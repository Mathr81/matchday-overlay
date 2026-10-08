import fs from 'node:fs';
import path from 'node:path';
import { reduce } from '../shared/reducer';
import type { Ack, Command, Config, DisplayState, JournalRecord, MatchEvent, MatchState, Snapshot } from '../shared/types';
import { Journal } from './journal';

type EventBody = MatchEvent extends infer E ? (E extends unknown ? Omit<E, 'id' | 'at'> : never) : never;

const defaultDisplay = (): DisplayState => ({ scoreVisible: true });

/** Tient l'état du match : applique les commandes, écrit le journal, prévient les abonnés. */
export class MatchStore {
  readonly skippedLines: number;
  private readonly journal: Journal;
  private readonly displayFile: string;
  private records: JournalRecord[];
  private seen = new Set<string>();
  private display: DisplayState;
  private rev = 0;
  private listeners = new Set<() => void>();

  constructor(
    dataDir: string,
    readonly config: Config,
    private readonly now: () => number = Date.now,
  ) {
    this.journal = new Journal(path.join(dataDir, 'match.jsonl'));
    const { records, skipped } = this.journal.load();
    this.records = records;
    this.skippedLines = skipped;
    for (const r of records) this.seen.add(r.id);

    this.displayFile = path.join(dataDir, 'display.json');
    this.display = fs.existsSync(this.displayFile)
      ? { ...defaultDisplay(), ...JSON.parse(fs.readFileSync(this.displayFile, 'utf8')) }
      : defaultDisplay();
  }

  get match(): MatchState {
    return reduce(this.records, this.config.format);
  }

  snapshot(): Snapshot {
    return { type: 'snapshot', rev: this.rev, serverNow: this.now(), config: this.config, match: this.match, display: this.display };
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  execute(cmd: Command): Ack {
    const ok: Ack = { type: 'ack', cid: cmd.cid, ok: true };
    const refuse = (reason: string): Ack => ({ type: 'ack', cid: cmd.cid, ok: false, reason });
    // Une commande déjà reçue (double appui, renvoi après coupure) n'est appliquée qu'une fois.
    if (this.seen.has(cmd.cid)) return ok;

    const { phase, period } = this.match.clock;
    const at = this.now();
    const record = (body: EventBody | { type: 'void'; target: string }) => {
      const full = { ...body, id: cmd.cid, at } as JournalRecord;
      this.journal.append(full);
      this.records.push(full);
      return this.changed(cmd.cid, ok);
    };

    switch (cmd.type) {
      case 'start_period':
        if (phase !== 'pre' && phase !== 'break') return refuse(phase === 'ended' ? 'Le match est terminé.' : 'Une période est déjà en cours.');
        return record({ type: 'period_started', period: period + 1 });
      case 'pause_clock':
        if (phase !== 'running') return refuse('Le chrono ne tourne pas.');
        return record({ type: 'clock_paused' });
      case 'resume_clock':
        if (phase !== 'paused') return refuse("Le chrono n'est pas en pause.");
        return record({ type: 'clock_resumed' });
      case 'end_period':
        if (phase !== 'running' && phase !== 'paused') return refuse('Aucune période en cours.');
        return record({ type: 'period_ended' });
      case 'goal':
        if (cmd.team !== 'home' && cmd.team !== 'away') return refuse('Équipe inconnue.');
        return record({ type: 'goal', team: cmd.team });
      case 'set_added_time':
        if (!Number.isInteger(cmd.minutes) || cmd.minutes < 0 || cmd.minutes > 30) return refuse('Durée invalide.');
        return record({ type: 'added_time', minutes: cmd.minutes });
      case 'void_event': {
        const target = this.records.find((r) => r.id === cmd.target && r.type !== 'void');
        const already = this.records.some((r) => r.type === 'void' && r.target === cmd.target);
        if (!target || already) return refuse('Événement introuvable.');
        return record({ type: 'void', target: cmd.target });
      }
      case 'set_score_visible':
        this.setDisplay({ ...this.display, scoreVisible: cmd.visible === true });
        return this.changed(cmd.cid, ok);
      case 'reset_match':
        this.journal.archive(at);
        this.records = [];
        this.seen.clear();
        this.setDisplay(defaultDisplay());
        return this.changed(cmd.cid, ok);
      default:
        return refuse('Commande inconnue.');
    }
  }

  private setDisplay(display: DisplayState) {
    this.display = display;
    const tmp = this.displayFile + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(display));
    fs.renameSync(tmp, this.displayFile);
  }

  private changed(cid: string, ack: Ack): Ack {
    this.seen.add(cid);
    this.rev++;
    for (const fn of this.listeners) fn();
    return ack;
  }
}

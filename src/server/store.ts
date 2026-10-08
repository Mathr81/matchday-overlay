import fs from 'node:fs';
import path from 'node:path';
import { reduce } from '../shared/reducer';
import type {
  Ack,
  Command,
  Config,
  Cue,
  DisplayState,
  JournalRecord,
  MatchEvent,
  MatchState,
  PlayerRef,
  Snapshot,
  TeamId,
  VoidRecord,
} from '../shared/types';
import { Journal } from './journal';

type Body<T> = T extends unknown ? Omit<T, 'id' | 'at'> : never;
type RecordBody = Body<MatchEvent> | Body<VoidRecord>;
type CueBody = Cue extends infer C ? (C extends unknown ? Omit<C, 'id' | 'minute'> : never) : never;

const defaultDisplay = (): DisplayState => ({ scoreVisible: true });
const other = (team: TeamId): TeamId => (team === 'home' ? 'away' : 'home');
const isTeam = (team: unknown): team is TeamId => team === 'home' || team === 'away';

/** Tient l'état du match : applique les commandes, écrit le journal, prévient les abonnés. */
export class MatchStore {
  readonly skippedLines: number;
  private journal: Journal;
  private readonly displayFile: string;
  private records: JournalRecord[];
  private seen = new Set<string>();
  private display: DisplayState;
  private simulation = false;
  private rev = 0;
  private listeners = new Set<(cue: Cue | null) => void>();

  constructor(
    private readonly dataDir: string,
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
    return {
      type: 'snapshot',
      rev: this.rev,
      serverNow: this.now(),
      config: this.config,
      match: this.match,
      display: this.display,
      simulation: this.simulation,
    };
  }

  /** `cue` est le signal d'animation produit par la commande, s'il y en a un. */
  subscribe(fn: (cue: Cue | null) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  execute(cmd: Command): Ack {
    const ok: Ack = { type: 'ack', cid: cmd.cid, ok: true };
    const refuse = (reason: string): Ack => ({ type: 'ack', cid: cmd.cid, ok: false, reason });
    // Une commande déjà reçue (double appui, renvoi après coupure) n'est appliquée qu'une fois.
    if (this.seen.has(cmd.cid)) return ok;

    const before = this.match;
    const { phase, period } = before.clock;
    const at = this.now();
    const record = (body: RecordBody, cue?: CueBody) => {
      const full = { ...body, id: cmd.cid, at } as JournalRecord;
      this.journal.append(full);
      this.records.push(full);
      if (!cue) return this.changed(cmd.cid, ok);
      const minute = this.match.timeline.find((t) => t.id === cmd.cid)?.minute ?? before.timeline.find((t) => t.id === (body as VoidRecord).target)?.minute ?? '';
      return this.changed(cmd.cid, ok, { ...cue, id: cmd.cid, minute } as Cue);
    };
    const player = (team: TeamId, id: string | undefined): PlayerRef | null => {
      const p = this.config.teams[team].players.find((x) => x.id === id);
      return p ? { number: p.number, name: p.name } : null;
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
      case 'set_clock': {
        if (phase !== 'running' && phase !== 'paused') return refuse('Aucune période en cours.');
        const elapsedMs = cmd.seconds * 1000 - before.clock.baseMs;
        if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return refuse('Heure invalide pour cette période.');
        return record({ type: 'clock_adjusted', elapsedMs });
      }
      case 'goal': {
        if (!isTeam(cmd.team)) return refuse('Équipe inconnue.');
        const kind = cmd.kind ?? 'normal';
        // Contre son camp : le buteur joue pour l'équipe adverse de celle qui marque le point.
        const scorerTeam = kind === 'own' ? other(cmd.team) : cmd.team;
        return record(
          { type: 'goal', team: cmd.team, kind, scorer: cmd.scorer, assist: cmd.assist },
          { type: 'goal', team: cmd.team, kind, scorer: player(scorerTeam, cmd.scorer), assist: player(cmd.team, cmd.assist) },
        );
      }
      case 'disallow_goal': {
        const goal = before.timeline.find((t) => t.id === cmd.target);
        if (goal?.type !== 'goal') return refuse('But introuvable.');
        const scorerTeam = goal.kind === 'own' ? other(goal.team) : goal.team;
        return record(
          { type: 'void', target: cmd.target, disallowed: true },
          { type: 'goal_disallowed', team: goal.team, scorer: player(scorerTeam, goal.scorer) },
        );
      }
      case 'card': {
        if (!isTeam(cmd.team)) return refuse('Équipe inconnue.');
        if (cmd.color !== 'yellow' && cmd.color !== 'red') return refuse('Carton inconnu.');
        const already = cmd.player ? before.cards[`${cmd.team}:${cmd.player}`] : undefined;
        if (already && (already.red || already.yellow >= 2)) return refuse('Ce joueur est déjà expulsé.');
        const color = cmd.color === 'yellow' && already?.yellow === 1 ? 'second_yellow' : cmd.color;
        return record(
          { type: 'card', team: cmd.team, color: cmd.color, player: cmd.player },
          { type: 'card', team: cmd.team, color, player: player(cmd.team, cmd.player) },
        );
      }
      case 'substitution':
        if (!isTeam(cmd.team)) return refuse('Équipe inconnue.');
        return record(
          { type: 'substitution', team: cmd.team, out: cmd.out, in: cmd.in },
          { type: 'substitution', team: cmd.team, out: player(cmd.team, cmd.out), in: player(cmd.team, cmd.in) },
        );
      case 'penalty':
        if (!isTeam(cmd.team)) return refuse('Équipe inconnue.');
        return record({ type: 'penalty_awarded', team: cmd.team }, { type: 'penalty', team: cmd.team });
      case 'penalty_missed':
        if (!isTeam(cmd.team)) return refuse('Équipe inconnue.');
        return record(
          { type: 'penalty_missed', team: cmd.team, player: cmd.player },
          { type: 'penalty_missed', team: cmd.team, player: player(cmd.team, cmd.player) },
        );
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
      case 'simulation':
        this.setSimulation(cmd.on === true);
        return this.changed(cmd.cid, ok);
      default:
        return refuse('Commande inconnue.');
    }
  }

  /** La simulation écrit dans son propre journal : le vrai match n'est jamais touché. */
  private setSimulation(on: boolean) {
    if (on === this.simulation) return;
    this.simulation = on;
    const file = path.join(this.dataDir, on ? 'simulation.jsonl' : 'match.jsonl');
    if (on) fs.rmSync(file, { force: true });
    this.journal = new Journal(file);
    this.records = this.journal.load().records;
    this.seen = new Set(this.records.map((r) => r.id));
  }

  private setDisplay(display: DisplayState) {
    this.display = display;
    const tmp = this.displayFile + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(display));
    fs.renameSync(tmp, this.displayFile);
  }

  private changed(cid: string, ack: Ack, cue: Cue | null = null): Ack {
    this.seen.add(cid);
    this.rev++;
    for (const fn of this.listeners) fn(cue);
    return ack;
  }
}

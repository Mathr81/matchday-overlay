import fs from 'node:fs';
import path from 'node:path';
import { nextSteps } from '../shared/format';
import { reduce } from '../shared/reducer';
import { STAT_KEYS } from '../shared/types';
import type {
  Ack,
  Command,
  Config,
  Cue,
  DisplayState,
  EditRecord,
  EventPatch,
  JournalRecord,
  MatchEvent,
  MatchState,
  PlayerRef,
  Snapshot,
  TeamId,
  TriggerEvent,
  VoidRecord,
} from '../shared/types';
import { Journal } from './journal';

type Body<T> = T extends unknown ? Omit<T, 'id' | 'at'> : never;
type RecordBody = Body<MatchEvent> | Body<VoidRecord> | Body<EditRecord>;
type CueBody = Cue extends infer C ? (C extends unknown ? Omit<C, 'id' | 'minute'> : never) : never;

const defaultDisplay = (): DisplayState => ({ scoreVisible: true, panel: null, banner: null });
const PANEL_TYPES = ['prematch', 'lineup', 'summary', 'stats', 'shootout', 'holding'];
const text = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
const other = (team: TeamId): TeamId => (team === 'home' ? 'away' : 'home');
const isTeam = (team: unknown): team is TeamId => team === 'home' || team === 'away';
const PATCH_KEYS: (keyof EventPatch)[] = ['team', 'kind', 'color', 'scorer', 'assist', 'player', 'in', 'out', 'minute'];

/** Événements de match produits par une commande acceptée. */
function triggerEvents(cmd: Command, cue: Cue | null): TriggerEvent[] {
  if (cmd.type === 'start_period') return ['period_start'];
  if (cmd.type === 'end_period') return ['period_end'];
  if (cmd.type === 'start_shootout') return ['shootout_start'];
  if (!cue) return [];
  switch (cue.type) {
    case 'goal':
      return ['goal', cue.team === 'home' ? 'goal_home' : 'goal_away'];
    case 'card':
      return [cue.color === 'yellow' ? 'card_yellow' : 'card_red'];
    case 'penalty_missed':
      return [];
    default:
      return [cue.type];
  }
}

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
  private triggerListeners = new Set<(events: TriggerEvent[]) => void>();
  private lastCue: Cue | null = null;

  constructor(
    private readonly dataDir: string,
    public config: Config,
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

  /** Remplace la configuration (page d'admin) : l'état est recalculé avec, et tous les écrans sont prévenus. */
  setConfig(config: Config) {
    this.config = config;
    this.rev++;
    for (const fn of this.listeners) fn(null);
  }

  /** `cue` est le signal d'animation produit par la commande, s'il y en a un. */
  subscribe(fn: (cue: Cue | null) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Événements de match, pour les automatismes (vMix). Rien n'est signalé pendant une simulation. */
  onTrigger(fn: (events: TriggerEvent[]) => void): () => void {
    this.triggerListeners.add(fn);
    return () => this.triggerListeners.delete(fn);
  }

  execute(cmd: Command): Ack {
    const fresh = !this.seen.has(cmd.cid);
    const phaseBefore = this.match.clock.phase;
    this.lastCue = null;
    const ack = this.run(cmd);
    if (ack.ok && fresh && !this.simulation) {
      const events = triggerEvents(cmd, this.lastCue);
      if (phaseBefore !== 'ended' && this.match.clock.phase === 'ended') events.push('match_end');
      if (events.length) for (const fn of this.triggerListeners) fn(events);
    }
    return ack;
  }

  private run(cmd: Command): Ack {
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
        if (phase === 'running' || phase === 'paused') return refuse('Une période est déjà en cours.');
        if (!nextSteps(before, this.config.format).period) return refuse(phase === 'ended' ? 'Le match est terminé.' : 'Pas de période suivante prévue.');
        return record({ type: 'period_started', period: period + 1 });
      case 'end_match':
        if (phase !== 'break') return refuse('Le match ne peut pas être terminé maintenant.');
        return record({ type: 'match_ended' });
      case 'start_shootout':
        if (!isTeam(cmd.first)) return refuse('Équipe inconnue.');
        if (!nextSteps(before, this.config.format).shootout) return refuse('Pas de tirs au but possibles maintenant.');
        // Le panneau de la séance s'affiche tout seul.
        this.setDisplay({ ...this.display, panel: { type: 'shootout' } });
        return record({ type: 'shootout_started', first: cmd.first });
      case 'shootout_kick':
        if (!isTeam(cmd.team)) return refuse('Équipe inconnue.');
        if (phase !== 'shootout' || !before.shootout) return refuse('La séance de tirs au but est terminée ou pas commencée.');
        return record({ type: 'shootout_kick', team: cmd.team, scored: cmd.scored === true, player: cmd.player });
      case 'announce_winner': {
        const pens = before.shootout?.winner ? before.shootout.score : null;
        const winner = before.shootout?.winner ?? (before.score.home > before.score.away ? 'home' : before.score.away > before.score.home ? 'away' : null);
        if (phase !== 'ended' || !winner) return refuse("Il n'y a pas encore de vainqueur.");
        // Le panneau de la séance laisse la place à l'annonce.
        if (this.display.panel?.type === 'shootout') this.setDisplay({ ...this.display, panel: null });
        return this.changed(cmd.cid, ok, { type: 'winner', id: cmd.cid, team: winner, minute: '', score: before.score, shootout: pens });
      }
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
          cmd.silent ? undefined : { type: 'goal', team: cmd.team, kind, scorer: player(scorerTeam, cmd.scorer), assist: player(cmd.team, cmd.assist) },
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
      case 'edit_event': {
        if (!before.timeline.some((t) => t.id === cmd.target)) return refuse('Événement introuvable.');
        const patch: EventPatch = {};
        for (const key of PATCH_KEYS) if (cmd.patch && key in cmd.patch) (patch as Record<string, unknown>)[key] = cmd.patch[key];
        if (patch.team !== undefined && !isTeam(patch.team)) return refuse('Équipe inconnue.');
        if (Object.keys(patch).length === 0) return refuse('Rien à modifier.');
        return record({ type: 'edit', target: cmd.target, patch });
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
        const target = this.records.find((r) => r.id === cmd.target && r.type !== 'void' && r.type !== 'edit');
        const already = this.records.some((r) => r.type === 'void' && r.target === cmd.target);
        if (!target || already) return refuse('Événement introuvable.');
        return record({ type: 'void', target: cmd.target });
      }
      case 'stat':
        if (!isTeam(cmd.team) || !STAT_KEYS.includes(cmd.key) || (cmd.delta !== 1 && cmd.delta !== -1)) return refuse('Stat inconnue.');
        if (cmd.delta === -1 && before.stats[cmd.team][cmd.key] === 0) return refuse('Déjà à zéro.');
        return record({ type: 'stat', team: cmd.team, key: cmd.key, delta: cmd.delta });
      case 'set_panel':
        if (cmd.panel !== null && !PANEL_TYPES.includes(cmd.panel?.type)) return refuse('Panneau inconnu.');
        if (cmd.panel?.type === 'lineup' && !isTeam(cmd.panel.team)) return refuse('Équipe inconnue.');
        this.setDisplay({ ...this.display, panel: cmd.panel });
        return this.changed(cmd.cid, ok);
      case 'set_banner': {
        const title = text(cmd.banner?.title, 80);
        if (cmd.banner !== null && !title) return refuse('Il faut un titre.');
        const banner = cmd.banner && { title, subtitle: text(cmd.banner.subtitle, 120) || undefined, qr: text(cmd.banner.qr, 300) || undefined };
        this.setDisplay({ ...this.display, banner });
        return this.changed(cmd.cid, ok);
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
    this.lastCue = cue;
    for (const fn of this.listeners) fn(cue);
    return ack;
  }
}

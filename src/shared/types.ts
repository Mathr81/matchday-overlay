export type TeamId = 'home' | 'away';

export interface Player {
  id: string;
  number: number;
  name: string;
  starter: boolean;
}

export interface TeamConfig {
  name: string;
  code: string;
  color: string;
  logo: string;
  /** Logo sombre : les thèmes le posent sur une pastille claire. */
  logoOnLight: boolean;
  players: Player[];
}

export interface MatchFormat {
  periodMinutes: number;
  periods: number;
  /** Deux périodes de plus en cas d'égalité à la fin du temps réglementaire. */
  extraTime: { enabled: boolean; periodMinutes: number };
  /** Séance de tirs au but en cas d'égalité ; `kicks` tirs par équipe avant la mort subite. */
  shootout: { enabled: boolean; kicks: number };
}

/** Bandeau libre : commentateurs, message du BDT, sponsor… `qr` est un lien affiché en QR code. */
export interface Banner {
  title: string;
  subtitle?: string;
  qr?: string;
}

export interface Config {
  teams: Record<TeamId, TeamConfig>;
  format: MatchFormat;
  theme: 'tigre';
  texts: {
    /** Nom de l'événement, repris sur les panneaux. */
    title: string;
    subtitle: string;
    /** Message de l'écran d'attente. */
    holding: string;
  };
  /** Bandeaux enregistrés, proposés d'un appui dans le contrôle. */
  banners: Banner[];
}

// ---- journal ----

interface Stamped {
  id: string;
  /** Heure du serveur, en ms. */
  at: number;
  /** Minute corrigée à la main ; sinon elle est calculée d'après le chrono. */
  minute?: string;
}

export type MatchEvent = Stamped &
  (
    | { type: 'period_started'; period: number }
    | { type: 'clock_paused' }
    | { type: 'clock_resumed' }
    | { type: 'period_ended' }
    | { type: 'clock_adjusted'; elapsedMs: number }
    /** `team` est l'équipe qui marque le point ; pour un csc le buteur est dans l'autre équipe. */
    | { type: 'goal'; team: TeamId; kind: GoalKind; scorer?: string; assist?: string }
    | { type: 'card'; team: TeamId; color: 'yellow' | 'red'; player?: string }
    | { type: 'substitution'; team: TeamId; out?: string; in?: string }
    | { type: 'penalty_awarded'; team: TeamId }
    | { type: 'penalty_missed'; team: TeamId; player?: string }
    | { type: 'stat'; team: TeamId; key: StatKey; delta: 1 | -1 }
    | { type: 'added_time'; minutes: number }
    | { type: 'match_ended' }
    | { type: 'shootout_started'; first: TeamId }
    | { type: 'shootout_kick'; team: TeamId; scored: boolean; player?: string }
  );

export const STAT_KEYS = ['shots', 'onTarget', 'corners', 'fouls', 'offsides'] as const;
export type StatKey = (typeof STAT_KEYS)[number];

export type GoalKind = 'normal' | 'own' | 'penalty';

/** Annule un événement. `disallowed` : but refusé, annoncé à l'antenne. */
export type VoidRecord = Stamped & { type: 'void'; target: string; disallowed?: boolean };

/** Champs d'un fait de match qu'on peut corriger après coup. */
export interface EventPatch {
  team?: TeamId;
  kind?: GoalKind;
  color?: 'yellow' | 'red';
  scorer?: string | null;
  assist?: string | null;
  player?: string | null;
  in?: string | null;
  out?: string | null;
  minute?: string;
}

export type EditRecord = Stamped & { type: 'edit'; target: string; patch: EventPatch };

export type JournalRecord = MatchEvent | VoidRecord | EditRecord;

// ---- état dérivé ----

export type ClockPhase = 'pre' | 'running' | 'paused' | 'break' | 'shootout' | 'ended';

export interface ShootoutKick {
  id: string;
  team: TeamId;
  scored: boolean;
  player?: string;
}

export interface ShootoutState {
  first: TeamId;
  kicks: ShootoutKick[];
  taken: Record<TeamId, number>;
  score: Record<TeamId, number>;
  winner: TeamId | null;
  suddenDeath: boolean;
  /** Équipe qui doit tirer, null quand c'est fini. */
  next: TeamId | null;
  /** Nombre de cases à afficher par équipe. */
  rounds: number;
}

export interface ClockState {
  /** 0 avant le coup d'envoi. */
  period: number;
  phase: ClockPhase;
  /** Temps de jeu au début de la période (0, 45 min…). */
  baseMs: number;
  /** Temps écoulé dans la période au dernier changement. */
  elapsedMs: number;
  /** Heure du serveur depuis laquelle le chrono tourne, sinon null. */
  anchorAt: number | null;
  addedMinutes: number | null;
}

export type TimelineItem = Exclude<Extract<MatchEvent, { team: TeamId }>, { type: 'stat' | 'shootout_kick' }> & { minute: string };

export interface MatchState {
  score: Record<TeamId, number>;
  clock: ClockState;
  lastGoalId: string | null;
  /** Faits de match non annulés, dans l'ordre, avec leur minute. */
  timeline: TimelineItem[];
  /** Clé « équipe:joueur ». */
  cards: Record<string, { yellow: number; red: boolean }>;
  /** Compteurs saisis à la main. */
  stats: Record<TeamId, Record<StatKey, number>>;
  shootout: ShootoutState | null;
}

/** Panneau affiché tant qu'on ne le retire pas. Tous couvrent l'écran sauf les stats. */
export type Panel =
  | { type: 'prematch'; /** Heure du serveur du coup d'envoi, pour le compte à rebours. */ kickoffAt?: number }
  | { type: 'lineup'; team: TeamId }
  | { type: 'summary'; motm?: { team: TeamId; player: string } }
  | { type: 'stats' }
  | { type: 'shootout' }
  | { type: 'holding' };

export interface DisplayState {
  scoreVisible: boolean;
  panel: Panel | null;
  banner: Banner | null;
}

// ---- protocole ----

export type CommandBody =
  | { type: 'start_period' }
  | { type: 'pause_clock' }
  | { type: 'resume_clock' }
  | { type: 'end_period' }
  | { type: 'set_clock'; seconds: number }
  /** `silent` : correction du score, sans animation à l'antenne. */
  | { type: 'goal'; team: TeamId; kind?: GoalKind; scorer?: string; assist?: string; silent?: boolean }
  | { type: 'disallow_goal'; target: string }
  | { type: 'edit_event'; target: string; patch: EventPatch }
  | { type: 'card'; team: TeamId; color: 'yellow' | 'red'; player?: string }
  | { type: 'substitution'; team: TeamId; out?: string; in?: string }
  | { type: 'penalty'; team: TeamId }
  | { type: 'penalty_missed'; team: TeamId; player?: string }
  | { type: 'set_added_time'; minutes: number }
  | { type: 'void_event'; target: string }
  | { type: 'simulation'; on: boolean }
  | { type: 'stat'; team: TeamId; key: StatKey; delta: 1 | -1 }
  | { type: 'end_match' }
  | { type: 'start_shootout'; first: TeamId }
  | { type: 'shootout_kick'; team: TeamId; scored: boolean; player?: string }
  | { type: 'announce_winner' }
  | { type: 'set_panel'; panel: Panel | null }
  | { type: 'set_banner'; banner: Banner | null }
  | { type: 'set_score_visible'; visible: boolean }
  | { type: 'reset_match' };

export type Command = CommandBody & { cid: string };

export interface Snapshot {
  type: 'snapshot';
  rev: number;
  serverNow: number;
  config: Config;
  match: MatchState;
  display: DisplayState;
  /** Vrai quand on joue un match de simulation, à part du vrai match. */
  simulation: boolean;
}

export interface PlayerRef {
  number: number;
  name: string;
}

/** Signal d'animation : joué une fois par les overlays connectés, jamais rejoué après coup. */
export type Cue = { id: string; team: TeamId; minute: string } & (
  | { type: 'goal'; kind: GoalKind; scorer: PlayerRef | null; assist: PlayerRef | null }
  | { type: 'goal_disallowed'; scorer: PlayerRef | null }
  | { type: 'penalty' }
  | { type: 'penalty_missed'; player: PlayerRef | null }
  | { type: 'card'; color: 'yellow' | 'red' | 'second_yellow'; player: PlayerRef | null }
  | { type: 'substitution'; in: PlayerRef | null; out: PlayerRef | null }
  | { type: 'winner'; score: Record<TeamId, number>; shootout: Record<TeamId, number> | null }
);

export interface CueMessage {
  type: 'cue';
  cue: Cue;
}

export interface Ack {
  type: 'ack';
  cid: string;
  ok: boolean;
  reason?: string;
}

export type ServerMessage = Snapshot | Ack | CueMessage;
export type ClientMessage = { type: 'command'; command: Command };
export type Role = 'overlay' | 'control';

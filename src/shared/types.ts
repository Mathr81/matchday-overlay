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
}

export interface Config {
  teams: Record<TeamId, TeamConfig>;
  format: MatchFormat;
  theme: 'tigre';
}

// ---- journal ----

interface Stamped {
  id: string;
  /** Heure du serveur, en ms. */
  at: number;
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
    | { type: 'added_time'; minutes: number }
  );

export type GoalKind = 'normal' | 'own' | 'penalty';

/** Annule un événement. `disallowed` : but refusé, annoncé à l'antenne. */
export type VoidRecord = Stamped & { type: 'void'; target: string; disallowed?: boolean };

export type JournalRecord = MatchEvent | VoidRecord;

// ---- état dérivé ----

export type ClockPhase = 'pre' | 'running' | 'paused' | 'break' | 'ended';

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

export type TimelineItem = Extract<MatchEvent, { team: TeamId }> & { minute: string };

export interface MatchState {
  score: Record<TeamId, number>;
  clock: ClockState;
  lastGoalId: string | null;
  /** Faits de match non annulés, dans l'ordre, avec leur minute. */
  timeline: TimelineItem[];
  /** Clé « équipe:joueur ». */
  cards: Record<string, { yellow: number; red: boolean }>;
}

export interface DisplayState {
  scoreVisible: boolean;
}

// ---- protocole ----

export type CommandBody =
  | { type: 'start_period' }
  | { type: 'pause_clock' }
  | { type: 'resume_clock' }
  | { type: 'end_period' }
  | { type: 'set_clock'; seconds: number }
  | { type: 'goal'; team: TeamId; kind?: GoalKind; scorer?: string; assist?: string }
  | { type: 'disallow_goal'; target: string }
  | { type: 'card'; team: TeamId; color: 'yellow' | 'red'; player?: string }
  | { type: 'substitution'; team: TeamId; out?: string; in?: string }
  | { type: 'penalty'; team: TeamId }
  | { type: 'penalty_missed'; team: TeamId; player?: string }
  | { type: 'set_added_time'; minutes: number }
  | { type: 'void_event'; target: string }
  | { type: 'simulation'; on: boolean }
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

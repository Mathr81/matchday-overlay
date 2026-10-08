export type TeamId = 'home' | 'away';

export interface TeamConfig {
  name: string;
  code: string;
  color: string;
  logo: string;
  /** Logo sombre : les thèmes le posent sur une pastille claire. */
  logoOnLight: boolean;
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
    | { type: 'goal'; team: TeamId }
    | { type: 'added_time'; minutes: number }
  );

export type VoidRecord = Stamped & { type: 'void'; target: string };

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

export interface MatchState {
  score: Record<TeamId, number>;
  clock: ClockState;
  lastGoalId: string | null;
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
  | { type: 'goal'; team: TeamId }
  | { type: 'set_added_time'; minutes: number }
  | { type: 'void_event'; target: string }
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
}

export interface Ack {
  type: 'ack';
  cid: string;
  ok: boolean;
  reason?: string;
}

export type ServerMessage = Snapshot | Ack;
export type ClientMessage = { type: 'command'; command: Command };
export type Role = 'overlay' | 'control';

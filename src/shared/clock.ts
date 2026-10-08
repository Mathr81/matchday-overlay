import type { ClockState, MatchFormat } from './types';

export function elapsedInPeriod(clock: ClockState, now: number): number {
  return clock.elapsedMs + (clock.anchorAt === null ? 0 : Math.max(0, now - clock.anchorAt));
}

function mmss(ms: number, padMinutes: boolean): string {
  const s = Math.floor(ms / 1000);
  const m = String(Math.floor(s / 60));
  return `${padMinutes ? m.padStart(2, '0') : m}:${String(s % 60).padStart(2, '0')}`;
}

/** « 67:24 » dans le temps réglementaire, « 45+2:13 » au-delà. */
export function formatClock(clock: ClockState, format: MatchFormat, now: number): string {
  const length = format.periodMinutes * 60_000;
  const within = elapsedInPeriod(clock, now);
  if (within < length) return mmss(clock.baseMs + within, true);
  return `${(clock.baseMs + length) / 60_000}+${mmss(within - length, false)}`;
}

export function periodLabel(clock: ClockState, format: MatchFormat): string {
  if (clock.phase === 'pre') return 'Avant-match';
  if (clock.phase === 'ended') return 'Terminé';
  if (clock.phase === 'break') return format.periods === 2 ? 'Mi-temps' : 'Pause';
  if (format.periods === 2) return clock.period === 1 ? '1re mi-temps' : '2e mi-temps';
  return `Période ${clock.period}`;
}

/** Minute de jeu d'un événement : « 67' », ou « 45+2' » dans le temps additionnel. */
export function minuteLabel(clock: ClockState, format: MatchFormat, at: number): string {
  const length = format.periodMinutes * 60_000;
  const within = elapsedInPeriod(clock, at);
  if (within < length) return `${Math.floor((clock.baseMs + within) / 60_000) + 1}'`;
  return `${(clock.baseMs + length) / 60_000}+${Math.floor((within - length) / 60_000) + 1}'`;
}

/** Un joueur est expulsé après un rouge ou deux jaunes. */
export function isSentOff(card: { yellow: number; red: boolean } | undefined): boolean {
  return !!card && (card.red || card.yellow >= 2);
}

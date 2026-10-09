import type { MatchFormat, MatchState } from './types';

/** Nombre total de périodes possibles, prolongations comprises. */
export const maxPeriods = (format: MatchFormat) => format.periods + (format.extraTime.enabled ? 2 : 0);

/** Durée d'une période en ms : les prolongations ont leur propre durée. */
export const periodLength = (format: MatchFormat, period: number) =>
  (period > format.periods ? format.extraTime.periodMinutes : format.periodMinutes) * 60_000;

/** Temps de jeu au début d'une période. */
export function periodBase(format: MatchFormat, period: number): number {
  let base = 0;
  for (let p = 1; p < period; p++) base += periodLength(format, p);
  return base;
}

/** Ce qui reste possible une fois une période terminée sur un score donné. */
export function afterPeriod(format: MatchFormat, period: number, draw: boolean): { period: boolean; shootout: boolean } {
  const regulationOver = period >= format.periods;
  return {
    // Les prolongations se jouent en entier ; elles ne commencent que sur une égalité.
    period: period < format.periods || (period < maxPeriods(format) && (period > format.periods || draw)),
    shootout: regulationOver && draw && format.shootout.enabled && (period === format.periods || period === maxPeriods(format)),
  };
}

/** Suites proposées à l'opérateur selon l'état du match. */
export function nextSteps(match: MatchState, format: MatchFormat): { period: boolean; shootout: boolean; end: boolean } {
  const { phase, period } = match.clock;
  if (phase === 'pre') return { period: true, shootout: false, end: false };
  if (phase !== 'break') return { period: false, shootout: false, end: false };
  const options = afterPeriod(format, period, match.score.home === match.score.away);
  return { ...options, end: period >= format.periods };
}

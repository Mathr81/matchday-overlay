import type { ShootoutKick, ShootoutState, TeamId } from './types';

const other = (team: TeamId): TeamId => (team === 'home' ? 'away' : 'home');

/**
 * État d'une séance de tirs au but d'après les tirs déjà tentés.
 * `series` est le nombre de tirs par équipe avant la mort subite (cinq en général).
 */
export function shootoutState(first: TeamId, kicks: ShootoutKick[], series: number): ShootoutState {
  const taken = { home: 0, away: 0 };
  const score = { home: 0, away: 0 };
  for (const k of kicks) {
    taken[k.team]++;
    if (k.scored) score[k.team]++;
  }

  let winner: TeamId | null = null;
  if (taken.home <= series && taken.away <= series) {
    // Pendant la série : c'est fini dès qu'une équipe ne peut plus être rattrapée.
    for (const team of ['home', 'away'] as const) {
      if (score[team] > score[other(team)] + (series - taken[other(team)])) winner = team;
    }
  } else if (taken.home === taken.away && score.home !== score.away) {
    // Mort subite : un tir de chaque côté suffit à départager.
    winner = score.home > score.away ? 'home' : 'away';
  }

  const suddenDeath = !winner ? taken.home >= series && taken.away >= series : Math.max(taken.home, taken.away) > series;
  const second = other(first);
  const next = winner ? null : taken[first] <= taken[second] ? first : second;
  // Nombre de cases à montrer : la série, puis une de plus à chaque tour de mort subite.
  const rounds = Math.max(series, taken.home, taken.away, suddenDeath && !winner ? Math.min(taken.home, taken.away) + 1 : 0);
  return { first, kicks, taken, score, winner, suddenDeath, next, rounds };
}

import type { Config, MatchState, Player, TeamId } from './types';

/** Joueurs sur le terrain et sur le banc, d'après les titulaires et les remplacements déjà faits. */
export function lineup(config: Config, match: MatchState, team: TeamId): { pitch: Player[]; bench: Player[] } {
  const players = config.teams[team].players;
  const on = new Set(players.filter((p) => p.starter).map((p) => p.id));
  for (const item of match.timeline) {
    if (item.type !== 'substitution' || item.team !== team) continue;
    if (item.out) on.delete(item.out);
    if (item.in) on.add(item.in);
  }
  return { pitch: players.filter((p) => on.has(p.id)), bench: players.filter((p) => !on.has(p.id)) };
}

export function playerName(config: Config, id: string | undefined): string {
  for (const team of Object.values(config.teams)) {
    const p = team.players.find((x) => x.id === id);
    if (p) return `${p.number} ${p.name}`;
  }
  return '';
}

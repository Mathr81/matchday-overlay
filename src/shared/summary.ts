import type { Config, MatchState, StatKey, TeamId } from './types';

const other = (team: TeamId): TeamId => (team === 'home' ? 'away' : 'home');

const STAT_LABELS: Record<StatKey, string> = {
  shots: 'Tirs',
  onTarget: 'Tirs cadrés',
  corners: 'Corners',
  fouls: 'Fautes',
  offsides: 'Hors-jeu',
};

export const statLabel = (key: StatKey) => STAT_LABELS[key];

export interface StatRow {
  label: string;
  home: number;
  away: number;
}

/** Lignes de stats : compteurs saisis, plus les cartons comptés d'après le journal. */
export function statRows(match: MatchState): StatRow[] {
  const cards = (team: TeamId, color: 'yellow' | 'red') => match.timeline.filter((t) => t.type === 'card' && t.team === team && t.color === color).length;
  // Un deuxième jaune vaut aussi une expulsion.
  const sentOff = (team: TeamId) =>
    cards(team, 'red') + Object.entries(match.cards).filter(([key, c]) => key.startsWith(team + ':') && !c.red && c.yellow >= 2).length;
  const rows: StatRow[] = (Object.keys(STAT_LABELS) as StatKey[]).map((key) => ({ label: STAT_LABELS[key], home: match.stats.home[key], away: match.stats.away[key] }));
  rows.push({ label: 'Cartons jaunes', home: cards('home', 'yellow'), away: cards('away', 'yellow') });
  rows.push({ label: 'Expulsions', home: sentOff('home'), away: sentOff('away') });
  return rows;
}

export interface ScorerLine {
  name: string;
  minute: string;
  note: string;
}

/** Buteurs d'une équipe, dans l'ordre. Un csc est marqué par un joueur adverse. */
export function scorers(config: Config, match: MatchState, team: TeamId): ScorerLine[] {
  const lines: ScorerLine[] = [];
  for (const t of match.timeline) {
    if (t.type !== 'goal' || t.team !== team) continue;
    const from = t.kind === 'own' ? other(team) : team;
    const player = config.teams[from].players.find((p) => p.id === t.scorer);
    lines.push({ name: player?.name ?? 'But', minute: t.minute, note: t.kind === 'own' ? 'csc' : t.kind === 'penalty' ? 'pen.' : '' });
  }
  return lines;
}

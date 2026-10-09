import { reduce } from '../shared/reducer';
import type { Banner, Config, Cue, DisplayState, JournalRecord, MatchState, Panel, PlayerRef, TeamId } from '../shared/types';

/** Une scène de la galerie : un état de match inventé, ce qui est affiché, et le signal à jouer s'il y en a un. */
export interface Scene {
  match: MatchState;
  display: DisplayState;
  cue?: Cue;
}

export const SCENES = {
  Score: { score: 'Score', added: 'Temps additionnel', hidden: 'Score masqué' },
  Moments: {
    goal: 'But',
    'goal-penalty': 'But sur penalty',
    'goal-own': 'But contre son camp',
    disallowed: 'But refusé',
    penalty: 'Penalty',
    'penalty-missed': 'Penalty raté',
    yellow: 'Carton jaune',
    red: 'Carton rouge',
    'second-yellow': 'Deuxième jaune',
    substitution: 'Remplacement',
    winner: 'Vainqueur',
    'winner-shootout': 'Vainqueur aux tirs au but',
  },
  Panneaux: {
    prematch: 'Avant-match',
    'lineup-home': 'Composition 1',
    'lineup-away': 'Composition 2',
    halftime: 'Mi-temps',
    fulltime: 'Fin du match',
    stats: 'Statistiques',
    shootout: 'Tirs au but',
    sudden: 'Mort subite',
    holding: "Écran d'attente",
  },
  Bandeaux: { banner: 'Bandeau', 'banner-qr': 'Bandeau avec QR code' },
} as const;

export type SceneId = { [G in keyof typeof SCENES]: keyof (typeof SCENES)[G] }[keyof typeof SCENES];

const MIN = 60_000;

export function buildScene(id: SceneId, config: Config): Scene {
  const now = Date.now();
  let n = 0;
  const records: JournalRecord[] = [];
  const add = (at: number, event: object) => records.push({ id: `g${++n}`, at, ...event } as JournalRecord);
  const id_ = (team: TeamId, i: number) => config.teams[team].players[i]?.id;
  const ref = (team: TeamId, i: number): PlayerRef | null => {
    const p = config.teams[team].players[i];
    return p ? { number: p.number, name: p.name } : null;
  };

  // Match de base : 2–1 à la 63e, avec un carton et quelques stats.
  const start = now - 80 * MIN;
  const second = now - 18 * MIN;
  add(start, { type: 'period_started', period: 1 });
  add(start + 12 * MIN, { type: 'goal', team: 'home', kind: 'normal', scorer: id_('home', 8), assist: id_('home', 6) });
  add(start + 20 * MIN, { type: 'card', team: 'away', color: 'yellow', player: id_('away', 3) });
  add(start + 31 * MIN, { type: 'goal', team: 'away', kind: 'penalty', scorer: id_('away', 8) });
  const stats: [TeamId, string, number][] = [['home', 'shots', 9], ['away', 'shots', 6], ['home', 'onTarget', 5], ['away', 'onTarget', 2], ['home', 'corners', 4], ['away', 'corners', 3], ['home', 'fouls', 5], ['away', 'fouls', 8], ['away', 'offsides', 2]];
  for (const [team, key, count] of stats) for (let i = 0; i < count; i++) add(start + 30 * MIN, { type: 'stat', team, key, delta: 1 });
  add(start + 46 * MIN, { type: 'period_ended' });

  const late = id === 'fulltime' || id === 'winner' || id === 'winner-shootout' || id === 'shootout' || id === 'sudden';
  const tied = id === 'winner-shootout' || id === 'shootout' || id === 'sudden';
  if (id !== 'halftime' && id !== 'prematch') {
    add(late ? now - 60 * MIN : second, { type: 'period_started', period: 2 });
    if (!tied) add((late ? now - 60 * MIN : second) + 12 * MIN, { type: 'goal', team: 'home', kind: 'normal', scorer: id_('home', 9) });
    if (id === 'added') add(now, { type: 'added_time', minutes: 3 });
    if (late) {
      add(now - 12 * MIN, { type: 'period_ended' });
      if (tied) {
        add(now - 5 * MIN, { type: 'shootout_started', first: 'home' });
        const series = id === 'shootout' ? [true, true, true, false, true] : id === 'sudden' ? [true, true, true, false, true, true, true, false, true, true, true, true] : [true, true, true, false, true, true, true, false, true, true, true, false];
        series.forEach((scored, i) => add(now - 4 * MIN + i * 1000, { type: 'shootout_kick', team: i % 2 ? 'away' : 'home', scored }));
      }
      if (!tied || id === 'winner-shootout') add(now - MIN, { type: 'match_ended' });
    }
  }

  const match = id === 'prematch' ? reduce([], config.format) : reduce(records, config.format);
  const panels: Partial<Record<SceneId, Panel>> = {
    prematch: { type: 'prematch', kickoffAt: now + 5 * MIN + 12_000 },
    'lineup-home': { type: 'lineup', team: 'home' },
    'lineup-away': { type: 'lineup', team: 'away' },
    halftime: { type: 'summary' },
    fulltime: { type: 'summary', motm: id_('home', 8) ? { team: 'home', player: id_('home', 8)! } : undefined },
    stats: { type: 'stats' },
    shootout: { type: 'shootout' },
    sudden: { type: 'shootout' },
    holding: { type: 'holding' },
  };
  const banners: Partial<Record<SceneId, Banner>> = {
    banner: config.banners.find((b) => !b.qr) ?? { title: 'Aux commentaires', subtitle: 'Prénom Nom et Prénom Nom' },
    'banner-qr': config.banners.find((b) => b.qr) ?? { title: 'Soutenez le BDT', subtitle: 'Scannez pour participer', qr: 'https://example.org' },
  };

  const base = { id: `cue${now}`, minute: "63'" };
  const cues: Partial<Record<SceneId, Cue>> = {
    goal: { ...base, team: 'home', type: 'goal', kind: 'normal', scorer: ref('home', 9), assist: ref('home', 6) },
    'goal-penalty': { ...base, team: 'away', type: 'goal', kind: 'penalty', scorer: ref('away', 8), assist: null },
    'goal-own': { ...base, team: 'home', type: 'goal', kind: 'own', scorer: ref('away', 2), assist: null },
    disallowed: { ...base, team: 'home', type: 'goal_disallowed', scorer: ref('home', 9) },
    penalty: { ...base, team: 'away', type: 'penalty' },
    'penalty-missed': { ...base, team: 'away', type: 'penalty_missed', player: ref('away', 8) },
    yellow: { ...base, team: 'home', type: 'card', color: 'yellow', player: ref('home', 4) },
    red: { ...base, team: 'away', type: 'card', color: 'red', player: ref('away', 5) },
    'second-yellow': { ...base, team: 'away', type: 'card', color: 'second_yellow', player: ref('away', 3) },
    substitution: { ...base, team: 'home', type: 'substitution', in: ref('home', 12), out: ref('home', 7) },
    winner: { ...base, team: 'home', type: 'winner', score: match.score, shootout: null },
    'winner-shootout': { ...base, team: 'home', type: 'winner', score: match.score, shootout: match.shootout?.score ?? null },
  };

  return {
    match,
    display: { scoreVisible: id !== 'hidden', panel: panels[id] ?? null, banner: banners[id] ?? null },
    cue: cues[id],
  };
}

import type { CommandBody } from '../shared/types';

export interface Step {
  chapter: string;
  /** Minute de jeu à laquelle le chrono est placé avant l'action, « mm:ss ». */
  clock?: string;
  command: CommandBody;
  /** Secondes d'attente après l'action, à vitesse normale. */
  wait: number;
  /** Pour l'avant-match : compte à rebours de tant de secondes à partir de maintenant. */
  countdown?: number;
}

const stat = (team: 'home' | 'away', key: 'shots' | 'onTarget' | 'corners' | 'fouls' | 'offsides'): Step => ({
  chapter: '',
  command: { type: 'stat', team, key, delta: 1 },
  wait: 0,
});
/** Quelques compteurs d'un coup, sans attendre, rattachés au chapitre en cours. */
const stats = (chapter: string, ...steps: Step[]): Step[] => steps.map((s) => ({ ...s, chapter }));

/** Match complet joué par la simulation. Les identifiants de joueurs sont ceux de l'effectif d'exemple. */
export const script: Step[] = [
  { chapter: 'Avant-match', command: { type: 'set_panel', panel: { type: 'prematch' } }, countdown: 12, wait: 7 },
  { chapter: 'Compositions', command: { type: 'set_panel', panel: { type: 'lineup', team: 'home' } }, wait: 6 },
  { chapter: 'Compositions', command: { type: 'set_panel', panel: { type: 'lineup', team: 'away' } }, wait: 6 },
  { chapter: "Coup d'envoi", command: { type: 'set_panel', panel: null }, wait: 1 },
  { chapter: "Coup d'envoi", command: { type: 'start_period' }, wait: 4 },
  { chapter: "Coup d'envoi", command: { type: 'set_banner', banner: { title: 'Aux commentaires', subtitle: 'Prénom Nom et Prénom Nom' } }, wait: 5 },
  ...stats("Coup d'envoi", stat('home', 'shots'), stat('home', 'onTarget'), stat('home', 'corners'), stat('away', 'fouls')),
  { chapter: 'But des élèves', clock: '11:40', command: { type: 'goal', team: 'home', scorer: 'h9', assist: 'h10' }, wait: 9 },
  { chapter: 'Carton jaune', clock: '22:15', command: { type: 'card', team: 'away', color: 'yellow', player: 'a4' }, wait: 6 },
  { chapter: 'Penalty pour les profs', clock: '30:30', command: { type: 'penalty', team: 'away' }, wait: 5 },
  { chapter: 'Penalty marqué', clock: '31:20', command: { type: 'goal', team: 'away', kind: 'penalty', scorer: 'a9' }, wait: 9 },
  { chapter: 'But… refusé', clock: '37:50', command: { type: 'goal', team: 'home', scorer: 'h7' }, wait: 9 },
  { chapter: 'But… refusé', command: { type: 'disallow_goal', target: '$lastGoal' }, wait: 6 },
  { chapter: 'Temps additionnel', clock: '44:50', command: { type: 'set_added_time', minutes: 2 }, wait: 4 },
  ...stats('Temps additionnel', stat('away', 'shots'), stat('away', 'shots'), stat('away', 'onTarget'), stat('home', 'shots'), stat('home', 'fouls'), stat('away', 'corners')),
  { chapter: 'Mi-temps', clock: '46:55', command: { type: 'set_banner', banner: null }, wait: 1 },
  { chapter: 'Mi-temps', command: { type: 'end_period' }, wait: 2 },
  { chapter: 'Mi-temps', command: { type: 'set_panel', panel: { type: 'summary' } }, wait: 8 },
  { chapter: 'Seconde période', command: { type: 'set_panel', panel: null }, wait: 1 },
  { chapter: 'Seconde période', command: { type: 'start_period' }, wait: 4 },
  { chapter: 'Remplacement', clock: '57:20', command: { type: 'substitution', team: 'home', out: 'h7', in: 'h14' }, wait: 7 },
  { chapter: 'Deuxième jaune', clock: '63:40', command: { type: 'card', team: 'away', color: 'yellow', player: 'a4' }, wait: 9 },
  ...stats('Stats en direct', stat('home', 'shots'), stat('home', 'shots'), stat('home', 'onTarget'), stat('away', 'offsides'), stat('home', 'corners'), stat('away', 'fouls')),
  { chapter: 'Stats en direct', clock: '66:00', command: { type: 'set_panel', panel: { type: 'stats' } }, wait: 7 },
  { chapter: 'Stats en direct', command: { type: 'set_panel', panel: null }, wait: 2 },
  { chapter: 'But contre son camp', clock: '70:10', command: { type: 'goal', team: 'home', kind: 'own', scorer: 'a3' }, wait: 9 },
  { chapter: 'Penalty raté', clock: '79:30', command: { type: 'penalty', team: 'home' }, wait: 5 },
  { chapter: 'Penalty raté', clock: '80:20', command: { type: 'penalty_missed', team: 'home', player: 'h11' }, wait: 6 },
  { chapter: 'Égalisation', clock: '87:45', command: { type: 'goal', team: 'away', scorer: 'a10', assist: 'a8' }, wait: 9 },
  { chapter: 'Fin du temps réglementaire', clock: '89:50', command: { type: 'set_added_time', minutes: 4 }, wait: 4 },
  { chapter: 'Fin du temps réglementaire', clock: '93:50', command: { type: 'end_period' }, wait: 2 },
  { chapter: 'Résumé', command: { type: 'set_panel', panel: { type: 'summary', motm: { team: 'home', player: 'h9' } } }, wait: 10 },
  { chapter: 'Résumé', command: { type: 'set_panel', panel: null }, wait: 1 },
];

export const seconds = (clock: string) => {
  const [m, s] = clock.split(':').map(Number);
  return m * 60 + s;
};

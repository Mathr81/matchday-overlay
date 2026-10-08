import fs from 'node:fs';
import path from 'node:path';
import type { Config, Player, TeamId } from '../shared/types';

// Effectifs d'exemple : à remplacer par les vrais noms dans data/config.json.
const roster = (prefix: string, names: string[]): Player[] =>
  names.map((name, i) => ({ id: `${prefix}${i + 1}`, number: i + 1, name, starter: i < 11 }));

export function defaultConfig(): Config {
  return {
    teams: {
      home: {
        name: 'Élèves',
        code: 'ELV',
        color: '#EF5407',
        logo: '/logos/logo-no-background.svg',
        logoOnLight: false,
        players: roster('h', [
          'Théo Marchand', 'Lucas Petit', 'Enzo Durand', 'Léa Moreau', 'Nathan Leroy', 'Adam Fournier', 'Tom Bernard', 'Jules Girard',
          'Hugo Lambert', 'Noé Garcia', 'Maël Rousseau', 'Sacha Blanc', 'Louis Faure', 'Inès Roux', 'Gabin Mercier', 'Raphaël Colin',
        ]),
      },
      away: {
        name: 'Profs',
        code: 'PRO',
        color: '#1E3F4E',
        logo: '/logos/logo-barral-cropped.png',
        logoOnLight: true,
        players: roster('a', [
          'M. Dupuis', 'Mme Lefèvre', 'M. Martin', 'M. Bonnet', 'Mme Chevalier', 'M. Robin', 'M. Gauthier', 'Mme Perrin',
          'M. Morel', 'M. Simon', 'M. Laurent', 'Mme Henry', 'M. Roussel', 'M. Masson', 'Mme Barbier', 'M. Denis',
        ]),
      },
    },
    format: { periodMinutes: 45, periods: 2 },
    theme: 'tigre',
  };
}

/** Lit data/config.json, ou l'écrit avec les valeurs par défaut s'il n'existe pas. */
export function loadConfig(dataDir: string): Config {
  const file = path.join(dataDir, 'config.json');
  const defaults = defaultConfig();
  if (!fs.existsSync(file)) {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(defaults, null, 2));
    return defaults;
  }
  // Un fichier écrit par une version plus ancienne peut ne pas avoir tous les champs.
  const saved = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<Config>;
  const team = (id: TeamId) => ({ ...defaults.teams[id], ...saved.teams?.[id] });
  return { ...defaults, ...saved, teams: { home: team('home'), away: team('away') }, format: { ...defaults.format, ...saved.format } };
}

import crypto from 'node:crypto';
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

/** Ce qui est écrit dans data/config.json : la configuration publique, plus le code PIN qui ne quitte jamais le serveur. */
export type SavedConfig = Config & { pin: string };

const newPin = () => String(crypto.randomInt(0, 10_000)).padStart(4, '0');

/** Lit data/config.json et le complète (ou le crée) quand il manque des champs. */
export function loadConfig(dataDir: string): { config: Config; pin: string } {
  const file = path.join(dataDir, 'config.json');
  const defaults = defaultConfig();
  // Un fichier écrit par une version plus ancienne peut ne pas avoir tous les champs.
  const saved: Partial<SavedConfig> = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  const team = (id: TeamId) => ({ ...defaults.teams[id], ...saved.teams?.[id] });
  const { pin = newPin(), ...rest } = saved;
  const config: Config = { ...defaults, ...rest, teams: { home: team('home'), away: team('away') }, format: { ...defaults.format, ...saved.format } };
  if (saved.pin === undefined) {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ pin, ...config }, null, 2));
  }
  return { config, pin };
}

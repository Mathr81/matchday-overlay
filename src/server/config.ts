import fs from 'node:fs';
import path from 'node:path';
import type { Config } from '../shared/types';

export function defaultConfig(): Config {
  return {
    teams: {
      home: { name: 'Élèves', code: 'ELV', color: '#EF5407', logo: '/logos/logo-no-background.svg', logoOnLight: false },
      away: { name: 'Profs', code: 'PRO', color: '#1E3F4E', logo: '/logos/logo-barral-cropped.png', logoOnLight: true },
    },
    format: { periodMinutes: 45, periods: 2 },
    theme: 'tigre',
  };
}

/** Lit data/config.json, ou l'écrit avec les valeurs par défaut s'il n'existe pas. */
export function loadConfig(dataDir: string): Config {
  const file = path.join(dataDir, 'config.json');
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  const config = defaultConfig();
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(config, null, 2));
  return config;
}

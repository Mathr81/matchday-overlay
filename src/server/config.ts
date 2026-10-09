import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { THEMES } from '../shared/types';
import type { Banner, Config, Player, TeamConfig, TeamId } from '../shared/types';

// Effectifs d'exemple : à remplacer par les vrais noms dans la page d'admin.
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
    format: { periodMinutes: 45, periods: 2, extraTime: { enabled: true, periodMinutes: 15 }, shootout: { enabled: true, kicks: 5 } },
    theme: 'tigre',
    texts: { title: 'Profs – Élèves', subtitle: 'Le match du BDT', holding: 'De retour dans un instant' },
    banners: [
      { title: 'Aux commentaires', subtitle: 'Prénom Nom et Prénom Nom' },
      { title: 'Le BDT vous souhaite un bon match', subtitle: 'Bureau des Terminales · Barral 2027' },
      { title: 'Soutenez le BDT', subtitle: 'Scannez pour participer à la cagnotte', qr: 'https://example.org/cagnotte' },
    ],
  };
}

/** Ce qui est écrit dans data/config.json : la configuration publique, plus le code PIN qui ne quitte jamais le serveur. */
export type SavedConfig = Config & { pin: string };

const newPin = () => String(crypto.randomInt(0, 10_000)).padStart(4, '0');
const configFile = (dataDir: string) => path.join(dataDir, 'config.json');

export function saveConfig(dataDir: string, config: Config, pin: string): void {
  fs.mkdirSync(dataDir, { recursive: true });
  const tmp = configFile(dataDir) + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify({ pin, ...config }, null, 2));
  fs.renameSync(tmp, configFile(dataDir));
}

/** Lit data/config.json et le complète (ou le crée) quand il manque des champs. */
export function loadConfig(dataDir: string): { config: Config; pin: string } {
  const file = configFile(dataDir);
  const defaults = defaultConfig();
  // Un fichier écrit par une version plus ancienne peut ne pas avoir tous les champs.
  const saved: Partial<SavedConfig> = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  const team = (id: TeamId) => ({ ...defaults.teams[id], ...saved.teams?.[id] });
  const { pin = newPin(), ...rest } = saved;
  const config: Config = {
    ...defaults,
    ...rest,
    teams: { home: team('home'), away: team('away') },
    format: {
      ...defaults.format,
      ...saved.format,
      extraTime: { ...defaults.format.extraTime, ...saved.format?.extraTime },
      shootout: { ...defaults.format.shootout, ...saved.format?.shootout },
    },
    texts: { ...defaults.texts, ...saved.texts },
  };
  if (saved.pin === undefined) saveConfig(dataDir, config, pin);
  return { config, pin };
}

// ---- validation de ce que la page d'admin envoie ----

class Invalid extends Error {}

const str = (value: unknown, label: string, max: number, required = true): string => {
  const s = typeof value === 'string' ? value.trim() : '';
  if (required && !s) throw new Invalid(`${label} : ce champ est vide.`);
  if (s.length > max) throw new Invalid(`${label} : ${max} caractères au plus.`);
  return s;
};
const int = (value: unknown, label: string, min: number, max: number): number => {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) throw new Invalid(`${label} : un nombre entre ${min} et ${max}.`);
  return value;
};

function team(input: Partial<TeamConfig> | undefined, label: string): TeamConfig {
  const color = str(input?.color, `${label}, couleur`, 7);
  if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Invalid(`${label} : la couleur doit ressembler à #EF5407.`);
  const logo = str(input?.logo, `${label}, logo`, 200);
  if (!/^\/(logos|uploads)\/[\w.-]+$/.test(logo)) throw new Invalid(`${label} : logo inconnu.`);
  const players = Array.isArray(input?.players) ? input.players : [];
  if (players.length > 40) throw new Invalid(`${label} : 40 joueurs au plus.`);
  const ids = new Set<string>();
  return {
    name: str(input?.name, `${label}, nom`, 30),
    code: str(input?.code, `${label}, sigle`, 4).toUpperCase(),
    color,
    logo,
    logoOnLight: input?.logoOnLight === true,
    players: players.map((p, i) => {
      const id = str(p?.id, `${label}, joueur ${i + 1}`, 40);
      if (ids.has(id)) throw new Invalid(`${label} : deux joueurs ont le même identifiant.`);
      ids.add(id);
      return { id, number: int(p?.number, `${label}, numéro du joueur ${i + 1}`, 0, 999), name: str(p?.name, `${label}, nom du joueur ${i + 1}`, 40), starter: p?.starter === true };
    }),
  };
}

/** Vérifie et nettoie une configuration reçue. Renvoie la configuration propre, ou un message d'erreur. */
export function validateConfig(input: Partial<Config> | undefined): Config | string {
  try {
    if (!THEMES.includes(input?.theme as Config['theme'])) throw new Invalid('Thème inconnu.');
    const banners = Array.isArray(input?.banners) ? input.banners : [];
    if (banners.length > 20) throw new Invalid('20 bandeaux au plus.');
    return {
      teams: { home: team(input?.teams?.home, 'Équipe 1'), away: team(input?.teams?.away, 'Équipe 2') },
      format: {
        periodMinutes: int(input?.format?.periodMinutes, 'Durée d’une période', 1, 90),
        periods: int(input?.format?.periods, 'Nombre de périodes', 1, 4),
        extraTime: { enabled: input?.format?.extraTime?.enabled === true, periodMinutes: int(input?.format?.extraTime?.periodMinutes, 'Durée d’une prolongation', 1, 30) },
        shootout: { enabled: input?.format?.shootout?.enabled === true, kicks: int(input?.format?.shootout?.kicks, 'Tirs au but par équipe', 1, 10) },
      },
      theme: input!.theme!,
      texts: {
        title: str(input?.texts?.title, 'Nom de l’événement', 60),
        subtitle: str(input?.texts?.subtitle, 'Sous-titre', 80, false),
        holding: str(input?.texts?.holding, 'Message d’attente', 60),
      },
      banners: banners.map((b: Partial<Banner>, i) => {
        const banner: Banner = { title: str(b?.title, `Bandeau ${i + 1}, titre`, 80) };
        const subtitle = str(b?.subtitle, `Bandeau ${i + 1}, sous-titre`, 120, false);
        const qr = str(b?.qr, `Bandeau ${i + 1}, lien`, 300, false);
        if (subtitle) banner.subtitle = subtitle;
        if (qr) banner.qr = qr;
        return banner;
      }),
    };
  } catch (e) {
    if (e instanceof Invalid) return e.message;
    throw e;
  }
}

export const validPin = (pin: unknown): pin is string => typeof pin === 'string' && /^\d{4,8}$/.test(pin);

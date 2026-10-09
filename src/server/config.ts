import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { THEMES, TRIGGER_EVENTS } from '../shared/types';
import type { Banner, Config, Player, PrivateSettings, TeamConfig, TeamId, VmixTrigger } from '../shared/types';

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
    vertical: { top: 230, bottom: 520 },
  };
}

/** Ce qui est écrit dans data/config.json : la configuration publique, plus les réglages qui ne quittent jamais le serveur. */
export type SavedConfig = Config & PrivateSettings;

const newPin = () => String(crypto.randomInt(0, 10_000)).padStart(4, '0');
const configFile = (dataDir: string) => path.join(dataDir, 'config.json');

/** Réglages de départ. Les déclencheurs vMix fournis sont des exemples, tous désactivés, et aucun ne change de plan à l'antenne. */
export function defaultSettings(): PrivateSettings {
  return {
    pin: newPin(),
    apiKey: crypto.randomBytes(12).toString('hex'),
    vmix: {
      enabled: false,
      host: 'http://127.0.0.1:8088',
      triggers: [
        { id: 'exemple-jingle', on: 'goal', enabled: false, function: 'OverlayInput2In', input: 'Jingle but', delayMs: 0 },
        { id: 'exemple-replay', on: 'goal', enabled: false, function: 'ReplayMarkInOut', value: '10', delayMs: 0 },
        { id: 'exemple-fin', on: 'winner', enabled: false, function: 'OverlayInput2In', input: 'Générique de fin', delayMs: 0 },
      ],
    },
  };
}

export function saveConfig(dataDir: string, config: Config, settings: PrivateSettings): void {
  fs.mkdirSync(dataDir, { recursive: true });
  const tmp = configFile(dataDir) + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify({ ...settings, ...config }, null, 2));
  fs.renameSync(tmp, configFile(dataDir));
}

/** Lit data/config.json et le complète (ou le crée) quand il manque des champs. */
export function loadConfig(dataDir: string): { config: Config; settings: PrivateSettings } {
  const file = configFile(dataDir);
  const defaults = defaultConfig();
  // Un fichier écrit par une version plus ancienne peut ne pas avoir tous les champs.
  const saved: Partial<SavedConfig> = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  const team = (id: TeamId) => ({ ...defaults.teams[id], ...saved.teams?.[id] });
  const fresh = defaultSettings();
  const { pin = fresh.pin, apiKey = fresh.apiKey, vmix, ...rest } = saved;
  const settings: PrivateSettings = { pin, apiKey, vmix: { ...fresh.vmix, ...vmix } };
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
    vertical: { ...defaults.vertical, ...saved.vertical },
  };
  if (saved.pin === undefined || saved.apiKey === undefined || saved.vmix === undefined) saveConfig(dataDir, config, settings);
  return { config, settings };
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
      vertical: { top: int(input?.vertical?.top, 'Marge du haut (vertical)', 0, 600), bottom: int(input?.vertical?.bottom, 'Marge du bas (vertical)', 0, 900) },
    };
  } catch (e) {
    if (e instanceof Invalid) return e.message;
    throw e;
  }
}

/** Vérifie les réglages privés reçus de la page d'admin. Renvoie les réglages propres, ou un message d'erreur. */
export function validateSettings(input: Partial<PrivateSettings> | undefined): PrivateSettings | string {
  try {
    if (typeof input?.pin !== 'string' || !/^\d{4,8}$/.test(input.pin)) throw new Invalid('Le code PIN doit faire 4 à 8 chiffres.');
    const apiKey = str(input.apiKey, 'Clé Companion', 64);
    if (!/^[\w-]{8,64}$/.test(apiKey)) throw new Invalid('Clé Companion : 8 à 64 lettres, chiffres ou tirets.');
    const host = str(input.vmix?.host, 'Adresse de vMix', 100);
    if (!/^https?:\/\/[\w.-]+(:\d+)?\/?$/.test(host)) throw new Invalid('Adresse de vMix : elle doit ressembler à http://127.0.0.1:8088.');
    const triggers = Array.isArray(input.vmix?.triggers) ? input.vmix.triggers : [];
    if (triggers.length > 40) throw new Invalid('40 déclencheurs au plus.');
    return {
      pin: input.pin,
      apiKey,
      vmix: {
        enabled: input.vmix?.enabled === true,
        host,
        triggers: triggers.map((t: Partial<VmixTrigger>, i) => {
          const label = `Déclencheur ${i + 1}`;
          if (!t?.on || !(t.on in TRIGGER_EVENTS)) throw new Invalid(`${label} : événement inconnu.`);
          const fn = str(t.function, `${label}, fonction`, 60);
          if (!/^\w+$/.test(fn)) throw new Invalid(`${label} : le nom de fonction ne contient que des lettres et des chiffres.`);
          const trigger: VmixTrigger = { id: str(t.id, label, 40), on: t.on, enabled: t.enabled === true, function: fn, delayMs: int(t.delayMs, `${label}, délai`, 0, 60_000) };
          for (const key of ['input', 'value', 'duration'] as const) {
            const v = str(t[key], `${label}, ${key}`, 120, false);
            if (v) trigger[key] = v;
          }
          return trigger;
        }),
      },
    };
  } catch (e) {
    if (e instanceof Invalid) return e.message;
    throw e;
  }
}

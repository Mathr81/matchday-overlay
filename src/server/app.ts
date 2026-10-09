import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import fastifyStatic from '@fastify/static';
import websocket from '@fastify/websocket';
import Fastify from 'fastify';
import type { WebSocket } from 'ws';
import { THEMES } from '../shared/types';
import type { Ack, Command, Config, Panel, PrivateSettings } from '../shared/types';
import { validateConfig, validateSettings } from './config';
import type { MatchStore } from './store';
import { VmixBridge } from './vmix';

export interface AppOptions {
  store: MatchStore;
  /** Pages construites par Vite. */
  webDir: string;
  logosDir: string;
  /** Logos envoyés depuis la page d'admin. */
  uploadsDir: string;
  /** Code PIN, clé Companion et réglages vMix. */
  settings: PrivateSettings;
  /** Appelé quand l'admin enregistre : à écrire sur disque. */
  onSave?: (config: Config, settings: PrivateSettings) => void;
  /** Remplace les appels HTTP vers vMix, pour les tests. */
  fetcher?: typeof fetch;
}

/** Fermeture du WebSocket quand le jeton manque ou n'est plus bon : la page redemande le code. */
export const CLOSE_DENIED = 4401;

/** Commandes ouvertes à Companion : pas de remise à zéro, de simulation ni de correction du journal. */
const REMOTE_COMMANDS = new Set([
  'start_period',
  'pause_clock',
  'resume_clock',
  'end_period',
  'set_added_time',
  'goal',
  'card',
  'penalty',
  'penalty_missed',
  'stat',
  'end_match',
  'start_shootout',
  'shootout_kick',
  'announce_winner',
  'set_panel',
  'set_banner',
  'set_score_visible',
]);

const IMAGE_TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/svg+xml': 'svg' };

export async function buildApp({ store, webDir, logosDir, uploadsDir, settings: initialSettings, onSave, fetcher }: AppOptions) {
  const app = Fastify({ bodyLimit: 4 * 1024 * 1024 });
  let settings = initialSettings;
  // Le jeton dépend du code : changer le code déconnecte tous les appareils.
  const tokenFor = (p: string) => crypto.createHash('sha256').update(`matchday:${p}`).digest('hex');
  let token = tokenFor(settings.pin);
  let lastFailure = 0;

  // Les automatismes vMix suivent les événements du match ; un échec n'a aucun effet sur l'habillage.
  const vmix = new VmixBridge(() => settings.vmix, fetcher);
  store.onTrigger((events) => vmix.fire(events));

  fs.mkdirSync(uploadsDir, { recursive: true });
  await app.register(websocket);
  await app.register(fastifyStatic, { root: webDir });
  await app.register(fastifyStatic, { root: logosDir, prefix: '/logos/', decorateReply: false });
  await app.register(fastifyStatic, { root: uploadsDir, prefix: '/uploads/', decorateReply: false });

  app.get('/', (_req, reply) => reply.redirect('/control'));
  app.get('/overlay/16x9', (_req, reply) => reply.sendFile('overlay/16x9.html'));
  app.get('/overlay/9x16', (_req, reply) => reply.sendFile('overlay/9x16.html'));
  app.get('/control', (_req, reply) => reply.sendFile('control/index.html'));
  app.get('/simulation', (_req, reply) => reply.sendFile('simulation/index.html'));
  app.get('/admin', (_req, reply) => reply.sendFile('admin/index.html'));
  app.get('/galerie', (_req, reply) => reply.sendFile('gallery/index.html'));

  app.post('/api/login', async (req, reply) => {
    // Un essai par seconde au plus après une erreur : assez pour décourager de deviner le code.
    const wait = lastFailure + 1000 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    if ((req.body as { pin?: unknown } | null)?.pin === settings.pin) return { token };
    lastFailure = Date.now();
    return reply.code(401).send({ error: 'Code incorrect.' });
  });

  // ---- admin : tout ce qui suit demande le jeton ----

  const sockets = new Set<WebSocket>();
  const controls = new Set<WebSocket>();
  const allowed = (req: { headers: Record<string, unknown> }) => req.headers['x-token'] === token;

  app.get('/api/config', (req, reply) => (allowed(req) ? { config: store.config, settings } : reply.code(401).send({ error: 'Code requis.' })));

  app.post('/api/config', (req, reply) => {
    if (!allowed(req)) return reply.code(401).send({ error: 'Code requis.' });
    const body = req.body as { config?: Partial<Config>; settings?: Partial<PrivateSettings> } | null;
    const config = validateConfig(body?.config);
    if (typeof config === 'string') return reply.code(400).send({ error: config });
    const next = validateSettings(body?.settings);
    if (typeof next === 'string') return reply.code(400).send({ error: next });
    const pinChanged = next.pin !== settings.pin;
    settings = next;
    token = tokenFor(settings.pin);
    onSave?.(config, settings);
    store.setConfig(config);
    // Nouveau code : les téléphones déjà connectés doivent le ressaisir.
    if (pinChanged) for (const socket of controls) socket.close(CLOSE_DENIED, 'denied');
    return { token };
  });

  app.post('/api/logo', (req, reply) => {
    if (!allowed(req)) return reply.code(401).send({ error: 'Code requis.' });
    const match = /^data:([\w/+.-]+);base64,(.+)$/.exec((req.body as { data?: string } | null)?.data ?? '');
    const ext = match && IMAGE_TYPES[match[1]];
    if (!match || !ext) return reply.code(400).send({ error: 'Image PNG, JPEG, WebP ou SVG attendue.' });
    const bytes = Buffer.from(match[2], 'base64');
    if (bytes.length > 2 * 1024 * 1024) return reply.code(400).send({ error: 'Image trop lourde (2 Mo au plus).' });
    // Le nom vient du contenu : renvoyer deux fois la même image ne crée qu'un fichier.
    const name = `${crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 16)}.${ext}`;
    fs.writeFileSync(path.join(uploadsDir, name), bytes);
    return { path: `/uploads/${name}` };
  });

  // ---- vMix ----

  app.get('/api/vmix/status', async (req, reply) => (allowed(req) ? vmix.status() : reply.code(401).send({ error: 'Code requis.' })));
  app.get('/api/vmix/log', (req, reply) => (allowed(req) ? { log: vmix.log } : reply.code(401).send({ error: 'Code requis.' })));
  app.post('/api/vmix/test', async (req, reply) => {
    if (!allowed(req)) return reply.code(401).send({ error: 'Code requis.' });
    const t = req.body as { function?: string; input?: string; value?: string; duration?: string } | null;
    if (!t?.function || !/^\w+$/.test(t.function)) return reply.code(400).send({ error: 'Nom de fonction vMix manquant ou invalide.' });
    return vmix.call({ function: t.function, input: t.input, value: t.value, duration: t.duration });
  });

  // ---- pilotage de l'affichage par Companion ou un Stream Deck : /api/do/<action>/<détail>?key=… ----

  let doCount = 0;
  const run = (body: Parameters<MatchStore['execute']>[0] extends infer C ? (C extends unknown ? Omit<C, 'cid'> : never) : never) =>
    store.execute({ ...body, cid: `do-${Date.now().toString(36)}-${doCount++}` } as Command);
  const PANELS: Record<string, Panel> = {
    prematch: { type: 'prematch' },
    'lineup-home': { type: 'lineup', team: 'home' },
    'lineup-away': { type: 'lineup', team: 'away' },
    summary: { type: 'summary' },
    stats: { type: 'stats' },
    holding: { type: 'holding' },
  };

  app.get('/api/do/:action/:detail', (req, reply) => {
    const { action, detail } = req.params as { action: string; detail: string };
    if ((req.query as { key?: string }).key !== settings.apiKey) return reply.code(401).send({ ok: false, reason: 'Clé incorrecte.' });
    const display = store.snapshot().display;
    if (action === 'score' && ['show', 'hide', 'toggle'].includes(detail)) {
      return run({ type: 'set_score_visible', visible: detail === 'toggle' ? !display.scoreVisible : detail === 'show' });
    }
    if (action === 'panel' && (detail === 'off' || detail in PANELS)) return run({ type: 'set_panel', panel: detail === 'off' ? null : PANELS[detail] });
    if (action === 'banner') {
      // Numéro du bandeau enregistré, à partir de 1 ; le relancer le retire.
      const banner = detail === 'off' ? null : store.config.banners[Number(detail) - 1];
      if (banner === undefined) return reply.code(404).send({ ok: false, reason: 'Bandeau inconnu.' });
      const same = banner !== null && JSON.stringify(display.banner) === JSON.stringify(banner);
      return run({ type: 'set_banner', banner: same ? null : banner });
    }
    if (action === 'theme' && (THEMES as readonly string[]).includes(detail)) {
      const config = { ...store.config, theme: detail as Config['theme'] };
      onSave?.(config, settings);
      store.setConfig(config);
      return { ok: true };
    }
    return reply.code(404).send({ ok: false, reason: 'Action inconnue.' });
  });

  // Le module Companion envoie les mêmes commandes que la page de contrôle, sauf celles qui effacent ou réécrivent le match.
  app.post('/api/command', (req, reply) => {
    if ((req.query as { key?: string }).key !== settings.apiKey) return reply.code(401).send({ ok: false, reason: 'Clé incorrecte.' });
    const body = req.body as { type?: string } | null;
    if (!body || typeof body.type !== 'string' || !REMOTE_COMMANDS.has(body.type)) return reply.code(400).send({ ok: false, reason: 'Commande inconnue.' });
    return run(body as Parameters<typeof run>[0]);
  });

  // ---- temps réel ----

  const broadcast = (message: object) => {
    const text = JSON.stringify(message);
    for (const socket of sockets) if (socket.readyState === socket.OPEN) socket.send(text);
  };
  store.subscribe((cue) => {
    // Le signal part avant l'état : l'overlay peut ainsi retenir le score jusqu'au bon moment de l'animation.
    if (cue) broadcast({ type: 'cue', cue });
    broadcast(store.snapshot());
  });

  app.get('/ws', { websocket: true }, (socket, req) => {
    // Seule la page de contrôle peut envoyer des commandes ; les overlays sont en lecture seule.
    const query = req.query as { role?: string; token?: string };
    const canCommand = query.role === 'control';
    if (canCommand && query.token !== token) return socket.close(CLOSE_DENIED, 'denied');
    sockets.add(socket);
    if (canCommand) controls.add(socket);
    socket.send(JSON.stringify(store.snapshot()));
    socket.on('close', () => {
      sockets.delete(socket);
      controls.delete(socket);
    });
    socket.on('message', (raw) => {
      let message;
      try {
        message = JSON.parse(raw.toString());
      } catch {
        return;
      }
      const command = message?.command;
      if (message?.type !== 'command' || typeof command?.cid !== 'string') return;
      const ack: Ack = canCommand ? store.execute(command) : { type: 'ack', cid: command.cid, ok: false, reason: 'Lecture seule.' };
      socket.send(JSON.stringify(ack));
    });
  });

  return app;
}

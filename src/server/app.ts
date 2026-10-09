import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import fastifyStatic from '@fastify/static';
import websocket from '@fastify/websocket';
import Fastify from 'fastify';
import type { WebSocket } from 'ws';
import type { Ack, Config } from '../shared/types';
import { validateConfig, validPin } from './config';
import type { MatchStore } from './store';

export interface AppOptions {
  store: MatchStore;
  /** Pages construites par Vite. */
  webDir: string;
  logosDir: string;
  /** Logos envoyés depuis la page d'admin. */
  uploadsDir: string;
  /** Code demandé par les pages de contrôle, d'admin et de simulation. */
  pin: string;
  /** Appelé quand l'admin enregistre : à écrire sur disque. */
  onSave?: (config: Config, pin: string) => void;
}

/** Fermeture du WebSocket quand le jeton manque ou n'est plus bon : la page redemande le code. */
export const CLOSE_DENIED = 4401;

const IMAGE_TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/svg+xml': 'svg' };

export async function buildApp({ store, webDir, logosDir, uploadsDir, pin: initialPin, onSave }: AppOptions) {
  const app = Fastify({ bodyLimit: 4 * 1024 * 1024 });
  let pin = initialPin;
  // Le jeton dépend du code : changer le code déconnecte tous les appareils.
  const tokenFor = (p: string) => crypto.createHash('sha256').update(`matchday:${p}`).digest('hex');
  let token = tokenFor(pin);
  let lastFailure = 0;

  fs.mkdirSync(uploadsDir, { recursive: true });
  await app.register(websocket);
  await app.register(fastifyStatic, { root: webDir });
  await app.register(fastifyStatic, { root: logosDir, prefix: '/logos/', decorateReply: false });
  await app.register(fastifyStatic, { root: uploadsDir, prefix: '/uploads/', decorateReply: false });

  app.get('/', (_req, reply) => reply.redirect('/control'));
  app.get('/overlay/16x9', (_req, reply) => reply.sendFile('overlay/16x9.html'));
  app.get('/control', (_req, reply) => reply.sendFile('control/index.html'));
  app.get('/simulation', (_req, reply) => reply.sendFile('simulation/index.html'));
  app.get('/admin', (_req, reply) => reply.sendFile('admin/index.html'));

  app.post('/api/login', async (req, reply) => {
    // Un essai par seconde au plus après une erreur : assez pour décourager de deviner le code.
    const wait = lastFailure + 1000 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    if ((req.body as { pin?: unknown } | null)?.pin === pin) return { token };
    lastFailure = Date.now();
    return reply.code(401).send({ error: 'Code incorrect.' });
  });

  // ---- admin : tout ce qui suit demande le jeton ----

  const sockets = new Set<WebSocket>();
  const controls = new Set<WebSocket>();
  const allowed = (req: { headers: Record<string, unknown> }) => req.headers['x-token'] === token;

  app.get('/api/config', (req, reply) => (allowed(req) ? { config: store.config, pin } : reply.code(401).send({ error: 'Code requis.' })));

  app.post('/api/config', (req, reply) => {
    if (!allowed(req)) return reply.code(401).send({ error: 'Code requis.' });
    const body = req.body as { config?: Partial<Config>; pin?: unknown } | null;
    const config = validateConfig(body?.config);
    if (typeof config === 'string') return reply.code(400).send({ error: config });
    const nextPin = body?.pin;
    if (!validPin(nextPin)) return reply.code(400).send({ error: 'Le code PIN doit faire 4 à 8 chiffres.' });
    const pinChanged = nextPin !== pin;
    pin = nextPin;
    token = tokenFor(pin);
    onSave?.(config, pin);
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

import crypto from 'node:crypto';
import fastifyStatic from '@fastify/static';
import websocket from '@fastify/websocket';
import Fastify from 'fastify';
import type { WebSocket } from 'ws';
import type { Ack } from '../shared/types';
import type { MatchStore } from './store';

export interface AppOptions {
  store: MatchStore;
  /** Pages construites par Vite. */
  webDir: string;
  logosDir: string;
  /** Code demandé par les pages de contrôle et de simulation. */
  pin: string;
}

/** Fermeture du WebSocket quand le jeton manque ou n'est plus bon : la page redemande le code. */
export const CLOSE_DENIED = 4401;

export async function buildApp({ store, webDir, logosDir, pin }: AppOptions) {
  const app = Fastify();
  // Le jeton dépend du code : changer le code déconnecte tous les appareils.
  const token = crypto.createHash('sha256').update(`matchday:${pin}`).digest('hex');
  let lastFailure = 0;

  app.post('/api/login', async (req, reply) => {
    // Un essai par seconde au plus après une erreur : assez pour décourager de deviner le code.
    const wait = lastFailure + 1000 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    if ((req.body as { pin?: unknown } | null)?.pin === pin) return { token };
    lastFailure = Date.now();
    return reply.code(401).send({ error: 'Code incorrect.' });
  });

  await app.register(websocket);
  await app.register(fastifyStatic, { root: webDir });
  await app.register(fastifyStatic, { root: logosDir, prefix: '/logos/', decorateReply: false });

  app.get('/', (_req, reply) => reply.redirect('/control'));
  app.get('/overlay/16x9', (_req, reply) => reply.sendFile('overlay/16x9.html'));
  app.get('/control', (_req, reply) => reply.sendFile('control/index.html'));
  app.get('/simulation', (_req, reply) => reply.sendFile('simulation/index.html'));

  const sockets = new Set<WebSocket>();
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
    socket.send(JSON.stringify(store.snapshot()));
    socket.on('close', () => sockets.delete(socket));
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

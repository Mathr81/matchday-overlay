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
}

export async function buildApp({ store, webDir, logosDir }: AppOptions) {
  const app = Fastify();
  await app.register(websocket);
  await app.register(fastifyStatic, { root: webDir });
  await app.register(fastifyStatic, { root: logosDir, prefix: '/logos/', decorateReply: false });

  app.get('/', (_req, reply) => reply.redirect('/control'));
  app.get('/overlay/16x9', (_req, reply) => reply.sendFile('overlay/16x9.html'));
  app.get('/control', (_req, reply) => reply.sendFile('control/index.html'));

  const sockets = new Set<WebSocket>();
  store.subscribe(() => {
    const message = JSON.stringify(store.snapshot());
    for (const socket of sockets) if (socket.readyState === socket.OPEN) socket.send(message);
  });

  app.get('/ws', { websocket: true }, (socket, req) => {
    // Seule la page de contrôle peut envoyer des commandes ; les overlays sont en lecture seule.
    const canCommand = (req.query as { role?: string }).role === 'control';
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

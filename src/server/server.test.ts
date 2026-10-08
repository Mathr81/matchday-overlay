import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import type { Command, CommandBody, ServerMessage, Snapshot } from '../shared/types';
import { buildApp } from './app';
import { defaultConfig } from './config';
import { Journal } from './journal';
import { MatchStore } from './store';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'matchday-'));
let n = 0;
const cmd = (body: CommandBody, cid = `c${++n}`): Command => ({ ...body, cid });

describe('Journal', () => {
  it('reloads what was appended', () => {
    const file = path.join(tmp(), 'match.jsonl');
    new Journal(file).append({ id: 'a', at: 1, type: 'goal', team: 'home' });
    expect(new Journal(file).load()).toEqual({ records: [{ id: 'a', at: 1, type: 'goal', team: 'home' }], skipped: 0 });
  });

  it('skips a line truncated by a crash and keeps writing cleanly after it', () => {
    const file = path.join(tmp(), 'match.jsonl');
    fs.writeFileSync(file, '{"id":"a","at":1,"type":"goal","team":"home"}\n{"id":"b","at":2,"ty');
    const journal = new Journal(file);
    expect(journal.load().skipped).toBe(1);
    journal.append({ id: 'c', at: 3, type: 'goal', team: 'away' });
    const { records, skipped } = journal.load();
    expect(records.map((r) => r.id)).toEqual(['a', 'c']);
    expect(skipped).toBe(1);
  });
});

describe('MatchStore', () => {
  it('applies a command only once when it is received twice', () => {
    const store = new MatchStore(tmp(), defaultConfig());
    const goal = cmd({ type: 'goal', team: 'home' });
    expect(store.execute(goal).ok).toBe(true);
    expect(store.execute(goal).ok).toBe(true);
    expect(store.match.score.home).toBe(1);
  });

  it('refuses commands that make no sense in the current phase', () => {
    const store = new MatchStore(tmp(), defaultConfig());
    expect(store.execute(cmd({ type: 'pause_clock' })).ok).toBe(false);
    expect(store.execute(cmd({ type: 'start_period' })).ok).toBe(true);
    expect(store.execute(cmd({ type: 'start_period' })).reason).toBe('Une période est déjà en cours.');
    expect(store.execute(cmd({ type: 'set_added_time', minutes: -1 })).ok).toBe(false);
  });

  it('voids a goal once, and refuses unknown targets', () => {
    const store = new MatchStore(tmp(), defaultConfig());
    store.execute(cmd({ type: 'goal', team: 'away' }, 'g1'));
    expect(store.execute(cmd({ type: 'void_event', target: 'g1' })).ok).toBe(true);
    expect(store.match.score.away).toBe(0);
    expect(store.execute(cmd({ type: 'void_event', target: 'g1' })).ok).toBe(false);
    expect(store.execute(cmd({ type: 'void_event', target: 'nope' })).ok).toBe(false);
  });

  it('recovers score, running clock and display after a restart', () => {
    const dir = tmp();
    let t = 1_000_000;
    const first = new MatchStore(dir, defaultConfig(), () => t);
    first.execute(cmd({ type: 'start_period' }));
    t += 600_000;
    first.execute(cmd({ type: 'goal', team: 'home' }, 'g1'));
    first.execute(cmd({ type: 'set_score_visible', visible: false }));

    t += 60_000;
    const second = new MatchStore(dir, defaultConfig(), () => t);
    const snap = second.snapshot();
    expect(snap.match.score).toEqual({ home: 1, away: 0 });
    expect(snap.match.clock).toMatchObject({ phase: 'running', anchorAt: 1_000_000 });
    expect(snap.display.scoreVisible).toBe(false);
    // Le renvoi d'une commande d'avant le redémarrage ne recompte pas le but.
    second.execute(cmd({ type: 'goal', team: 'home' }, 'g1'));
    expect(second.match.score.home).toBe(1);
  });

  it('archives the journal on reset', () => {
    const dir = tmp();
    const store = new MatchStore(dir, defaultConfig());
    store.execute(cmd({ type: 'goal', team: 'home' }));
    store.execute(cmd({ type: 'reset_match' }));
    expect(store.match.score.home).toBe(0);
    expect(fs.readdirSync(path.join(dir, 'archive'))).toHaveLength(1);
  });
});

describe('WebSocket', () => {
  let close: (() => Promise<unknown>) | undefined;
  afterEach(() => close?.());

  async function start() {
    const store = new MatchStore(tmp(), defaultConfig());
    const app = await buildApp({ store, webDir: tmp(), logosDir: tmp() });
    await app.listen({ port: 0, host: '127.0.0.1' });
    close = () => app.close();
    const { port } = app.server.address() as { port: number };
    const open = (role: string) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?role=${role}`);
      const inbox: ServerMessage[] = [];
      const waiters: ((m: ServerMessage) => void)[] = [];
      ws.on('message', (raw) => {
        const m = JSON.parse(raw.toString());
        const w = waiters.shift();
        if (w) w(m);
        else inbox.push(m);
      });
      const next = () => new Promise<ServerMessage>((res) => (inbox.length ? res(inbox.shift()!) : waiters.push(res)));
      const send = (body: CommandBody) => ws.send(JSON.stringify({ type: 'command', command: cmd(body) }));
      return { next, send };
    };
    return { open, store };
  }

  it('sends a snapshot on connect and broadcasts changes to every page', async () => {
    const { open } = await start();
    const overlay = open('overlay');
    const control = open('control');
    expect(((await overlay.next()) as Snapshot).match.score.home).toBe(0);
    await control.next();

    control.send({ type: 'goal', team: 'home' });
    const pushed = (await overlay.next()) as Snapshot;
    expect(pushed.type).toBe('snapshot');
    expect(pushed.match.score.home).toBe(1);
  });

  it('refuses commands coming from an overlay', async () => {
    const { open, store } = await start();
    const overlay = open('overlay');
    await overlay.next();
    overlay.send({ type: 'goal', team: 'home' });
    expect(await overlay.next()).toMatchObject({ type: 'ack', ok: false, reason: 'Lecture seule.' });
    expect(store.match.score.home).toBe(0);
  });
});

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
    new Journal(file).append({ id: 'a', at: 1, type: 'goal', team: 'home', kind: 'normal' });
    expect(new Journal(file).load()).toEqual({ records: [{ id: 'a', at: 1, type: 'goal', team: 'home', kind: 'normal' }], skipped: 0 });
  });

  it('skips a line truncated by a crash and keeps writing cleanly after it', () => {
    const file = path.join(tmp(), 'match.jsonl');
    fs.writeFileSync(file, '{"id":"a","at":1,"type":"goal","team":"home"}\n{"id":"b","at":2,"ty');
    const journal = new Journal(file);
    expect(journal.load().skipped).toBe(1);
    journal.append({ id: 'c', at: 3, type: 'goal', team: 'away', kind: 'normal' });
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

  it('turns a second yellow into a sending-off and refuses a third card', () => {
    const store = new MatchStore(tmp(), defaultConfig());
    const cues: (string | undefined)[] = [];
    store.subscribe((cue) => cues.push(cue?.type === 'card' ? cue.color : undefined));
    store.execute(cmd({ type: 'card', team: 'away', color: 'yellow', player: 'a4' }));
    store.execute(cmd({ type: 'card', team: 'away', color: 'yellow', player: 'a4' }));
    expect(cues).toEqual(['yellow', 'second_yellow']);
    expect(store.execute(cmd({ type: 'card', team: 'away', color: 'red', player: 'a4' })).ok).toBe(false);
  });

  it('disallows a goal: score goes back and the scorer is announced', () => {
    const store = new MatchStore(tmp(), defaultConfig());
    let last: unknown;
    store.subscribe((cue) => (last = cue));
    store.execute(cmd({ type: 'start_period' }));
    store.execute(cmd({ type: 'set_clock', seconds: 21 * 60 + 30 }));
    expect(store.execute(cmd({ type: 'set_clock', seconds: -5 })).ok).toBe(false);
    store.execute(cmd({ type: 'goal', team: 'home', scorer: 'h9', assist: 'h10' }, 'g1'));
    expect(last).toMatchObject({ type: 'goal', minute: "22'", scorer: { number: 9, name: 'Hugo Lambert' }, assist: { number: 10 } });
    store.execute(cmd({ type: 'disallow_goal', target: 'g1' }));
    expect(store.match.score.home).toBe(0);
    expect(last).toMatchObject({ type: 'goal_disallowed', team: 'home', minute: "22'", scorer: { number: 9 } });
  });

  it('credits an own goal to the other team but names the real scorer', () => {
    const store = new MatchStore(tmp(), defaultConfig());
    let last: unknown;
    store.subscribe((cue) => (last = cue));
    store.execute(cmd({ type: 'goal', team: 'home', kind: 'own', scorer: 'a3' }));
    expect(store.match.score).toEqual({ home: 1, away: 0 });
    expect(last).toMatchObject({ team: 'home', kind: 'own', scorer: { name: 'M. Martin' } });
  });

  it('plays a simulation on a separate journal and gives the real match back untouched', () => {
    const store = new MatchStore(tmp(), defaultConfig());
    store.execute(cmd({ type: 'goal', team: 'home' }));
    store.execute(cmd({ type: 'simulation', on: true }));
    expect(store.snapshot()).toMatchObject({ simulation: true, match: { score: { home: 0, away: 0 } } });
    store.execute(cmd({ type: 'goal', team: 'away' }));
    store.execute(cmd({ type: 'simulation', on: false }));
    expect(store.snapshot()).toMatchObject({ simulation: false, match: { score: { home: 1, away: 0 } } });
  });

  it('edits an event: changes the scorer, the team and the minute', () => {
    const store = new MatchStore(tmp(), defaultConfig());
    store.execute(cmd({ type: 'start_period' }));
    store.execute(cmd({ type: 'goal', team: 'home', scorer: 'h9', assist: 'h10' }, 'g1'));
    store.execute(cmd({ type: 'edit_event', target: 'g1', patch: { scorer: 'h7', assist: null, minute: "12'" } }));
    expect(store.match.timeline[0]).toMatchObject({ scorer: 'h7', minute: "12'" });
    expect(store.match.timeline[0]).not.toHaveProperty('assist');
    store.execute(cmd({ type: 'edit_event', target: 'g1', patch: { team: 'away' } }));
    expect(store.match.score).toEqual({ home: 0, away: 1 });
    expect(store.execute(cmd({ type: 'edit_event', target: 'nope', patch: { team: 'away' } })).ok).toBe(false);
  });

  it('adds a silent goal without any animation cue', () => {
    const store = new MatchStore(tmp(), defaultConfig());
    const cues: unknown[] = [];
    store.subscribe((cue) => cues.push(cue));
    store.execute(cmd({ type: 'goal', team: 'home', silent: true }));
    expect(store.match.score.home).toBe(1);
    expect(cues).toEqual([null]);
  });

  it('counts stats, never below zero, and keeps panels and banners across a restart', () => {
    const dir = tmp();
    const store = new MatchStore(dir, defaultConfig());
    store.execute(cmd({ type: 'stat', team: 'home', key: 'corners', delta: 1 }));
    store.execute(cmd({ type: 'stat', team: 'home', key: 'corners', delta: 1 }));
    store.execute(cmd({ type: 'stat', team: 'home', key: 'corners', delta: -1 }));
    expect(store.match.stats.home.corners).toBe(1);
    expect(store.execute(cmd({ type: 'stat', team: 'away', key: 'corners', delta: -1 })).ok).toBe(false);

    store.execute(cmd({ type: 'set_panel', panel: { type: 'lineup', team: 'away' } }));
    store.execute(cmd({ type: 'set_banner', banner: { title: '  Aux commentaires ', subtitle: '' } }));
    expect(store.execute(cmd({ type: 'set_banner', banner: { title: ' ' } })).ok).toBe(false);
    const again = new MatchStore(dir, defaultConfig()).snapshot().display;
    expect(again.panel).toEqual({ type: 'lineup', team: 'away' });
    expect(again.banner).toEqual({ title: 'Aux commentaires' });
  });

  it('goes from a drawn match to extra time, then a shootout, and names the winner', () => {
    const store = new MatchStore(tmp(), defaultConfig());
    const play = () => {
      expect(store.execute(cmd({ type: 'start_period' })).ok).toBe(true);
      expect(store.execute(cmd({ type: 'end_period' })).ok).toBe(true);
    };
    play();
    play();
    expect(store.match.clock.phase).toBe('break');
    expect(store.execute(cmd({ type: 'announce_winner' })).ok).toBe(false);
    play();
    play();
    // Après les prolongations sur un nul, il ne reste que les tirs au but (ou finir sur ce score).
    expect(store.execute(cmd({ type: 'start_period' })).ok).toBe(false);
    expect(store.execute(cmd({ type: 'start_shootout', first: 'home' })).ok).toBe(true);
    expect(store.snapshot().display.panel).toEqual({ type: 'shootout' });

    let cue: unknown;
    store.subscribe((c) => (cue = c ?? cue));
    for (const scored of [true, false, true, false, true, false]) {
      const team = store.match.shootout!.next!;
      store.execute(cmd({ type: 'shootout_kick', team, scored }, team + store.match.shootout!.kicks.length));
    }
    // 3 – 0 après trois tirs chacun : l'autre équipe ne peut plus revenir.
    expect(store.match.shootout).toMatchObject({ winner: 'home', score: { home: 3, away: 0 } });
    expect(store.match.clock.phase).toBe('ended');
    expect(store.execute(cmd({ type: 'shootout_kick', team: 'away', scored: true })).ok).toBe(false);
    store.execute(cmd({ type: 'announce_winner' }));
    expect(cue).toMatchObject({ type: 'winner', team: 'home', shootout: { home: 3, away: 0 } });

    // Annuler le dernier tir rouvre la séance.
    store.execute(cmd({ type: 'void_event', target: 'away5' }));
    expect(store.match.clock.phase).toBe('shootout');
    expect(store.match.shootout?.winner).toBeNull();
  });

  it('ends a match with a winner at full time, and lets a draw be ended without a shootout', () => {
    const store = new MatchStore(tmp(), defaultConfig());
    store.execute(cmd({ type: 'start_period' }));
    store.execute(cmd({ type: 'end_period' }));
    store.execute(cmd({ type: 'start_period' }));
    store.execute(cmd({ type: 'goal', team: 'away' }));
    store.execute(cmd({ type: 'end_period' }));
    expect(store.match.clock.phase).toBe('ended');
    expect(store.execute(cmd({ type: 'announce_winner' })).ok).toBe(true);

    const draw = new MatchStore(tmp(), defaultConfig());
    draw.execute(cmd({ type: 'start_period' }));
    draw.execute(cmd({ type: 'end_period' }));
    draw.execute(cmd({ type: 'start_period' }));
    draw.execute(cmd({ type: 'end_period' }));
    expect(draw.execute(cmd({ type: 'end_match' })).ok).toBe(true);
    expect(draw.match.clock.phase).toBe('ended');
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
    const app = await buildApp({ store, webDir: tmp(), logosDir: tmp(), pin: '4321' });
    const login = await app.inject({ method: 'POST', url: '/api/login', payload: { pin: '4321' } });
    const token = login.json().token as string;
    await app.listen({ port: 0, host: '127.0.0.1' });
    close = () => app.close();
    const { port } = app.server.address() as { port: number };
    const open = (role: string) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?role=${role}&token=${role === 'control' ? token : ''}`);
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
    return { open, store, app, port };
  }

  it('gives a token only for the right PIN, and closes a control socket without it', async () => {
    const { app, port } = await start();
    expect((await app.inject({ method: 'POST', url: '/api/login', payload: { pin: '0000' } })).statusCode).toBe(401);
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?role=control&token=nope`);
    const code = await new Promise((res) => ws.on('close', res));
    expect(code).toBe(4401);
  });

  it('sends a snapshot on connect and broadcasts changes to every page', async () => {
    const { open } = await start();
    const overlay = open('overlay');
    const control = open('control');
    expect(((await overlay.next()) as Snapshot).match.score.home).toBe(0);
    await control.next();

    control.send({ type: 'goal', team: 'home' });
    // Le signal d'animation arrive avant le nouvel état.
    expect(await overlay.next()).toMatchObject({ type: 'cue', cue: { type: 'goal', team: 'home' } });
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

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import WebSocket from 'ws';
import type { Command, CommandBody, ServerMessage, Snapshot } from '../shared/types';
import { buildApp } from './app';
import { defaultConfig, defaultSettings, loadConfig, saveConfig, validateConfig, validateSettings } from './config';
import { VmixBridge, vmixUrl } from './vmix';
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

describe('config', () => {
  it('fills in fields missing from an older file and keeps what was there', () => {
    const dir = tmp();
    fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ pin: '2468', format: { periodMinutes: 30, periods: 2 }, teams: { home: { name: 'Terminales' } } }));
    const { config, settings } = loadConfig(dir);
    expect(settings.pin).toBe('2468');
    expect(settings.vmix.enabled).toBe(false);
    // La clé tirée au premier lancement est écrite : elle ne change pas au redémarrage suivant.
    expect(loadConfig(dir).settings.apiKey).toBe(settings.apiKey);
    expect(config.teams.home).toMatchObject({ name: 'Terminales', code: 'ELV' });
    expect(config.format).toMatchObject({ periodMinutes: 30, shootout: { enabled: true, kicks: 5 } });
  });

  it('round-trips through save and load', () => {
    const dir = tmp();
    const config = defaultConfig();
    config.texts.title = 'Finale';
    const settings = { ...defaultSettings(), pin: '1357' };
    saveConfig(dir, config, settings);
    expect(loadConfig(dir)).toEqual({ config, settings });
  });

  it('accepts the default configuration and explains what is wrong otherwise', () => {
    expect(validateConfig(defaultConfig())).toEqual(defaultConfig());
    const broken = defaultConfig();
    broken.format.periodMinutes = 0;
    expect(validateConfig(broken)).toContain('entre 1 et 90');
    const noName = defaultConfig();
    noName.teams.away.players[0].name = ' ';
    expect(validateConfig(noName)).toContain('Équipe 2');
  });
});

describe('vMix', () => {
  const trigger = { id: 't', on: 'goal' as const, enabled: true, function: 'OverlayInput1In', input: 'Mon titre', delayMs: 0 };

  it('builds the API address and drops empty parameters', () => {
    expect(vmixUrl('http://127.0.0.1:8088/', { function: 'ReplayMarkInOut', value: '10' })).toBe('http://127.0.0.1:8088/api/?Function=ReplayMarkInOut&Value=10');
  });

  it('stays silent when the master switch is off or the trigger is disabled', async () => {
    const calls: string[] = [];
    const fetcher = (async (url: string) => (calls.push(url), new Response('ok'))) as unknown as typeof fetch;
    const settings = { enabled: false, host: 'http://x', triggers: [trigger, { ...trigger, id: 'u', enabled: false, on: 'winner' as const }] };
    const bridge = new VmixBridge(() => settings, fetcher);
    bridge.fire(['goal']);
    settings.enabled = true;
    bridge.fire(['winner']);
    await new Promise((r) => setTimeout(r, 20));
    expect(calls).toHaveLength(0);
    bridge.fire(['goal', 'goal_home']);
    await vi.waitFor(() => expect(calls).toHaveLength(1));
  });

  it('logs a failure instead of throwing when vMix is unreachable', async () => {
    const fetcher = (async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;
    const bridge = new VmixBridge(() => ({ enabled: true, host: 'http://x', triggers: [trigger] }), fetcher);
    const entry = await bridge.call(trigger);
    expect(entry).toMatchObject({ ok: false, detail: 'vMix est injoignable à cette adresse.' });
    expect(bridge.log).toHaveLength(1);
  });

  it('checks the settings sent by the admin', () => {
    expect(validateSettings(defaultSettings())).toMatchObject({ vmix: { enabled: false } });
    expect(validateSettings({ ...defaultSettings(), pin: '12' })).toContain('PIN');
    const bad = defaultSettings();
    bad.vmix.host = 'vmix';
    expect(validateSettings(bad)).toContain('Adresse de vMix');
    const badFn = defaultSettings();
    badFn.vmix.triggers[0].function = 'Cut&Input=1';
    expect(validateSettings(badFn)).toContain('nom de fonction');
  });
});

describe('MatchStore', () => {
  it('reports match events for automations, but never during a simulation or for a silent goal', () => {
    const store = new MatchStore(tmp(), defaultConfig());
    const seen: string[][] = [];
    store.onTrigger((events) => seen.push(events));
    store.execute(cmd({ type: 'start_period' }));
    store.execute(cmd({ type: 'goal', team: 'home' }, 'g'));
    store.execute(cmd({ type: 'goal', team: 'home' }, 'g'));
    store.execute(cmd({ type: 'goal', team: 'away', silent: true }));
    store.execute(cmd({ type: 'card', team: 'away', color: 'yellow', player: 'a4' }));
    store.execute(cmd({ type: 'card', team: 'away', color: 'yellow', player: 'a4' }));
    store.execute(cmd({ type: 'simulation', on: true }));
    store.execute(cmd({ type: 'goal', team: 'home' }));
    expect(seen).toEqual([['period_start'], ['goal', 'goal_home'], ['card_yellow'], ['card_red']]);
  });

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
    const saved: { pin?: string; theme?: string } = {};
    const calls: string[] = [];
    const fetcher = (async (url: string) => {
      calls.push(url);
      return new Response('<vmix><version>28.0.0.39</version></vmix>');
    }) as unknown as typeof fetch;
    const settings = { ...defaultSettings(), pin: '4321', apiKey: 'companion-key' };
    settings.vmix = { enabled: true, host: 'http://vmix.test:8088', triggers: [{ id: 't1', on: 'goal_home', enabled: true, function: 'OverlayInput2In', input: 'Jingle but', delayMs: 0 }] };
    const app = await buildApp({
      store,
      webDir: tmp(),
      logosDir: tmp(),
      uploadsDir: tmp(),
      settings,
      fetcher,
      onSave: (c, s) => ((saved.pin = s.pin), (saved.theme = c.theme)),
    });
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
    return { open, store, app, port, token, saved, settings, calls };
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

  it('saves a new configuration from the admin, pushes it to every screen, and rejects a bad one', async () => {
    const { open, store, app, token, settings } = await start();
    const overlay = open('overlay');
    await overlay.next();
    const config = defaultConfig();
    config.teams.home.name = 'Terminales';
    config.format.periodMinutes = 30;

    expect((await app.inject({ method: 'POST', url: '/api/config', payload: { config, settings } })).statusCode).toBe(401);
    const ok = await app.inject({ method: 'POST', url: '/api/config', headers: { 'x-token': token }, payload: { config, settings } });
    expect(ok.statusCode).toBe(200);
    expect(((await overlay.next()) as Snapshot).config.teams.home.name).toBe('Terminales');
    expect(store.config.format.periodMinutes).toBe(30);

    config.teams.home.color = 'orange';
    const bad = await app.inject({ method: 'POST', url: '/api/config', headers: { 'x-token': token }, payload: { config, settings } });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().error).toContain('couleur');
  });

  it('changing the PIN disconnects phones and makes the old token useless', async () => {
    const { open, app, token, saved, port, settings } = await start();
    const control = open('control');
    await control.next();
    const res = await app.inject({ method: 'POST', url: '/api/config', headers: { 'x-token': token }, payload: { config: defaultConfig(), settings: { ...settings, pin: '9999' } } });
    expect(saved.pin).toBe('9999');
    expect(res.json().token).not.toBe(token);
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?role=control&token=${token}`);
    expect(await new Promise((r) => ws.on('close', r))).toBe(4401);
  });

  it('stores an uploaded logo and refuses anything that is not an image', async () => {
    const { app, token } = await start();
    const png = 'data:image/png;base64,' + Buffer.from('fake-png').toString('base64');
    const ok = await app.inject({ method: 'POST', url: '/api/logo', headers: { 'x-token': token }, payload: { data: png } });
    expect(ok.json().path).toMatch(/^\/uploads\/[0-9a-f]{16}\.png$/);
    expect((await app.inject({ method: 'GET', url: ok.json().path })).statusCode).toBe(200);
    const bad = await app.inject({ method: 'POST', url: '/api/logo', headers: { 'x-token': token }, payload: { data: 'data:text/html;base64,PGI+' } });
    expect(bad.statusCode).toBe(400);
  });

  it('calls vMix when a matching event happens, and only then', async () => {
    const { open, calls } = await start();
    const control = open('control');
    await control.next();
    control.send({ type: 'goal', team: 'away' });
    control.send({ type: 'goal', team: 'home', silent: true });
    control.send({ type: 'goal', team: 'home' });
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toBe('http://vmix.test:8088/api/?Function=OverlayInput2In&Input=Jingle%20but');
  });

  it('lets Companion drive the display with the key, and nothing without it', async () => {
    const { app, store } = await start();
    expect((await app.inject('/api/do/score/hide?key=wrong')).statusCode).toBe(401);
    expect(store.snapshot().display.scoreVisible).toBe(true);
    await app.inject('/api/do/score/hide?key=companion-key');
    expect(store.snapshot().display.scoreVisible).toBe(false);
    await app.inject('/api/do/panel/lineup-away?key=companion-key');
    expect(store.snapshot().display.panel).toEqual({ type: 'lineup', team: 'away' });
    await app.inject('/api/do/banner/1?key=companion-key');
    expect(store.snapshot().display.banner?.title).toBe('Aux commentaires');
    await app.inject('/api/do/banner/1?key=companion-key');
    expect(store.snapshot().display.banner).toBeNull();
    expect((await app.inject('/api/do/banner/99?key=companion-key')).statusCode).toBe(404);
    // Les actions de match ne passent pas par ces adresses.
    expect((await app.inject('/api/do/goal/home?key=companion-key')).statusCode).toBe(404);
  });

  it('reports whether vMix answers and tests a single call from the admin', async () => {
    const { app, token, calls } = await start();
    const status = await app.inject({ url: '/api/vmix/status', headers: { 'x-token': token } });
    expect(status.json()).toEqual({ ok: true, detail: 'vMix 28.0.0.39' });
    const test = await app.inject({ method: 'POST', url: '/api/vmix/test', headers: { 'x-token': token }, payload: { function: 'Fade', duration: '500' } });
    expect(test.json()).toMatchObject({ ok: true, url: 'http://vmix.test:8088/api/?Function=Fade&Duration=500' });
    expect(calls).toHaveLength(2);
    const log = await app.inject({ url: '/api/vmix/log', headers: { 'x-token': token } });
    expect(log.json().log).toHaveLength(1);
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

import { minuteLabel } from './clock';
import { afterPeriod, periodBase } from './format';
import { shootoutState } from './shootout';
import { STAT_KEYS } from './types';
import type { ClockState, EventPatch, JournalRecord, MatchEvent, MatchFormat, MatchState, StatKey } from './types';

const emptyStats = () => Object.fromEntries(STAT_KEYS.map((k) => [k, 0])) as Record<StatKey, number>;

export function initialState(): MatchState {
  return {
    score: { home: 0, away: 0 },
    clock: { period: 0, phase: 'pre', baseMs: 0, elapsedMs: 0, anchorAt: null, addedMinutes: null },
    lastGoalId: null,
    timeline: [],
    cards: {},
    stats: { home: emptyStats(), away: emptyStats() },
    shootout: null,
  };
}

/** Recalcule tout l'état du match à partir du journal. */
export function reduce(records: JournalRecord[], format: MatchFormat): MatchState {
  const voided = new Set<string>();
  const patches = new Map<string, EventPatch>();
  for (const r of records) {
    if (r.type === 'void') voided.add(r.target);
    else if (r.type === 'edit') patches.set(r.target, { ...patches.get(r.target), ...r.patch });
  }

  const state = initialState();
  for (const r of records) {
    if (r.type === 'void' || r.type === 'edit' || voided.has(r.id)) continue;
    const patch = patches.get(r.id);
    apply(state, patch ? patched(r, patch) : r, format);
  }
  return state;
}

/** Applique une correction : un champ mis à null est retiré (joueur effacé). */
function patched(event: MatchEvent, patch: EventPatch): MatchEvent {
  const out: Record<string, unknown> = { ...event };
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) delete out[key];
    else out[key] = value;
  }
  return out as unknown as MatchEvent;
}

function stopClock(clock: ClockState, at: number) {
  if (clock.anchorAt === null) return;
  clock.elapsedMs += Math.max(0, at - clock.anchorAt);
  clock.anchorAt = null;
}

function apply(state: MatchState, e: MatchEvent, format: MatchFormat) {
  const clock = state.clock;
  if ('team' in e && e.type !== 'stat' && e.type !== 'shootout_kick') state.timeline.push({ ...e, minute: e.minute ?? minuteLabel(clock, format, e.at) });
  switch (e.type) {
    case 'period_started':
      state.clock = {
        period: e.period,
        phase: 'running',
        baseMs: periodBase(format, e.period),
        elapsedMs: 0,
        anchorAt: e.at,
        addedMinutes: null,
      };
      break;
    case 'clock_paused':
      if (clock.phase !== 'running') break;
      stopClock(clock, e.at);
      clock.phase = 'paused';
      break;
    case 'clock_resumed':
      if (clock.phase !== 'paused') break;
      clock.anchorAt = e.at;
      clock.phase = 'running';
      break;
    case 'period_ended':
      if (clock.phase !== 'running' && clock.phase !== 'paused') break;
      stopClock(clock, e.at);
      {
        // Le match s'arrête quand il n'y a plus de suite possible : ni période, ni tirs au but.
        const options = afterPeriod(format, clock.period, state.score.home === state.score.away);
        clock.phase = options.period || options.shootout ? 'break' : 'ended';
      }
      break;
    case 'match_ended':
      stopClock(clock, e.at);
      clock.phase = 'ended';
      break;
    case 'shootout_started':
      state.shootout = shootoutState(e.first, [], format.shootout.kicks);
      clock.phase = 'shootout';
      break;
    case 'shootout_kick':
      if (!state.shootout) break;
      state.shootout = shootoutState(
        state.shootout.first,
        [...state.shootout.kicks, { id: e.id, team: e.team, scored: e.scored, player: e.player }],
        format.shootout.kicks,
      );
      // Un tir annulé après coup peut rouvrir la séance : la phase suit toujours l'état recalculé.
      clock.phase = state.shootout.winner ? 'ended' : 'shootout';
      break;
    case 'clock_adjusted':
      clock.elapsedMs = e.elapsedMs;
      if (clock.anchorAt !== null) clock.anchorAt = e.at;
      break;
    case 'card': {
      if (!e.player) break;
      const card = (state.cards[`${e.team}:${e.player}`] ??= { yellow: 0, red: false });
      if (e.color === 'yellow') card.yellow++;
      else card.red = true;
      break;
    }
    case 'stat':
      state.stats[e.team][e.key] = Math.max(0, state.stats[e.team][e.key] + e.delta);
      break;
    case 'goal':
      state.score[e.team]++;
      state.lastGoalId = e.id;
      break;
    case 'added_time':
      clock.addedMinutes = e.minutes;
      break;
  }
}

import { minuteLabel } from './clock';
import type { ClockState, JournalRecord, MatchEvent, MatchFormat, MatchState } from './types';

export function initialState(): MatchState {
  return {
    score: { home: 0, away: 0 },
    clock: { period: 0, phase: 'pre', baseMs: 0, elapsedMs: 0, anchorAt: null, addedMinutes: null },
    lastGoalId: null,
    timeline: [],
    cards: {},
  };
}

/** Recalcule tout l'état du match à partir du journal. */
export function reduce(records: JournalRecord[], format: MatchFormat): MatchState {
  const voided = new Set<string>();
  for (const r of records) if (r.type === 'void') voided.add(r.target);

  const state = initialState();
  for (const r of records) {
    if (r.type === 'void' || voided.has(r.id)) continue;
    apply(state, r, format);
  }
  return state;
}

function stopClock(clock: ClockState, at: number) {
  if (clock.anchorAt === null) return;
  clock.elapsedMs += Math.max(0, at - clock.anchorAt);
  clock.anchorAt = null;
}

function apply(state: MatchState, e: MatchEvent, format: MatchFormat) {
  const clock = state.clock;
  if ('team' in e) state.timeline.push({ ...e, minute: minuteLabel(clock, format, e.at) });
  switch (e.type) {
    case 'period_started':
      state.clock = {
        period: e.period,
        phase: 'running',
        baseMs: (e.period - 1) * format.periodMinutes * 60_000,
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
      clock.phase = clock.period >= format.periods ? 'ended' : 'break';
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
    case 'goal':
      state.score[e.team]++;
      state.lastGoalId = e.id;
      break;
    case 'added_time':
      clock.addedMinutes = e.minutes;
      break;
  }
}

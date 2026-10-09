import { describe, expect, it } from 'vitest';
import { formatClock, periodLabel } from './clock';
import { reduce } from './reducer';
import type { JournalRecord, MatchFormat } from './types';

const format: MatchFormat = { periodMinutes: 45, periods: 2 };
const T0 = 1_000_000;
const MIN = 60_000;

describe('reduce', () => {
  it('starts at 0-0 before kick-off', () => {
    const s = reduce([], format);
    expect(s.score).toEqual({ home: 0, away: 0 });
    expect(s.clock.phase).toBe('pre');
  });

  it('counts goals per team and remembers the last one', () => {
    const s = reduce(
      [
        { id: 'a', at: T0, type: 'goal', team: 'home', kind: 'normal' },
        { id: 'b', at: T0, type: 'goal', team: 'away', kind: 'normal' },
        { id: 'c', at: T0, type: 'goal', team: 'home', kind: 'normal' },
      ],
      format,
    );
    expect(s.score).toEqual({ home: 2, away: 1 });
    expect(s.lastGoalId).toBe('c');
  });

  it('ignores voided events', () => {
    const s = reduce(
      [
        { id: 'a', at: T0, type: 'goal', team: 'home', kind: 'normal' },
        { id: 'b', at: T0, type: 'goal', team: 'home', kind: 'normal' },
        { id: 'v', at: T0, type: 'void', target: 'b' },
      ],
      format,
    );
    expect(s.score.home).toBe(1);
    expect(s.lastGoalId).toBe('a');
  });

  it('accumulates time across pause and resume', () => {
    const records: JournalRecord[] = [
      { id: '1', at: T0, type: 'period_started', period: 1 },
      { id: '2', at: T0 + 10 * MIN, type: 'clock_paused' },
      { id: '3', at: T0 + 15 * MIN, type: 'clock_resumed' },
    ];
    const s = reduce(records, format);
    expect(s.clock.phase).toBe('running');
    expect(formatClock(s.clock, format, T0 + 17 * MIN + 5000)).toBe('12:05');
  });

  it('starts the second period at 45:00 and ends the match after it', () => {
    const records: JournalRecord[] = [
      { id: '1', at: T0, type: 'period_started', period: 1 },
      { id: '2', at: T0 + 47 * MIN, type: 'period_ended' },
    ];
    expect(reduce(records, format).clock.phase).toBe('break');
    records.push({ id: '3', at: T0 + 60 * MIN, type: 'period_started', period: 2 });
    const second = reduce(records, format);
    expect(formatClock(second.clock, format, T0 + 60 * MIN)).toBe('45:00');
    records.push({ id: '4', at: T0 + 106 * MIN, type: 'period_ended' });
    expect(reduce(records, format).clock.phase).toBe('ended');
  });

  it('clears added time when a new period starts', () => {
    const records: JournalRecord[] = [
      { id: '1', at: T0, type: 'period_started', period: 1 },
      { id: '2', at: T0, type: 'added_time', minutes: 3 },
    ];
    expect(reduce(records, format).clock.addedMinutes).toBe(3);
    records.push({ id: '3', at: T0, type: 'period_ended' }, { id: '4', at: T0, type: 'period_started', period: 2 });
    expect(reduce(records, format).clock.addedMinutes).toBeNull();
  });
});

describe('formatClock', () => {
  const running = (startedAt: number, period = 1) =>
    reduce([{ id: '1', at: startedAt, type: 'period_started', period }], format).clock;

  it('shows 00:00 before kick-off', () => {
    expect(formatClock(reduce([], format).clock, format, T0)).toBe('00:00');
  });

  it('switches to stoppage notation past the period length', () => {
    expect(formatClock(running(T0), format, T0 + 47 * MIN + 13_000)).toBe('45+2:13');
    expect(formatClock(running(T0, 2), format, T0 + 45 * MIN)).toBe('90+0:00');
  });

  it('never goes backwards if a screen clock is behind the server', () => {
    expect(formatClock(running(T0), format, T0 - 5000)).toBe('00:00');
  });
});

describe('periodLabel', () => {
  it('names the phases of a two-half match', () => {
    const at = (records: JournalRecord[]) => periodLabel(reduce(records, format).clock, format);
    expect(at([])).toBe('Avant-match');
    expect(at([{ id: '1', at: T0, type: 'period_started', period: 1 }])).toBe('1re mi-temps');
    expect(at([{ id: '1', at: T0, type: 'period_started', period: 1 }, { id: '2', at: T0, type: 'period_ended' }])).toBe('Mi-temps');
  });
});

describe('summary', () => {
  it('lists scorers with notes and counts a second yellow as a sending-off', async () => {
    const { scorers, statRows } = await import('./summary');
    const { defaultConfig } = await import('../server/config');
    const config = defaultConfig();
    const match = reduce(
      [
        { id: '1', at: T0, type: 'period_started', period: 1 },
        { id: '2', at: T0 + 11 * MIN, type: 'goal', team: 'home', kind: 'normal', scorer: 'h9' },
        { id: '3', at: T0 + 20 * MIN, type: 'goal', team: 'home', kind: 'own', scorer: 'a3' },
        { id: '4', at: T0 + 30 * MIN, type: 'card', team: 'away', color: 'yellow', player: 'a4' },
        { id: '5', at: T0 + 40 * MIN, type: 'card', team: 'away', color: 'yellow', player: 'a4' },
      ],
      format,
    );
    expect(scorers(config, match, 'home')).toEqual([
      { name: 'Hugo Lambert', minute: "12'", note: '' },
      { name: 'M. Martin', minute: "21'", note: 'csc' },
    ]);
    const rows = Object.fromEntries(statRows(match).map((r) => [r.label, r]));
    expect(rows['Cartons jaunes'].away).toBe(2);
    expect(rows['Expulsions'].away).toBe(1);
  });
});

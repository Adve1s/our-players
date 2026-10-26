import type { GameStatus } from '@our-players/shared';
import { describe, expect, it } from 'vitest';
import { type DataHealthInput, staleReasons } from '../src/api/data-health';

const now = new Date('2026-10-25T12:00:00Z');
const MIN = 60_000;
const HOUR = 60 * MIN;
const ago = (ms: number) => new Date(now.getTime() - ms);

const base: DataHealthInput = {
  games: [],
  resultsRuns: {},
  lastScheduleSuccess: { NHL: ago(HOUR), NBA: ago(HOUR) },
};

const game = (status: GameStatus, startedAgo: number, boxscoreFetchedAt: Date | null = null) => ({
  publicId: 'nhl-2026020001',
  status,
  startTimeUtc: ago(startedAgo),
  boxscoreFetchedAt,
});

const scheduleReason = 'NHL: no successful schedule run in 50 h';

it('a healthy input has no stale reasons', () => {
  expect(staleReasons(now, base)).toEqual([]);
});

describe('a game without its box score', () => {
  it.each([
    ['SCHEDULED, started exactly 4 h ago', game('SCHEDULED', 4 * HOUR)],
    ['SCHEDULED, started exactly 48 h ago', game('SCHEDULED', 48 * HOUR)],
    ['LIVE, started 5 h ago', game('LIVE', 5 * HOUR)],
    ['FINAL without a box score, started 5 h ago', game('FINAL', 5 * HOUR)],
  ])('is late when %s', (_, g) => {
    const reasons = staleReasons(now, { ...base, games: [g] });
    expect(reasons).toEqual(['nhl-2026020001: started over 4 h ago, no box score yet']);
  });

  it.each([
    ['SCHEDULED, started 3 h 59 min ago', game('SCHEDULED', 4 * HOUR - MIN)],
    ['SCHEDULED, started 48 h 1 min ago', game('SCHEDULED', 48 * HOUR + MIN)],
    ['FINAL with a box score, started 5 h ago', game('FINAL', 5 * HOUR, ago(HOUR))],
    ['POSTPONED, started 5 h ago', game('POSTPONED', 5 * HOUR)],
    ['CANCELLED, started 5 h ago', game('CANCELLED', 5 * HOUR)],
  ])('is not late when %s', (_, g) => {
    expect(staleReasons(now, { ...base, games: [g] })).toEqual([]);
  });
});

describe('results runs', () => {
  it('three failed or partial runs in a league are stale', () => {
    const reasons = staleReasons(now, {
      ...base,
      resultsRuns: { NHL: ['partial', 'failed', 'partial'] },
    });
    expect(reasons).toEqual(['NHL: last 3 results runs failed or partial']);
  });

  it('fewer than three runs are not stale yet', () => {
    expect(staleReasons(now, { ...base, resultsRuns: { NHL: ['failed', 'failed'] } })).toEqual([]);
  });

  it('one success among the last three is healthy', () => {
    const reasons = staleReasons(now, {
      ...base,
      resultsRuns: { NHL: ['failed', 'succeeded', 'failed'] },
    });
    expect(reasons).toEqual([]);
  });

  it('each failing league gets its own reason', () => {
    const reasons = staleReasons(now, {
      ...base,
      resultsRuns: { NHL: ['failed', 'failed', 'failed'], NBA: ['partial', 'partial', 'failed'] },
    });
    expect(reasons).toHaveLength(2);
    expect(reasons).toContain('NHL: last 3 results runs failed or partial');
    expect(reasons).toContain('NBA: last 3 results runs failed or partial');
  });
});

describe('the schedule', () => {
  const nbaRan = { NBA: ago(HOUR) };

  it('is stale when it never succeeded', () => {
    expect(staleReasons(now, { ...base, lastScheduleSuccess: nbaRan })).toEqual([scheduleReason]);
  });

  it('is fresh when it succeeded exactly 50 h ago', () => {
    const lastScheduleSuccess = { ...nbaRan, NHL: ago(50 * HOUR) };
    expect(staleReasons(now, { ...base, lastScheduleSuccess })).toEqual([]);
  });

  it('is stale when it last succeeded 50 h 1 min ago', () => {
    const lastScheduleSuccess = { ...nbaRan, NHL: ago(50 * HOUR + MIN) };
    expect(staleReasons(now, { ...base, lastScheduleSuccess })).toEqual([scheduleReason]);
  });

  it('is checked per league: a fresh NHL schedule does not cover a stale NBA one', () => {
    const lastScheduleSuccess = { NHL: ago(HOUR), NBA: ago(60 * HOUR) };
    expect(staleReasons(now, { ...base, lastScheduleSuccess })).toEqual([
      'NBA: no successful schedule run in 50 h',
    ]);
  });
});

it('reports every rule that fires', () => {
  const reasons = staleReasons(now, {
    games: [game('LIVE', 5 * HOUR)],
    resultsRuns: { NHL: ['failed', 'failed', 'failed'] },
    lastScheduleSuccess: { NBA: ago(HOUR) },
  });
  expect(reasons).toHaveLength(3);
});

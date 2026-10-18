import { describe, expect, it } from 'vitest';
import type { JobName } from '../src/jobs';
import {
  type Decision,
  decide,
  type SchedulerGame,
  type SchedulerState,
} from '../src/scheduler/decide';

const NOW = new Date('2026-10-18T14:00:00Z');
const H = 60 * 60 * 1000;
const M = 60 * 1000;
const ago = (ms: number, now = NOW) => new Date(now.getTime() - ms);
const at = (iso: string) => new Date(iso);

const game = (over: Partial<SchedulerGame> = {}): SchedulerGame => ({
  league: 'NHL',
  status: 'FINAL',
  startTimeUtc: ago(20 * H),
  finalAt: ago(17 * H),
  boxscoreFetchedAt: ago(17 * H),
  correctedAt: ago(11 * H),
  ...over,
});
const TOMORROW = game({
  status: 'SCHEDULED',
  startTimeUtc: at('2026-10-19T23:00:00Z'),
  finalAt: null,
  boxscoreFetchedAt: null,
  correctedAt: null,
});
const RAN_TODAY: SchedulerState['lastRuns'] = {
  schedule: at('2026-10-18T09:05:00Z'),
  roster: at('2026-10-18T10:05:00Z'),
  'season-stats': at('2026-10-18T11:05:00Z'),
};
const state = (games: SchedulerGame[], over: Partial<SchedulerState> = {}): SchedulerState => ({
  games: [...games, TOMORROW],
  lastRuns: RAN_TODAY,
  startup: false,
  ...over,
});
const results = (reason: string): Decision[] => [{ league: 'NHL', job: 'results', reason }];

describe('decide — results', () => {
  const uncorrected = (finalAgo: number) =>
    game({ finalAt: ago(finalAgo), boxscoreFetchedAt: ago(finalAgo), correctedAt: null });

  it.each<[string, SchedulerState, Decision[]]>([
    ['quiet afternoon with corrected finals only makes no decisions', state([game()]), []],
    [
      'a LIVE game started 1 h ago is in progress',
      state([
        game({
          status: 'LIVE',
          startTimeUtc: ago(H),
          finalAt: null,
          boxscoreFetchedAt: null,
          correctedAt: null,
        }),
      ]),
      results('games in progress'),
    ],
    [
      'a SCHEDULED game starting in 1 h needs nothing yet',
      state([
        game({
          status: 'SCHEDULED',
          startTimeUtc: ago(-H),
          finalAt: null,
          boxscoreFetchedAt: null,
          correctedAt: null,
        }),
      ]),
      [],
    ],
    [
      'a SCHEDULED game whose start passed 10 min ago (stale schedule) is polled',
      state([
        game({
          status: 'SCHEDULED',
          startTimeUtc: ago(10 * M),
          finalAt: null,
          boxscoreFetchedAt: null,
          correctedAt: null,
        }),
      ]),
      results('games in progress'),
    ],
    [
      'a FINAL game without a box score, started 3 h ago, is polled',
      state([
        game({
          startTimeUtc: ago(3 * H),
          finalAt: ago(30 * M),
          boxscoreFetchedAt: null,
          correctedAt: null,
        }),
      ]),
      results('games in progress'),
    ],
    ['a correction is not due 5 h 59 m after the final', state([uncorrected(5 * H + 59 * M)]), []],
    [
      'a correction is due 6 h after the final',
      state([uncorrected(6 * H)]),
      results('corrections due'),
    ],
    ['a correction older than 24 h is left alone', state([uncorrected(25 * H)]), []],
    [
      'a correction older than 24 h is caught up at startup',
      state([uncorrected(25 * H)], { startup: true }),
      results('corrections due'),
    ],
    [
      'a corrected game with an old final needs nothing',
      state([game({ startTimeUtc: ago(80 * H), finalAt: ago(77 * H) })]),
      [],
    ],
    [
      'a SCHEDULED game started 25 h ago is left alone',
      state([
        game({
          status: 'SCHEDULED',
          startTimeUtc: ago(25 * H),
          finalAt: null,
          boxscoreFetchedAt: null,
          correctedAt: null,
        }),
      ]),
      [],
    ],
    [
      'a SCHEDULED game started 25 h ago is caught up at startup',
      state(
        [
          game({
            status: 'SCHEDULED',
            startTimeUtc: ago(25 * H),
            finalAt: null,
            boxscoreFetchedAt: null,
            correctedAt: null,
          }),
        ],
        { startup: true },
      ),
      results('catch-up at startup'),
    ],
    [
      'games in progress wins over catch-up and corrections',
      state(
        [
          game({
            status: 'LIVE',
            startTimeUtc: ago(H),
            finalAt: null,
            boxscoreFetchedAt: null,
            correctedAt: null,
          }),
          game({
            status: 'SCHEDULED',
            startTimeUtc: ago(25 * H),
            finalAt: null,
            boxscoreFetchedAt: null,
            correctedAt: null,
          }),
          uncorrected(6 * H),
        ],
        { startup: true },
      ),
      results('games in progress'),
    ],
    [
      'catch-up wins over corrections',
      state(
        [
          game({
            status: 'SCHEDULED',
            startTimeUtc: ago(25 * H),
            finalAt: null,
            boxscoreFetchedAt: null,
            correctedAt: null,
          }),
          uncorrected(6 * H),
        ],
        { startup: true },
      ),
      results('catch-up at startup'),
    ],
    [
      "another league's live game is ignored",
      state([
        game({
          league: 'NBA',
          status: 'LIVE',
          startTimeUtc: ago(H),
          finalAt: null,
          boxscoreFetchedAt: null,
          correctedAt: null,
        }),
      ]),
      [],
    ],
  ])('%s', (_name, s, expected) => {
    expect(decide(NOW, ['NHL'], s)).toEqual(expected);
  });
});

describe('decide — schedule at startup', () => {
  const noFuture = (over: Partial<SchedulerState>): SchedulerState => ({
    ...state([game()], over),
    games: [game()],
  });

  it('fetches the schedule at startup when no future game is stored', () => {
    expect(decide(NOW, ['NHL'], noFuture({ startup: true }))).toEqual([
      { league: 'NHL', job: 'schedule', reason: 'no future games' },
    ]);
  });

  it('runs the schedule first, then whatever else is due', () => {
    const live = game({
      status: 'LIVE',
      startTimeUtc: ago(H),
      finalAt: null,
      boxscoreFetchedAt: null,
      correctedAt: null,
    });
    expect(decide(NOW, ['NHL'], { ...noFuture({ startup: true }), games: [live] })).toEqual([
      { league: 'NHL', job: 'schedule', reason: 'no future games' },
      { league: 'NHL', job: 'results', reason: 'games in progress' },
    ]);
  });

  it('gives one schedule decision when the daily slot is also due', () => {
    const lastRuns = { ...RAN_TODAY, schedule: at('2026-10-17T09:05:00Z') };
    expect(decide(NOW, ['NHL'], noFuture({ startup: true, lastRuns }))).toEqual([
      { league: 'NHL', job: 'schedule', reason: 'no future games' },
    ]);
  });

  it('skips the schedule at startup when a future game is stored', () => {
    expect(decide(NOW, ['NHL'], state([game()], { startup: true }))).toEqual([]);
  });

  it('skips the schedule outside startup when it already ran today, even without future games', () => {
    expect(decide(NOW, ['NHL'], noFuture({ startup: false }))).toEqual([]);
  });
});

describe('decide — daily slots', () => {
  const only = (job: JobName, now: Date, lastRuns: SchedulerState['lastRuns']) =>
    decide(now, ['NHL'], state([game()], { lastRuns })).filter((d) => d.job === job);
  const runs = (job: JobName, run: Date | undefined): SchedulerState['lastRuns'] => {
    const { [job]: _, ...rest } = RAN_TODAY;
    return run ? { ...rest, [job]: run } : rest;
  };
  const slot = (hour: number, minutes = 0) => new Date(Date.UTC(2026, 9, 18, hour, minutes));
  const yesterday = (d: Date) => ago(24 * H, d);

  describe.each<[JobName, number, string]>([
    ['schedule', 9, 'daily 09:00'],
    ['roster', 10, 'daily 10:00'],
    ['season-stats', 11, 'daily 11:00'],
  ])('%s', (job, hour, reason) => {
    const due = [{ league: 'NHL', job, reason }];

    it('is not due one minute before its slot', () => {
      expect(only(job, ago(M, slot(hour)), runs(job, yesterday(slot(hour, 5))))).toEqual([]);
    });

    it('is due at its slot when it last ran yesterday', () => {
      expect(only(job, slot(hour), runs(job, yesterday(slot(hour, 5))))).toEqual(due);
    });

    it('is due at its slot when it never ran', () => {
      expect(only(job, slot(hour), runs(job, undefined))).toEqual(due);
    });

    it('is not due again the same day after a run past its slot', () => {
      expect(only(job, slot(23, 59), runs(job, slot(hour, 5)))).toEqual([]);
    });

    it('does not re-fire after a run that failed past its slot', () => {
      // job_runs start times are all the state carries, so a failed run counts like any other.
      expect(only(job, slot(hour, 20), runs(job, slot(hour, 10)))).toEqual([]);
    });
  });
});

describe('decide — order', () => {
  it('orders several due jobs schedule, results, roster, season-stats', () => {
    const now = at('2026-10-18T12:00:00Z');
    const live = game({
      status: 'LIVE',
      startTimeUtc: ago(H, now),
      finalAt: null,
      boxscoreFetchedAt: null,
      correctedAt: null,
    });
    expect(decide(now, ['NHL'], { games: [live], lastRuns: {}, startup: true })).toEqual([
      { league: 'NHL', job: 'schedule', reason: 'no future games' },
      { league: 'NHL', job: 'results', reason: 'games in progress' },
      { league: 'NHL', job: 'roster', reason: 'daily 10:00' },
      { league: 'NHL', job: 'season-stats', reason: 'daily 11:00' },
    ]);
  });
});

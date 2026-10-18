import type { Game } from '@our-players/shared';
import { eq } from 'drizzle-orm';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DbHandle } from '../src/db/client';
import { upsertGames } from '../src/db/games';
import { games, jobRuns } from '../src/db/schema';
import { upsertTeams } from '../src/db/teams';
import {
  createLogger,
  type JobContext,
  type JobResult,
  type LogLevel,
  type runJob,
} from '../src/jobs/runner';
import type { Decision } from '../src/scheduler/decide';
import { loadState, startScheduler, TICK_MS, tick } from '../src/scheduler/scheduler';
import { createTestDb } from './db';
import { cbj, celtics, NO_OVERRIDES, nbaGame, nhlGame, nyi, sixers } from './db-data';
import { fakeClient } from './fake-client';

const NOW = new Date('2026-10-18T14:00:00Z');
const H = 60 * 60 * 1000;
const ago = (ms: number) => new Date(NOW.getTime() - ms);

let handle: DbHandle;
let lines: { level: LogLevel; line: string }[];
let client: ReturnType<typeof fakeClient>;
let ctx: JobContext;

// Migrating the template once can exceed the default hook timeout under a full parallel run.
beforeAll(async () => (await createTestDb()).close(), 30_000);

beforeEach(async () => {
  handle = await createTestDb();
  await upsertTeams(handle.db, [cbj, nyi]);
  lines = [];
  client = fakeClient({});
  ctx = {
    db: handle.db,
    client,
    now: () => NOW,
    log: createLogger((level, line) => lines.push({ level, line })),
    overrides: NO_OVERRIDES,
  };
});

afterEach(() => handle.close());

const parsed = () => lines.map((l) => JSON.parse(l.line) as Record<string, unknown>);

async function storeGame(
  id: string,
  start: Date,
  status: Game['status'],
  bookkeeping: { finalAt?: Date; boxscoreFetchedAt?: Date; correctedAt?: Date } = {},
  base: Game = nhlGame,
) {
  const iso = start.toISOString();
  const publicId = `${base.league.toLowerCase()}-${id}`;
  await upsertGames(handle.db, [
    {
      ...base,
      publicId,
      externalId: id,
      gameDate: iso.slice(0, 10),
      startTimeUtc: iso,
      status,
    },
  ]);
  if (Object.keys(bookkeeping).length > 0)
    await handle.db.update(games).set(bookkeeping).where(eq(games.publicId, publicId));
}

const TOMORROW = new Date('2026-10-19T23:00:00Z');

async function storeRun(
  job: string,
  startedAt: string,
  args: Record<string, unknown> = { league: 'NHL' },
) {
  await handle.db
    .insert(jobRuns)
    .values({ job, args, status: 'succeeded', startedAt: new Date(startedAt) });
}

async function ranAllDailyJobsToday(league = 'NHL') {
  await storeRun('schedule', '2026-10-18T09:05:00Z', { league });
  await storeRun('roster', '2026-10-18T10:05:00Z', { league });
  await storeRun('season-stats', '2026-10-18T11:05:00Z', { league });
}

const starts = (state: { games: readonly { startTimeUtc: Date }[] }) =>
  state.games.map((g) => g.startTimeUtc.toISOString()).sort();

describe('loadState', () => {
  it('keeps recent and future games and uncorrected finals of any age, not old corrected ones', async () => {
    await storeGame('2026020001', ago(30 * H), 'FINAL', {
      finalAt: ago(27 * H),
      boxscoreFetchedAt: ago(27 * H),
      correctedAt: ago(20 * H),
    });
    await storeGame('2026020002', ago(7 * 24 * H), 'FINAL', {
      finalAt: ago(7 * 24 * H - 3 * H),
      boxscoreFetchedAt: ago(7 * 24 * H - 3 * H),
    });
    await storeGame('2026020003', TOMORROW, 'SCHEDULED');
    const state = await loadState(handle.db, NOW, false);
    expect(starts(state)).toEqual([ago(7 * 24 * H).toISOString(), TOMORROW.toISOString()]);
    expect(state.startup).toBe(false);
  });

  it('loads a SCHEDULED game started days ago only at startup', async () => {
    await storeGame('2026020001', ago(3 * 24 * H), 'SCHEDULED');
    expect(starts(await loadState(handle.db, NOW, false))).toEqual([]);
    const state = await loadState(handle.db, NOW, true);
    expect(starts(state)).toEqual([ago(3 * 24 * H).toISOString()]);
    expect(state.startup).toBe(true);
  });

  it('maps the stored bookkeeping columns', async () => {
    await storeGame('2026020001', ago(5 * H), 'FINAL', {
      finalAt: ago(2 * H),
      boxscoreFetchedAt: ago(H),
    });
    const [game] = (await loadState(handle.db, NOW, false)).games;
    expect(game).toEqual({
      league: 'NHL',
      status: 'FINAL',
      startTimeUtc: ago(5 * H),
      finalAt: ago(2 * H),
      boxscoreFetchedAt: ago(H),
      correctedAt: null,
    });
  });

  it("lastRuns holds each job's latest start", async () => {
    await storeRun('schedule', '2026-10-17T09:05:00Z');
    await storeRun('schedule', '2026-10-18T09:05:00Z');
    await storeRun('roster', '2026-10-18T10:05:00Z');
    const { lastRuns } = await loadState(handle.db, NOW, false);
    expect(lastRuns).toEqual({
      NHL: {
        schedule: new Date('2026-10-18T09:05:00Z'),
        roster: new Date('2026-10-18T10:05:00Z'),
      },
    });
  });

  it('lastRuns keeps each league apart', async () => {
    await storeRun('roster', '2026-10-18T10:05:00Z', { league: 'NHL' });
    await storeRun('roster', '2026-10-17T10:05:00Z', { league: 'NBA' });
    const { lastRuns } = await loadState(handle.db, NOW, false);
    expect(lastRuns).toEqual({
      NHL: { roster: new Date('2026-10-18T10:05:00Z') },
      NBA: { roster: new Date('2026-10-17T10:05:00Z') },
    });
  });

  it('lastRuns ignores runs without a known league', async () => {
    await storeRun('roster', '2026-10-18T10:05:00Z', {});
    await storeRun('roster', '2026-10-18T10:06:00Z', { league: 'MLB' });
    const { lastRuns } = await loadState(handle.db, NOW, false);
    expect(lastRuns).toEqual({});
  });
});

const succeeded: JobResult = { status: 'succeeded', runId: 1, counts: {}, error: null };

describe('tick', () => {
  it('a tick with nothing to do makes no requests', async () => {
    await ranAllDailyJobsToday();
    await storeGame('2026020001', TOMORROW, 'SCHEDULED');
    expect(await tick(ctx, ['NHL'], false)).toEqual([]);
    expect(client.requests).toEqual([]);
    expect(parsed()).toContainEqual({ level: 'info', msg: 'tick', decisions: [] });
  });

  it('a tick logs its decisions and runs them in order', async () => {
    await storeRun('season-stats', '2026-10-18T11:05:00Z');
    await storeGame('2026020001', TOMORROW, 'SCHEDULED');
    const calls: [string, unknown][] = [];
    const run: typeof runJob = async (_ctx, name, _job, args) => {
      calls.push([name, args]);
      return succeeded;
    };
    const expected: Decision[] = [
      { league: 'NHL', job: 'schedule', reason: 'daily 09:00' },
      { league: 'NHL', job: 'roster', reason: 'daily 10:00' },
    ];
    expect(await tick(ctx, ['NHL'], false, run)).toEqual(expected);
    expect(calls).toEqual([
      ['schedule', { league: 'NHL' }],
      ['roster', { league: 'NHL' }],
    ]);
    expect(parsed()).toContainEqual({ level: 'info', msg: 'tick', decisions: expected });
  });

  it('a startup tick runs results as a catch-up', async () => {
    await ranAllDailyJobsToday();
    await storeGame('2026020001', TOMORROW, 'SCHEDULED');
    await storeGame('2026020002', ago(3 * 24 * H), 'SCHEDULED');
    const calls: [string, unknown][] = [];
    const run: typeof runJob = async (_ctx, name, _job, args) => {
      calls.push([name, args]);
      return succeeded;
    };
    await tick(ctx, ['NHL'], true, run);
    expect(calls).toEqual([['results', { league: 'NHL', catchUp: true }]]);
  });

  it('a later tick runs results without catch-up', async () => {
    await ranAllDailyJobsToday();
    await storeGame('2026020001', TOMORROW, 'SCHEDULED');
    await storeGame('2026020002', ago(H), 'LIVE');
    const calls: [string, unknown][] = [];
    const run: typeof runJob = async (_ctx, name, _job, args) => {
      calls.push([name, args]);
      return succeeded;
    };
    await tick(ctx, ['NHL'], false, run);
    expect(calls).toEqual([['results', { league: 'NHL' }]]);
  });

  it('a tick for both leagues runs NBA decisions with the NBA league', async () => {
    await upsertTeams(handle.db, [celtics, sixers]);
    await ranAllDailyJobsToday('NHL');
    await storeRun('schedule', '2026-10-18T09:05:00Z', { league: 'NBA' });
    await storeRun('season-stats', '2026-10-18T11:05:00Z', { league: 'NBA' });
    await storeGame('2026020001', TOMORROW, 'SCHEDULED');
    await storeGame('401810001', TOMORROW, 'SCHEDULED', {}, nbaGame);
    await storeGame('401810002', ago(3 * 24 * H), 'SCHEDULED', {}, nbaGame);
    const calls: [string, unknown][] = [];
    const run: typeof runJob = async (_ctx, name, _job, args) => {
      calls.push([name, args]);
      return succeeded;
    };
    await tick(ctx, ['NHL', 'NBA'], true, run);
    expect(calls).toEqual([
      ['results', { league: 'NBA', catchUp: true }],
      ['roster', { league: 'NBA' }],
    ]);
  });

  it('a rejected runJob is logged and the tick goes on', async () => {
    await storeRun('season-stats', '2026-10-18T11:05:00Z');
    await storeGame('2026020001', TOMORROW, 'SCHEDULED');
    const names: string[] = [];
    const run: typeof runJob = async (_ctx, name) => {
      names.push(name);
      if (name === 'schedule') throw new Error('job_runs insert failed');
      return succeeded;
    };
    await tick(ctx, ['NHL'], false, run);
    expect(names).toEqual(['schedule', 'roster']);
    expect(parsed()).toContainEqual({
      level: 'error',
      msg: 'scheduled job threw',
      job: 'schedule',
      league: 'NHL',
      error: 'job_runs insert failed',
    });
  });
});

describe('startScheduler', () => {
  // Only the interval is faked, so PGlite's own timers keep running.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function controlledTicks() {
    const startups: boolean[] = [];
    const pending: (() => void)[] = [];
    const tickFn = (_c: JobContext, _l: unknown, startup: boolean) => {
      startups.push(startup);
      return new Promise<Decision[]>((resolve) => pending.push(() => resolve([])));
    };
    const finishAll = () => {
      for (const f of pending.splice(0)) f();
    };
    return { startups, tickFn, finishAll };
  }

  it('ticks at start with startup, then every 10 minutes without', async () => {
    const t = controlledTicks();
    const scheduler = startScheduler(ctx, ['NHL'], t.tickFn);
    expect(t.startups).toEqual([true]);
    t.finishAll();
    await vi.advanceTimersByTimeAsync(TICK_MS - 1);
    expect(t.startups).toEqual([true]);
    await vi.advanceTimersByTimeAsync(1);
    expect(t.startups).toEqual([true, false]);
    t.finishAll();
    await scheduler.stop();
  });

  it('stop() resolves after the in-flight tick and no tick follows', async () => {
    const t = controlledTicks();
    const scheduler = startScheduler(ctx, ['NHL'], t.tickFn);
    let stopped = false;
    const stopping = scheduler.stop().then(() => {
      stopped = true;
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(stopped).toBe(false);
    t.finishAll();
    await stopping;
    await vi.advanceTimersByTimeAsync(3 * TICK_MS);
    expect(t.startups).toEqual([true]);
  });

  it('a tick still running at the next interval is skipped with a warning', async () => {
    const t = controlledTicks();
    const scheduler = startScheduler(ctx, ['NHL'], t.tickFn);
    await vi.advanceTimersByTimeAsync(TICK_MS);
    expect(t.startups).toEqual([true]);
    expect(
      parsed()
        .filter((l) => l.level === 'warn')
        .map((l) => l.msg),
    ).toEqual(['tick skipped: previous tick still running']);
    t.finishAll();
    await vi.advanceTimersByTimeAsync(TICK_MS);
    expect(t.startups).toEqual([true, false]);
    t.finishAll();
    await scheduler.stop();
  });

  it('a failed tick is logged and the next tick still runs', async () => {
    let calls = 0;
    const tickFn = async () => {
      calls++;
      if (calls === 1) throw new Error('db gone');
      return [];
    };
    const scheduler = startScheduler(ctx, ['NHL'], tickFn);
    await vi.advanceTimersByTimeAsync(TICK_MS);
    expect(calls).toBe(2);
    expect(parsed()).toContainEqual({ level: 'error', msg: 'tick failed', error: 'db gone' });
    await scheduler.stop();
  });

  it('ticks stay startup ticks until one completes', async () => {
    const startups: boolean[] = [];
    const tickFn = async (_c: JobContext, _l: unknown, startup: boolean) => {
      startups.push(startup);
      if (startups.length === 1) throw new Error('db gone');
      return [];
    };
    const scheduler = startScheduler(ctx, ['NHL'], tickFn);
    await vi.advanceTimersByTimeAsync(2 * TICK_MS);
    expect(startups).toEqual([true, true, false]);
    await scheduler.stop();
  });
});

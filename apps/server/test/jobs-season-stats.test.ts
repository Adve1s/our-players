import type { Game } from '@our-players/shared';
import { and, eq } from 'drizzle-orm';
import { afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
import type { DbHandle } from '../src/db/client';
import { upsertGames } from '../src/db/games';
import { upsertPlayers } from '../src/db/players';
import { jobRuns, players, seasonStats } from '../src/db/schema';
import { upsertTeams } from '../src/db/teams';
import { createLogger, type JobContext, type LogLevel, runJob } from '../src/jobs/runner';
import { seasonStatsJob } from '../src/jobs/season-stats';
import { nhlUrls } from '../src/sources/nhl';
import { createTestDb } from './db';
import { cbj, girgensons, merzlikins, NO_OVERRIDES, nhlGame, nyi } from './db-data';
import { fakeClient } from './fake-client';
import { loadFixture } from './fixtures';

// Rows in the recorded 2025-26 regular-season summaries.
const SKATER_ROWS = 940;
const GOALIE_ROWS = 98;

const game = (id: string, o: Pick<Game, 'season' | 'seasonType' | 'startTimeUtc' | 'status'>) =>
  ({ ...nhlGame, publicId: `nhl-${id}`, externalId: id, ...o }) satisfies Game;

const regGame = game('2025021127', {
  season: '2025-26',
  seasonType: 'REG',
  startTimeUtc: '2026-04-01T23:00:00.000Z',
  status: 'FINAL',
});

// The recorded payloads hold no game type, so the PRE routes serve the REG ones.
const summaryRoutes = (gameTypeId: 1 | 2) => ({
  [nhlUrls.summary('skater', '20252026', gameTypeId)]: loadFixture(
    'nhl',
    'skater-summary-reg-all',
    '20252026',
  ),
  [nhlUrls.summary('goalie', '20252026', gameTypeId)]: loadFixture(
    'nhl',
    'goalie-summary-reg-all',
    '20252026',
  ),
});

// The Date read back has millisecond resolution, so a rewrite must land on a later clock.
const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

let handle: DbHandle;
let logs: { level: LogLevel; line: string }[];
let ctx: JobContext;
let client: ReturnType<typeof fakeClient>;

function useRoutes(routes: Record<string, unknown>) {
  client = fakeClient(routes);
  ctx.client = client;
}

beforeAll(async () => (await createTestDb()).close(), 30_000);

beforeEach(async () => {
  handle = await createTestDb();
  await upsertTeams(handle.db, [cbj, nyi]);
  await upsertPlayers(handle.db, [girgensons, merzlikins], NO_OVERRIDES);
  logs = [];
  client = fakeClient(summaryRoutes(2));
  ctx = {
    db: handle.db,
    client,
    now: () => new Date('2026-04-20T12:00:00Z'),
    log: createLogger((level, line) => logs.push({ level, line })),
    overrides: NO_OVERRIDES,
  };
});

afterEach(() => handle.close());

const seasonStatsJobRun = () => runJob(ctx, 'season-stats', seasonStatsJob, { league: 'NHL' });

async function statsOf(publicId: string, seasonType: 'PRE' | 'REG') {
  const [row] = await handle.db
    .select({
      season: seasonStats.season,
      kind: seasonStats.kind,
      basis: seasonStats.basis,
      stats: seasonStats.stats,
      fetchedAt: seasonStats.fetchedAt,
    })
    .from(seasonStats)
    .innerJoin(players, eq(players.id, seasonStats.playerId))
    .where(and(eq(players.publicId, publicId), eq(seasonStats.seasonType, seasonType)));
  if (!row) throw new Error(`no ${seasonType} season stats for ${publicId}`);
  return row;
}

it("stores a stored skater's regular-season totals", async () => {
  await upsertGames(handle.db, [regGame]);
  await seasonStatsJobRun();
  const row = await statsOf(girgensons.publicId, 'REG');
  expect(row).toMatchObject({ season: '2025-26', kind: 'hockey_skater', basis: 'totals' });
  expect(row.stats).toMatchObject({ gamesPlayed: 74, goals: 9, assists: 11, points: 20 });
});

it("stores a stored goalie's regular-season totals", async () => {
  await upsertGames(handle.db, [regGame]);
  await seasonStatsJobRun();
  const row = await statsOf(merzlikins.publicId, 'REG');
  expect(row).toMatchObject({ season: '2025-26', kind: 'hockey_goalie', basis: 'totals' });
  expect(row.stats).toMatchObject({ gamesPlayed: 30, wins: 14, saves: 717 });
});

it('counts stored rows, skipped players and requests in job_runs', async () => {
  await upsertGames(handle.db, [regGame]);
  const result = await seasonStatsJobRun();
  if (result.status === 'skipped') throw new Error('unexpected skip');
  const [run] = await handle.db.select().from(jobRuns).where(eq(jobRuns.id, result.runId));
  expect(run?.status).toBe('succeeded');
  expect(run?.counts).toEqual({ rows: 2, skipped: SKATER_ROWS + GOALIE_ROWS - 2, requests: 2 });
});

it('a re-run writes no row again', async () => {
  await upsertGames(handle.db, [regGame]);
  await seasonStatsJobRun();
  const before = (await statsOf(girgensons.publicId, 'REG')).fetchedAt;
  await tick();
  const again = await seasonStatsJobRun();
  expect(again).toMatchObject({ status: 'succeeded', counts: { rows: 0 } });
  expect((await statsOf(girgensons.publicId, 'REG')).fetchedAt).toEqual(before);
});

it('fetches each started season type of the season, PRE before REG', async () => {
  const preGame = game('2025010001', {
    season: '2025-26',
    seasonType: 'PRE',
    startTimeUtc: '2025-09-21T23:00:00.000Z',
    status: 'FINAL',
  });
  await upsertGames(handle.db, [regGame, preGame]);
  useRoutes({ ...summaryRoutes(1), ...summaryRoutes(2) });
  const result = await seasonStatsJobRun();
  expect(result).toMatchObject({ status: 'succeeded', counts: { rows: 4, requests: 4 } });
  expect(client.requests).toEqual([
    nhlUrls.summary('skater', '20252026', 1),
    nhlUrls.summary('goalie', '20252026', 1),
    nhlUrls.summary('skater', '20252026', 2),
    nhlUrls.summary('goalie', '20252026', 2),
  ]);
  expect((await statsOf(girgensons.publicId, 'PRE')).season).toBe('2025-26');
});

it('makes no request when the current season has no started game', async () => {
  await upsertGames(handle.db, [
    game('2026010001', {
      season: '2026-27',
      seasonType: 'PRE',
      startTimeUtc: '2026-09-20T23:00:00.000Z',
      status: 'SCHEDULED',
    }),
  ]);
  const result = await seasonStatsJobRun();
  expect(result).toMatchObject({ status: 'succeeded', counts: { requests: 0 } });
  expect(logs.some((l) => l.level === 'info' && l.line.includes('2026-27'))).toBe(true);
});

it('makes no request when no game is stored', async () => {
  const result = await seasonStatsJobRun();
  expect(result).toMatchObject({ status: 'succeeded', counts: { requests: 0 } });
});

it('fails, naming the URL, when a summary fetch fails', async () => {
  await upsertGames(handle.db, [regGame]);
  useRoutes({});
  const result = await seasonStatsJobRun();
  expect(result).toMatchObject({ status: 'failed' });
  if (result.status === 'skipped') throw new Error('unexpected skip');
  expect(result.error).toContain(nhlUrls.summary('skater', '20252026', 2));
});

it('rejects a league that has no adapter yet', async () => {
  const result = await runJob(ctx, 'season-stats', seasonStatsJob, { league: 'NBA' });
  expect(result).toMatchObject({ status: 'failed', error: 'nba arrives in S05' });
});

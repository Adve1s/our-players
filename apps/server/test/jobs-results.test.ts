import type { Game } from '@our-players/shared';
import { eq } from 'drizzle-orm';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { DbHandle } from '../src/db/client';
import { upsertGames } from '../src/db/games';
import { upsertPlayers } from '../src/db/players';
import { games, jobRuns, players, statLines } from '../src/db/schema';
import { upsertTeams } from '../src/db/teams';
import { backfillJob } from '../src/jobs/backfill';
import { resultsJob } from '../src/jobs/results';
import {
  createLogger,
  type JobArgs,
  type JobContext,
  type LogLevel,
  runJob,
} from '../src/jobs/runner';
import { mapBoxscore, mapScore, nhlUrls } from '../src/sources/nhl';
import { createTestDb } from './db';
import { NO_OVERRIDES } from './db-data';
import { fakeClient } from './fake-client';
import { loadFixture } from './fixtures';

const GAME = '2025020760';
const MERZLIKINS = 'nhl-8478007';

// score/<date> with only the given games, so the job asks for no box score we haven't recorded.
function scoreOnly(date: string, keep: string[]): unknown {
  const score = loadFixture('nhl', 'score', date) as { games: { id: number }[] };
  score.games = score.games.filter((g) => keep.includes(String(g.id)));
  return score;
}

const scoreRoute = (date: string, payload: unknown) => ({ [nhlUrls.score(date)]: payload });
const boxRoute = (id: string) => ({
  [nhlUrls.boxscore(id)]: loadFixture('nhl', 'boxscore', id),
});
const landingRoute = (id: string) => ({
  [nhlUrls.playerLanding(id)]: loadFixture('nhl', 'player-landing', id),
});
const fullRoutes = () => ({
  ...scoreRoute('2026-01-17', scoreOnly('2026-01-17', [GAME])),
  ...boxRoute(GAME),
  ...landingRoute('8476878'),
  ...landingRoute('8478007'),
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
  logs = [];
  client = fakeClient({});
  ctx = {
    db: handle.db,
    client,
    now: () => new Date('2026-10-18T12:00:00Z'),
    log: createLogger((level, line) => logs.push({ level, line })),
    overrides: NO_OVERRIDES,
  };
});

afterEach(() => handle.close());

const results = (args: Omit<JobArgs, 'league'> = {}) =>
  runJob(ctx, 'results', resultsJob, { league: 'NHL', ...args });
const backfill = (from: string, to: string) =>
  runJob(ctx, 'backfill', backfillJob, { league: 'NHL', from, to });
const warnings = () =>
  logs.filter((l) => l.level === 'warn').map((l) => (JSON.parse(l.line) as { msg: string }).msg);

async function gameRow(publicId: string) {
  const [row] = await handle.db.select().from(games).where(eq(games.publicId, publicId));
  if (!row) throw new Error(`test setup: game ${publicId} not stored`);
  return row;
}

async function playerRow(publicId: string) {
  const [row] = await handle.db.select().from(players).where(eq(players.publicId, publicId));
  if (!row) throw new Error(`player ${publicId} not stored`);
  return row;
}

async function linesOf(gamePublicId: string) {
  return handle.db
    .select({ player: players.publicId, stats: statLines.stats })
    .from(statLines)
    .innerJoin(games, eq(games.id, statLines.gameId))
    .innerJoin(players, eq(players.id, statLines.playerId))
    .where(eq(games.publicId, gamePublicId));
}

async function stamps() {
  const byId = <T extends { id: string }>(rows: T[]) =>
    rows.sort((a, b) => a.id.localeCompare(b.id));
  const g = await handle.db.select({ id: games.publicId, at: games.updatedAt }).from(games);
  const p = await handle.db.select({ id: players.publicId, at: players.updatedAt }).from(players);
  const l = await handle.db
    .select({ game: statLines.gameId, player: statLines.playerId, at: statLines.updatedAt })
    .from(statLines);
  return {
    games: byId(g),
    players: byId(p),
    lines: byId(l.map((r) => ({ id: `${r.game}/${r.player}`, at: r.at }))),
  };
}

// Every box-score player of the game stored as a stub, except Merzļikins.
async function seedAllButMerzlikins() {
  const box = mapBoxscore(loadFixture('nhl', 'boxscore', GAME));
  await upsertTeams(handle.db, box.teams);
  await upsertPlayers(
    handle.db,
    box.players.filter((p) => p.publicId !== MERZLIKINS),
    NO_OVERRIDES,
  );
  return box;
}

async function seedGames(list: Game[], teams: ReturnType<typeof mapScore>['teams']) {
  await upsertTeams(handle.db, teams);
  await upsertGames(handle.db, list);
}

describe('resultsJob', () => {
  it('results stores every line of a final game', async () => {
    useRoutes(fullRoutes());
    const box = mapBoxscore(loadFixture('nhl', 'boxscore', GAME));
    const result = await results({ date: '2026-01-17' });

    const lines = await linesOf(`nhl-${GAME}`);
    expect(lines).toHaveLength(box.lines.length);
    const merz = lines.find((l) => l.player === MERZLIKINS);
    expect(merz?.stats).toMatchObject({ saves: 30, shotsAgainst: 33, decision: 'W' });
    const game = await gameRow(`nhl-${GAME}`);
    expect(game.finalAt).toBeInstanceOf(Date);
    expect(game.boxscoreFetchedAt).toBeInstanceOf(Date);
    expect(result.status === 'skipped' ? undefined : result.counts.finalized).toBe(1);
  });

  it("results fetches no box score for a game that hasn't started", async () => {
    useRoutes(scoreRoute('2026-10-16', loadFixture('nhl', 'score', '2026-10-16-states')));
    await results({ date: '2026-10-16' });

    const stored = await handle.db.select({ status: games.status }).from(games);
    expect(stored.map((g) => g.status)).toEqual(['SCHEDULED', 'SCHEDULED']);
    expect(client.requests).toEqual([nhlUrls.score('2026-10-16')]);
    expect(await handle.db.select().from(statLines)).toHaveLength(0);
  });

  it('results with no started, unfinished game makes no request', async () => {
    const score = mapScore(loadFixture('nhl', 'score', '2026-10-16-states'));
    await seedGames(
      score.games.map((g) => ({ ...g, startTimeUtc: '2026-10-19T00:00:00Z' })),
      score.teams,
    );
    const result = await results();

    expect(client.requestCount).toBe(0);
    expect(result.status).toBe('succeeded');
    expect(await handle.db.select().from(jobRuns)).toHaveLength(1);
  });

  it("results picks the day of a started game that isn't final", async () => {
    const score = mapScore(scoreOnly('2026-01-17', [GAME]));
    await seedGames(
      score.games.map((g) => ({
        ...g,
        status: 'SCHEDULED',
        homeScore: null,
        awayScore: null,
        periodScores: null,
        endedIn: null,
      })),
      score.teams,
    );
    await results();

    expect(client.requests).toEqual([nhlUrls.score('2026-01-17')]);
  });

  it('re-running results changes nothing', async () => {
    useRoutes(fullRoutes());
    await results({ date: '2026-01-17' });
    const before = await stamps();
    await tick();

    const again = await results();
    expect(again.status === 'skipped' ? undefined : again.counts.requests).toBe(0);
    expect(await stamps()).toEqual(before);

    const sent = client.requests.length;
    const dated = await results({ date: '2026-01-17' });
    expect(client.requests.slice(sent)).toEqual([nhlUrls.score('2026-01-17')]);
    expect(dated.status === 'skipped' ? undefined : dated.counts.games).toBe(0);
    expect(await stamps()).toEqual(before);
  });

  it('an unknown player becomes an enriched stub', async () => {
    const box = await seedAllButMerzlikins();
    useRoutes({
      ...scoreRoute('2026-01-17', scoreOnly('2026-01-17', [GAME])),
      ...boxRoute(GAME),
      ...landingRoute('8478007'),
    });
    const result = await results({ date: '2026-01-17' });

    const merz = await playerRow(MERZLIKINS);
    expect(merz.firstName).toBe('Elvis');
    expect(merz.birthCountry).toBe('LVA');
    expect(merz.nationality).toBe('LVA');
    expect(merz.currentTeamId).toBeNull();
    expect(client.requests.filter((u) => u.endsWith('/landing'))).toEqual([
      nhlUrls.playerLanding('8478007'),
    ]);
    expect(warnings().some((m) => m.includes(MERZLIKINS) && m.includes('nhl/10'))).toBe(true);
    expect(result.status).toBe('succeeded');
    expect(result.status === 'skipped' ? undefined : result.counts.enriched).toBe(1);
    const seeded = box.players.find((p) => p.publicId !== MERZLIKINS);
    if (!seeded) throw new Error('test setup: box score has no other player');
    expect((await playerRow(seeded.publicId)).firstName).toBe(seeded.firstName);
  });

  it('a failed enrichment keeps the stub and its line', async () => {
    const box = await seedAllButMerzlikins();
    useRoutes({
      ...scoreRoute('2026-01-17', scoreOnly('2026-01-17', [GAME])),
      ...boxRoute(GAME),
    });
    const result = await results({ date: '2026-01-17' });

    const stub = box.players.find((p) => p.publicId === MERZLIKINS);
    expect((await playerRow(MERZLIKINS)).firstName).toBe(stub?.firstName);
    expect((await linesOf(`nhl-${GAME}`)).map((l) => l.player)).toContain(MERZLIKINS);
    expect(result.status).toBe('partial');
    expect(result.status === 'skipped' ? undefined : result.error).toContain(MERZLIKINS);
  });

  it('a failed box score leaves the game for the next run', async () => {
    useRoutes(scoreRoute('2026-01-17', scoreOnly('2026-01-17', [GAME])));
    const failed = await results({ date: '2026-01-17' });
    expect(failed.status).toBe('partial');
    expect((await gameRow(`nhl-${GAME}`)).boxscoreFetchedAt).toBeNull();

    useRoutes(fullRoutes());
    await results();
    const box = mapBoxscore(loadFixture('nhl', 'boxscore', GAME));
    expect(await linesOf(`nhl-${GAME}`)).toHaveLength(box.lines.length);
  });
});

describe('backfillJob', () => {
  it('backfill ingests each day of the range', async () => {
    useRoutes({
      ...scoreRoute('2026-03-23', scoreOnly('2026-03-23', [])),
      ...scoreRoute('2026-03-24', scoreOnly('2026-03-24', ['2025021127'])),
      ...boxRoute('2025021127'),
    });
    await backfill('2026-03-23', '2026-03-24');

    expect(client.requests.filter((u) => u.includes('/score/'))).toEqual([
      nhlUrls.score('2026-03-23'),
      nhlUrls.score('2026-03-24'),
    ]);
    const box = mapBoxscore(loadFixture('nhl', 'boxscore', '2025021127'));
    expect(await linesOf('nhl-2025021127')).toHaveLength(box.lines.length);
  });

  it("one failed day doesn't stop a backfill", async () => {
    useRoutes({
      ...scoreRoute('2026-03-24', scoreOnly('2026-03-24', ['2025021127'])),
      ...boxRoute('2025021127'),
    });
    const result = await backfill('2026-03-23', '2026-03-24');

    const box = mapBoxscore(loadFixture('nhl', 'boxscore', '2025021127'));
    expect(await linesOf('nhl-2025021127')).toHaveLength(box.lines.length);
    expect(result.status).toBe('partial');
    expect(result.status === 'skipped' ? undefined : result.error).toContain('2026-03-23');
  });
});

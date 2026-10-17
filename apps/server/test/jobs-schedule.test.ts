import { eq } from 'drizzle-orm';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { DbHandle } from '../src/db/client';
import { games } from '../src/db/schema';
import { resultsJob } from '../src/jobs/results';
import { createLogger, type JobArgs, type JobContext, runJob } from '../src/jobs/runner';
import { scheduleJob } from '../src/jobs/schedule';
import { nhlUrls } from '../src/sources/nhl';
import { createTestDb } from './db';
import { NO_OVERRIDES } from './db-data';
import { fakeClient } from './fake-client';
import { loadFixture } from './fixtures';

const GAME = '2025021127';

type RawTeam = { score?: number };
type RawSchedule = {
  gameWeek: { games: { id: number; gameState: string; awayTeam: RawTeam; homeTeam: RawTeam }[] }[];
};

// score/<date> with only the given games, so the job asks for no box score we haven't recorded.
function scoreOnly(date: string, keep: string[]): unknown {
  const score = loadFixture('nhl', 'score', date) as { games: { id: number }[] };
  score.games = score.games.filter((g) => keep.includes(String(g.id)));
  return score;
}

// The recorded week with GAME turned back into a future game with no score: a stale feed.
function scheduleWithGameAsFuture(): unknown {
  const schedule = loadFixture('nhl', 'schedule', '2026-03-24') as RawSchedule;
  const game = schedule.gameWeek.flatMap((d) => d.games).find((g) => String(g.id) === GAME);
  if (!game) throw new Error(`test setup: ${GAME} not in schedule/2026-03-24`);
  game.gameState = 'FUT';
  delete game.awayTeam.score;
  delete game.homeTeam.score;
  return schedule;
}

let handle: DbHandle;
let ctx: JobContext;
let client: ReturnType<typeof fakeClient>;

function useRoutes(routes: Record<string, unknown>) {
  client = fakeClient(routes);
  ctx.client = client;
}

beforeAll(async () => (await createTestDb()).close(), 30_000);

beforeEach(async () => {
  handle = await createTestDb();
  client = fakeClient({});
  ctx = {
    db: handle.db,
    client,
    now: () => new Date('2026-10-18T12:00:00Z'),
    log: createLogger(() => {}),
    overrides: NO_OVERRIDES,
  };
});

afterEach(() => handle.close());

const schedule = (args: Omit<JobArgs, 'league'> = {}) =>
  runJob(ctx, 'schedule', scheduleJob, { league: 'NHL', ...args });

async function gameRow(publicId: string) {
  const [row] = await handle.db.select().from(games).where(eq(games.publicId, publicId));
  if (!row) throw new Error(`test setup: game ${publicId} not stored`);
  return row;
}

// Stores GAME FINAL with its period scores, as the results job does.
async function storeFinalGame() {
  useRoutes({
    [nhlUrls.score('2026-03-24')]: scoreOnly('2026-03-24', [GAME]),
    [nhlUrls.boxscore(GAME)]: loadFixture('nhl', 'boxscore', GAME),
  });
  await runJob(ctx, 'results', resultsJob, { league: 'NHL', date: '2026-03-24' });
  const stored = await gameRow(`nhl-${GAME}`);
  if (stored.status !== 'FINAL' || stored.periodScores === null) {
    throw new Error(`test setup: ${GAME} not stored FINAL with period scores`);
  }
  return stored;
}

describe('scheduleJob', () => {
  it("schedule stores the week's games and teams", async () => {
    useRoutes({ [nhlUrls.schedule('2026-03-24')]: loadFixture('nhl', 'schedule', '2026-03-24') });
    const result = await schedule({ date: '2026-03-24' });

    expect(await handle.db.select().from(games)).toHaveLength(58);
    expect(result.status === 'skipped' ? undefined : result.counts.games).toBe(58);
    expect(result.status === 'skipped' ? undefined : result.counts.teams).toBe(32);
    // The week's last day is stored too; the fixture was recorded after it ended, so it is FINAL.
    const last = await handle.db.select().from(games).where(eq(games.gameDate, '2026-03-30'));
    expect(last).toHaveLength(5);
    expect((await gameRow('nhl-2025021173')).status).toBe('FINAL');
  });

  it('a schedule re-run never downgrades a stored FINAL game', async () => {
    const before = await storeFinalGame();
    useRoutes({ [nhlUrls.schedule('2026-03-24')]: scheduleWithGameAsFuture() });
    await schedule({ date: '2026-03-24' });

    const after = await gameRow(`nhl-${GAME}`);
    expect(after.status).toBe('FINAL');
    expect(after.homeScore).toBe(6);
    expect(after.awayScore).toBe(3);
    expect(after.periodScores).toEqual(before.periodScores);
    expect(after.endedIn).toBe('REG');
  });

  it("schedule doesn't wipe score-derived period scores", async () => {
    const before = await storeFinalGame();
    useRoutes({ [nhlUrls.schedule('2026-03-24')]: loadFixture('nhl', 'schedule', '2026-03-24') });
    await schedule({ date: '2026-03-24' });

    expect((await gameRow(`nhl-${GAME}`)).periodScores).toEqual(before.periodScores);
  });

  it("schedule uses today's UTC date by default", async () => {
    ctx.now = () => new Date('2026-03-24T09:00:00Z');
    useRoutes({ [nhlUrls.schedule('2026-03-24')]: loadFixture('nhl', 'schedule', '2026-03-24') });
    await schedule();

    expect(client.requests).toEqual([nhlUrls.schedule('2026-03-24')]);
  });
});

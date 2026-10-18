import { eq } from 'drizzle-orm';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { DbHandle } from '../src/db/client';
import { upsertGames } from '../src/db/games';
import { upsertPlayers } from '../src/db/players';
import {
  games,
  players,
  seasonStats as seasonStatsTable,
  statLines,
  teams,
} from '../src/db/schema';
import { upsertTeams } from '../src/db/teams';
import { resultsJob } from '../src/jobs/results';
import { rosterJob } from '../src/jobs/roster';
import { createLogger, type JobArgs, type JobContext, runJob } from '../src/jobs/runner';
import { scheduleJob } from '../src/jobs/schedule';
import { seasonStatsJob } from '../src/jobs/season-stats';
import { loadNationalityOverrides } from '../src/nationality/overrides';
import { espnUrls, mapAthlete, mapScoreboard, mapTeams } from '../src/sources/espn-nba';
import { createTestDb } from './db';
import { bertans, celtics, NO_OVERRIDES, nbaGame, porzingis, sixers } from './db-data';
import { fakeClient } from './fake-client';
import { loadFixture } from './fixtures';

const DAY = '2026-03-16';
const GAME = '401810839'; // GS @ WSH
const PORZINGIS = 'nba-3102531';
const HORFORD = 'nba-3213';
const ESPN_HOSTS = ['https://site.api.espn.com/', 'https://sports.core.api.espn.com/'];

// scoreboard/<date> with only the given events, so the job asks for no summary we haven't recorded.
function scoreboardOnly(date: string, keep: string[]): unknown {
  const board = loadFixture('espn-nba', 'scoreboard', date) as { events: { id: string }[] };
  board.events = board.events.filter((e) => keep.includes(e.id));
  return board;
}

const scoreboardRoute = (date: string, payload: unknown) => ({
  [espnUrls.scoreboard(date)]: payload,
});
const summaryRoute = (id: string) => ({
  [espnUrls.summary(id)]: loadFixture('espn-nba', 'summary', id),
});
const athleteRoute = (id: string) => ({
  [espnUrls.athlete(id)]: loadFixture('espn-nba', 'athlete', id),
});

// updated_at is the database's now(), so a rewrite must land on a later wall clock.
const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

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

const results = (args: Omit<JobArgs, 'league'> = {}) =>
  runJob(ctx, 'results', resultsJob, { league: 'NBA', ...args });
const schedule = (date: string) => runJob(ctx, 'schedule', scheduleJob, { league: 'NBA', date });
const countOf = (r: Awaited<ReturnType<typeof results>>, key: string) =>
  r.status === 'skipped' ? undefined : r.counts[key];

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
    .select({
      player: players.publicId,
      played: statLines.played,
      dnpReason: statLines.dnpReason,
      stats: statLines.stats,
      at: statLines.updatedAt,
    })
    .from(statLines)
    .innerJoin(games, eq(games.id, statLines.gameId))
    .innerJoin(players, eq(players.id, statLines.playerId))
    .where(eq(games.publicId, gamePublicId));
}

const summaryRequests = () => client.requests.filter((u) => u.includes('/summary?'));
const offEspn = (urls: string[]) => urls.filter((u) => !ESPN_HOSTS.some((h) => u.startsWith(h)));

describe('NBA results', () => {
  const dayRoutes = () => ({
    ...scoreboardRoute(DAY, loadFixture('espn-nba', 'scoreboard', DAY)),
    ...summaryRoute(GAME),
  });

  it('stores every line of the routed final and leaves the 404 games for later', async () => {
    useRoutes(dayRoutes());
    const result = await results({ date: DAY });

    const lines = await linesOf(`nba-${GAME}`);
    expect(lines).toHaveLength(26);
    expect(lines.find((l) => l.player === PORZINGIS)?.stats).toMatchObject({ points: 30 });
    const horford = lines.find((l) => l.player === HORFORD);
    expect(horford?.played).toBe(false);
    expect(horford?.dnpReason).toBe('NOT WITH TEAM');
    expect(result.status).toBe('partial');
    expect(countOf(result, 'finalized')).toBe(1);
    expect((await gameRow('nba-401810838')).boxscoreFetchedAt).toBeNull();
  });

  it('requests a summary only for games stored as FINAL', async () => {
    useRoutes(dayRoutes());
    await results({ date: DAY });

    const finals = await handle.db
      .select({ id: games.externalId })
      .from(games)
      .where(eq(games.status, 'FINAL'));
    expect(finals).toHaveLength(8);
    expect(summaryRequests().sort()).toEqual(finals.map((g) => espnUrls.summary(g.id)).sort());
  });

  it('asks only ESPN hosts during the day loop (AC8)', async () => {
    useRoutes(dayRoutes());
    await results({ date: DAY });

    expect(client.requests.length).toBeGreaterThan(0);
    expect(offEspn(client.requests)).toEqual([]);
  });

  it('re-running the day changes no line and re-fetches no stored summary', async () => {
    useRoutes(dayRoutes());
    await results({ date: DAY });
    const before = await linesOf(`nba-${GAME}`);
    await tick();

    const sent = client.requests.length;
    const again = await results({ date: DAY });
    const resent = client.requests.slice(sent);
    expect(resent).not.toContain(espnUrls.summary(GAME));
    expect(resent.filter((u) => u.includes('/athletes/'))).toEqual([]);
    expect(countOf(again, 'lines') ?? 0).toBe(0);
    expect(await linesOf(`nba-${GAME}`)).toEqual(before);
  });

  it('enriches a stub from the athlete endpoint', async () => {
    useRoutes({ ...dayRoutes(), ...athleteRoute('3102531') });
    const result = await results({ date: DAY });

    const porzingis = await playerRow(PORZINGIS);
    expect(porzingis.birthCountry).toBe('LVA');
    expect(porzingis.firstName).toBe('Kristaps');
    expect(client.requests).toContain(espnUrls.athlete('3102531'));
    expect(countOf(result, 'enriched')).toBe(1);
  });

  it('keeps an unrouted athlete as a stub with no team, and his line', async () => {
    useRoutes({ ...dayRoutes(), ...athleteRoute('3102531') });
    const result = await results({ date: DAY });

    expect(client.requests).toContain(espnUrls.athlete('3213'));
    const horford = await playerRow(HORFORD);
    expect(horford.lastName).toBe('Horford');
    expect(horford.currentTeamId).toBeNull();
    expect((await linesOf(`nba-${GAME}`)).map((l) => l.player)).toContain(HORFORD);
    expect(countOf(result, 'stubs')).toBe(25);
    expect(result.status).toBe('partial');
    expect(result.status === 'skipped' ? undefined : result.error).toContain(HORFORD);
  });
});

describe('NBA corrections', () => {
  const START = new Date(
    mapScoreboard(loadFixture('espn-nba', 'scoreboard', DAY), DAY).games.find(
      (g) => g.externalId === GAME,
    )?.startTimeUtc ?? 'missing',
  ).getTime();
  const H = 60 * 60 * 1000;
  const at = (ms: number) => {
    ctx.now = () => new Date(START + ms);
  };

  // First fetched 4 h after the start, final since START + 3 h.
  async function seedFetchedEarly() {
    useRoutes({
      ...scoreboardRoute(DAY, scoreboardOnly(DAY, [GAME])),
      ...summaryRoute(GAME),
      ...athleteRoute('3102531'),
    });
    at(4 * H);
    await results({ date: DAY });
    expect((await gameRow(`nba-${GAME}`)).correctedAt).toBeNull();
    await handle.db
      .update(games)
      .set({ finalAt: new Date(START + 3 * H) })
      .where(eq(games.publicId, `nba-${GAME}`));
  }

  it('a catch-up run 6 h after final re-requests the summary once', async () => {
    await seedFetchedEarly();
    const sent = client.requests.length;
    at(9 * H);
    const result = await results({ catchUp: true });

    expect(client.requests.slice(sent)).toEqual([espnUrls.summary(GAME)]);
    expect((await gameRow(`nba-${GAME}`)).correctedAt).toBeInstanceOf(Date);
    expect(countOf(result, 'corrected')).toBe(1);

    const corrected = client.requests.length;
    await results({ catchUp: true });
    expect(client.requests.length).toBe(corrected);
  });

  it('asks only ESPN hosts across the day loop and the corrections (AC8)', async () => {
    await seedFetchedEarly();
    at(9 * H);
    await results({ catchUp: true });

    expect(client.requests).toContain(espnUrls.summary(GAME));
    expect(client.requests).toContain(espnUrls.athlete('3102531'));
    expect(offEspn(client.requests)).toEqual([]);
    expect(client.requests.filter((u) => u.includes('nhle.com'))).toEqual([]);
  });
});

describe('NBA schedule', () => {
  const WEEK = [
    '2026-03-14',
    '2026-03-15',
    '2026-03-16',
    '2026-03-17',
    '2026-03-18',
    '2026-03-19',
    '2026-03-20',
  ];
  const recorded = new Set(['2026-03-14', '2026-03-16']);
  const weekRoutes = (days: string[]) =>
    Object.assign(
      {},
      ...days.map((d) =>
        scoreboardRoute(
          d,
          loadFixture('espn-nba', 'scoreboard', recorded.has(d) ? d : '2026-04-13'),
        ),
      ),
    ) as Record<string, unknown>;

  it('asks one scoreboard per day for seven days and stores the games', async () => {
    useRoutes(weekRoutes(WEEK));
    const result = await schedule('2026-03-14');

    expect(client.requests).toEqual(WEEK.map((d) => espnUrls.scoreboard(d)));
    expect(client.requests[0]).toContain('dates=20260314');
    expect(client.requests[6]).toContain('dates=20260320');
    expect(result.status).toBe('succeeded');
    const stored = await handle.db.select({ day: games.gameDate }).from(games);
    expect(stored.filter((g) => g.day === '2026-03-14')).toHaveLength(7);
    expect(stored.filter((g) => g.day === '2026-03-16')).toHaveLength(8);
    expect(stored).toHaveLength(15);
  });

  it('fails the run when a day of the week 404s', async () => {
    useRoutes(weekRoutes(WEEK.slice(0, 6)));
    const result = await schedule('2026-03-14');

    expect(client.requests).toEqual(WEEK.map((d) => espnUrls.scoreboard(d)));
    expect(result.status).toBe('failed');
    expect(result.status === 'skipped' ? undefined : result.error).toContain('dates=20260320');
  });
});

describe('NBA roster', () => {
  type RawRoster = { team: { id: string }; athletes: { id: string }[] };
  const teamsFixture = () => loadFixture('espn-nba', 'teams', '2026-10-18');
  const teamIds = mapTeams(teamsFixture()).teams.map((t) => t.externalId);

  // Roster 9 (GS) as recorded; every other team gets a copy under its own ID with offset athlete IDs,
  // so no player is on two rosters.
  function rosterOf(teamId: string): RawRoster {
    const raw = loadFixture('espn-nba', 'roster', '9') as RawRoster;
    if (teamId === '9') return raw;
    raw.team.id = teamId;
    for (const a of raw.athletes) a.id = String(Number(a.id) + Number(teamId) * 10_000_000);
    return raw;
  }

  const rosterRoutes = (skip: string[] = []) => ({
    [espnUrls.teams()]: teamsFixture(),
    ...Object.fromEntries(
      teamIds.filter((id) => !skip.includes(id)).map((id) => [espnUrls.roster(id), rosterOf(id)]),
    ),
  });
  const roster = () => runJob(ctx, 'roster', rosterJob, { league: 'NBA' });

  async function rosterRow(publicId: string) {
    const [row] = await handle.db
      .select({
        active: players.active,
        team: teams.abbrev,
        nationality: players.nationality,
        nationalitySource: players.nationalitySource,
      })
      .from(players)
      .leftJoin(teams, eq(teams.id, players.currentTeamId))
      .where(eq(players.publicId, publicId));
    if (!row) throw new Error(`player ${publicId} not stored`);
    return row;
  }

  it('stores every team and puts Porziņģis on GS as an active LVA player by birth', async () => {
    useRoutes(rosterRoutes());
    const result = await roster();

    expect(result.status).toBe('succeeded');
    expect(countOf(result, 'teams')).toBe(30);
    expect(await rosterRow(PORZINGIS)).toEqual({
      active: true,
      team: 'GS',
      nationality: 'LVA',
      nationalitySource: 'birth',
    });
  });

  it('a failed roster fetch records partial and changes no active flag', async () => {
    // Bertāns is on no routed roster, so a complete run would deactivate him.
    await upsertTeams(handle.db, [celtics]);
    await upsertPlayers(handle.db, [bertans], NO_OVERRIDES);
    useRoutes(rosterRoutes(['27']));
    const result = await roster();

    expect(result.status).toBe('partial');
    expect(countOf(result, 'teamsFailed')).toBe(1);
    expect(countOf(result, 'deactivated')).toBeUndefined();
    const row = await rosterRow(bertans.publicId);
    expect(row.active).toBe(true);
    expect(row.team).toBe('BOS');
  });
});

describe('NBA nationality overrides (AC4)', () => {
  it('the committed overrides give Embiid USA and Towns DOM over their birth countries', async () => {
    await upsertTeams(handle.db, mapTeams(loadFixture('espn-nba', 'teams', '2026-10-18')).teams);
    const [embiid, towns] = ['3059318', '3136195'].map(
      (id) => mapAthlete(loadFixture('espn-nba', 'athlete', id)).player,
    );
    if (!embiid || !towns) throw new Error('test setup: athletes not mapped');
    await upsertPlayers(handle.db, [embiid, towns], await loadNationalityOverrides());

    const embiidRow = await playerRow('nba-3059318');
    expect(embiidRow.nationality).toBe('USA');
    expect(embiidRow.nationalitySource).toBe('override');
    expect(embiidRow.birthCountry).toBe('CMR');
    const townsRow = await playerRow('nba-3136195');
    expect(townsRow.nationality).toBe('DOM');
    expect(townsRow.nationalitySource).toBe('override');
    expect(townsRow.birthCountry).toBe('USA');
  });
});

describe('NBA season stats', () => {
  type RawByAthlete = { pagination: { pages: number; count: number } };
  const DONCIC = 'nba-3945274';
  const SGA = 'nba-4278073';
  const PAGE_1 = espnUrls.byathlete('2026', 2, 1);

  // Page 1 of the recorded 2025-26 regular season, with its pagination cut as given.
  function pageOne(pagination: RawByAthlete['pagination']): unknown {
    const raw = loadFixture('espn-nba', 'byathlete', '2026') as RawByAthlete;
    raw.pagination = { ...raw.pagination, ...pagination };
    return raw;
  }

  const athlete = (id: string, firstName: string, lastName: string) => ({
    ...porzingis,
    publicId: `nba-${id}`,
    externalId: id,
    firstName,
    lastName,
    currentTeamExternalId: null,
  });

  beforeEach(async () => {
    await upsertTeams(handle.db, [celtics, sixers]);
    await upsertGames(handle.db, [
      {
        ...nbaGame,
        season: '2025-26',
        gameDate: '2026-03-16',
        startTimeUtc: '2026-03-16T23:30:00.000Z',
      },
    ]);
    // Both on page 1; Porziņģis is not.
    await upsertPlayers(
      handle.db,
      [athlete('3945274', 'Luka', 'Dončić'), athlete('4278073', 'Shai', 'Gilgeous-Alexander')],
      NO_OVERRIDES,
    );
  });

  const seasonStats = () => runJob(ctx, 'season-stats', seasonStatsJob, { league: 'NBA' });

  it("stores the stored players' rows and counts the rest as skipped", async () => {
    useRoutes({ [PAGE_1]: pageOne({ pages: 1, count: 50 }) });
    const result = await seasonStats();

    expect(result.status).toBe('succeeded');
    expect(countOf(result, 'rows')).toBe(2);
    expect(countOf(result, 'skipped')).toBe(48);
    expect(countOf(result, 'requests')).toBe(1);
    const stored = await handle.db
      .select({ player: players.publicId })
      .from(players)
      .innerJoin(seasonStatsTable, eq(seasonStatsTable.playerId, players.id));
    expect(stored.map((r) => r.player).sort()).toEqual([DONCIC, SGA]);
  });

  it('a page count over the budget fails the run after one request (AC7)', async () => {
    useRoutes({ [PAGE_1]: pageOne({ pages: 21, count: 1050 }) });
    const result = await seasonStats();

    expect(result.status).toBe('failed');
    expect(result.status === 'skipped' ? undefined : result.error).toContain(
      'espn-nba byathlete: 21 pages exceeds the budget of 20',
    );
    expect(client.requests).toEqual([PAGE_1]);
  });
});

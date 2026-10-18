import type { DbHandle } from '../src/db/client';
import { upsertPlayers } from '../src/db/players';
import { resultsJob } from '../src/jobs/results';
import { rosterJob } from '../src/jobs/roster';
import { createLogger, type JobContext, runJob } from '../src/jobs/runner';
import { scheduleJob } from '../src/jobs/schedule';
import { espnUrls } from '../src/sources/espn-nba';
import { nhlUrls } from '../src/sources/nhl';
import { createTestDb } from './db';
import { freeAgent, girgensons, NO_OVERRIDES } from './db-data';
import { fakeClient } from './fake-client';
import { loadFixture } from './fixtures';

export const MERZLIKINS = 'nhl-8478007';
export const SILOVS = 'nhl-8481668';
export const RUST = 'nhl-8475810';
export const GIRGENSONS = 'nhl-8476878';
export const FREE_AGENT = 'nhl-8479356';
export const PORZINGIS = 'nba-3102531';
export const LEONS = 'nba-4897449';

const ROSTER_DAY = '2026-10-18';
const TEAMS = ['CBJ', 'FLA', 'PIT'];
const NHL_DAY = '2026-01-17';
const NHL_GAME = '2025020760';
const NHL_WEEK = '2026-03-24';
const NBA_DAYS = ['2026-03-16', '2026-03-23'];

function calendar(): unknown {
  const raw = loadFixture('nhl', 'schedule-calendar', ROSTER_DAY) as {
    teams: { abbrev: string }[];
  };
  raw.teams = raw.teams.filter((t) => TEAMS.includes(t.abbrev));
  return raw;
}

function score(): unknown {
  const raw = loadFixture('nhl', 'score', NHL_DAY) as { games: { id: number }[] };
  raw.games = raw.games.filter((g) => String(g.id) === NHL_GAME);
  return raw;
}

// Every API test's data, stored by the real jobs over recorded fixtures; any other URL is a 404.
export async function seedApiDb(): Promise<DbHandle> {
  const handle = await createTestDb();
  const ctx: JobContext = {
    db: handle.db,
    client: fakeClient({
      [nhlUrls.scheduleCalendar(ROSTER_DAY)]: calendar(),
      ...Object.fromEntries(TEAMS.map((t) => [nhlUrls.roster(t), loadFixture('nhl', 'roster', t)])),
      [nhlUrls.score(NHL_DAY)]: score(),
      [nhlUrls.boxscore(NHL_GAME)]: loadFixture('nhl', 'boxscore', NHL_GAME),
      [nhlUrls.playerLanding('8476878')]: loadFixture('nhl', 'player-landing', '8476878'),
      [nhlUrls.playerLanding('8478007')]: loadFixture('nhl', 'player-landing', '8478007'),
      [nhlUrls.schedule(NHL_WEEK)]: loadFixture('nhl', 'schedule', NHL_WEEK),
      ...Object.fromEntries(
        NBA_DAYS.map((d) => [espnUrls.scoreboard(d), loadFixture('espn-nba', 'scoreboard', d)]),
      ),
      [espnUrls.summary('401810839')]: loadFixture('espn-nba', 'summary', '401810839'),
      [espnUrls.summary('401810899')]: loadFixture('espn-nba', 'summary', '401810899'),
      [espnUrls.athlete('3102531')]: loadFixture('espn-nba', 'athlete', '3102531'),
    }),
    now: () => new Date(`${ROSTER_DAY}T12:00:00Z`),
    log: createLogger(() => {}),
    overrides: NO_OVERRIDES,
  };
  await runJob(ctx, 'roster', rosterJob, { league: 'NHL' });
  await runJob(ctx, 'results', resultsJob, { league: 'NHL', date: NHL_DAY });
  await runJob(ctx, 'schedule', scheduleJob, { league: 'NHL', date: NHL_WEEK });
  for (const date of NBA_DAYS) await runJob(ctx, 'results', resultsJob, { league: 'NBA', date });
  await upsertPlayers(
    handle.db,
    [
      { ...girgensons, currentTeamExternalId: '29' },
      { ...freeAgent, birthCountry: 'LVA' },
    ],
    NO_OVERRIDES,
  );
  return handle;
}

import type { DbHandle } from '../src/db/client';
import { upsertPlayers } from '../src/db/players';
import { upsertTeams } from '../src/db/teams';
import { resultsJob } from '../src/jobs/results';
import { rosterJob } from '../src/jobs/roster';
import { createLogger, type Job, type JobArgs, type JobContext, runJob } from '../src/jobs/runner';
import { scheduleJob } from '../src/jobs/schedule';
import { seasonStatsJob } from '../src/jobs/season-stats';
import { loadNationalityOverrides } from '../src/nationality/overrides';
import { espnUrls, mapAthlete, mapTeams } from '../src/sources/espn-nba';
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
export const EMBIID = 'nba-3059318';
export const TOWNS = 'nba-3136195';
// Not on any recorded roster, so the real roster run deactivates him.
export const GUSTAVSEN = 'nhl-1000001';
export const FORSLING = 'nhl-8478055';

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

// Page 1 of the recorded 2025-26 regular season as the only page, so the job asks for no other.
function byathletePageOne(): unknown {
  const raw = loadFixture('espn-nba', 'byathlete', '2026') as {
    pagination: { pages: number; count: number };
  };
  raw.pagination = { ...raw.pagination, pages: 1, count: 50 };
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
      [nhlUrls.summary('skater', '20252026', 2)]: loadFixture(
        'nhl',
        'skater-summary-reg-all',
        '20252026',
      ),
      [nhlUrls.summary('goalie', '20252026', 2)]: loadFixture(
        'nhl',
        'goalie-summary-reg-all',
        '20252026',
      ),
      [espnUrls.byathlete('2026', 2, 1)]: byathletePageOne(),
    }),
    now: () => new Date(`${ROSTER_DAY}T12:00:00Z`),
    log: createLogger(() => {}),
    overrides: NO_OVERRIDES,
  };
  // runJob records a failure instead of throwing and the log is silenced, so a broken seed must fail here.
  const run = async (name: string, job: Job, args: JobArgs) => {
    const result = await runJob(ctx, name, job, args);
    if (result.status === 'failed' || result.status === 'skipped') {
      const error = result.status === 'failed' ? result.error : 'skipped';
      const what = [name, args.league, args.date].filter(Boolean).join(' ');
      throw new Error(`seed: ${what} failed: ${error}`);
    }
  };
  await upsertPlayers(
    handle.db,
    [
      {
        ...freeAgent,
        publicId: GUSTAVSEN,
        externalId: '1000001',
        firstName: 'Ola',
        lastName: 'Gustavsen',
        birthCountry: 'NOR',
        currentTeamExternalId: null,
      },
    ],
    NO_OVERRIDES,
  );
  await run('roster', rosterJob, { league: 'NHL' });
  await run('results', resultsJob, { league: 'NHL', date: NHL_DAY });
  await run('schedule', scheduleJob, { league: 'NHL', date: NHL_WEEK });
  for (const date of NBA_DAYS) await run('results', resultsJob, { league: 'NBA', date });
  await upsertPlayers(
    handle.db,
    [
      { ...girgensons, currentTeamExternalId: '29' },
      { ...freeAgent, birthCountry: 'LVA' },
    ],
    NO_OVERRIDES,
  );
  await upsertTeams(handle.db, mapTeams(loadFixture('espn-nba', 'teams', '2026-10-18')).teams);
  const [embiid, towns] = ['3059318', '3136195'].map(
    (id) => mapAthlete(loadFixture('espn-nba', 'athlete', id)).player,
  );
  if (!embiid || !towns) throw new Error('seed: athletes not mapped');
  await upsertPlayers(handle.db, [embiid, towns], await loadNationalityOverrides());
  await run('season-stats', seasonStatsJob, { league: 'NHL' });
  await run('season-stats', seasonStatsJob, { league: 'NBA' });
  return handle;
}

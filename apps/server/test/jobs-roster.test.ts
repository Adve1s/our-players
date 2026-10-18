import { eq } from 'drizzle-orm';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { DbHandle } from '../src/db/client';
import { upsertPlayers } from '../src/db/players';
import { jobRuns, players, teams } from '../src/db/schema';
import { upsertTeams } from '../src/db/teams';
import { rosterJob } from '../src/jobs/roster';
import { createLogger, type JobContext, runJob } from '../src/jobs/runner';
import { nhlUrls } from '../src/sources/nhl';
import { createTestDb } from './db';
import { girgensons, NO_OVERRIDES, nyi, override, overrides } from './db-data';
import { fakeClient } from './fake-client';
import { loadFixture } from './fixtures';

const TODAY = '2026-10-18';
const TEAMS = ['CBJ', 'FLA', 'PIT'];
const SILOVS = 'nhl-8481668';

type RawRosterPlayer = Record<string, unknown> & { id: number };
type RawRoster = {
  forwards: RawRosterPlayer[];
  defensemen: RawRosterPlayer[];
  goalies: RawRosterPlayer[];
};

// The recorded calendar cut to the three teams whose rosters are recorded.
function calendar(): unknown {
  const raw = loadFixture('nhl', 'schedule-calendar', TODAY) as { teams: { abbrev: string }[] };
  raw.teams = raw.teams.filter((t) => TEAMS.includes(t.abbrev));
  return raw;
}

const roster = (abbrev: string) => loadFixture('nhl', 'roster', abbrev) as RawRoster;
const rosterSize = (r: RawRoster) => r.forwards.length + r.defensemen.length + r.goalies.length;

// CBJ's roster with Girgensons added, built from a recorded forward so it parses like the real thing.
function cbjWithGirgensons(): RawRoster {
  const r = roster('CBJ');
  const [first] = r.forwards;
  if (!first) throw new Error('test setup: CBJ has no forwards');
  r.forwards.push({
    ...first,
    id: Number(girgensons.externalId),
    firstName: { default: girgensons.firstName },
    lastName: { default: girgensons.lastName },
    sweaterNumber: Number(girgensons.jersey),
    positionCode: girgensons.position,
    birthDate: girgensons.birthDate,
    birthCity: { default: girgensons.birthCity },
    birthCountry: girgensons.birthCountry,
  });
  return r;
}

function routes(skip: string[] = [], cbj: RawRoster = roster('CBJ')): Record<string, unknown> {
  const all: Record<string, unknown> = {
    [nhlUrls.scheduleCalendar(TODAY)]: calendar(),
    [nhlUrls.roster('CBJ')]: cbj,
    [nhlUrls.roster('FLA')]: roster('FLA'),
    [nhlUrls.roster('PIT')]: roster('PIT'),
  };
  for (const url of skip) delete all[url];
  return all;
}

let handle: DbHandle;
let ctx: JobContext;

beforeAll(async () => (await createTestDb()).close(), 30_000);

beforeEach(async () => {
  handle = await createTestDb();
  ctx = {
    db: handle.db,
    client: fakeClient({}),
    now: () => new Date(`${TODAY}T12:00:00Z`),
    log: createLogger(() => {}),
    overrides: NO_OVERRIDES,
  };
  // Girgensons is on none of the three rosters.
  await upsertTeams(handle.db, [nyi]);
  await upsertPlayers(handle.db, [girgensons], NO_OVERRIDES);
});

afterEach(() => handle.close());

async function rosterRun(r: Record<string, unknown> = routes()) {
  ctx.client = fakeClient(r);
  const result = await runJob(ctx, 'roster', rosterJob, { league: 'NHL' });
  if (result.status === 'skipped') throw new Error('test setup: roster run skipped');
  return result;
}

async function playerRow(publicId: string) {
  const [row] = await handle.db
    .select({
      active: players.active,
      teamId: players.currentTeamId,
      team: teams.abbrev,
      nationality: players.nationality,
      nationalitySource: players.nationalitySource,
    })
    .from(players)
    .leftJoin(teams, eq(teams.id, players.currentTeamId))
    .where(eq(players.publicId, publicId));
  if (!row) throw new Error(`test setup: player ${publicId} not stored`);
  return row;
}

describe('rosterJob', () => {
  it('roster stores every player of every team', async () => {
    const result = await rosterRun();

    const total = TEAMS.reduce((n, t) => n + rosterSize(roster(t)), 0);
    // Plus the seeded Girgensons.
    expect(await handle.db.select().from(players)).toHaveLength(total + 1);
    const silovs = await playerRow(SILOVS);
    expect(silovs.team).toBe('PIT');
    expect(silovs.nationality).toBe('LVA');
    expect(result.counts.teams).toBe(3);
  });

  it('roster asks the calendar for the US game day, not the UTC date', async () => {
    ctx.now = () => new Date('2026-10-19T03:00:00Z');
    const result = await rosterRun();

    expect(result.status).toBe('succeeded');
    expect(result.counts.teams).toBe(3);
  });

  it('a player missing from every roster becomes inactive with no team', async () => {
    const result = await rosterRun();

    const row = await playerRow(girgensons.publicId);
    expect(row.active).toBe(false);
    expect(row.teamId).toBeNull();
    expect(result.counts.deactivated).toBe(1);
  });

  it('he is restored when he reappears', async () => {
    await rosterRun();
    const result = await rosterRun(routes([], cbjWithGirgensons()));

    const row = await playerRow(girgensons.publicId);
    expect(row.active).toBe(true);
    expect(row.team).toBe('CBJ');
    expect(result.counts.reactivated).toBe(1);
  });

  it('a failed roster fetch changes no active flag and records partial', async () => {
    const result = await rosterRun(routes([nhlUrls.roster('PIT')]));

    const row = await playerRow(girgensons.publicId);
    expect(row.active).toBe(true);
    expect(row.team).toBe('NYI');
    const stored = await handle.db.select().from(players);
    expect(stored).toHaveLength(rosterSize(roster('CBJ')) + rosterSize(roster('FLA')) + 1);
    const [run] = await handle.db.select().from(jobRuns).where(eq(jobRuns.id, result.runId));
    expect(run?.status).toBe('partial');
    expect(run?.error).toContain('roster PIT');
  });

  it('an empty roster counts as a failed fetch', async () => {
    // Seeds PIT's players with Girgensons kept active, then puts him back on NYI.
    await rosterRun(routes([], cbjWithGirgensons()));
    await upsertPlayers(handle.db, [girgensons], NO_OVERRIDES);
    const empty = { ...roster('PIT'), forwards: [], defensemen: [], goalies: [] };
    const result = await rosterRun({ ...routes(), [nhlUrls.roster('PIT')]: empty });

    const row = await playerRow(girgensons.publicId);
    expect(row.active).toBe(true);
    expect(row.team).toBe('NYI');
    const silovs = await playerRow(SILOVS);
    expect(silovs.active).toBe(true);
    expect(silovs.team).toBe('PIT');
    const [run] = await handle.db.select().from(jobRuns).where(eq(jobRuns.id, result.runId));
    expect(run?.status).toBe('partial');
    expect(run?.error).toContain('roster PIT');
  });

  it('a re-run changes nothing', async () => {
    await rosterRun();
    const stamps = async () =>
      handle.db
        .select({ publicId: players.publicId, updatedAt: players.updatedAt })
        .from(players)
        .orderBy(players.publicId);
    const before = await stamps();
    const result = await rosterRun();

    expect(result.counts.deactivated).toBe(0);
    expect(result.counts.reactivated).toBe(0);
    expect(await stamps()).toEqual(before);
  });

  it('overrides apply on the roster write', async () => {
    ctx.overrides = overrides(override(SILOVS, 'Arturs Silovs', 'EST'));
    await rosterRun();

    const silovs = await playerRow(SILOVS);
    expect(silovs.nationality).toBe('EST');
    expect(silovs.nationalitySource).toBe('override');
  });

  it('a failed calendar fetch fails the run', async () => {
    const result = await rosterRun(routes([nhlUrls.scheduleCalendar(TODAY)]));

    expect(result.status).toBe('failed');
    // Only the seeded Girgensons, untouched.
    expect(await handle.db.select().from(players)).toHaveLength(1);
    expect((await playerRow(girgensons.publicId)).active).toBe(true);
  });
});

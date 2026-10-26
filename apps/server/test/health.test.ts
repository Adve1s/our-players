import {
  dataHealthResponseSchema,
  errorResponseSchema,
  healthResponseSchema,
} from '@our-players/shared';
import { eq } from 'drizzle-orm';
import { beforeAll, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import type { Db } from '../src/db/client';
import { upsertGames } from '../src/db/games';
import { finishJobRun, type JobStatus, startJobRun } from '../src/db/job-runs';
import { jobRuns } from '../src/db/schema';
import { upsertTeams } from '../src/db/teams';
import { createLogger } from '../src/jobs/runner';
import { createTestDb } from './db';
import { cbj, nhlGame, nyi } from './db-data';

// The first createTestDb() migrates this file's template (~3 s, longer under parallel load).
beforeAll(async () => (await createTestDb()).close(), 30_000);

// Before the wall clock, so job runs (finished_at = DB now()) are never older than the 50 h schedule limit.
const NOW = new Date('2026-03-17T12:00:00Z');

async function run(db: Db, job: string, status: JobStatus, league = 'NHL') {
  const id = await startJobRun(db, job, { league });
  if (status !== 'running') await finishJobRun(db, id, { status, counts: {}, error: null });
}

async function setup() {
  const handle = await createTestDb();
  const roster = await startJobRun(handle.db, 'roster', { league: 'NHL' });
  await finishJobRun(handle.db, roster, { status: 'succeeded', counts: {}, error: null });
  const results = await startJobRun(handle.db, 'results', { league: 'NHL' });
  await finishJobRun(handle.db, results, { status: 'failed', counts: {}, error: 'boom' });
  const lines: string[] = [];
  const app = createApp({
    db: handle.db,
    now: () => NOW,
    log: createLogger((_, line) => lines.push(line)),
  });
  return { handle, app, lines };
}

it('GET /health answers ok with the last success per job, skipping jobs that never succeeded', async () => {
  const { app } = await setup();
  const res = await app.request('/health');
  expect(res.status).toBe(200);
  const body = healthResponseSchema.parse(await res.json());
  expect(body.ok).toBe(true);
  expect(body.lastSuccess).toHaveProperty('roster');
  expect(body.lastSuccess).not.toHaveProperty('results');
});

it('GET /health answers 503 UNAVAILABLE when the database is closed', async () => {
  const { app, handle } = await setup();
  await handle.close();
  const res = await app.request('/health');
  expect(res.status).toBe(503);
  const body = errorResponseSchema.parse(await res.json());
  expect(body.error.code).toBe('UNAVAILABLE');
});

it('an unknown route answers 404 NOT_FOUND in the error format', async () => {
  const { app } = await setup();
  const res = await app.request('/nope');
  expect(res.status).toBe(404);
  expect(errorResponseSchema.parse(await res.json()).error.code).toBe('NOT_FOUND');
});

it('request logs carry the path but never the query string', async () => {
  const { app, lines } = await setup();
  await app.request('/health?countries=LVA&fav=nhl-8475810');
  const logged = lines.map((l) => JSON.parse(l) as Record<string, unknown>);
  expect(logged).toContainEqual(
    expect.objectContaining({ msg: 'request', path: '/health', status: 200 }),
  );
  for (const line of lines) {
    expect(line).not.toContain('?');
    expect(line).not.toContain('LVA');
    expect(line).not.toContain('8475810');
  }
});

// setup() also stores one failed NHL results run, short of the three that count as stale.
async function dataSetup() {
  const s = await setup();
  await run(s.handle.db, 'schedule', 'succeeded');
  await run(s.handle.db, 'schedule', 'succeeded', 'NBA');
  return s;
}

it('GET /health/data answers ok when the schedule ran and no game is late', async () => {
  const { app } = await dataSetup();
  const res = await app.request('/health/data');
  expect(res.status).toBe(200);
  expect(dataHealthResponseSchema.parse(await res.json()).ok).toBe(true);
});

it('GET /health/data answers 503 STALE naming a game with no box score 5 h after its start', async () => {
  const { app, handle } = await dataSetup();
  await upsertTeams(handle.db, [cbj, nyi]);
  const startTimeUtc = new Date(NOW.getTime() - 5 * 3_600_000).toISOString();
  await upsertGames(handle.db, [{ ...nhlGame, status: 'SCHEDULED', startTimeUtc }]);
  const res = await app.request('/health/data');
  expect(res.status).toBe(503);
  const body = errorResponseSchema.parse(await res.json());
  expect(body.error.code).toBe('STALE');
  expect(body.error.message).toContain(nhlGame.publicId);
  expect((await app.request('/health')).status).toBe(200);
});

it('GET /health/data answers 503 when the newest 3 finished NHL results runs all fell short', async () => {
  const { app, handle } = await dataSetup();
  // An older success and a newer running run must both be left out of the last 3.
  for (const status of ['succeeded', 'partial', 'partial', 'partial', 'running'] as const) {
    await run(handle.db, 'results', status);
  }
  await run(handle.db, 'results', 'succeeded', 'NBA');
  const res = await app.request('/health/data');
  expect(res.status).toBe(503);
  const body = errorResponseSchema.parse(await res.json());
  expect(body.error.message).toContain('NHL: last 3 results runs failed or partial');
  expect(body.error.message).not.toContain('NBA');
});

it('GET /health/data ignores results runs started more than 48 h ago', async () => {
  const { app, handle } = await dataSetup();
  for (let i = 0; i < 3; i++) await run(handle.db, 'results', 'partial');
  // started_at defaults to the DB's now(), so the test moves the runs back before the fixed clock.
  await handle.db
    .update(jobRuns)
    .set({ startedAt: new Date(NOW.getTime() - 49 * 3_600_000) })
    .where(eq(jobRuns.job, 'results'));
  const res = await app.request('/health/data');
  expect(res.status).toBe(200);
});

// finished_at is the DB's now(), after the fixed clock, so any counted run is fresh.
it('GET /health/data counts a partial schedule run as a success', async () => {
  const { app, handle } = await setup();
  await run(handle.db, 'schedule', 'partial');
  await run(handle.db, 'schedule', 'partial', 'NBA');
  expect((await app.request('/health/data')).status).toBe(200);
});

it('GET /health/data does not count a failed schedule run as a success', async () => {
  const { app, handle } = await setup();
  await run(handle.db, 'schedule', 'failed');
  await run(handle.db, 'schedule', 'succeeded', 'NBA');
  const res = await app.request('/health/data');
  expect(res.status).toBe(503);
  expect(errorResponseSchema.parse(await res.json()).error.message).toContain(
    'NHL: no successful schedule run in 50 h',
  );
});

it('GET /health/data answers 503 when only the NBA schedule keeps failing', async () => {
  const { app, handle } = await setup();
  await run(handle.db, 'schedule', 'succeeded');
  await run(handle.db, 'schedule', 'failed', 'NBA');
  const res = await app.request('/health/data');
  expect(res.status).toBe(503);
  const message = errorResponseSchema.parse(await res.json()).error.message;
  expect(message).toContain('NBA: no successful schedule run in 50 h');
  expect(message).not.toContain('NHL');
});

it('GET /health/data answers 503 UNAVAILABLE when the database is closed', async () => {
  const { app, handle } = await dataSetup();
  await handle.close();
  const res = await app.request('/health/data');
  expect(res.status).toBe(503);
  expect(errorResponseSchema.parse(await res.json()).error.code).toBe('UNAVAILABLE');
});

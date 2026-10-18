import { errorResponseSchema, healthResponseSchema } from '@our-players/shared';
import { beforeAll, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { finishJobRun, startJobRun } from '../src/db/job-runs';
import { createLogger } from '../src/jobs/runner';
import { createTestDb } from './db';

// The first createTestDb() migrates this file's template (~3 s, longer under parallel load).
beforeAll(async () => (await createTestDb()).close(), 30_000);

async function setup() {
  const handle = await createTestDb();
  const roster = await startJobRun(handle.db, 'roster', { league: 'NHL' });
  await finishJobRun(handle.db, roster, { status: 'succeeded', counts: {}, error: null });
  const results = await startJobRun(handle.db, 'results', { league: 'NHL' });
  await finishJobRun(handle.db, results, { status: 'failed', counts: {}, error: 'boom' });
  const lines: string[] = [];
  const app = createApp({
    db: handle.db,
    now: () => new Date('2026-03-17T12:00:00Z'),
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

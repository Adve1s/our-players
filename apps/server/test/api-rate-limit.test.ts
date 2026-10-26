import { errorResponseSchema } from '@our-players/shared';
import type { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import type { DbHandle } from '../src/db/client';
import { createLogger } from '../src/jobs/runner';
import { createTestDb } from './db';

const ORIGIN = 'https://web.example';
const IP = '203.0.113.7';

let handle: DbHandle;

beforeAll(async () => {
  handle = await createTestDb();
}, 60_000);

afterAll(async () => {
  await handle.close();
});

// Each test gets its own app (fresh counters) and a clock it can move.
function setup(rateLimitPerMinute: number | null = 3) {
  const clock = { now: new Date('2026-10-25T12:00:10Z') };
  const app = createApp({
    db: handle.db,
    now: () => clock.now,
    log: createLogger(() => {}),
    corsOrigins: [ORIGIN],
    ...(rateLimitPerMinute === null ? {} : { rateLimitPerMinute }),
  });
  return { app, clock };
}

const get = (app: Hono, xff: string, headers: Record<string, string> = {}, path = '/v1/meta') =>
  app.request(path, { headers: { 'X-Forwarded-For': xff, ...headers } });

async function useUpLimit(app: Hono) {
  for (let i = 0; i < 3; i++) expect((await get(app, IP)).status).toBe(200);
}

describe('rate limit on /v1', () => {
  it('answers 429 RATE_LIMITED with Retry-After to the window end once the limit is used up', async () => {
    const { app } = setup();
    await useUpLimit(app);
    const res = await get(app, IP);
    expect(res.status).toBe(429);
    expect(errorResponseSchema.parse(await res.json()).error.code).toBe('RATE_LIMITED');
    expect(res.headers.get('retry-after')).toBe('50');
  });

  it('a 429 still carries the allow-origin header for a configured origin', async () => {
    const { app } = setup();
    await useUpLimit(app);
    const res = await get(app, IP, { Origin: ORIGIN });
    expect(res.status).toBe(429);
    expect(res.headers.get('access-control-allow-origin')).toBe(ORIGIN);
  });

  it('counts each IP separately', async () => {
    const { app } = setup();
    await useUpLimit(app);
    expect((await get(app, '198.51.100.1')).status).toBe(200);
  });

  it('keys on the last X-Forwarded-For entry', async () => {
    const { app } = setup();
    await useUpLimit(app);
    expect((await get(app, `198.51.100.1, ${IP}`)).status).toBe(429);
  });

  it('starts counting again in the next window', async () => {
    const { app, clock } = setup();
    await useUpLimit(app);
    clock.now = new Date('2026-10-25T12:01:00Z');
    expect((await get(app, IP)).status).toBe(200);
  });

  it('leaves /health outside the limit', async () => {
    const { app } = setup();
    await useUpLimit(app);
    expect((await get(app, IP, {}, '/health')).status).toBe(200);
  });

  it('without rateLimitPerMinute there is no limit', async () => {
    const { app } = setup(null);
    for (let i = 0; i < 10; i++) expect((await get(app, IP)).status).toBe(200);
  });
});

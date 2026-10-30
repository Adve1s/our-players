import type { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import type { DbHandle } from '../src/db/client';
import { createLogger } from '../src/jobs/runner';
import { createTestDb } from './db';

const now = () => new Date('2026-03-24T06:00:00Z');

let handle: DbHandle;
let app: Hono;

beforeAll(async () => {
  handle = await createTestDb();
  app = createApp({ db: handle.db, now, log: createLogger(() => {}) });
}, 60_000);

afterAll(async () => {
  await handle.close();
});

describe('security headers on API responses', () => {
  it.each([
    ['a 200 from /v1', '/v1/meta'],
    ['/health', '/health'],
    ['a 400', '/v1/days/2026-13-45'],
    ['a 404', '/v1/nope'],
  ])('%s carries HSTS and nosniff', async (_name, path) => {
    const res = await app.request(path);
    expect(res.headers.get('strict-transport-security')).toBe(
      'max-age=15552000; includeSubDomains',
    );
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('a 429 over the rate limit carries HSTS and nosniff', async () => {
    // A second app on the same test DB with rateLimitPerMinute: 2 and a fixed clock: the third request is over.
    const limited = createApp({
      db: handle.db,
      now: () => new Date('2026-03-24T06:00:00Z'),
      log: createLogger(() => {}),
      rateLimitPerMinute: 2,
    });
    await limited.request('/v1/meta');
    await limited.request('/v1/meta');
    const res = await limited.request('/v1/meta');
    expect(res.status).toBe(429);
    expect(res.headers.get('strict-transport-security')).toBe(
      'max-age=15552000; includeSubDomains',
    );
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });
});

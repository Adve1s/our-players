import type { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import type { DbHandle } from '../src/db/client';
import { createLogger } from '../src/jobs/runner';
import { createTestDb } from './db';

const ALLOWED = 'http://localhost:8081';

let handle: DbHandle;
let app: Hono;

beforeAll(async () => {
  handle = await createTestDb();
  app = createApp({
    db: handle.db,
    now: () => new Date('2026-03-24T06:00:00Z'),
    log: createLogger(() => {}),
    corsOrigins: [ALLOWED],
  });
}, 60_000);

afterAll(async () => {
  await handle.close();
});

describe('CORS on /v1', () => {
  it('a GET from a configured origin is allowed for that origin and varies on Origin', async () => {
    const res = await app.request('/v1/meta', { headers: { Origin: ALLOWED } });
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe(ALLOWED);
    expect(res.headers.get('vary')).toContain('Origin');
  });

  it('a GET from another origin gets no allow-origin header', async () => {
    const res = await app.request('/v1/meta', { headers: { Origin: 'https://evil.example' } });
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('a GET without an Origin gets no allow-origin header', async () => {
    const res = await app.request('/v1/meta');
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('a preflight from a configured origin answers 204 and allows GET', async () => {
    const res = await app.request('/v1/meta', {
      method: 'OPTIONS',
      headers: { Origin: ALLOWED, 'Access-Control-Request-Method': 'GET' },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-methods')).toContain('GET');
  });

  it('an error response still carries the allow-origin header', async () => {
    const res = await app.request('/v1/days/2026-02-30', { headers: { Origin: ALLOWED } });
    expect(res.status).toBe(400);
    expect(res.headers.get('access-control-allow-origin')).toBe(ALLOWED);
  });

  it('/health is outside /v1 and gets no allow-origin header', async () => {
    const res = await app.request('/health', { headers: { Origin: ALLOWED } });
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });
});

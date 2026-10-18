import { metaResponseSchema } from '@our-players/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import type { Db, DbHandle } from '../src/db/client';
import { createLogger } from '../src/jobs/runner';
import { seedApiDb } from './api-seed';
import { createTestDb } from './db';

let seeded: DbHandle;
let empty: DbHandle;

beforeAll(async () => {
  seeded = await seedApiDb();
  empty = await createTestDb();
}, 60_000);

afterAll(async () => {
  await seeded.close();
  await empty.close();
});

// 08:00 in Riga (EET) on 2026-03-24.
const NOW = new Date('2026-03-24T06:00:00Z');

async function meta(db: Db) {
  const app = createApp({ db, now: () => NOW, log: createLogger(() => {}) });
  const res = await app.request('/v1/meta');
  expect(res.status).toBe(200);
  return metaResponseSchema.parse(await res.json());
}

describe('GET /v1/meta', () => {
  it('each league has its current season and the latest game day that has started', async () => {
    const { leagues } = await meta(seeded.db);

    // NBA's latest is the US date before Riga's 03-24; NHL's 03-24 games haven't started yet.
    expect(leagues).toEqual([
      { league: 'NHL', currentSeason: '2025-26', latestGameDate: '2026-01-17' },
      { league: 'NBA', currentSeason: '2025-26', latestGameDate: '2026-03-23' },
    ]);
  });

  it('dataUpdatedAt is the last results run that stored data', async () => {
    const { dataUpdatedAt } = await meta(seeded.db);

    expect(typeof dataUpdatedAt).toBe('string');
  });

  it('an empty database has no season, no game day and no update time', async () => {
    expect(await meta(empty.db)).toEqual({
      leagues: [
        { league: 'NHL', currentSeason: null, latestGameDate: null },
        { league: 'NBA', currentSeason: null, latestGameDate: null },
      ],
      dataUpdatedAt: null,
    });
  });
});

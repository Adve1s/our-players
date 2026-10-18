import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { DbHandle } from '../src/db/client';
import { loadRecap } from '../src/recap';
import { seedApiDb } from './api-seed';

let handle: DbHandle;

beforeAll(async () => {
  handle = await seedApiDb();
}, 60_000);

afterAll(() => handle.close());

describe('seedApiDb', () => {
  it('stores the NHL results day as one regular-season game with its date and period scores', async () => {
    const { games } = await loadRecap(handle.db, '2026-01-17');

    expect(games).toHaveLength(1);
    expect(games[0]?.seasonType).toBe('REG');
    expect(games[0]?.gameDate).toBe('2026-01-17');
    expect(games[0]?.periodScores?.length).toBeGreaterThanOrEqual(3);
  });

  it('stores the eight NBA games of 2026-03-16', async () => {
    const { games } = await loadRecap(handle.db, '2026-03-16');

    expect(games.filter((g) => g.league === 'NBA')).toHaveLength(8);
  });

  it('stores the fifteen NHL games of 2026-03-24 from the schedule week', async () => {
    const { games } = await loadRecap(handle.db, '2026-03-24');

    expect(games.filter((g) => g.league === 'NHL')).toHaveLength(15);
  });
});

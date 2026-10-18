import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { DbHandle } from '../src/db/client';
import { players, seasonStats } from '../src/db/schema';
import { loadRecap } from '../src/recap';
import { EMBIID, GIRGENSONS, GUSTAVSEN, MERZLIKINS, seedApiDb, TOWNS } from './api-seed';

let handle: DbHandle;

beforeAll(async () => {
  handle = await seedApiDb();
}, 60_000);

afterAll(() => handle.close());

async function playerRow(publicId: string) {
  const [row] = await handle.db.select().from(players).where(eq(players.publicId, publicId));
  if (!row) throw new Error(`player ${publicId} not stored`);
  return row;
}

async function regKinds(publicId: string) {
  const rows = await handle.db
    .select({ kind: seasonStats.kind })
    .from(seasonStats)
    .innerJoin(players, eq(players.id, seasonStats.playerId))
    .where(
      and(
        eq(players.publicId, publicId),
        eq(seasonStats.season, '2025-26'),
        eq(seasonStats.seasonType, 'REG'),
      ),
    );
  return rows.map((r) => r.kind);
}

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

  it('stores the former player inactive, deactivated by the roster run', async () => {
    expect((await playerRow(GUSTAVSEN)).active).toBe(false);
  });

  it('gives Embiid the committed override USA over his birth country CMR', async () => {
    const row = await playerRow(EMBIID);
    expect(row.nationality).toBe('USA');
    expect(row.nationalitySource).toBe('override');
    expect(row.birthCountry).toBe('CMR');
    expect(row.active).toBe(true);
  });

  it('gives Towns the committed override DOM over his birth country USA', async () => {
    const row = await playerRow(TOWNS);
    expect(row.nationality).toBe('DOM');
    expect(row.nationalitySource).toBe('override');
    expect(row.birthCountry).toBe('USA');
  });

  it.each([
    [GIRGENSONS, 'hockey_skater'],
    [MERZLIKINS, 'hockey_goalie'],
    [TOWNS, 'basketball_player'],
  ])('stores a 2025-26 regular-season row for %s of kind %s', async (publicId, kind) => {
    expect(await regKinds(publicId)).toEqual([kind]);
  });
});

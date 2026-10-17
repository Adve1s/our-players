import type { Player } from '@our-players/shared';
import { eq } from 'drizzle-orm';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import type { Db, DbHandle } from '../src/db/client';
import { upsertPlayers } from '../src/db/players';
import { players } from '../src/db/schema';
import { upsertTeams } from '../src/db/teams';
import { recomputeNationalities } from '../src/nationality/recompute';
import { createTestDb } from './db';
import {
  bertans,
  embiid,
  freeAgent,
  girgensons,
  merzlikins,
  NO_OVERRIDES,
  nba,
  nhl,
  override,
  overrides,
  porzingis,
} from './db-data';

const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

const embiidOverride = override(embiid.publicId, 'Joel Embiid', 'USA');

// Stored as the roster job would before the overrides file changed: no overrides applied.
async function storePlayers(db: Db, list: readonly Player[] = [...nhl.players, ...nba.players]) {
  await upsertTeams(db, [...nhl.teams, ...nba.teams]);
  await upsertPlayers(db, list, NO_OVERRIDES);
}

async function nationalityOf(db: Db, publicId: string) {
  const [row] = await db
    .select({ nationality: players.nationality, source: players.nationalitySource })
    .from(players)
    .where(eq(players.publicId, publicId));
  if (!row) throw new Error(`test setup: player ${publicId} not stored`);
  return row;
}

describe('recomputeNationalities', () => {
  // The first createTestDb() migrates this file's template (~3 s, longer under parallel load).
  beforeAll(async () => (await createTestDb()).close(), 30_000);
  let handle: DbHandle | undefined;
  let warn: MockInstance<typeof console.warn>;
  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(async () => {
    warn.mockRestore();
    await handle?.close();
    handle = undefined;
  });
  async function open(): Promise<Db> {
    handle = await createTestDb();
    return handle.db;
  }

  describe('stored players get the resolver’s nationality (AC 4)', () => {
    it('the overridden player gets the override code with source override', async () => {
      const db = await open();
      await storePlayers(db);
      await recomputeNationalities(db, overrides(embiidOverride));
      expect(await nationalityOf(db, embiid.publicId)).toEqual({
        nationality: 'USA',
        source: 'override',
      });
    });

    it.each([
      ['Girgensons', girgensons.publicId],
      ['Merzļikins', merzlikins.publicId],
      ['Porziņģis', porzingis.publicId],
      ['Bertāns', bertans.publicId],
    ])('%s without an override keeps LVA with source birth', async (_name, publicId) => {
      const db = await open();
      await storePlayers(db);
      await recomputeNationalities(db, overrides(embiidOverride));
      expect(await nationalityOf(db, publicId)).toEqual({ nationality: 'LVA', source: 'birth' });
    });

    it('a player without a birth country gets null with source null', async () => {
      const db = await open();
      await storePlayers(db);
      await recomputeNationalities(db, overrides(embiidOverride));
      expect(await nationalityOf(db, freeAgent.publicId)).toEqual({
        nationality: null,
        source: null,
      });
    });

    it('updated counts only the rows whose nationality or source changed', async () => {
      const db = await open();
      await storePlayers(db);
      expect((await recomputeNationalities(db, overrides(embiidOverride))).updated).toBe(1);
    });

    it('a second run with the same overrides updates nothing', async () => {
      const db = await open();
      await storePlayers(db);
      await recomputeNationalities(db, overrides(embiidOverride));
      expect((await recomputeNationalities(db, overrides(embiidOverride))).updated).toBe(0);
    });

    it("leaves unchanged players' rows untouched, updated_at included", async () => {
      const db = await open();
      await storePlayers(db);
      const before = await db
        .select()
        .from(players)
        .where(eq(players.publicId, porzingis.publicId));
      await tick();
      await recomputeNationalities(db, overrides(embiidOverride));
      expect(
        await db.select().from(players).where(eq(players.publicId, porzingis.publicId)),
      ).toEqual(before);
    });

    it("a changed player's updated_at moves forward", async () => {
      const db = await open();
      await storePlayers(db);
      const [before] = await db.select().from(players).where(eq(players.publicId, embiid.publicId));
      await tick();
      await recomputeNationalities(db, overrides(embiidOverride));
      const [after] = await db.select().from(players).where(eq(players.publicId, embiid.publicId));
      expect(after?.updatedAt.getTime()).toBeGreaterThan(before?.updatedAt.getTime() ?? 0);
    });
  });

  describe('removed and redundant overrides', () => {
    it('removing an override reverts the player to the birth country with source birth', async () => {
      const db = await open();
      await upsertTeams(db, nba.teams);
      await upsertPlayers(db, nba.players, overrides(embiidOverride));
      const result = await recomputeNationalities(db, NO_OVERRIDES);
      expect(result.updated).toBe(1);
      expect(await nationalityOf(db, embiid.publicId)).toEqual({
        nationality: 'CMR',
        source: 'birth',
      });
    });

    it('an override equal to the birth country still has source override (D-030)', async () => {
      const db = await open();
      await storePlayers(db);
      const result = await recomputeNationalities(
        db,
        overrides(override(porzingis.publicId, 'Kristaps Porziņģis', 'LVA')),
      );
      expect(result.updated).toBe(1);
      expect(await nationalityOf(db, porzingis.publicId)).toEqual({
        nationality: 'LVA',
        source: 'override',
      });
    });

    it('removing an override equal to the birth country gives source birth', async () => {
      const db = await open();
      await storePlayers(db);
      await recomputeNationalities(
        db,
        overrides(override(porzingis.publicId, 'Kristaps Porziņģis', 'LVA')),
      );
      await recomputeNationalities(db, NO_OVERRIDES);
      expect(await nationalityOf(db, porzingis.publicId)).toEqual({
        nationality: 'LVA',
        source: 'birth',
      });
    });
  });

  describe('warnings (AC 4)', () => {
    const notStored = 'nationality override nba-3059318 (Joel Embiid): player not in the database';
    const mismatch =
      'nationality override nba-3059318: name "Joel Embiid" does not match stored "Joel Embid"';

    it("returns a warning for an override whose player isn't stored", async () => {
      const db = await open();
      await storePlayers(db, nhl.players);
      const { warnings } = await recomputeNationalities(db, overrides(embiidOverride));
      expect(warnings).toEqual([notStored]);
    });

    it('passes the not-stored warning to console.warn', async () => {
      const db = await open();
      await storePlayers(db, nhl.players);
      await recomputeNationalities(db, overrides(embiidOverride));
      expect(warn).toHaveBeenCalledWith(notStored);
    });

    it('returns a warning naming both names when the stored name differs', async () => {
      const db = await open();
      await storePlayers(db, [{ ...embiid, lastName: 'Embid' }]);
      const { warnings } = await recomputeNationalities(db, overrides(embiidOverride));
      expect(warnings).toEqual([mismatch]);
    });

    it('passes the name-mismatch warning to console.warn', async () => {
      const db = await open();
      await storePlayers(db, [{ ...embiid, lastName: 'Embid' }]);
      await recomputeNationalities(db, overrides(embiidOverride));
      expect(warn).toHaveBeenCalledWith(mismatch);
    });

    it.each([
      'Kristaps Porziņģis',
      'Kristaps Porzingis',
      'kristaps porzingis',
      'KRISTAPS PORZIŅĢIS',
    ])('override name "%s" for stored Kristaps Porziņģis gives no warning', async (name) => {
      const db = await open();
      await storePlayers(db);
      const { warnings } = await recomputeNationalities(
        db,
        overrides(override(porzingis.publicId, name, 'LVA')),
      );
      expect(warnings).toEqual([]);
      expect(warn).not.toHaveBeenCalled();
    });
  });
});

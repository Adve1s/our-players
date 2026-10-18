import type { Game } from '@our-players/shared';
import { eq } from 'drizzle-orm';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { Db, DbHandle } from '../src/db/client';
import { upsertGames } from '../src/db/games';
import { upsertPlayers } from '../src/db/players';
import { games } from '../src/db/schema';
import { upsertSeasonStats } from '../src/db/season-stats';
import { upsertTeams } from '../src/db/teams';
import { createTestDb } from './db';
import {
  cbj,
  celtics,
  girgensons,
  NO_OVERRIDES,
  nbaGame,
  nhlGame,
  nhlSeasonStats,
  nyi,
  sixers,
} from './db-data';

// The Date read back has millisecond resolution, so a later write needs a strictly later clock.
const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

async function gameRow(db: Db, publicId: string) {
  const [row] = await db.select().from(games).where(eq(games.publicId, publicId));
  if (!row) throw new Error(`test setup: game ${publicId} not stored`);
  return row;
}

const live = { ...nhlGame, status: 'LIVE', endedIn: null } satisfies Game;

describe('repository guards', () => {
  // The first createTestDb() migrates this file's template (~3 s, longer under parallel load).
  beforeAll(async () => (await createTestDb()).close(), 30_000);
  let handle: DbHandle | undefined;
  afterEach(async () => {
    await handle?.close();
    handle = undefined;
  });
  async function open(): Promise<Db> {
    handle = await createTestDb();
    await upsertTeams(handle.db, [cbj, nyi, celtics, sixers]);
    return handle.db;
  }

  describe('upsertGames keeps what a game already has', () => {
    it('a stored FINAL game is not set back to SCHEDULED', async () => {
      const db = await open();
      await upsertGames(db, [nhlGame]);
      const before = await gameRow(db, nhlGame.publicId);
      await tick();
      const scheduled = {
        ...nhlGame,
        status: 'SCHEDULED',
        homeScore: null,
        awayScore: null,
        periodScores: null,
        endedIn: null,
      } satisfies Game;

      expect(await upsertGames(db, [scheduled])).toBe(0);
      const row = await gameRow(db, nhlGame.publicId);
      expect(row.status).toBe('FINAL');
      expect(row.homeScore).toBe(3);
      expect(row.awayScore).toBe(2);
      expect(row.periodScores).toHaveLength(4);
      expect(row.endedIn).toBe('OT');
      expect(row.updatedAt.getTime()).toBe(before.updatedAt.getTime());
    });

    it('a stored FINAL game is not set back to LIVE', async () => {
      const db = await open();
      await upsertGames(db, [nhlGame]);
      const before = await gameRow(db, nhlGame.publicId);
      await tick();

      expect(await upsertGames(db, [{ ...live, homeScore: 2 }])).toBe(0);
      expect(await gameRow(db, nhlGame.publicId)).toEqual(before);
    });

    it('a FINAL game still takes a FINAL correction', async () => {
      const db = await open();
      await upsertGames(db, [nhlGame]);

      expect(await upsertGames(db, [{ ...nhlGame, homeScore: 4 }])).toBe(1);
      expect((await gameRow(db, nhlGame.publicId)).homeScore).toBe(4);
    });

    it('a row without period scores never replaces stored ones, but the rest of it is written', async () => {
      const db = await open();
      await upsertGames(db, [live]);
      const moved = {
        ...live,
        periodScores: null,
        startTimeUtc: '2026-10-08T00:00:00.000Z',
      } satisfies Game;

      expect(await upsertGames(db, [moved])).toBe(1);
      const row = await gameRow(db, nhlGame.publicId);
      expect(row.periodScores).toHaveLength(4);
      expect(row.startTimeUtc.toISOString()).toBe('2026-10-08T00:00:00.000Z');
    });

    it('a LIVE game with period scores can become POSTPONED', async () => {
      const db = await open();
      await upsertGames(db, [live]);
      const postponed = { ...live, status: 'POSTPONED', periodScores: null } satisfies Game;

      expect(await upsertGames(db, [postponed])).toBe(1);
      const row = await gameRow(db, nhlGame.publicId);
      expect(row.status).toBe('POSTPONED');
      expect(row.periodScores).toHaveLength(4);
    });

    it('a repeat write without period scores is a no-op', async () => {
      const db = await open();
      await upsertGames(db, [live]);
      const before = await gameRow(db, nhlGame.publicId);
      await tick();

      expect(await upsertGames(db, [{ ...live, periodScores: null }])).toBe(0);
      expect((await gameRow(db, nhlGame.publicId)).updatedAt.getTime()).toBe(
        before.updatedAt.getTime(),
      );
    });

    it('a SCHEDULED game still takes a new start time', async () => {
      const db = await open();
      const scheduled = {
        ...nhlGame,
        status: 'SCHEDULED',
        homeScore: null,
        awayScore: null,
        periodScores: null,
        endedIn: null,
      } satisfies Game;
      await upsertGames(db, [scheduled]);

      expect(
        await upsertGames(db, [{ ...scheduled, startTimeUtc: '2026-10-08T00:00:00.000Z' }]),
      ).toBe(1);
      expect((await gameRow(db, nhlGame.publicId)).startTimeUtc.toISOString()).toBe(
        '2026-10-08T00:00:00.000Z',
      );
    });
  });

  describe('upsertGames checks a game before writing', () => {
    it("rejects a game whose league doesn't fit its source", async () => {
      const db = await open();
      const bad = {
        ...nhlGame,
        source: 'espn',
        homeTeamExternalId: celtics.externalId,
        awayTeamExternalId: sixers.externalId,
      } satisfies Game;

      await expect(upsertGames(db, [bad])).rejects.toThrow(
        /^game nhl-2026020001: league NHL does not fit source espn/,
      );
    });

    it('rejects a team from another league', async () => {
      const db = await open();
      await upsertTeams(db, [{ ...cbj, source: 'espn', externalId: '99', league: 'NHL' }]);

      await expect(upsertGames(db, [{ ...nbaGame, homeTeamExternalId: '99' }])).rejects.toThrow(
        /team espn\/99 is in league NHL/,
      );
    });

    it('rejects home == away', async () => {
      const db = await open();

      await expect(
        upsertGames(db, [{ ...nhlGame, awayTeamExternalId: nhlGame.homeTeamExternalId }]),
      ).rejects.toThrow(/home and away are the same team/);
    });

    it('a rejected game rejects the whole batch', async () => {
      const db = await open();
      const bad = { ...nbaGame, awayTeamExternalId: nbaGame.homeTeamExternalId } satisfies Game;

      await expect(upsertGames(db, [nhlGame, bad])).rejects.toThrow();
      expect(await db.select().from(games)).toHaveLength(0);
    });
  });

  it("upsertSeasonStats rejects a kind outside the player's league", async () => {
    const db = await open();
    await upsertPlayers(db, [girgensons], NO_OVERRIDES);

    await expect(
      upsertSeasonStats(db, [{ ...nhlSeasonStats, kind: 'basketball_player' }]),
    ).rejects.toThrow(/^season stats nhl-8476878\/2026-27: basketball_player is not a hockey kind/);
  });
});

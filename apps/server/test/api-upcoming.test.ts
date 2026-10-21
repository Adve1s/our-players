import {
  type DayGameResponse,
  dayResponseSchema,
  type PlayerRow,
  type Prefs,
} from '@our-players/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { createApp } from '../src/api/app';
import type { DbHandle } from '../src/db/client';
import { gameDayRows } from '../src/game-day-rows';
import { createLogger } from '../src/jobs/runner';
import { formatRecap, loadRecap } from '../src/recap';
import { FREE_AGENT, GIRGENSONS, LEONS, RUST, SILOVS, seedApiDb, seedUpcoming } from './api-seed';

const VILMANIS = 'nhl-8483771';
const BALINSKIS = 'nhl-8484304';
// COL@PIT, SEA@FLA, MIN@TBL and CBJ@PHI on 2026-03-24; PIT@COL and BOS@ANA on 2026-10-16.
const COL_PIT = 'nhl-2025021126';
const SEA_FLA = 'nhl-2025021123';
const MIN_TBL = 'nhl-2025021127';
const CBJ_PHI = 'nhl-2025021125';
const PIT_COL = 'nhl-2026020119';
const BOS_ANA = 'nhl-2026020120';

const lva: Prefs = {
  leagues: new Set(['NHL', 'NBA']),
  countries: new Set(['LVA']),
  favorites: new Set(),
  hidden: new Set(),
};

function setup(db: DbHandle['db']) {
  const app = createApp({
    db,
    now: () => new Date('2026-10-18T12:00:00Z'),
    log: createLogger(() => {}),
  });
  // Every response is checked against the shared contract.
  async function get<S extends z.ZodType>(path: string, status: number, schema: S) {
    const res = await app.request(path);
    expect(res.status).toBe(status);
    return schema.parse(await res.json()) as z.output<S>;
  }
  return { get };
}

const game = (games: DayGameResponse[], id: string) => {
  const g = games.find((x) => x.id === id);
  if (!g) throw new Error(`no game ${id}`);
  return g;
};

const row = (rows: PlayerRow[], playerId: string) => rows.find((r) => r.player.id === playerId);
const allRows = (games: DayGameResponse[]) => games.flatMap((g) => g.rows);

describe('upcoming rows (games without a box score)', () => {
  let handle: DbHandle;

  beforeAll(async () => {
    handle = await seedApiDb();
    await seedUpcoming(handle);
  }, 90_000);

  afterAll(() => handle.close());

  const day = async (query: string) =>
    (await setup(handle.db).get(`/v1/days/${query}`, 200, dayResponseSchema)).games;
  const recap = async (date: string) =>
    formatRecap(date, ['LVA'], gameDayRows(await loadRecap(handle.db, date), lva));

  describe('2026-03-24 (FINAL games, only MIN@TBL with its box score)', () => {
    it('Silovs gets an upcoming row in COL@PIT, home side', async () => {
      const games = await day('2026-03-24?countries=LVA');

      const r = row(game(games, COL_PIT).rows, SILOVS);
      expect(r?.type).toBe('upcoming');
      expect(r?.side).toBe('home');
    });

    it.each([
      ['Vilmanis', VILMANIS],
      ['Balinskis', BALINSKIS],
    ])('%s (FLA) gets an upcoming row in SEA@FLA, home side', async (_name, id) => {
      const games = await day('2026-03-24?countries=LVA');

      const r = row(game(games, SEA_FLA).rows, id);
      expect(r?.type).toBe('upcoming');
      expect(r?.side).toBe('home');
    });

    it('Girgensons keeps his line row in MIN@TBL, home side', async () => {
      const games = await day('2026-03-24?countries=LVA');

      const r = row(game(games, MIN_TBL).rows, GIRGENSONS);
      expect(r?.type).toBe('line');
      expect(r?.side).toBe('home');
    });

    it('Girgensons gets no row in CBJ@PHI, his current team, since he has a line elsewhere that day', async () => {
      const games = await day('2026-03-24?countries=LVA');

      expect(row(game(games, CBJ_PHI).rows, GIRGENSONS)).toBeUndefined();
    });

    it('a favorite from another country (Rust, PIT) gets an upcoming row in COL@PIT', async () => {
      const games = await day('2026-03-24?countries=LVA&fav=nhl-8475810');

      expect(row(game(games, COL_PIT).rows, RUST)?.type).toBe('upcoming');
    });

    it('hiding Silovs removes his upcoming row and leaves the other Latvians', async () => {
      const games = await day('2026-03-24?countries=LVA&hide=nhl-8481668');

      expect(allRows(games).filter((r) => r.player.id === SILOVS)).toEqual([]);
      expect(row(game(games, SEA_FLA).rows, VILMANIS)?.type).toBe('upcoming');
    });

    it('the Latvian free agent (no current team) gets no row while Silovs gets his', async () => {
      const games = await day('2026-03-24?countries=LVA');

      expect(allRows(games).filter((r) => r.player.id === FREE_AGENT)).toEqual([]);
      expect(row(game(games, COL_PIT).rows, SILOVS)?.type).toBe('upcoming');
    });

    it('the games with rows come first, in start-time order: SEA@FLA, COL@PIT, MIN@TBL', async () => {
      const games = await day('2026-03-24?countries=LVA');

      const withRows = games.filter((g) => g.rows.length > 0).map((g) => g.id);
      expect(withRows).toEqual([SEA_FLA, COL_PIT, MIN_TBL]);
      expect(games.slice(0, withRows.length).map((g) => g.id)).toEqual(withRows);
    });

    it('pnpm recap prints Silovs as Waiting for stats', async () => {
      expect(await recap('2026-03-24')).toMatch(/Arturs Silovs +PIT +Waiting for stats/);
    });
  });

  describe('2026-10-16 (two scheduled games)', () => {
    it('PIT@COL comes first, SCHEDULED, with an upcoming row for Silovs, away side', async () => {
      const games = await day('2026-10-16?countries=LVA');

      const [first] = games;
      expect(first?.id).toBe(PIT_COL);
      expect(first?.status).toBe('SCHEDULED');
      const r = row(first?.rows ?? [], SILOVS);
      expect(r?.type).toBe('upcoming');
      expect(r?.side).toBe('away');
    });

    it('BOS@ANA follows with no rows', async () => {
      const games = await day('2026-10-16?countries=LVA');

      expect(games[1]?.id).toBe(BOS_ANA);
      expect(games[1]?.rows).toEqual([]);
    });

    it('pnpm recap prints Silovs as Not started', async () => {
      expect(await recap('2026-10-16')).toMatch(/Arturs Silovs +PIT +Not started/);
    });
  });

  describe('days with box scores are unchanged', () => {
    it('2026-01-17 keeps two goalie lines and Girgensons not in lineup, no upcoming row', async () => {
      const games = await day('2026-01-17?countries=LVA');

      expect(allRows(games).map((r) => r.type)).toEqual(['line', 'not-in-lineup', 'line']);
    });

    it("2026-03-23 keeps Leons' DNP row and has no upcoming row", async () => {
      const games = await day('2026-03-23?fav=nba-4897449');

      expect(row(game(games, 'nba-401810899').rows, LEONS)?.type).toBe('dnp');
      expect(allRows(games).filter((r) => r.type === 'upcoming')).toEqual([]);
    });
  });
});

describe('upcoming rows in a live game', () => {
  let handle: DbHandle;

  beforeAll(async () => {
    handle = await seedApiDb();
    await seedUpcoming(handle, { live: true });
  }, 90_000);

  afterAll(() => handle.close());

  it('PIT@COL is LIVE with an upcoming row for Silovs', async () => {
    const { games } = await setup(handle.db).get(
      '/v1/days/2026-10-16?countries=LVA',
      200,
      dayResponseSchema,
    );

    const g = game(games, PIT_COL);
    expect(g.status).toBe('LIVE');
    expect(row(g.rows, SILOVS)?.type).toBe('upcoming');
  });

  it('pnpm recap prints Silovs as In progress', async () => {
    const text = formatRecap(
      '2026-10-16',
      ['LVA'],
      gameDayRows(await loadRecap(handle.db, '2026-10-16'), lva),
    );
    expect(text).toMatch(/Arturs Silovs +PIT +In progress/);
  });
});

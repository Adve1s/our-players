import {
  countriesResponseSchema,
  errorResponseSchema,
  type PlayerSummary,
  playerResponseSchema,
  playersResponseSchema,
} from '@our-players/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { createApp } from '../src/api/app';
import type { DbHandle } from '../src/db/client';
import { upsertGames, upsertStatLines } from '../src/db/games';
import { upsertPlayers } from '../src/db/players';
import { upsertSeasonStats } from '../src/db/season-stats';
import { upsertTeams } from '../src/db/teams';
import { createLogger } from '../src/jobs/runner';
import {
  EMBIID,
  FORSLING,
  FREE_AGENT,
  GIRGENSONS,
  GUSTAVSEN,
  LEONS,
  MERZLIKINS,
  PORZINGIS,
  seedApiDb,
  TOWNS,
} from './api-seed';
import { createTestDb } from './db';
import {
  cbj,
  freeAgent,
  girgensons,
  girgensonsLine,
  NO_OVERRIDES,
  nhlGame,
  nhlSeasonStats,
  nyi,
} from './db-data';

let handle: DbHandle;

beforeAll(async () => {
  handle = await seedApiDb();
}, 60_000);

afterAll(() => handle.close());

function setup(db = handle.db) {
  const lines: string[] = [];
  const app = createApp({
    db,
    now: () => new Date('2026-10-18T12:00:00Z'),
    log: createLogger((_, line) => lines.push(line)),
  });
  // AC1: every response is checked against the shared contract.
  async function get<S extends z.ZodType>(path: string, status: number, schema: S) {
    const res = await app.request(path);
    expect(res.status).toBe(status);
    return { body: schema.parse(await res.json()) as z.output<S>, res };
  }
  return { app, get, lines };
}

const search = async (query: string) =>
  (await setup().get(`/v1/players/search?${query}`, 200, playersResponseSchema)).body.players;

const searchFor = (term: string) => search(new URLSearchParams({ q: term }).toString());

const ids = (players: PlayerSummary[]) => players.map((p) => p.id);

const badRequest = async (path: string, param: string) => {
  const { body } = await setup().get(path, 400, errorResponseSchema);
  expect(body.error.code).toBe('BAD_REQUEST');
  expect(body.error.message).toContain(param);
};

describe('GET /v1/players/search', () => {
  it.each(['porzingis', 'PORZ', 'Porziņģis'])('%s finds Porziņģis first', async (term) => {
    expect((await searchFor(term))[0]?.id).toBe(PORZINGIS);
  });

  it.each(['merzlikins', 'MERZĻIKINS'])('%s finds Merzļikins first', async (term) => {
    expect((await searchFor(term))[0]?.id).toBe(MERZLIKINS);
  });

  it('a partial last name finds Girgensons first', async () => {
    expect((await searchFor('girgen'))[0]?.id).toBe(GIRGENSONS);
  });

  it.each(['cukste', 'Čukste'])('%s finds the free agent first, with no team', async (term) => {
    const first = (await searchFor(term))[0];
    expect(first?.id).toBe(FREE_AGENT);
    expect(first?.team).toBeNull();
  });

  it('active players come first, then word-start matches, then by last name', async () => {
    expect(ids(await searchFor('gus'))).toEqual([FORSLING, GIRGENSONS, GUSTAVSEN]);
  });

  // Without the hyphen rule, Reese would be the only word start and come before Aston-Reese.
  it('a match at the start of a part after a hyphen counts as a word start', async () => {
    const lastNames = (await searchFor('ree')).map((p) => p.lastName);
    expect(lastNames).toEqual(['Aston-Reese', 'Reese', 'Green']);
  });

  it('leagues=NBA leaves out NHL players', async () => {
    expect(ids(await search('q=mer&leagues=NBA'))).toEqual(['nba-3074213']);
  });

  it('answers at most 20 players', async () => {
    expect(await searchFor('a')).toHaveLength(20);
  });

  it('a LIKE wildcard is a literal character', async () => {
    expect(await search('q=%25')).toEqual([]);
  });

  it('the query is trimmed', async () => {
    expect((await search('q=%20porz%20'))[0]?.id).toBe(PORZINGIS);
  });

  it.each([
    ['no q', '/v1/players/search'],
    ['an empty q', '/v1/players/search?q='],
    ['only spaces', '/v1/players/search?q=%20%20%20'],
    ['51 characters', `/v1/players/search?q=${'a'.repeat(51)}`],
    ['a lone combining accent', '/v1/players/search?q=%CC%81'],
  ])('%s → 400 naming q', async (_, path) => {
    await badRequest(path, 'q');
  });

  it('a bad league → 400 naming leagues', async () => {
    await badRequest('/v1/players/search?q=porz&leagues=xx', 'leagues');
  });

  it('a repeated q → 400 naming q', async () => {
    await badRequest('/v1/players/search?q=porz&q=girgen', 'q');
  });

  it('a result row carries league, position, nationality, active and team', async () => {
    const p = (await searchFor('porzingis'))[0];
    expect(p?.league).toBe('NBA');
    expect(p?.position).toEqual(expect.any(String));
    expect(p?.nationality).toBe('LVA');
    expect(p?.active).toBe(true);
    expect(p?.team?.abbrev).toBe('GS');
  });

  describe('ordering among crafted names', () => {
    let crafted: DbHandle;
    const named = (n: number, firstName: string, lastName: string) => ({
      ...freeAgent,
      publicId: `nhl-200000${n}`,
      externalId: `200000${n}`,
      firstName,
      lastName,
    });

    beforeAll(async () => {
      crafted = await createTestDb();
      await upsertPlayers(
        crafted.db,
        [
          named(1, 'Jānis', 'Zeltiņš'),
          named(2, 'Jānis', 'Čehlārs'),
          named(3, 'Jānis', 'Bērziņš'),
          named(4, 'Jānis', 'Ābols'),
          named(5, 'Ana', 'Baston-Ruiz'),
          named(6, 'Zed', 'Kim-Aston-Rey'),
        ],
        NO_OVERRIDES,
      );
    }, 30_000);

    afterAll(() => crafted.close());

    const lastNames = async (term: string) => {
      const path = `/v1/players/search?${new URLSearchParams({ q: term })}`;
      const { body } = await setup(crafted.db).get(path, 200, playersResponseSchema);
      return body.players.map((p) => p.lastName);
    };

    // Under the database's C collation, Ā and Č would sort after Z and be the first cut by the limit.
    it('ties sort by last name with a diacritic letter beside its base letter', async () => {
      expect(await lastNames('janis')).toEqual(['Ābols', 'Bērziņš', 'Čehlārs', 'Zeltiņš']);
    });

    it('a hyphen in the query still matches as a word start', async () => {
      expect(await lastNames('aston-r')).toEqual(['Kim-Aston-Rey', 'Baston-Ruiz']);
    });
  });
});

describe('GET /v1/players?ids=', () => {
  const byIds = async (query: string) =>
    (await setup().get(`/v1/players?${query}`, 200, playersResponseSchema)).body.players;

  it('answers in the order asked, unknown IDs left out, duplicates once', async () => {
    const players = await byIds(`ids=${GIRGENSONS},nhl-999,${PORZINGIS},${GIRGENSONS}`);
    expect(ids(players)).toEqual([GIRGENSONS, PORZINGIS]);
  });

  it('an empty list answers no players', async () => {
    expect(await byIds('ids=')).toEqual([]);
  });

  it('no ids → 400 naming ids', async () => {
    await badRequest('/v1/players', 'ids');
  });

  it('a malformed ID → 400', async () => {
    await badRequest('/v1/players?ids=bad', 'ids');
  });

  it('a repeated ids → 400 naming ids', async () => {
    await badRequest(`/v1/players?ids=${GIRGENSONS}&ids=${PORZINGIS}`, 'ids');
  });

  it('201 IDs → 400', async () => {
    const list = Array.from({ length: 201 }, (_, i) => `nhl-${i + 1}`).join(',');
    await badRequest(`/v1/players?ids=${list}`, 'ids');
  });
});

describe('GET /v1/countries', () => {
  const countries = async (query = '') =>
    (await setup().get(`/v1/countries${query}`, 200, countriesResponseSchema)).body.countries;
  const counts = (list: Awaited<ReturnType<typeof countries>>, code: string) =>
    list.find((c) => c.code === code)?.counts;

  it('counts active players per league, by sporting nationality', async () => {
    const list = await countries();
    expect(counts(list, 'LVA')).toEqual({ NHL: 6, NBA: 1 });
    expect(counts(list, 'USA')).toEqual({ NHL: 19, NBA: 1 });
    expect(counts(list, 'DOM')).toEqual({ NBA: 1 });
  });

  it('leaves out a birth country overridden away (CMR) and an inactive-only country (NOR)', async () => {
    const codes = (await countries()).map((c) => c.code);
    expect(codes).not.toContain('CMR');
    expect(codes).not.toContain('NOR');
  });

  it('leagues=NBA counts only NBA players', async () => {
    const list = await countries('?leagues=NBA');
    expect(list.filter((c) => c.counts.NHL !== undefined)).toEqual([]);
    expect(list.map((c) => c.code)).not.toContain('CAN');
  });

  it('codes are sorted', async () => {
    const codes = (await countries()).map((c) => c.code);
    expect(codes).toEqual([...codes].sort());
  });
});

describe('GET /v1/players/:playerId', () => {
  const player = async (id: string, db = handle.db) =>
    (await setup(db).get(`/v1/players/${id}`, 200, playerResponseSchema)).body;
  const onlyEntry = async (id: string) => {
    const { seasonStats } = await player(id);
    expect(seasonStats).toHaveLength(1);
    return seasonStats[0];
  };

  it('Girgensons: current team and nationality from his birth country', async () => {
    const p = await player(GIRGENSONS);
    expect(p.team?.abbrev).toBe('CBJ');
    expect(p.birthCountry).toBe('LVA');
    expect(p.nationalitySource).toBe('birth');
  });

  it("Girgensons: the current season's regular-season skater totals", async () => {
    const entry = await onlyEntry(GIRGENSONS);
    expect(entry).toMatchObject({
      kind: 'hockey_skater',
      season: '2025-26',
      seasonType: 'REG',
      basis: 'totals',
    });
    expect(entry?.stats).toMatchObject({
      gamesPlayed: 74,
      goals: 9,
      assists: 11,
      points: 20,
      plusMinus: 1,
      shots: 89,
      toiPerGameSeconds: 886.054,
    });
  });

  it("Merzļikins: the current season's regular-season goalie totals", async () => {
    const entry = await onlyEntry(MERZLIKINS);
    expect(entry?.kind).toBe('hockey_goalie');
    expect(entry?.seasonType).toBe('REG');
    expect(entry?.stats).toMatchObject({
      gamesPlayed: 30,
      wins: 14,
      losses: 11,
      otLosses: 3,
      savePct: 0.883,
      shutouts: 1,
    });
  });

  it('Merzļikins: his game log is his one stored line, on the away side', async () => {
    const { gameLog } = await player(MERZLIKINS);
    expect(gameLog).toHaveLength(1);
    expect(gameLog[0]?.type).toBe('line');
    expect(gameLog[0]?.game.id).toBe('nhl-2025020760');
    expect(gameLog[0]?.side).toBe('away');
  });

  it("Towns: the current season's regular-season basketball totals", async () => {
    const entry = await onlyEntry(TOWNS);
    expect(entry?.kind).toBe('basketball_player');
    expect(entry?.seasonType).toBe('REG');
    expect(entry?.stats).toMatchObject({ gamesPlayed: 75, points: 1504, rebounds: 889 });
    expect(entry?.kind === 'basketball_player' && entry.stats.fgPct).toBeCloseTo(0.501, 3);
  });

  it('Towns: an override makes him DOM, born in the USA', async () => {
    const p = await player(TOWNS);
    expect(p.nationality).toBe('DOM');
    expect(p.nationalitySource).toBe('override');
    expect(p.birthCountry).toBe('USA');
  });

  it('Embiid: an override makes him USA, born in CMR, with no stats or games', async () => {
    const p = await player(EMBIID);
    expect(p.nationality).toBe('USA');
    expect(p.nationalitySource).toBe('override');
    expect(p.birthCountry).toBe('CMR');
    expect(p.seasonStats).toEqual([]);
    expect(p.gameLog).toEqual([]);
  });

  it('Porziņģis: the game log is newest first', async () => {
    const { gameLog } = await player(PORZINGIS);
    expect(gameLog.map((e) => e.game.id)).toEqual(['nba-401810899', 'nba-401810839']);
    expect(gameLog.map((e) => e.type)).toEqual(['line', 'line']);
  });

  it('Porziņģis: the 2026-03-16 line has his points, on the away side', async () => {
    const entry = (await player(PORZINGIS)).gameLog.find((e) => e.game.id === 'nba-401810839');
    expect(entry?.type === 'line' && entry.line.stats).toMatchObject({ points: 30 });
    expect(entry?.side).toBe('away');
  });

  it("Leons: a game he didn't play is a DNP with its reason", async () => {
    const entry = (await player(LEONS)).gameLog.find((e) => e.game.id === 'nba-401810899');
    expect(entry).toMatchObject({ type: 'dnp', reason: "COACH'S DECISION" });
  });

  it('the free agent has no team', async () => {
    expect((await player(FREE_AGENT)).team).toBeNull();
  });

  it('an unknown player → 404', async () => {
    const { body } = await setup().get('/v1/players/nhl-999', 404, errorResponseSchema);
    expect(body.error).toMatchObject({ code: 'NOT_FOUND', message: 'no player nhl-999' });
  });

  it('a malformed ID → 400 naming playerId', async () => {
    await badRequest('/v1/players/bad', 'playerId');
  });

  describe('with 11 games', () => {
    let cap: DbHandle;

    beforeAll(async () => {
      cap = await createTestDb();
      await upsertTeams(cap.db, [cbj, nyi]);
      await upsertPlayers(cap.db, [girgensons], NO_OVERRIDES);
      for (let n = 1; n <= 11; n++) {
        const nn = String(n).padStart(2, '0');
        const id = `nhl-20260200${nn}`;
        await upsertGames(cap.db, [
          {
            ...nhlGame,
            publicId: id,
            externalId: `20260200${nn}`,
            gameDate: `2026-10-${nn}`,
            startTimeUtc: `2026-10-${nn}T23:00:00.000Z`,
          },
        ]);
        await upsertStatLines(cap.db, id, [{ ...girgensonsLine, gamePublicId: id }]);
      }
    }, 30_000);

    afterAll(() => cap.close());

    it('the game log keeps the newest 10', async () => {
      const { gameLog } = await player(GIRGENSONS, cap.db);
      expect(gameLog).toHaveLength(10);
      expect(gameLog[0]?.game.id).toBe('nhl-2026020011');
      expect(gameLog[9]?.game.id).toBe('nhl-2026020002');
    });
  });

  describe('in the preseason', () => {
    let pre: DbHandle;

    beforeAll(async () => {
      pre = await createTestDb();
      await upsertTeams(pre.db, [cbj, nyi]);
      await upsertPlayers(pre.db, [girgensons], NO_OVERRIDES);
      await upsertGames(pre.db, [
        {
          ...nhlGame,
          publicId: 'nhl-2025021300',
          externalId: '2025021300',
          season: '2025-26',
          gameDate: '2026-04-10',
          startTimeUtc: '2026-04-10T23:00:00.000Z',
        },
        {
          ...nhlGame,
          publicId: 'nhl-2026010001',
          externalId: '2026010001',
          seasonType: 'PRE',
          gameDate: '2026-10-01',
          startTimeUtc: '2026-10-01T23:00:00.000Z',
        },
      ]);
      await upsertSeasonStats(pre.db, [
        {
          ...nhlSeasonStats,
          season: '2025-26',
          stats: {
            gamesPlayed: 74,
            goals: 9,
            assists: 11,
            points: 20,
            plusMinus: 1,
            shots: 89,
            pim: 10,
            powerPlayGoals: 1,
            toiPerGameSeconds: 886,
          },
        },
      ]);
    }, 30_000);

    afterAll(() => pre.close());

    // Owner (PR #14): a started preseason game doesn't empty the page; last season's stats stay.
    it("shows last season's stats until the regular season starts", async () => {
      const { seasonStats } = await player(GIRGENSONS, pre.db);
      expect(seasonStats.map((s) => [s.season, s.seasonType])).toEqual([['2025-26', 'REG']]);
    });
  });
});

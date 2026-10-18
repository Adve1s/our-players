import {
  type DayGameResponse,
  dayResponseSchema,
  errorResponseSchema,
  gameResponseSchema,
  type PlayerRow,
} from '@our-players/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { createApp } from '../src/api/app';
import type { DbHandle } from '../src/db/client';
import { createLogger } from '../src/jobs/runner';
import {
  FREE_AGENT,
  GIRGENSONS,
  LEONS,
  MERZLIKINS,
  PORZINGIS,
  RUST,
  SILOVS,
  seedApiDb,
} from './api-seed';
import { createTestDb } from './db';

const CACHE = 'public, max-age=60, stale-while-revalidate=300';

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
  return { get, lines };
}

const day = async (query: string) =>
  (await setup().get(`/v1/days/${query}`, 200, dayResponseSchema)).body;

const game = (games: DayGameResponse[], id: string) => {
  const g = games.find((x) => x.id === id);
  if (!g) throw new Error(`no game ${id}`);
  return g;
};

const row = (rows: PlayerRow[], playerId: string) => rows.find((r) => r.player.id === playerId);

describe('GET /v1/days/:gameDate', () => {
  describe('2026-01-17 (one NHL game)', () => {
    it('countries=LVA shows the CBJ–PIT game with its score and the Latvian rows, away team first', async () => {
      const { games } = await day('2026-01-17?countries=LVA');

      expect(games.map((g) => g.id)).toEqual(['nhl-2025020760']);
      const g = game(games, 'nhl-2025020760');
      expect(g.away).toEqual({ abbrev: 'CBJ', score: 4 });
      expect(g.home).toEqual({ abbrev: 'PIT', score: 3 });
      expect(g.rows.map((r) => r.player.id)).toEqual([MERZLIKINS, GIRGENSONS, SILOVS]);
    });

    it('Merzlikins has an away goalie line: 30 saves on 33 shots, a win', async () => {
      const { games } = await day('2026-01-17?countries=LVA');

      const r = row(game(games, 'nhl-2025020760').rows, MERZLIKINS);
      expect(r?.type).toBe('line');
      expect(r?.side).toBe('away');
      if (r?.type !== 'line' || r.line.kind !== 'hockey_goalie')
        throw new Error('not a goalie line');
      expect(r.line.stats.saves).toBe(30);
      expect(r.line.stats.shotsAgainst).toBe(33);
      expect(r.line.stats.decision).toBe('W');
    });

    it('Silovs has a home goalie line: 23 saves, an overtime loss', async () => {
      const { games } = await day('2026-01-17?countries=LVA');

      const r = row(game(games, 'nhl-2025020760').rows, SILOVS);
      expect(r?.type).toBe('line');
      expect(r?.side).toBe('home');
      if (r?.type !== 'line' || r.line.kind !== 'hockey_goalie')
        throw new Error('not a goalie line');
      expect(r.line.stats.saves).toBe(23);
      expect(r.line.stats.decision).toBe('OTL');
    });

    it('hide removes a player of a followed country', async () => {
      const { games } = await day('2026-01-17?countries=LVA&hide=nhl-8478007');

      expect(row(game(games, 'nhl-2025020760').rows, MERZLIKINS)).toBeUndefined();
    });

    it('fav adds a player of another country', async () => {
      const { games } = await day('2026-01-17?countries=LVA&fav=nhl-8475810');

      const r = row(game(games, 'nhl-2025020760').rows, RUST);
      expect(r?.side).toBe('home');
      expect(r?.player.nationality).toBe('USA');
      if (r?.type !== 'line') throw new Error('not a line');
      expect(r.line.kind).toBe('hockey_skater');
    });

    it('an unknown but well-formed favorite ID is ignored', async () => {
      const { games } = await day('2026-01-17?fav=nhl-1');

      expect(game(games, 'nhl-2025020760').rows).toEqual([]);
    });

    it('a player not in the lineup gets a not-in-lineup row, and a player without a team gets none', async () => {
      const { games } = await day('2026-01-17?countries=LVA');

      const r = row(game(games, 'nhl-2025020760').rows, GIRGENSONS);
      expect(r?.type).toBe('not-in-lineup');
      expect(r?.side).toBe('away');
      expect(games.flatMap((g) => g.rows).some((x) => x.player.id === FREE_AGENT)).toBe(false);
    });

    it('a deselected league leaves no games, and prev/next skip its dates', async () => {
      const body = await day('2026-01-17?leagues=NBA&fav=nhl-8475810');

      expect(body.games).toEqual([]);
      expect(body.prevGameDate).toBeNull();
      expect(body.nextGameDate).toBe('2026-03-16');
    });
  });

  describe('2026-03-16 (eight NBA games)', () => {
    it('leagues=NBA keeps only NBA games and still shows Porziņģis', async () => {
      const { games } = await day('2026-03-16?leagues=NBA&countries=LVA&fav=nhl-8475810');

      expect(games.every((g) => g.league === 'NBA')).toBe(true);
      expect(games.flatMap((g) => g.rows).some((r) => r.player.id === PORZINGIS)).toBe(true);
    });

    it('the game with a shown player comes first, then the others by start time and ID', async () => {
      const { games } = await day('2026-03-16?countries=LVA');

      expect(games.map((g) => g.id)).toEqual([
        'nba-401810839',
        'nba-401810838',
        'nba-401810840',
        'nba-401810841',
        'nba-401810842',
        'nba-401810843',
        'nba-401810844',
        'nba-401810845',
      ]);
    });

    it('Porziņģis has an away line: 30 points, 5 rebounds, 4 assists in 26 minutes', async () => {
      const { games } = await day('2026-03-16?countries=LVA');

      const r = row(game(games, 'nba-401810839').rows, PORZINGIS);
      expect(r?.type).toBe('line');
      expect(r?.side).toBe('away');
      if (r?.type !== 'line' || r.line.kind !== 'basketball_player') throw new Error('not a line');
      expect(r.line.stats.points).toBe(30);
      expect(r.line.stats.rebounds).toBe(5);
      expect(r.line.stats.assists).toBe(4);
      expect(r.line.stats.minutes).toBe(26);
    });

    it('every other game has no rows', async () => {
      const { games } = await day('2026-03-16?countries=LVA');

      for (const g of games.slice(1)) expect(g.rows).toEqual([]);
    });
  });

  it("a player who did not play gets a dnp row with the coach's reason", async () => {
    const { games } = await day('2026-03-23?fav=nba-4897449');

    const r = row(game(games, 'nba-401810899').rows, LEONS);
    expect(r).toEqual(
      expect.objectContaining({ type: 'dnp', side: 'away', reason: "COACH'S DECISION" }),
    );
  });

  it.each([
    ['2026-03-16', '2026-01-17', '2026-03-23'],
    ['2026-03-16?leagues=NBA', null, '2026-03-23'],
    ['2026-03-17', '2026-03-16', '2026-03-23'],
  ])('prev/next of %s are %s / %s', async (query, prev, next) => {
    const body = await day(query);

    expect(body.prevGameDate).toBe(prev);
    expect(body.nextGameDate).toBe(next);
  });

  it('a date without games answers 200 with no games', async () => {
    expect((await day('2026-03-17')).games).toEqual([]);
  });

  it('the next game date after 2026-03-23 is the NHL schedule day 2026-03-24', async () => {
    expect((await day('2026-03-23')).nextGameDate).toBe('2026-03-24');
  });
});

describe('GET /v1/games/:gameId', () => {
  const gameAt = async (path: string) =>
    (await setup().get(`/v1/games/${path}`, 200, gameResponseSchema)).body;

  it('returns the game with its date, Q1–Q4 period scores and the shown rows', async () => {
    const g = await gameAt('nba-401810839?countries=LVA');

    expect(g.gameDate).toBe('2026-03-16');
    expect(g.periodScores?.map((p) => p.period)).toEqual(['Q1', 'Q2', 'Q3', 'Q4']);
    expect(g.rows.map((r) => r.player.id)).toEqual([PORZINGIS]);
  });

  it('a game in a deselected league is still returned, without rows', async () => {
    const g = await gameAt('nba-401810839?countries=LVA&leagues=NHL');

    expect(g.id).toBe('nba-401810839');
    expect(g.rows).toEqual([]);
  });

  it('a schedule-only game has no period scores and no rows', async () => {
    const g = await gameAt('nhl-2025021120');

    expect(g.periodScores).toBeNull();
    expect(g.rows).toEqual([]);
  });

  it('an unknown game answers 404 NOT_FOUND', async () => {
    const { body } = await setup().get('/v1/games/nba-999', 404, errorResponseSchema);

    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.message).not.toContain('no route');
  });
});

describe('cache header', () => {
  it.each([
    ['/v1/days/2026-03-16', dayResponseSchema],
    ['/v1/games/nba-401810839', gameResponseSchema],
  ])('%s answers with the cache header', async (path, schema) => {
    const { res } = await setup().get(path, 200, schema);

    expect(res.headers.get('cache-control')).toBe(CACHE);
  });

  it('a 400 has no cache header', async () => {
    const { res } = await setup().get('/v1/days/2026-02-30', 400, errorResponseSchema);

    expect(res.headers.get('cache-control')).toBeNull();
  });
});

describe('bad requests', () => {
  const tooMany = Array.from({ length: 201 }, (_, i) => `nhl-${i + 1}`).join(',');

  it.each([
    { label: 'an impossible date', path: '/v1/days/2026-02-30', param: 'gameDate' },
    { label: 'a date without dashes', path: '/v1/days/20260316', param: 'gameDate' },
    { label: 'an unknown country', path: '/v1/days/2026-03-16?countries=XX', param: 'countries' },
    { label: 'no league', path: '/v1/days/2026-03-16?leagues=', param: 'leagues' },
    { label: 'a malformed favorite', path: '/v1/days/2026-03-16?fav=abc', param: 'fav' },
    { label: '201 hidden IDs', path: `/v1/days/2026-03-16?hide=${tooMany}`, param: 'hide' },
    {
      label: 'a repeated parameter',
      path: '/v1/days/2026-03-16?countries=LVA&countries=EST',
      param: 'countries',
    },
    { label: 'a malformed game ID', path: '/v1/games/abc', param: 'gameId' },
  ])('$label answers 400 BAD_REQUEST naming $param', async ({ path, param }) => {
    const { body } = await setup().get(path, 400, errorResponseSchema);

    expect(body.error.code).toBe('BAD_REQUEST');
    expect(body.error.message).toContain(param);
  });
});

describe('logs', () => {
  it('request logs carry the path but never the preferences', async () => {
    const { get, lines } = setup();
    await get('/v1/days/2026-01-17?countries=LVA&fav=nhl-8475810', 200, dayResponseSchema);
    await get(
      '/v1/days/2026-01-17?countries=LVA&fav=nhl-8475810&leagues=',
      400,
      errorResponseSchema,
    );

    const logged = lines.map((l) => JSON.parse(l) as Record<string, unknown>);
    const requests = logged.filter((l) => l.msg === 'request');
    expect(requests).toHaveLength(2);
    for (const r of requests) expect(r.path).toBe('/v1/days/2026-01-17');
    for (const line of lines) {
      expect(line).not.toContain('?');
      expect(line).not.toContain('LVA');
      expect(line).not.toContain('8475810');
    }
  });

  it('a database failure answers 500 INTERNAL and logs the path without the query', async () => {
    const closed = await createTestDb();
    await closed.close();
    const { get, lines } = setup(closed.db);

    const { body } = await get('/v1/days/2026-01-17?countries=LVA', 500, errorResponseSchema);

    expect(body.error.code).toBe('INTERNAL');
    const failed = lines.filter((l) => l.includes('request failed'));
    expect(failed).toHaveLength(1);
    expect(failed[0]).not.toContain('?');
  });
});

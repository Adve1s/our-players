import {
  ApiError,
  type CountryCode,
  createApiClient,
  type FetchLike,
  type League,
  type Prefs,
  type PublicId,
} from '@our-players/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { createApp } from '../src/api/app';
import type { DbHandle } from '../src/db/client';
import { createLogger } from '../src/jobs/runner';
import { EMBIID, GIRGENSONS, PORZINGIS, seedApiDb } from './api-seed';

let handle: DbHandle;

beforeAll(async () => {
  handle = await seedApiDb();
}, 60_000);

afterAll(() => handle.close());

function client() {
  const app = createApp({
    db: handle.db,
    now: () => new Date('2026-10-18T12:00:00Z'),
    log: createLogger(() => {}),
  });
  // async: Hono's app.request may return the Response unwrapped.
  return createApiClient('http://api.test', async (url) => app.request(url));
}

function prefs(p: {
  leagues?: League[];
  countries?: CountryCode[];
  favorites?: PublicId[];
  hidden?: PublicId[];
}): Prefs {
  return {
    leagues: new Set(p.leagues ?? ['NHL', 'NBA']),
    countries: new Set(p.countries ?? []),
    favorites: new Set(p.favorites ?? []),
    hidden: new Set(p.hidden ?? []),
  };
}

const rejection = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (e) {
    return e;
  }
  throw new Error('expected a rejection');
};

describe('createApiClient against the in-memory app', () => {
  it('meta() returns both leagues, NHL first', async () => {
    const meta = await client().meta();

    expect(meta.leagues.map((l) => l.league)).toEqual(['NHL', 'NBA']);
  });

  it('day() sends the countries pref: the first game has the Porziņģis row', async () => {
    const { games } = await client().day('2026-03-16', prefs({ countries: ['LVA'] }));

    expect(games[0]?.rows.map((r) => r.player.id)).toContain(PORZINGIS);
  });

  it('day() sends the hidden pref: no game has a Porziņģis row', async () => {
    const { games } = await client().day(
      '2026-03-16',
      prefs({ countries: ['LVA'], hidden: [PORZINGIS] }),
    );

    expect(games.flatMap((g) => g.rows).some((r) => r.player.id === PORZINGIS)).toBe(false);
  });

  it('game() returns period scores and the Porziņģis row', async () => {
    const game = await client().game('nba-401810839', prefs({ countries: ['LVA'] }));

    expect(game.periodScores).not.toBeNull();
    expect(game.rows.some((r) => r.player.id === PORZINGIS)).toBe(true);
  });

  it('searchPlayers() puts Porziņģis first for "porz" in the NBA', async () => {
    const { players } = await client().searchPlayers('porz', new Set(['NBA']));

    expect(players[0]?.id).toBe(PORZINGIS);
  });

  it('players() returns the requested ids in order', async () => {
    const { players } = await client().players([GIRGENSONS, PORZINGIS]);

    expect(players.map((p) => p.id)).toEqual([GIRGENSONS, PORZINGIS]);
  });

  it('player() returns the nationality source', async () => {
    const player = await client().player(EMBIID);

    expect(player.nationalitySource).toBe('override');
  });

  it('countries() sends the leagues: LVA counts one NBA player', async () => {
    const { countries } = await client().countries(new Set(['NBA']));

    expect(countries.find((c) => c.code === 'LVA')?.counts).toEqual({ NBA: 1 });
  });

  it.each([
    {
      label: 'an empty search',
      call: () => client().searchPlayers('', new Set(['NBA'])),
      status: 400,
      code: 'BAD_REQUEST',
    },
    {
      label: 'an unknown player',
      call: () => client().player('nhl-999'),
      status: 404,
      code: 'NOT_FOUND',
    },
  ])('$label rejects with ApiError $status $code', async ({ call, status, code }) => {
    const e = await rejection(call());

    expect(e).toBeInstanceOf(ApiError);
    expect(e).toMatchObject({ name: 'ApiError', status, code });
  });
});

describe('createApiClient with a stub fetch', () => {
  it('a non-2xx body that is not our error format rejects with HTTP_ERROR', async () => {
    const fetch: FetchLike = async () => ({
      ok: false,
      status: 502,
      json: () => Promise.reject(new SyntaxError('html')),
    });

    const e = await rejection(createApiClient('http://api.test', fetch).meta());

    expect(e).toBeInstanceOf(ApiError);
    expect(e).toMatchObject({ status: 502, code: 'HTTP_ERROR', message: 'HTTP 502' });
  });

  it('a 2xx body that breaks the contract rejects with the ZodError', async () => {
    const fetch: FetchLike = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ leagues: 'nope' }),
    });

    const e = await rejection(createApiClient('http://api.test', fetch).meta());

    expect(e).toBeInstanceOf(ZodError);
  });
});

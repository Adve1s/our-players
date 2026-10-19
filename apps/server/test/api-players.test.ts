import {
  countriesResponseSchema,
  errorResponseSchema,
  type PlayerSummary,
  playersResponseSchema,
} from '@our-players/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { createApp } from '../src/api/app';
import type { DbHandle } from '../src/db/client';
import { createLogger } from '../src/jobs/runner';
import {
  FORSLING,
  FREE_AGENT,
  GIRGENSONS,
  GUSTAVSEN,
  MERZLIKINS,
  PORZINGIS,
  seedApiDb,
} from './api-seed';

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

  it('a match at the start of a hyphenated part counts as a word start', async () => {
    const lastNames = (await searchFor('ree')).map((p) => p.lastName);
    const green = lastNames.indexOf('Green');
    expect(green).toBeGreaterThanOrEqual(0);
    expect(lastNames.indexOf('Aston-Reese')).toBeGreaterThanOrEqual(0);
    expect(lastNames.indexOf('Aston-Reese')).toBeLessThan(green);
    expect(lastNames.indexOf('Reese')).toBeGreaterThanOrEqual(0);
    expect(lastNames.indexOf('Reese')).toBeLessThan(green);
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

  it('a result row carries league, position, nationality, active and team', async () => {
    const p = (await searchFor('porzingis'))[0];
    expect(p?.league).toBe('NBA');
    expect(p?.position).toEqual(expect.any(String));
    expect(p?.nationality).toBe('LVA');
    expect(p?.active).toBe(true);
    expect(p?.team?.abbrev).toBe('GS');
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

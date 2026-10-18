import type { Game } from '@our-players/shared';
import { afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
import type { DbHandle } from '../src/db/client';
import { currentSeason, upsertGames } from '../src/db/games';
import { upsertTeams } from '../src/db/teams';
import { createTestDb } from './db';
import { cbj, celtics, nbaGame, nhlGame, nyi, sixers } from './db-data';

type Over = Pick<Game, 'season' | 'seasonType' | 'startTimeUtc' | 'status'>;

const nhl = (id: string, o: Over): Game => ({
  ...nhlGame,
  publicId: `nhl-${id}`,
  externalId: id,
  ...o,
});

const lastPost = nhl('2025030411', {
  season: '2025-26',
  seasonType: 'POST',
  startTimeUtc: '2026-06-15T00:00:00.000Z',
  status: 'FINAL',
});
const firstPre = nhl('2026010001', {
  season: '2026-27',
  seasonType: 'PRE',
  startTimeUtc: '2026-09-20T23:00:00.000Z',
  status: 'SCHEDULED',
});

let handle: DbHandle;

beforeAll(async () => (await createTestDb()).close(), 30_000);

beforeEach(async () => {
  handle = await createTestDb();
  await upsertTeams(handle.db, [cbj, nyi, celtics, sixers]);
});

afterEach(() => handle.close());

it.each<[string, Game[], string, string | null]>([
  ['no games', [], '2026-08-01T00:00:00Z', null],
  [
    'only future games: the earliest one',
    [
      nhl('2027020001', {
        season: '2027-28',
        seasonType: 'REG',
        startTimeUtc: '2027-10-07T23:00:00.000Z',
        status: 'SCHEDULED',
      }),
      firstPre,
    ],
    '2026-08-01T00:00:00Z',
    '2026-27',
  ],
  [
    'preseason: a PRE game started yesterday, REG next week',
    [
      lastPost,
      nhl('2026010001', {
        season: '2026-27',
        seasonType: 'PRE',
        startTimeUtc: '2026-09-20T23:00:00.000Z',
        status: 'FINAL',
      }),
      nhl('2026020001', {
        season: '2026-27',
        seasonType: 'REG',
        startTimeUtc: '2026-09-28T23:00:00.000Z',
        status: 'SCHEDULED',
      }),
    ],
    '2026-09-21T12:00:00Z',
    '2026-27',
  ],
  ['summer: the finished season', [lastPost, firstPre], '2026-08-01T00:00:00Z', '2025-26'],
  [
    'rollover: the first preseason game has started',
    [lastPost, firstPre],
    '2026-09-20T23:00:01Z',
    '2026-27',
  ],
  [
    'a postponed game whose start passed does not count',
    [
      lastPost,
      nhl('2026010001', {
        season: '2026-27',
        seasonType: 'PRE',
        startTimeUtc: '2026-09-20T23:00:00.000Z',
        status: 'POSTPONED',
      }),
    ],
    '2026-09-25T00:00:00Z',
    '2025-26',
  ],
  [
    'another league started later: still the NHL season',
    [
      lastPost,
      { ...nbaGame, season: '2027-28', startTimeUtc: '2026-07-01T00:00:00.000Z', status: 'FINAL' },
    ],
    '2026-08-01T00:00:00Z',
    '2025-26',
  ],
])('%s', async (_name, list, now, expected) => {
  await upsertGames(handle.db, list);
  expect(await currentSeason(handle.db, 'NHL', new Date(now))).toBe(expected);
});

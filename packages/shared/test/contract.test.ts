import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  countriesResponseSchema,
  dayResponseSchema,
  gameDateSchema,
  gameResponseSchema,
  idsQuerySchema,
  playerSummarySchema,
  prefsQuerySchema,
  searchQuerySchema,
  seasonStatsEntrySchema,
} from '../src/index';

describe('prefsQuerySchema', () => {
  it('defaults to every league and empty countries, favorites and hidden', () => {
    const prefs = prefsQuerySchema.parse({});
    expect(prefs.leagues).toEqual(new Set(['NHL', 'NBA']));
    expect(prefs.countries).toEqual(new Set());
    expect(prefs.favorites).toEqual(new Set());
    expect(prefs.hidden).toEqual(new Set());
  });

  it('splits comma-separated countries, fav and hide into Sets', () => {
    const prefs = prefsQuerySchema.parse({
      countries: 'LVA,EST',
      fav: 'nhl-8478402',
      hide: 'nba-1234',
    });
    expect(prefs.countries).toEqual(new Set(['LVA', 'EST']));
    expect(prefs.favorites).toEqual(new Set(['nhl-8478402']));
    expect(prefs.hidden).toEqual(new Set(['nba-1234']));
  });

  it('keeps only the requested leagues', () => {
    expect(prefsQuerySchema.parse({ leagues: 'NBA' }).leagues).toEqual(new Set(['NBA']));
  });

  it('reads an empty fav as no favorites', () => {
    expect(prefsQuerySchema.parse({ fav: '' }).favorites).toEqual(new Set());
  });

  it('ignores an unknown parameter', () => {
    expect(prefsQuerySchema.safeParse({ x: '1' }).success).toBe(true);
  });

  const ids = (n: number) => Array.from({ length: n }, (_, i) => `nhl-${i + 1}`).join(',');

  it.each([
    [200, true],
    [201, false],
  ])('a fav list of %i IDs parses: %s', (n, ok) => {
    expect(prefsQuerySchema.safeParse({ fav: ids(n) }).success).toBe(ok);
  });

  it.each([
    ['leagues', ''],
    ['leagues', 'MLB'],
    ['countries', 'XX'],
    ['countries', 'lva'],
    ['countries', 'LVA,'],
    ['countries', 'LVA, EST'],
    ['fav', 'abc'],
    ['hide', 'nhl-0'],
  ])('rejects %s=%j and the message names the parameter', (param, value) => {
    const result = prefsQuerySchema.safeParse({ [param]: value });
    expect(result.success).toBe(false);
    expect(result.error && z.prettifyError(result.error)).toContain(param);
  });
});

describe('gameDateSchema', () => {
  it('accepts 2026-03-16', () => {
    expect(gameDateSchema.parse('2026-03-16')).toBe('2026-03-16');
  });

  it.each(['2026-02-30', '20260316', '2026-3-16'])('rejects %s', (date) => {
    expect(gameDateSchema.safeParse(date).success).toBe(false);
  });
});

describe('dayResponseSchema', () => {
  const player = (id: string) => ({
    id,
    firstName: 'Elvis',
    lastName: 'Merzļikins',
    nationality: 'LVA',
  });
  const day = {
    gameDate: '2026-01-17',
    prevGameDate: null,
    nextGameDate: '2026-01-18',
    games: [
      {
        id: 'nhl-2025020750',
        league: 'NHL',
        seasonType: 'REG',
        gameDate: '2026-01-17',
        startTimeUtc: '2026-01-18T00:00:00Z',
        status: 'FINAL',
        endedIn: 'OT',
        away: { abbrev: 'CBJ', score: 3 },
        home: { abbrev: 'PIT', score: 2 },
        rows: [
          {
            type: 'line',
            side: 'away',
            player: player('nhl-8478007'),
            line: {
              kind: 'hockey_skater',
              stats: {
                goals: 1,
                assists: 0,
                points: 1,
                plusMinus: 1,
                shots: 3,
                toiSeconds: 1200,
                faceoffs: 3,
              },
            },
          },
          { type: 'dnp', side: 'home', player: player('nhl-8480000'), reason: null },
          { type: 'not-in-lineup', side: 'home', player: player('nhl-8476000') },
        ],
      },
    ],
  };

  it('parses a day with one row of each type', () => {
    const parsed = dayResponseSchema.parse(day);
    expect(parsed.games[0]?.rows.map((r) => r.type)).toEqual(['line', 'dnp', 'not-in-lineup']);
  });

  it('keeps a stat line that gained an unknown key, without the key', () => {
    const row = dayResponseSchema.parse(day).games[0]?.rows[0];
    expect(row?.type === 'line' && row.line.stats).toEqual({
      goals: 1,
      assists: 0,
      points: 1,
      plusMinus: 1,
      shots: 3,
      toiSeconds: 1200,
    });
  });
});

describe('idsQuerySchema', () => {
  it('splits comma-separated IDs into an array', () => {
    expect(idsQuerySchema.parse({ ids: 'nhl-1,nba-2' }).ids).toEqual(['nhl-1', 'nba-2']);
  });

  it('reads an empty ids as no IDs', () => {
    expect(idsQuerySchema.parse({ ids: '' }).ids).toEqual([]);
  });

  it('requires ids', () => {
    expect(idsQuerySchema.safeParse({}).success).toBe(false);
  });

  it('rejects an ID that is not a public ID', () => {
    expect(idsQuerySchema.safeParse({ ids: 'x-1' }).success).toBe(false);
  });

  it('rejects 201 IDs', () => {
    const ids = Array.from({ length: 201 }, (_, i) => `nhl-${i + 1}`).join(',');
    expect(idsQuerySchema.safeParse({ ids }).success).toBe(false);
  });
});

describe('searchQuerySchema', () => {
  it('trims the query', () => {
    expect(searchQuerySchema.parse({ q: '  porz ' }).q).toBe('porz');
  });

  it('accepts a 50-character query', () => {
    expect(searchQuerySchema.safeParse({ q: 'a'.repeat(50) }).success).toBe(true);
  });

  it.each([
    ['an empty query', { q: '' }],
    ['a blank query', { q: '   ' }],
    ['a missing query', {}],
    ['a 51-character query', { q: 'a'.repeat(51) }],
  ])('rejects %s', (_, query) => {
    expect(searchQuerySchema.safeParse(query).success).toBe(false);
  });
});

describe('seasonStatsEntrySchema', () => {
  const goalie = {
    kind: 'hockey_goalie',
    season: '2025-26',
    seasonType: 'REG',
    basis: 'totals',
    stats: {
      gamesPlayed: 2,
      gamesStarted: 2,
      wins: 1,
      losses: 1,
      otLosses: 0,
      saves: 0,
      shotsAgainst: 0,
      goalsAgainst: 0,
      goalsAgainstAverage: 0,
      shutouts: 0,
      toiSeconds: 7200,
    },
  };

  it('parses a goalie entry without savePct', () => {
    expect(seasonStatsEntrySchema.safeParse(goalie).success).toBe(true);
  });

  it('rejects a skater entry missing goals', () => {
    const skater = {
      kind: 'hockey_skater',
      season: '2025-26',
      seasonType: 'REG',
      basis: 'totals',
      stats: {
        gamesPlayed: 10,
        assists: 3,
        points: 5,
        plusMinus: 1,
        shots: 20,
        pim: 2,
        powerPlayGoals: 1,
        toiPerGameSeconds: 1000,
      },
    };
    expect(seasonStatsEntrySchema.safeParse(skater).success).toBe(false);
  });

  it('rejects an unknown kind', () => {
    expect(seasonStatsEntrySchema.safeParse({ ...goalie, kind: 'soccer_player' }).success).toBe(
      false,
    );
  });
});

describe('countriesResponseSchema', () => {
  it('parses a country with only one league counted', () => {
    const parsed = countriesResponseSchema.parse({
      countries: [{ code: 'LVA', counts: { NHL: 6 } }],
    });
    expect(parsed.countries[0]?.counts).toEqual({ NHL: 6 });
  });

  it('rejects a zero count', () => {
    const result = countriesResponseSchema.safeParse({
      countries: [{ code: 'LVA', counts: { NHL: 0 } }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown country code', () => {
    const result = countriesResponseSchema.safeParse({
      countries: [{ code: 'XX', counts: { NHL: 1 } }],
    });
    expect(result.success).toBe(false);
  });
});

describe('playerSummarySchema', () => {
  it('keeps a summary that gained an unknown key, without the key', () => {
    const summary = {
      id: 'nba-3102531',
      league: 'NBA',
      firstName: 'Kristaps',
      lastName: 'Porziņģis',
      position: 'C',
      team: { abbrev: 'BOS', name: 'Boston Celtics' },
      nationality: 'LVA',
      active: true,
    };
    expect(playerSummarySchema.parse({ ...summary, extra: 1 })).toEqual(summary);
  });
});

describe('gameResponseSchema', () => {
  const response = (row: Record<string, unknown>) => ({
    id: 'nhl-2025020760',
    league: 'NHL',
    seasonType: 'REG',
    gameDate: '2026-01-17',
    startTimeUtc: '2026-01-18T00:00:00Z',
    status: 'FINAL',
    endedIn: 'SO',
    away: { abbrev: 'CBJ', score: 4 },
    home: { abbrev: 'PIT', score: 3 },
    periodScores: null,
    rows: [
      {
        type: 'not-in-lineup',
        side: 'away',
        player: {
          id: 'nhl-8476878',
          firstName: 'Zemgus',
          lastName: 'Girgensons',
          nationality: 'LVA',
        },
        ...row,
      },
    ],
  });

  it('gameResponseSchema rejects a row without shown', () => {
    expect(gameResponseSchema.safeParse(response({ shown: true })).success).toBe(true);
    expect(gameResponseSchema.safeParse(response({})).success).toBe(false);
  });
});

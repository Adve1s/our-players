import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { dayResponseSchema, gameDateSchema, prefsQuerySchema } from '../src/index';

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

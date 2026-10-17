import type { SeasonStats } from '@our-players/shared';
import { describe, expect, it } from 'vitest';
import { mapGoalieSummary, mapSkaterSummary } from '../src/sources/nhl/season-stats';
import { loadFixture } from './fixtures';
import { list, obj, only } from './json';

// The fixture directory is the variant; the endpoint in error messages is skater-summary / goalie-summary.
const summary = (variant: string) => loadFixture('nhl', variant, '20252026');

function row(seasonStats: SeasonStats[], playerId: string): SeasonStats {
  return only(seasonStats, (s) => s.playerPublicId === `nhl-${playerId}`, `row of ${playerId}`);
}

function rawRow(raw: unknown, playerId: number) {
  return only(list(raw, 'data'), (r) => r.playerId === playerId, `raw row ${playerId}`);
}

describe('mapSkaterSummary: skater-summary-reg (gameTypeId 2)', () => {
  const result = () => mapSkaterSummary(summary('skater-summary-reg'), 'REG');
  const kolesar = () => row(result().seasonStats, '8478434');

  it('maps Kolesar 8478434 to his regular-season totals as given', () => {
    expect(kolesar().stats).toEqual({
      gamesPlayed: 82,
      goals: 6,
      assists: 11,
      points: 17,
      plusMinus: -14,
      shots: 67,
      pim: 55,
      powerPlayGoals: 0,
      toiPerGameSeconds: 692.2317,
    });
  });

  it('marks the row hockey_skater totals', () => {
    expect(kolesar().kind).toBe('hockey_skater');
    expect(kolesar().basis).toBe('totals');
  });

  it('normalizes seasonId 20252026 to "2025-26"', () => {
    expect(kolesar().season).toBe('2025-26');
  });

  it('uses the season type the caller passed', () => {
    expect(kolesar().seasonType).toBe('REG');
  });

  it('returns the total 940 and one row per data entry (50)', () => {
    expect(result().total).toBe(940);
    expect(result().seasonStats).toHaveLength(50);
  });
});

describe('mapSkaterSummary: skater-summary (no game type filter)', () => {
  const result = () => mapSkaterSummary(summary('skater-summary'), 'REG');

  it('maps traded Tsyplakov 8484958 (NYI,NJD) to one row with gamesPlayed 49', () => {
    const rows = result().seasonStats.filter((s) => s.playerPublicId === 'nhl-8484958');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.stats.gamesPlayed).toBe(49);
  });

  it('returns the total 977', () => {
    expect(result().total).toBe(977);
  });
});

describe('mapSkaterSummary: skater-summary-lva', () => {
  const result = () => mapSkaterSummary(summary('skater-summary-lva'), 'REG');

  it('maps Girgensons 8476878: gamesPlayed 81, toiPerGameSeconds 870.037 unrounded', () => {
    const s = row(result().seasonStats, '8476878').stats;
    expect(s.gamesPlayed).toBe(81);
    expect(s.toiPerGameSeconds).toBe(870.037);
  });

  it('maps ppGoals to powerPlayGoals and penaltyMinutes to pim (Balinskis 8484304: 3, 30)', () => {
    const s = row(result().seasonStats, '8484304').stats;
    expect(s.powerPlayGoals).toBe(3);
    expect(s.pim).toBe(30);
  });

  it('returns all 5 rows and the total 5', () => {
    expect(result().seasonStats).toHaveLength(5);
    expect(result().total).toBe(5);
  });
});

describe('mapGoalieSummary: goalie-summary-reg (gameTypeId 2)', () => {
  const result = () => mapGoalieSummary(summary('goalie-summary-reg'), 'REG');
  const kochetkov = () => row(result().seasonStats, '8481611');

  it('maps Kochetkov 8481611 to his totals as given', () => {
    expect(kochetkov().stats).toEqual({
      gamesPlayed: 9,
      gamesStarted: 8,
      wins: 6,
      losses: 2,
      otLosses: 0,
      saves: 170,
      shotsAgainst: 189,
      goalsAgainst: 19,
      savePct: 0.89947,
      goalsAgainstAverage: 2.32581,
      shutouts: 1,
      toiSeconds: 29409,
    });
  });

  it('marks the row hockey_goalie totals for 2025-26 with the season type passed', () => {
    const k = kochetkov();
    expect(k.kind).toBe('hockey_goalie');
    expect(k.basis).toBe('totals');
    expect(k.season).toBe('2025-26');
    expect(k.seasonType).toBe('REG');
  });

  it('returns the total 98', () => {
    expect(result().total).toBe(98);
  });
});

describe('mapGoalieSummary: goalie-summary (no game type filter)', () => {
  const result = () => mapGoalieSummary(summary('goalie-summary'), 'REG');

  it('maps Tarasov 8480193 to his totals as given', () => {
    expect(row(result().seasonStats, '8480193').stats).toEqual({
      gamesPlayed: 33,
      gamesStarted: 31,
      wins: 13,
      losses: 15,
      otLosses: 3,
      saves: 828,
      shotsAgainst: 925,
      goalsAgainst: 97,
      savePct: 0.89513,
      goalsAgainstAverage: 3.05404,
      shutouts: 0,
      toiSeconds: 114340,
    });
  });

  it('returns the total 100 and 50 rows', () => {
    expect(result().total).toBe(100);
    expect(result().seasonStats).toHaveLength(50);
  });
});

describe('season summaries: inputs no fixture contains (mutated copies)', () => {
  it('omits savePct when the source gives null (no fixture row has one)', () => {
    const raw = summary('goalie-summary');
    rawRow(raw, 8480193).savePct = null;
    const s = row(mapGoalieSummary(raw, 'REG').seasonStats, '8480193').stats;
    expect(s).not.toHaveProperty('savePct');
    expect(s.saves).toBe(828);
  });

  it('normalizes seasonId 20262027 to "2026-27"', () => {
    const raw = summary('skater-summary-lva');
    rawRow(raw, 8476878).seasonId = 20262027;
    expect(row(mapSkaterSummary(raw, 'REG').seasonStats, '8476878').season).toBe('2026-27');
  });

  it.each(['PRE', 'POST'] as const)('passes season type %s through', (seasonType) => {
    const { seasonStats } = mapSkaterSummary(summary('skater-summary-lva'), seasonType);
    expect(row(seasonStats, '8476878').seasonType).toBe(seasonType);
  });
});

describe('season summaries: errors', () => {
  it('throws on a seasonId that is not two consecutive years (20252027)', () => {
    const raw = summary('skater-summary-lva');
    rawRow(raw, 8476878).seasonId = 20252027;
    expect(() => mapSkaterSummary(raw, 'REG')).toThrow(/^nhl skater-summary/);
  });

  it('throws on a goalie seasonId that is not 8 digits (2025)', () => {
    const raw = summary('goalie-summary-reg');
    rawRow(raw, 8481611).seasonId = 2025;
    expect(() => mapGoalieSummary(raw, 'REG')).toThrow(/^nhl goalie-summary/);
  });

  it.each([
    ['skater-summary', 'a row without playerId', 8484958, 'playerId', undefined],
    ['skater-summary-reg', 'goals as a string', 8478434, 'goals', '6'],
    ['skater-summary-lva', 'timeOnIcePerGame as a string', 8476878, 'timeOnIcePerGame', '870'],
  ] as const)(
    '%s with %s throws "nhl skater-summary: invalid payload"',
    (variant, _what, playerId, field, value) => {
      const raw = summary(variant);
      const r = rawRow(raw, playerId);
      if (value === undefined) delete r[field];
      else r[field] = value;
      expect(() => mapSkaterSummary(raw, 'REG')).toThrow(/^nhl skater-summary: invalid payload/);
    },
  );

  it('skater summary without total throws "nhl skater-summary: invalid payload"', () => {
    const raw = summary('skater-summary-lva');
    delete obj(raw).total;
    expect(() => mapSkaterSummary(raw, 'REG')).toThrow(/^nhl skater-summary: invalid payload/);
  });

  it.each([
    ['goalie-summary', 'a row without saves', 8480193, 'saves', undefined],
    ['goalie-summary-reg', 'wins as a string', 8481611, 'wins', '6'],
  ] as const)(
    '%s with %s throws "nhl goalie-summary: invalid payload"',
    (variant, _what, playerId, field, value) => {
      const raw = summary(variant);
      const r = rawRow(raw, playerId);
      if (value === undefined) delete r[field];
      else r[field] = value;
      expect(() => mapGoalieSummary(raw, 'REG')).toThrow(/^nhl goalie-summary: invalid payload/);
    },
  );

  it('goalie summary without data throws "nhl goalie-summary: invalid payload"', () => {
    const raw = summary('goalie-summary-reg');
    delete obj(raw).data;
    expect(() => mapGoalieSummary(raw, 'REG')).toThrow(/^nhl goalie-summary: invalid payload/);
  });
});

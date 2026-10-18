import type { SeasonStats } from '@our-players/shared';
import { describe, expect, it } from 'vitest';
import { mapByAthlete } from '../src/sources/espn-nba/season-stats';
import { loadFixture } from './fixtures';
import { obj, only } from './json';

const byathlete = () => loadFixture('espn-nba', 'byathlete', '2026');

function row(seasonStats: SeasonStats[], athleteId: string): SeasonStats {
  return only(seasonStats, (s) => s.playerPublicId === `nba-${athleteId}`, `row of ${athleteId}`);
}

describe('mapByAthlete: byathlete/2026 (2025-26 regular season, page 1)', () => {
  const result = () => mapByAthlete(byathlete());
  const doncic = () => row(result().seasonStats, '3945274');

  it('maps Doncic 3945274 to his totals, by stat name', () => {
    // general: gamesPlayed 64, minutes 2289, rebounds 495, fouls 153; offensive: points 2143,
    // FG 693/1457, 3P 254/694, FT 503/645, assists 530, turnovers 255; defensive: steals 105, blocks 34.
    const { fgPct, threePct, ftPct, ...totals } = doncic().stats;
    expect(totals).toEqual({
      gamesPlayed: 64,
      minutes: 2289,
      points: 2143,
      rebounds: 495,
      assists: 530,
      steals: 105,
      blocks: 34,
      turnovers: 255,
      fouls: 153,
      fgMade: 693,
      fgAttempted: 1457,
      threeMade: 254,
      threeAttempted: 694,
      ftMade: 503,
      ftAttempted: 645,
    });
  });

  it('divides fieldGoalPct 47.5629997253418 by 100', () => {
    expect(doncic().stats.fgPct).toBeCloseTo(0.475629997, 6);
  });

  it('divides threePointFieldGoalPct 36.59942448139191 by 100', () => {
    expect(doncic().stats.threePct).toBeCloseTo(0.365994245, 6);
  });

  it('divides freeThrowPct 77.98400115966797 by 100', () => {
    expect(doncic().stats.ftPct).toBeCloseTo(0.779840012, 6);
  });

  it('marks the row basketball_player totals', () => {
    expect(doncic().kind).toBe('basketball_player');
    expect(doncic().basis).toBe('totals');
  });

  it('labels requestedSeason year 2026 as "2025-26"', () => {
    expect(doncic().season).toBe('2025-26');
  });

  it('maps requestedSeason type 2 to REG', () => {
    expect(doncic().seasonType).toBe('REG');
  });

  it('returns one row per athlete on the page: 50', () => {
    expect(result().seasonStats).toHaveLength(50);
  });

  it('returns the pagination: page 1 of 12, count 578', () => {
    expect(result().page).toBe(1);
    expect(result().pages).toBe(12);
    expect(result().count).toBe(578);
  });
});

describe('mapByAthlete: season and type come from the response (mutated copies)', () => {
  it('maps requestedSeason type 1 to PRE', () => {
    const raw = byathlete();
    obj(raw, 'requestedSeason', 'type').type = 1;
    expect(row(mapByAthlete(raw).seasonStats, '3945274').seasonType).toBe('PRE');
  });

  it('maps requestedSeason type 3 to POST', () => {
    const raw = byathlete();
    obj(raw, 'requestedSeason', 'type').type = 3;
    expect(row(mapByAthlete(raw).seasonStats, '3945274').seasonType).toBe('POST');
  });

  it('labels requestedSeason year 2027 as "2026-27"', () => {
    const raw = byathlete();
    obj(raw, 'requestedSeason').year = 2027;
    expect(row(mapByAthlete(raw).seasonStats, '3945274').season).toBe('2026-27');
  });
});

describe('mapByAthlete: errors', () => {
  it.each([
    [
      'pagination pages as a string',
      (raw: unknown) => {
        obj(raw, 'pagination').pages = '12';
      },
    ],
    [
      'an athlete without id',
      (raw: unknown) => {
        delete obj(raw, 'athletes', 0, 'athlete').id;
      },
    ],
    [
      'missing requestedSeason',
      (raw: unknown) => {
        delete obj(raw).requestedSeason;
      },
    ],
  ])('throws "espn-nba byathlete: invalid payload" on %s', (_what, mutate) => {
    const raw = byathlete();
    mutate(raw);
    expect(() => mapByAthlete(raw)).toThrow(/^espn-nba byathlete: invalid payload/);
  });
});

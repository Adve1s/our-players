import type { Game } from '@our-players/shared';
import { describe, expect, it } from 'vitest';
import { mapSchedule, mapScore } from '../src/sources/nhl/games';
import { loadFixture } from './fixtures';
import { list, obj, only } from './json';

const score = (date: string) => loadFixture('nhl', 'score', date);
const schedule = (date: string) => loadFixture('nhl', 'schedule', date);

function game(games: Game[], externalId: string): Game {
  return only(games, (g) => g.externalId === externalId, `game ${externalId}`);
}

// The raw game inside a score response, for mutating a copy.
function rawScoreGame(raw: unknown, id: number) {
  return only(list(raw, 'games'), (g) => g.id === id, `raw game ${id}`);
}

describe('mapScore: shootout game 2025020760 CBJ@PIT (score/2026-01-17)', () => {
  const sog = () => game(mapScore(score('2026-01-17')).games, '2025020760');

  it('derives the public ID from the NHL game ID', () => {
    const g = sog();
    expect(g.publicId).toBe('nhl-2025020760');
    expect(g.league).toBe('NHL');
    expect(g.source).toBe('nhl');
  });

  it('maps OFF to FINAL', () => {
    expect(sog().status).toBe('FINAL');
  });

  it('maps gameType 2 to the REG season type', () => {
    expect(sog().seasonType).toBe('REG');
  });

  it('normalizes season 20252026 to "2025-26"', () => {
    expect(sog().season).toBe('2025-26');
  });

  it('maps lastPeriodType SO to endedIn SO', () => {
    expect(sog().endedIn).toBe('SO');
  });

  it('takes the final score 4-3 from the teams', () => {
    const g = sog();
    expect(g.awayScore).toBe(4);
    expect(g.homeScore).toBe(3);
  });

  it('references the teams by NHL team ID as a string (CBJ 29 away, PIT 5 home)', () => {
    const g = sog();
    expect(g.awayTeamExternalId).toBe('29');
    expect(g.homeTeamExternalId).toBe('5');
  });

  it('labels the periods 1, 2, 3, OT, SO', () => {
    expect(sog().periodScores?.map((p) => p.period)).toEqual(['1', '2', '3', 'OT', 'SO']);
  });

  it("counts goals per period exactly as right-rail's linescore does (shootout counts 1 for the winner)", () => {
    // right-rail/2025020760 is the oracle: byPeriod 1-2, 2-0, 0-1, 0-0, 1-0.
    const byPeriod = list(loadFixture('nhl', 'right-rail', '2025020760'), 'linescore', 'byPeriod');
    expect(sog().periodScores?.map((p) => [p.away, p.home])).toEqual(
      byPeriod.map((p) => [p.away, p.home]),
    );
  });

  it('takes gameDate and startTimeUtc from the game', () => {
    const g = sog();
    expect(g.gameDate).toBe('2026-01-17');
    expect(g.startTimeUtc).toBe('2026-01-18T00:00:00Z');
  });
});

describe('mapScore: overtime game 2025021064 BOS@NJD (score/2026-03-16)', () => {
  const ot = () => game(mapScore(score('2026-03-16')).games, '2025021064');

  it('maps lastPeriodType OT to endedIn OT', () => {
    expect(ot().endedIn).toBe('OT');
  });

  it('takes the final score 3-4', () => {
    expect(ot().awayScore).toBe(3);
    expect(ot().homeScore).toBe(4);
  });

  it('gives periods 1-3 and OT with the NJD overtime winner', () => {
    // goals[]: P1 BOS 2; P2 NJD 2; P3 NJD 1, BOS 1; period 4 (OT) NJD 1.
    expect(ot().periodScores).toEqual([
      { period: '1', away: 2, home: 0 },
      { period: '2', away: 0, home: 2 },
      { period: '3', away: 1, home: 1 },
      { period: 'OT', away: 0, home: 1 },
    ]);
  });

  it('maps all 5 games of the day', () => {
    expect(mapScore(score('2026-03-16')).games).toHaveLength(5);
  });
});

describe('mapScore: late West Coast game 2025021134 ANA@VAN (score/2026-03-24)', () => {
  const late = () => game(mapScore(score('2026-03-24')).games, '2025021134');

  it('keeps the schedule date as gameDate although the UTC start is the next day', () => {
    expect(late().gameDate).toBe('2026-03-24');
  });

  it('keeps startTimeUTC as startTimeUtc', () => {
    expect(late().startTimeUtc).toBe('2026-03-25T02:00:00Z');
  });

  it('maps lastPeriodType REG to endedIn REG', () => {
    expect(late().endedIn).toBe('REG');
  });

  it('takes the final score 5-3', () => {
    expect(late().awayScore).toBe(5);
    expect(late().homeScore).toBe(3);
  });

  it('gives only periods 1-3 for a regulation game', () => {
    // goals[]: P1 VAN; P2 ANA, ANA, VAN; P3 ANA, VAN, ANA, ANA.
    expect(late().periodScores).toEqual([
      { period: '1', away: 0, home: 1 },
      { period: '2', away: 2, home: 1 },
      { period: '3', away: 3, home: 1 },
    ]);
  });

  it('maps all 15 games of the day', () => {
    expect(mapScore(score('2026-03-24')).games).toHaveLength(15);
  });
});

describe('mapScore: whole days of finished games', () => {
  it.each([
    ['2026-03-14', 14],
    ['2026-03-23', 1],
    ['2026-01-17', 13],
  ])('score/%s maps %i games, every one FINAL', (date, count) => {
    const { games } = mapScore(score(date));
    expect(games).toHaveLength(count);
    expect(games.every((g) => g.status === 'FINAL')).toBe(true);
  });

  it('score/2026-03-14: ANA@OTT 2025021043 ended in regulation 0-2', () => {
    const g = game(mapScore(score('2026-03-14')).games, '2025021043');
    expect(g.endedIn).toBe('REG');
    expect(g.awayScore).toBe(0);
    expect(g.homeScore).toBe(2);
  });

  it('score/2026-03-23: OTT@NYR 2025021119 ended in regulation 2-1', () => {
    const g = game(mapScore(score('2026-03-23')).games, '2025021119');
    expect(g.endedIn).toBe('REG');
    expect(g.awayScore).toBe(2);
    expect(g.homeScore).toBe(1);
  });
});

describe('mapScore: scheduled game 2026020119 PIT@COL (score/2026-10-16-states)', () => {
  const fut = () => game(mapScore(score('2026-10-16-states')).games, '2026020119');

  it('maps FUT to SCHEDULED', () => {
    expect(fut().status).toBe('SCHEDULED');
  });

  it('has null scores before the game', () => {
    expect(fut().awayScore).toBeNull();
    expect(fut().homeScore).toBeNull();
  });

  it('has null endedIn when not FINAL', () => {
    expect(fut().endedIn).toBeNull();
  });

  it('has null periodScores when there is no periodDescriptor', () => {
    expect(fut().periodScores).toBeNull();
  });

  it('normalizes season 20262027 to "2026-27"', () => {
    expect(fut().season).toBe('2026-27');
  });

  it('maps both games of the day', () => {
    expect(mapScore(score('2026-10-16-states')).games).toHaveLength(2);
  });
});

describe('mapScore: teams', () => {
  it('names team 29 by its common name "Blue Jackets"', () => {
    const team = only(mapScore(score('2026-01-17')).teams, (t) => t.externalId === '29', 'team 29');
    expect(team.name).toBe('Blue Jackets');
    expect(team.abbrev).toBe('CBJ');
    expect(team.league).toBe('NHL');
    expect(team.source).toBe('nhl');
  });

  it('lists each of the 26 teams of 13 games once', () => {
    const { teams } = mapScore(score('2026-01-17'));
    expect(teams).toHaveLength(26);
    expect(new Set(teams.map((t) => t.externalId)).size).toBe(26);
  });
});

describe('mapScore: states and inputs no fixture contains (mutated copies)', () => {
  it.each([
    ['OK', 'FUT', 'SCHEDULED'],
    ['OK', 'PRE', 'SCHEDULED'],
    ['OK', 'LIVE', 'LIVE'],
    ['OK', 'CRIT', 'LIVE'],
    ['PPD', 'FUT', 'POSTPONED'],
    ['CNCL', 'FUT', 'CANCELLED'],
  ])('gameScheduleState %s with gameState %s maps to %s', (scheduleState, gameState, status) => {
    const raw = score('2026-10-16-states');
    const g = rawScoreGame(raw, 2026020119);
    g.gameScheduleState = scheduleState;
    g.gameState = gameState;
    expect(game(mapScore(raw).games, '2026020119').status).toBe(status);
  });

  it('gives a PRE game no period scores even with a period descriptor', () => {
    const raw = score('2026-10-16-states');
    const g = rawScoreGame(raw, 2026020119);
    g.gameState = 'PRE';
    g.periodDescriptor = { number: 1, periodType: 'REG', maxRegulationPeriods: 3 };
    expect(game(mapScore(raw).games, '2026020119').periodScores).toBeNull();
  });

  describe('a live game (2025020760 mid second period, CBJ leading 3-2)', () => {
    const live = () => {
      const raw = score('2026-01-17');
      const g = rawScoreGame(raw, 2025020760);
      g.gameState = 'LIVE';
      delete g.gameOutcome;
      g.periodDescriptor = { number: 2, periodType: 'REG', maxRegulationPeriods: 3 };
      g.goals = list(g, 'goals').slice(0, 5); // the five goals of periods 1 and 2
      obj(g, 'awayTeam').score = 3;
      obj(g, 'homeTeam').score = 2;
      return game(mapScore(raw).games, '2025020760');
    };

    it('maps LIVE to LIVE', () => {
      expect(live().status).toBe('LIVE');
    });

    it('has null endedIn', () => {
      expect(live().endedIn).toBeNull();
    });

    it('takes the scores as given', () => {
      expect(live().awayScore).toBe(3);
      expect(live().homeScore).toBe(2);
    });

    it('gives period scores for periods 1 to the current one', () => {
      expect(live().periodScores).toEqual([
        { period: '1', away: 1, home: 2 },
        { period: '2', away: 2, home: 0 },
      ]);
    });
  });

  describe('a playoff double-overtime game (2025021064 with its OT winner moved to period 5)', () => {
    const doubleOt = () => {
      const raw = score('2026-03-16');
      const g = rawScoreGame(raw, 2025021064);
      const fifth = { number: 5, periodType: 'OT', maxRegulationPeriods: 3 };
      g.gameType = 3;
      g.periodDescriptor = fifth;
      g.gameOutcome = { lastPeriodType: 'OT', otPeriods: 2 };
      only(
        list(g, 'goals'),
        (goal) => obj(goal, 'periodDescriptor').number === 4,
        'OT goal',
      ).periodDescriptor = fifth;
      return game(mapScore(raw).games, '2025021064');
    };

    it('maps gameType 3 to POST', () => {
      expect(doubleOt().seasonType).toBe('POST');
    });

    it('labels the overtimes OT and 2OT', () => {
      expect(doubleOt().periodScores).toEqual([
        { period: '1', away: 2, home: 0 },
        { period: '2', away: 0, home: 2 },
        { period: '3', away: 1, home: 1 },
        { period: 'OT', away: 0, home: 0 },
        { period: '2OT', away: 0, home: 1 },
      ]);
    });

    it('maps lastPeriodType OT to endedIn OT', () => {
      expect(doubleOt().endedIn).toBe('OT');
    });
  });

  it('skips a gameType 4 game (All-Star, international)', () => {
    const raw = score('2026-01-17');
    rawScoreGame(raw, 2025020760).gameType = 4;
    const { games } = mapScore(raw);
    expect(games.map((g) => g.externalId)).not.toContain('2025020760');
    expect(games).toHaveLength(12);
  });

  it('skips a gameType 4 game whose teams lack fields league games have', () => {
    const raw = score('2026-01-17');
    const g = rawScoreGame(raw, 2025020760);
    g.gameType = 4;
    delete obj(g, 'awayTeam').name;
    delete obj(g, 'homeTeam').id;
    expect(mapScore(raw).games).toHaveLength(12);
  });

  it('skips a gameType 4 schedule game whose teams lack commonName', () => {
    const raw = schedule('2026-03-24');
    const g = only(list(raw, 'gameWeek', 0, 'games'), (x) => x.id === 2025021120, 'raw game');
    g.gameType = 4;
    delete obj(g, 'awayTeam').commonName;
    expect(mapSchedule(raw).games).toHaveLength(57);
  });
});

describe('mapScore: errors', () => {
  it('throws naming the game state when gameState is unknown', () => {
    const raw = score('2026-01-17');
    rawScoreGame(raw, 2025020760).gameState = 'XYZ';
    expect(() => mapScore(raw)).toThrow(/^nhl score: .*gameState/);
  });

  it('skips a game with an unknown gameScheduleState and warns, keeping the others', () => {
    const raw = score('2026-10-16-states');
    rawScoreGame(raw, 2026020119).gameScheduleState = 'SUSP';
    const { games, warnings } = mapScore(raw);
    expect(games.map((g) => g.externalId)).toEqual(['2026020120']);
    expect(warnings).toEqual([
      'nhl score: game 2026020119: unknown gameScheduleState "SUSP", game skipped',
    ]);
  });

  it('skips a schedule game with an unknown gameScheduleState and warns, keeping the week', () => {
    const raw = schedule('2026-03-24');
    only(
      list(raw, 'gameWeek', 0, 'games'),
      (x) => x.id === 2025021120,
      'raw game',
    ).gameScheduleState = 'TBD';
    const { games, warnings } = mapSchedule(raw);
    expect(games).toHaveLength(57);
    expect(warnings).toEqual([
      'nhl schedule: game 2025021120: unknown gameScheduleState "TBD", game skipped',
    ]);
  });

  it('returns no warnings for a payload it maps fully', () => {
    expect(mapScore(score('2026-01-17')).warnings).toEqual([]);
  });

  it('throws when the season is not two consecutive years (20252027)', () => {
    const raw = score('2026-01-17');
    rawScoreGame(raw, 2025020760).season = 20252027;
    expect(() => mapScore(raw)).toThrow(/^nhl score/);
  });

  it('throws when the season is not 8 digits (2025)', () => {
    const raw = score('2026-01-17');
    rawScoreGame(raw, 2025020760).season = 2025;
    expect(() => mapScore(raw)).toThrow(/^nhl score/);
  });

  it('throws when a FINAL game has no gameOutcome', () => {
    const raw = score('2026-01-17');
    delete rawScoreGame(raw, 2025020760).gameOutcome;
    expect(() => mapScore(raw)).toThrow(/^nhl score/);
  });

  it('throws when lastPeriodType is not REG, OT or SO', () => {
    const raw = score('2026-01-17');
    obj(rawScoreGame(raw, 2025020760), 'gameOutcome').lastPeriodType = 'XX';
    expect(() => mapScore(raw)).toThrow(/^nhl score/);
  });
});

describe('mapSchedule: preseason game 2026010049 BOS@WSH (schedule/2026-09-25)', () => {
  const pre = () => game(mapSchedule(schedule('2026-09-25')).games, '2026010049');

  it('maps gameType 1 to PRE', () => {
    expect(pre().seasonType).toBe('PRE');
  });

  it('maps gameState FINAL to FINAL', () => {
    expect(pre().status).toBe('FINAL');
  });

  it('maps lastPeriodType OT to endedIn OT', () => {
    expect(pre().endedIn).toBe('OT');
  });

  it('takes the final score 2-3', () => {
    expect(pre().awayScore).toBe(2);
    expect(pre().homeScore).toBe(3);
  });

  it('takes gameDate from the gameWeek day it is listed under', () => {
    expect(pre().gameDate).toBe('2026-09-25');
  });

  it('has null periodScores (schedule has no goals)', () => {
    expect(pre().periodScores).toBeNull();
  });

  it('normalizes season 20262027 to "2026-27"', () => {
    expect(pre().season).toBe('2026-27');
  });
});

describe('mapSchedule: schedule/2026-09-25', () => {
  it('maps a regular-season OFF game (2026020001 FLA@CAR) to REG and FINAL', () => {
    const g = game(mapSchedule(schedule('2026-09-25')).games, '2026020001');
    expect(g.seasonType).toBe('REG');
    expect(g.status).toBe('FINAL');
    expect(g.gameDate).toBe('2026-09-29');
  });

  it('maps all 34 games of the week', () => {
    expect(mapSchedule(schedule('2026-09-25')).games).toHaveLength(34);
  });

  it('names a team by commonName (6 → "Bruins")', () => {
    const team = only(
      mapSchedule(schedule('2026-09-25')).teams,
      (t) => t.externalId === '6',
      'team 6',
    );
    expect(team.name).toBe('Bruins');
    expect(team.abbrev).toBe('BOS');
  });

  it('dedupes teams across the week: 34 games, 32 teams', () => {
    const { teams } = mapSchedule(schedule('2026-09-25'));
    expect(teams).toHaveLength(32);
    expect(new Set(teams.map((t) => t.externalId)).size).toBe(32);
  });
});

describe('mapSchedule: schedule/2026-03-24', () => {
  it('maps all 58 games of the week', () => {
    expect(mapSchedule(schedule('2026-03-24')).games).toHaveLength(58);
  });

  it('lists 2025021134 ANA@VAN under 2026-03-24, not its UTC date', () => {
    const g = game(mapSchedule(schedule('2026-03-24')).games, '2025021134');
    expect(g.gameDate).toBe('2026-03-24');
    expect(g.startTimeUtc).toBe('2026-03-25T02:00:00Z');
  });

  it('dates a later game by its own gameWeek day (2025021173 on 2026-03-30)', () => {
    expect(game(mapSchedule(schedule('2026-03-24')).games, '2025021173').gameDate).toBe(
      '2026-03-30',
    );
  });
});

describe('malformed payloads throw naming source and endpoint', () => {
  it.each([
    [
      'score',
      'missing game id',
      () => {
        const raw = score('2026-01-17');
        delete rawScoreGame(raw, 2025020760).id;
        return mapScore(raw);
      },
    ],
    [
      'score',
      'season as a string',
      () => {
        const raw = score('2026-01-17');
        rawScoreGame(raw, 2025020760).season = '20252026';
        return mapScore(raw);
      },
    ],
    [
      'score',
      'missing games',
      () => {
        const raw = score('2026-01-17');
        delete obj(raw).games;
        return mapScore(raw);
      },
    ],
    [
      'schedule',
      'missing gameWeek date',
      () => {
        const raw = schedule('2026-09-25');
        delete obj(raw, 'gameWeek', 0).date;
        return mapSchedule(raw);
      },
    ],
    [
      'schedule',
      'startTimeUTC as a number',
      () => {
        const raw = schedule('2026-09-25');
        obj(raw, 'gameWeek', 0, 'games', 0).startTimeUTC = 123;
        return mapSchedule(raw);
      },
    ],
  ])('%s with %s', (endpoint, _what, run) => {
    expect(run).toThrow(new RegExp(`^nhl ${endpoint}: invalid payload`));
  });
});

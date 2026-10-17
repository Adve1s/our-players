import type { HockeyGoalieStats, HockeySkaterStats, Player, StatLine } from '@our-players/shared';
import { describe, expect, it } from 'vitest';
import { mapBoxscore } from '../src/sources/nhl/boxscore';
import { loadFixture } from './fixtures';
import { list, obj, only } from './json';

const boxscore = (gameId: string) => loadFixture('nhl', 'boxscore', gameId);

function line(lines: StatLine[], playerId: string): StatLine {
  return only(lines, (l) => l.playerPublicId === `nhl-${playerId}`, `line of ${playerId}`);
}

function player(players: Player[], playerId: string): Player {
  return only(players, (p) => p.externalId === playerId, `player ${playerId}`);
}

function skaterStats(l: StatLine): HockeySkaterStats {
  if (l.kind !== 'hockey_skater' || !l.played)
    throw new Error(`not a played skater line: ${l.kind}`);
  return l.stats;
}

function goalieStats(l: StatLine): HockeyGoalieStats {
  if (l.kind !== 'hockey_goalie' || !l.played)
    throw new Error(`not a played goalie line: ${l.kind}`);
  return l.stats;
}

// A player's raw entry in either side's forwards, defense or goalies, for mutating a copy.
function rawPlayer(raw: unknown, playerId: number) {
  const sides = ['awayTeam', 'homeTeam'].flatMap((side) =>
    ['forwards', 'defense', 'goalies'].flatMap((group) =>
      list(raw, 'playerByGameStats', side, group),
    ),
  );
  return only(sides, (p) => p.playerId === playerId, `raw player ${playerId}`);
}

describe('mapBoxscore: 2025021127 MIN@TBL (regulation)', () => {
  const result = () => mapBoxscore(boxscore('2025021127'));

  it('maps Girgensons 8476878 to a played skater line with all ten stats ("12:49" → 769 s)', () => {
    const l = line(result().lines, '8476878');
    expect(l.kind).toBe('hockey_skater');
    expect(l.played).toBe(true);
    expect(skaterStats(l)).toEqual({
      goals: 0,
      assists: 0,
      points: 0,
      plusMinus: 1,
      shots: 1,
      toiSeconds: 769,
      pim: 0,
      hits: 1,
      blocks: 0,
      powerPlayGoals: 0,
    });
  });

  it('maps a scoring defenseman (Raddysh 8478178) without mixing up fields', () => {
    // goals 1, assists 2, points 3, plusMinus 1, sog 5, toi "23:48", pim 0, hits 1, blockedShots 1, powerPlayGoals 1
    expect(skaterStats(line(result().lines, '8478178'))).toEqual({
      goals: 1,
      assists: 2,
      points: 3,
      plusMinus: 1,
      shots: 5,
      toiSeconds: 1428,
      pim: 0,
      hits: 1,
      blocks: 1,
      powerPlayGoals: 1,
    });
  });

  it("ties Girgensons' line to the game, his public ID and the home team TBL 14", () => {
    const l = line(result().lines, '8476878');
    expect(l.gamePublicId).toBe('nhl-2025021127');
    expect(l.playerPublicId).toBe('nhl-8476878');
    expect(l.teamExternalId).toBe('14');
  });

  it('gives a skater line starter null and dnpReason null', () => {
    const l = line(result().lines, '8476878');
    expect(l.starter).toBeNull();
    expect(l.dnpReason).toBeNull();
  });

  it('maps decision L to L (Gustavsson 8479406)', () => {
    const l = line(result().lines, '8479406');
    expect(l.kind).toBe('hockey_goalie');
    expect(goalieStats(l)).toEqual({
      saves: 20,
      shotsAgainst: 24,
      goalsAgainst: 4,
      savePct: 0.833333,
      toiSeconds: 3496,
      decision: 'L',
    });
    expect(l.teamExternalId).toBe('30');
  });

  it('gives one line per dressed player: 40', () => {
    expect(result().lines).toHaveLength(40);
  });
});

describe('mapBoxscore: 2025020760 CBJ@PIT (shootout)', () => {
  const result = () => mapBoxscore(boxscore('2025020760'));

  it('maps Merzlikins 8478007 to a goalie line 30 saves of 33, 3 GA, .909091, "65:00" → 3900 s, W', () => {
    const l = line(result().lines, '8478007');
    expect(l.kind).toBe('hockey_goalie');
    expect(l.played).toBe(true);
    expect(goalieStats(l)).toEqual({
      saves: 30,
      shotsAgainst: 33,
      goalsAgainst: 3,
      savePct: 0.909091,
      toiSeconds: 3900,
      decision: 'W',
    });
  });

  it('marks Merzlikins as starter for the away team CBJ 29', () => {
    const l = line(result().lines, '8478007');
    expect(l.starter).toBe(true);
    expect(l.teamExternalId).toBe('29');
  });

  it('maps decision O to OTL (Silovs 8481668, "64:26" → 3866 s)', () => {
    const l = line(result().lines, '8481668');
    expect(goalieStats(l)).toEqual({
      saves: 23,
      shotsAgainst: 26,
      goalsAgainst: 3,
      savePct: 0.884615,
      toiSeconds: 3866,
      decision: 'OTL',
    });
    expect(l.teamExternalId).toBe('5');
  });

  it('maps the dressed backup Greaves 8482982 (toi "00:00") to a DNP line', () => {
    const l = line(result().lines, '8482982');
    expect(l.kind).toBe('hockey_goalie');
    expect(l.played).toBe(false);
    expect(l.stats).toBeNull();
    expect(l.dnpReason).toBeNull();
  });

  it('keeps starter false on the backup Greaves', () => {
    expect(line(result().lines, '8482982').starter).toBe(false);
  });

  it('splits the stub name "E. Merzlikins" at the first space', () => {
    const p = player(result().players, '8478007');
    expect(p.firstName).toBe('E.');
    expect(p.lastName).toBe('Merzlikins');
  });

  it('keeps everything after the first space as the last name ("J. St. Ivany")', () => {
    const p = player(result().players, '8481030');
    expect(p.firstName).toBe('J.');
    expect(p.lastName).toBe('St. Ivany');
  });

  it('builds a goalie stub for Merzlikins: ID, position, group, jersey, team', () => {
    const p = player(result().players, '8478007');
    expect(p.publicId).toBe('nhl-8478007');
    expect(p.league).toBe('NHL');
    expect(p.source).toBe('nhl');
    expect(p.position).toBe('G');
    expect(p.positionGroup).toBe('goalie');
    expect(p.jersey).toBe('90');
    expect(p.currentTeamExternalId).toBe('29');
  });

  it('leaves birth fields null on a stub', () => {
    const p = player(result().players, '8478007');
    expect(p.birthDate).toBeNull();
    expect(p.birthCity).toBeNull();
    expect(p.birthCountry).toBeNull();
  });

  it('builds a defense stub for St. Ivany 8481030 on the home team PIT 5', () => {
    const p = player(result().players, '8481030');
    expect(p.position).toBe('D');
    expect(p.positionGroup).toBe('defense');
    expect(p.jersey).toBe('3');
    expect(p.currentTeamExternalId).toBe('5');
  });

  it('gives one stub per dressed player: 40', () => {
    expect(result().players).toHaveLength(40);
  });

  it('returns both teams by common name: 29 Blue Jackets, 5 Penguins', () => {
    const { teams } = result();
    expect(teams).toHaveLength(2);
    const cbj = only(teams, (t) => t.externalId === '29', 'team 29');
    expect(cbj.abbrev).toBe('CBJ');
    expect(cbj.name).toBe('Blue Jackets');
    expect(cbj.league).toBe('NHL');
    expect(cbj.source).toBe('nhl');
    expect(only(teams, (t) => t.externalId === '5', 'team 5').name).toBe('Penguins');
  });
});

describe('mapBoxscore: 2025021064 BOS@NJD (overtime)', () => {
  const result = () => mapBoxscore(boxscore('2025021064'));

  it('maps Markstrom 8474593 to W for the home team NJD 1', () => {
    const l = line(result().lines, '8474593');
    expect(goalieStats(l).decision).toBe('W');
    expect(goalieStats(l).toiSeconds).toBe(3893);
    expect(l.teamExternalId).toBe('1');
  });

  it('maps Korpisalo 8476914 decision O to OTL for the away team BOS 6', () => {
    const l = line(result().lines, '8476914');
    expect(goalieStats(l).decision).toBe('OTL');
    expect(goalieStats(l).savePct).toBe(0.882353);
    expect(l.teamExternalId).toBe('6');
  });

  it('maps a defense entry (Lohrei 8482511) to a hockey_skater line', () => {
    const l = line(result().lines, '8482511');
    expect(l.kind).toBe('hockey_skater');
    expect(skaterStats(l).toiSeconds).toBe(1327); // "22:07"
    expect(skaterStats(l).blocks).toBe(3);
  });

  it('gives the Lohrei stub position D and group defense', () => {
    const p = player(result().players, '8482511');
    expect(p.position).toBe('D');
    expect(p.positionGroup).toBe('defense');
  });

  it('keeps pim, hits and blocks apart (Dillon 8475455: 5, 3, 1)', () => {
    const s = skaterStats(line(result().lines, '8475455'));
    expect(s.pim).toBe(5);
    expect(s.hits).toBe(3);
    expect(s.blocks).toBe(1);
  });

  it('gives a forward stub group forward (8479999, position from the box score)', () => {
    const p = player(result().players, '8479999');
    expect(p.positionGroup).toBe('forward');
  });
});

describe('mapBoxscore: 2026010059 TBL@FLA (preseason)', () => {
  const result = () => mapBoxscore(boxscore('2026010059'));

  it('gives goalies starter null when the box score has no starter field', () => {
    const goalies = result().lines.filter((l) => l.kind === 'hockey_goalie');
    expect(goalies).toHaveLength(4);
    expect(goalies.every((l) => l.starter === null)).toBe(true);
  });

  it('maps Black 8484900 (savePctg 0, toi "00:00") to a DNP line', () => {
    const l = line(result().lines, '8484900');
    expect(l.played).toBe(false);
    expect(l.stats).toBeNull();
    expect(l.dnpReason).toBeNull();
  });

  it('maps Schmid 8481033 decision O to OTL with savePct 0.909091', () => {
    expect(goalieStats(line(result().lines, '8481033'))).toEqual({
      saves: 20,
      shotsAgainst: 22,
      goalsAgainst: 2,
      savePct: 0.909091,
      toiSeconds: 3882,
      decision: 'OTL',
    });
  });

  it('maps Hildeby 8483710 decision W for the away team TBL 14', () => {
    const l = line(result().lines, '8483710');
    expect(goalieStats(l).decision).toBe('W');
    expect(l.teamExternalId).toBe('14');
  });

  it('ties lines to the preseason game nhl-2026010059', () => {
    expect(line(result().lines, '8481033').gamePublicId).toBe('nhl-2026010059');
  });
});

describe('mapBoxscore: inputs no fixture contains (mutated copies)', () => {
  it('maps a goalie who played but faced no shots to a played line with savePct null', () => {
    // Greaves 8482982 given 2:10 of ice time; shotsAgainst 0 and no savePctg in the fixture.
    const raw = boxscore('2025020760');
    rawPlayer(raw, 8482982).toi = '02:10';
    const l = line(mapBoxscore(raw).lines, '8482982');
    expect(l.played).toBe(true);
    expect(goalieStats(l)).toEqual({
      saves: 0,
      shotsAgainst: 0,
      goalsAgainst: 0,
      savePct: null,
      toiSeconds: 130,
      decision: null,
    });
  });

  it('maps a skater with toi "00:00" to a DNP line', () => {
    const raw = boxscore('2025021127');
    rawPlayer(raw, 8476878).toi = '00:00';
    const l = line(mapBoxscore(raw).lines, '8476878');
    expect(l.kind).toBe('hockey_skater');
    expect(l.played).toBe(false);
    expect(l.stats).toBeNull();
  });

  it('gives a name without a space an empty first name and the whole name as last name', () => {
    const raw = boxscore('2025020760');
    obj(rawPlayer(raw, 8478007), 'name').default = 'Merzlikins';
    const p = player(mapBoxscore(raw).players, '8478007');
    expect(p.firstName).toBe('');
    expect(p.lastName).toBe('Merzlikins');
  });
});

describe('mapBoxscore: errors', () => {
  it('throws on a malformed toi "abc"', () => {
    const raw = boxscore('2025021127');
    rawPlayer(raw, 8476878).toi = 'abc';
    expect(() => mapBoxscore(raw)).toThrow(/^nhl boxscore/);
  });

  it('throws on an unknown decision "T"', () => {
    const raw = boxscore('2025020760');
    rawPlayer(raw, 8478007).decision = 'T';
    expect(() => mapBoxscore(raw)).toThrow(/^nhl boxscore/);
  });

  it('throws when a goalie who faced shots has no savePctg', () => {
    const raw = boxscore('2025020760');
    delete rawPlayer(raw, 8478007).savePctg;
    expect(() => mapBoxscore(raw)).toThrow(/^nhl boxscore/);
  });

  it('throws on an unknown position code', () => {
    const raw = boxscore('2025021127');
    rawPlayer(raw, 8476878).position = 'X';
    expect(() => mapBoxscore(raw)).toThrow(/^nhl boxscore/);
  });

  it.each([
    [
      'a goalie without toi',
      (raw: unknown) => {
        delete rawPlayer(raw, 8478007).toi;
      },
    ],
    [
      'a skater without playerId',
      (raw: unknown) => {
        delete rawPlayer(raw, 8475745).playerId;
      },
    ],
    [
      'goals as a string',
      (raw: unknown) => {
        rawPlayer(raw, 8475745).goals = '1';
      },
    ],
    [
      'missing playerByGameStats',
      (raw: unknown) => {
        delete obj(raw).playerByGameStats;
      },
    ],
    [
      'away team id as a string',
      (raw: unknown) => {
        obj(raw, 'awayTeam').id = '29';
      },
    ],
  ])('throws "nhl boxscore: invalid payload" on %s', (_what, mutate) => {
    const raw = boxscore('2025020760');
    mutate(raw);
    expect(() => mapBoxscore(raw)).toThrow(/^nhl boxscore: invalid payload/);
  });
});

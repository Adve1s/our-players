import type { BasketballPlayerStats, Player, StatLine } from '@our-players/shared';
import { describe, expect, it } from 'vitest';
import { mapSummary } from '../src/sources/espn-nba/boxscore';
import { loadFixture } from './fixtures';
import { list, obj, only } from './json';

const summary = (eventId: string) => loadFixture('espn-nba', 'summary', eventId);

function line(lines: StatLine[], athleteId: string): StatLine {
  return only(lines, (l) => l.playerPublicId === `nba-${athleteId}`, `line of ${athleteId}`);
}

function player(players: Player[], athleteId: string): Player {
  return only(players, (p) => p.externalId === athleteId, `player ${athleteId}`);
}

function basketballStats(l: StatLine): BasketballPlayerStats {
  if (l.kind !== 'basketball_player' || !l.played)
    throw new Error(`not a played basketball line: ${l.kind}`);
  return l.stats;
}

// Each team's statistics[0] block (labels + athletes), for mutating a copy.
function rawStatBlocks(raw: unknown) {
  return list(raw, 'boxscore', 'players').map((team) => obj(team, 'statistics', 0));
}

// An athlete row from either team's box score, for mutating a copy.
function rawRow(raw: unknown, athleteId: string) {
  const rows = rawStatBlocks(raw).flatMap((block) => list(block, 'athletes'));
  return only(rows, (r) => obj(r, 'athlete').id === athleteId, `raw row ${athleteId}`);
}

describe('mapSummary: 401810839 GS@WSH (regular season)', () => {
  const result = () => mapSummary(summary('401810839'));
  const porzingis = () => line(result().lines, '3102531');

  it('maps Porzingis 3102531 to a played basketball line with all 17 stats', () => {
    // stats ["26","30","8-13","1-5","13-14","5","4","3","2","3","1","4","2","+7"]
    const l = porzingis();
    expect(l.kind).toBe('basketball_player');
    expect(l.played).toBe(true);
    expect(basketballStats(l)).toEqual({
      minutes: 26,
      points: 30,
      fgMade: 8,
      fgAttempted: 13,
      threeMade: 1,
      threeAttempted: 5,
      ftMade: 13,
      ftAttempted: 14,
      rebounds: 5,
      assists: 4,
      turnovers: 3,
      steals: 2,
      blocks: 3,
      offRebounds: 1,
      defRebounds: 4,
      fouls: 2,
      plusMinus: 7,
    });
  });

  it("ties Porzingis' line to the game, his public ID and GS 9", () => {
    const l = porzingis();
    expect(l.gamePublicId).toBe('nba-401810839');
    expect(l.playerPublicId).toBe('nba-3102531');
    expect(l.teamExternalId).toBe('9');
  });

  it('keeps starter false for Porzingis off the bench', () => {
    expect(porzingis().starter).toBe(false);
  });

  it("ignores a played row's reason: dnpReason null", () => {
    expect(porzingis().dnpReason).toBeNull();
  });

  it('marks the starter Draymond Green 6589 starter true with plusMinus -8', () => {
    const l = line(result().lines, '6589');
    expect(l.starter).toBe(true);
    expect(basketballStats(l).plusMinus).toBe(-8);
  });

  it('maps Horford 3213 (didNotPlay) to a DNP line with reason "NOT WITH TEAM"', () => {
    const l = line(result().lines, '3213');
    expect(l.played).toBe(false);
    expect(l.stats).toBeNull();
    expect(l.dnpReason).toBe('NOT WITH TEAM');
    expect(l.kind).toBe('basketball_player');
  });

  it('keeps the DNP reasons verbatim (Post "RIGHT FOOT", Champagnie "COACH\'S DECISION")', () => {
    expect(line(result().lines, '4593016').dnpReason).toBe('RIGHT FOOT');
    expect(line(result().lines, '4432907').dnpReason).toBe("COACH'S DECISION");
  });

  it('gives every played line dnpReason null', () => {
    const played = result().lines.filter((l) => l.played);
    expect(played).toHaveLength(22);
    expect(played.every((l) => l.dnpReason === null)).toBe(true);
  });

  it('gives one line per athlete row: 26, of which 4 DNP', () => {
    const { lines } = result();
    expect(lines).toHaveLength(26);
    expect(lines.filter((l) => !l.played)).toHaveLength(4);
  });

  it('puts the WSH players on team 27 (Trae Young 4277905: 21 points, +3)', () => {
    const l = line(result().lines, '4277905');
    expect(l.teamExternalId).toBe('27');
    expect(basketballStats(l).points).toBe(21);
    expect(basketballStats(l).plusMinus).toBe(3);
  });

  it('builds a stub for Porzingis: ID, names, position, group, jersey, team', () => {
    const p = player(result().players, '3102531');
    expect(p.publicId).toBe('nba-3102531');
    expect(p.league).toBe('NBA');
    expect(p.source).toBe('espn');
    expect(p.firstName).toBe('Kristaps');
    expect(p.lastName).toBe('Porzingis');
    expect(p.position).toBe('C');
    expect(p.positionGroup).toBe('center');
    expect(p.jersey).toBe('7');
    expect(p.currentTeamExternalId).toBe('9');
  });

  it('leaves birth fields null on a stub', () => {
    const p = player(result().players, '3102531');
    expect(p.birthDate).toBeNull();
    expect(p.birthCity).toBeNull();
    expect(p.birthCountry).toBeNull();
  });

  it('keeps everything after the first space as the last name ("Gary Payton II")', () => {
    const p = player(result().players, '3134903');
    expect(p.firstName).toBe('Gary');
    expect(p.lastName).toBe('Payton II');
  });

  it.each([
    ['4066436', 'G', 'guard'],
    ['6589', 'F', 'forward'],
    ['3074213', 'C', 'center'],
  ])('groups stub %s with position %s as %s', (athleteId, position, group) => {
    const p = player(result().players, athleteId);
    expect(p.position).toBe(position);
    expect(p.positionGroup).toBe(group);
  });

  it('builds a stub for a DNP row too (Horford 3213 on GS 9)', () => {
    const p = player(result().players, '3213');
    expect(p.lastName).toBe('Horford');
    expect(p.currentTeamExternalId).toBe('9');
  });

  it('gives one stub per athlete row: 26', () => {
    expect(result().players).toHaveLength(26);
  });

  it('returns both teams by short name: 9 Warriors GS, 27 Wizards WSH', () => {
    const { teams } = result();
    expect(teams).toHaveLength(2);
    const gs = only(teams, (t) => t.externalId === '9', 'team 9');
    expect(gs.name).toBe('Warriors');
    expect(gs.abbrev).toBe('GS');
    expect(gs.league).toBe('NBA');
    expect(gs.source).toBe('espn');
    const wsh = only(teams, (t) => t.externalId === '27', 'team 27');
    expect(wsh.name).toBe('Wizards');
    expect(wsh.abbrev).toBe('WSH');
  });
});

describe('mapSummary: 401810899 GS@DAL (overtime)', () => {
  const result = () => mapSummary(summary('401810899'));

  it('maps Porzingis 3102531 as a starter: 29 min, 22 pts, 7-17, 2-6, 6-7, +3', () => {
    // stats ["29","22","7-17","2-6","6-7","7","5","2","1","0","2","5","3","+3"]
    const l = line(result().lines, '3102531');
    expect(l.gamePublicId).toBe('nba-401810899');
    expect(l.starter).toBe(true);
    expect(basketballStats(l)).toEqual({
      minutes: 29,
      points: 22,
      fgMade: 7,
      fgAttempted: 17,
      threeMade: 2,
      threeAttempted: 6,
      ftMade: 6,
      ftAttempted: 7,
      rebounds: 7,
      assists: 5,
      turnovers: 2,
      steals: 1,
      blocks: 0,
      offRebounds: 2,
      defRebounds: 5,
      fouls: 3,
      plusMinus: 3,
    });
  });

  it('maps Cooper Flagg 5041939 on DAL 6: 42 min, 32 pts, 12-19', () => {
    const l = line(result().lines, '5041939');
    expect(l.teamExternalId).toBe('6');
    expect(basketballStats(l).minutes).toBe(42);
    expect(basketballStats(l).points).toBe(32);
    expect(basketballStats(l).fgMade).toBe(12);
    expect(basketballStats(l).fgAttempted).toBe(19);
  });

  it('gives one line per athlete row: 26', () => {
    expect(result().lines).toHaveLength(26);
  });
});

describe('mapSummary: 401898399 SAC@GS (preseason)', () => {
  const result = () => mapSummary(summary('401898399'));

  it('maps Stephen Curry 3975 as a starter: 14 min, 8 pts, 3-6, 2-4, 0-0, +2', () => {
    // stats ["14","8","3-6","2-4","0-0","0","2","1","0","0","0","0","0","+2"]
    const l = line(result().lines, '3975');
    expect(l.gamePublicId).toBe('nba-401898399');
    expect(l.teamExternalId).toBe('9');
    expect(l.starter).toBe(true);
    expect(basketballStats(l)).toEqual({
      minutes: 14,
      points: 8,
      fgMade: 3,
      fgAttempted: 6,
      threeMade: 2,
      threeAttempted: 4,
      ftMade: 0,
      ftAttempted: 0,
      rebounds: 0,
      assists: 2,
      turnovers: 1,
      steals: 0,
      blocks: 0,
      offRebounds: 0,
      defRebounds: 0,
      fouls: 0,
      plusMinus: 2,
    });
  });

  it('maps a "+/-" of "0" to plusMinus 0 (Zach LaVine 3064440)', () => {
    expect(basketballStats(line(result().lines, '3064440')).plusMinus).toBe(0);
  });

  it('gives Porzingis, absent from the box score, no line', () => {
    expect(result().lines.some((l) => l.playerPublicId === 'nba-3102531')).toBe(false);
  });

  it('gives Porzingis, absent from the box score, no stub', () => {
    expect(result().players.some((p) => p.externalId === '3102531')).toBe(false);
  });

  it('keeps everything after the first space as the last name ("Darius Acuff Jr.")', () => {
    const p = player(result().players, '5142620');
    expect(p.firstName).toBe('Darius');
    expect(p.lastName).toBe('Acuff Jr.');
  });

  it('gives one line per athlete row: 34', () => {
    expect(result().lines).toHaveLength(34);
  });
});

describe('mapSummary: 401909095 NY@BOS (a played row with MIN "--")', () => {
  const result = () => mapSummary(summary('401909095'));

  it('maps Pacome Dadiet 5211983 (MIN "--", every stat 0) to a played line with 0 minutes', () => {
    const l = line(result().lines, '5211983');
    expect(l.played).toBe(true);
    expect(l.starter).toBe(false);
    const s = basketballStats(l);
    expect(s.minutes).toBe(0);
    expect(s.points).toBe(0);
    expect(s.fgAttempted).toBe(0);
    expect(s.plusMinus).toBe(0);
  });

  it('gives one line per athlete row: 28, of which 5 DNP', () => {
    expect(result().lines).toHaveLength(28);
    expect(result().lines.filter((l) => !l.played)).toHaveLength(5);
  });
});

describe('mapSummary: 401909843 ATL@CHA (position "NA")', () => {
  const result = () => mapSummary(summary('401909843'));

  it('maps Michael Ajayi 5176517 (position "NA") to a DNP line with reason "COACH\'S DECISION"', () => {
    const l = line(result().lines, '5176517');
    expect(l.played).toBe(false);
    expect(l.dnpReason).toBe("COACH'S DECISION");
  });

  it('gives Ajayi a stub with position and position group null, jersey "10"', () => {
    const p = player(result().players, '5176517');
    expect(p.position).toBeNull();
    expect(p.positionGroup).toBeNull();
    expect(p.jersey).toBe('10');
    expect(p.lastName).toBe('Ajayi');
  });

  it('gives one line per athlete row: 27', () => {
    expect(result().lines).toHaveLength(27);
  });
});

describe('mapSummary: 401810126 WSH@CHI (a DNP row without an athlete ID)', () => {
  const result = () => mapSummary(summary('401810126'));

  it('skips the DNP row whose athlete has only a short name ("Olbrich"): 26 lines from 27 rows', () => {
    expect(result().lines).toHaveLength(26);
  });

  it('builds no stub for that row: 26 stubs, every one with an ID', () => {
    expect(result().players).toHaveLength(26);
    for (const p of result().players) expect(p.externalId).toMatch(/^\d+$/);
  });

  it('keeps the other CHI DNP row: 4 + 1 DNP lines', () => {
    expect(result().lines.filter((l) => !l.played)).toHaveLength(5);
  });
});

describe('mapSummary: stats by label, not by position (AC2)', () => {
  // One fixed permutation of the 14 columns: new column i holds old column PERMUTATION[i].
  const PERMUTATION = [13, 2, 0, 7, 11, 4, 9, 1, 12, 5, 3, 10, 8, 6];
  const permute = <T>(values: T[]): T[] => PERMUTATION.map((from) => values[from] as T);

  it('gives the same result when labels and every stats array are reordered alike', () => {
    const shuffled = summary('401810839');
    for (const block of rawStatBlocks(shuffled)) {
      block.labels = permute(list(block, 'labels') as unknown as string[]);
      for (const row of list(block, 'athletes')) {
        const stats = row.stats as string[];
        if (stats.length > 0) row.stats = permute(stats);
      }
    }
    expect(list(rawStatBlocks(shuffled)[0], 'labels')[0]).toBe('+/-');
    expect(mapSummary(shuffled)).toEqual(mapSummary(summary('401810839')));
  });
});

describe('mapSummary: inputs no fixture contains (mutated copies)', () => {
  it('gives a name without a space an empty first name and the whole name as last name', () => {
    const raw = summary('401810839');
    obj(rawRow(raw, '3102531'), 'athlete').displayName = 'Nene';
    const p = player(mapSummary(raw).players, '3102531');
    expect(p.firstName).toBe('');
    expect(p.lastName).toBe('Nene');
  });

  it('gives a stub without a jersey jersey null', () => {
    const raw = summary('401810839');
    delete obj(rawRow(raw, '3102531'), 'athlete').jersey;
    expect(player(mapSummary(raw).players, '3102531').jersey).toBeNull();
  });
});

describe('mapSummary: errors', () => {
  it('throws naming the label when "+/-" is missing', () => {
    const raw = summary('401810839');
    for (const block of rawStatBlocks(raw)) {
      const labels = list(block, 'labels') as unknown as string[];
      const at = labels.indexOf('+/-');
      labels.splice(at, 1);
      for (const row of list(block, 'athletes')) {
        const stats = row.stats as string[];
        if (stats.length > 0) stats.splice(at, 1);
      }
    }
    expect(() => mapSummary(raw)).toThrow(/espn-nba summary: .*\+\/-/);
  });

  it('throws on a malformed split FG "8/13"', () => {
    const raw = summary('401810839');
    (rawRow(raw, '3102531').stats as string[])[2] = '8/13';
    expect(() => mapSummary(raw)).toThrow(/espn-nba summary/);
  });

  it('throws on a played row with 13 stats for 14 labels', () => {
    const raw = summary('401810839');
    (rawRow(raw, '3102531').stats as string[]).pop();
    expect(() => mapSummary(raw)).toThrow(/espn-nba summary/);
  });

  it('throws when the box score has no players (game not started)', () => {
    const raw = summary('401810839');
    delete obj(raw, 'boxscore').players;
    expect(() => mapSummary(raw)).toThrow(/espn-nba summary/);
  });

  it('throws when the box score has an empty players list', () => {
    const raw = summary('401810839');
    obj(raw, 'boxscore').players = [];
    expect(() => mapSummary(raw)).toThrow(/espn-nba summary/);
  });

  it('throws on an unknown position "X"', () => {
    const raw = summary('401810839');
    obj(rawRow(raw, '3102531'), 'athlete', 'position').abbreviation = 'X';
    expect(() => mapSummary(raw)).toThrow(/espn-nba/);
  });

  it('throws on MIN "--" when the row has points (Dadiet with PTS "12")', () => {
    const raw = summary('401909095');
    (rawRow(raw, '5211983').stats as string[])[1] = '12';
    expect(() => mapSummary(raw)).toThrow(/player 5211983: malformed MIN "--"/);
  });

  it('throws on "--" in a stat other than MIN (PTS)', () => {
    const raw = summary('401810839');
    (rawRow(raw, '3102531').stats as string[])[1] = '--';
    expect(() => mapSummary(raw)).toThrow(/malformed PTS "--"/);
  });

  it.each([
    [
      'a header without id',
      (raw: unknown) => {
        delete obj(raw, 'header').id;
      },
    ],
    [
      'an athlete without id',
      (raw: unknown) => {
        delete obj(rawRow(raw, '3102531'), 'athlete').id;
      },
    ],
    [
      'a DNP row of an identified athlete without a position (Horford 3213)',
      (raw: unknown) => {
        delete obj(rawRow(raw, '3213'), 'athlete').position;
      },
    ],
    [
      'didNotPlay as a string',
      (raw: unknown) => {
        rawRow(raw, '3102531').didNotPlay = 'false';
      },
    ],
  ])('throws "espn-nba summary: invalid payload" on %s', (_what, mutate) => {
    const raw = summary('401810839');
    mutate(raw);
    expect(() => mapSummary(raw)).toThrow(/^espn-nba summary: invalid payload/);
  });
});

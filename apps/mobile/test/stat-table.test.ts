import type { BoxScoreRow, HockeyGoalieStats, LineStats, PlayerRow } from '@our-players/shared';
import { describe, expect, it } from 'vitest';
import {
  boxGroups,
  type ColumnSet,
  columns,
  columnWidth,
  todayGroups,
  values,
} from '../src/lib/stat-table';

const skater: LineStats = {
  kind: 'hockey_skater',
  stats: {
    goals: 1,
    assists: 1,
    points: 2,
    plusMinus: 1,
    shots: 3,
    toiSeconds: 1025,
    pim: 2,
    hits: 4,
    blocks: 1,
    powerPlayGoals: 0,
  },
};

const goalieStats: HockeyGoalieStats = {
  saves: 25,
  shotsAgainst: 27,
  goalsAgainst: 2,
  savePct: 0.926,
  toiSeconds: 3600,
  decision: 'W',
};
const goalie: LineStats = { kind: 'hockey_goalie', stats: goalieStats };

const porzingis: LineStats = {
  kind: 'basketball_player',
  stats: {
    minutes: 26,
    points: 30,
    rebounds: 5,
    assists: 4,
    fgMade: 8,
    fgAttempted: 13,
    threeMade: 1,
    threeAttempted: 5,
    ftMade: 13,
    ftAttempted: 14,
    turnovers: 3,
    steals: 0,
    blocks: 2,
    offRebounds: 1,
    defRebounds: 4,
    fouls: 2,
    plusMinus: -7,
  },
};

const labels = (kind: LineStats['kind'], set: ColumnSet) => columns(kind, set).map((c) => c.label);
const wideLabels = (kind: LineStats['kind'], set: ColumnSet) =>
  columns(kind, set)
    .filter((c) => c.wide)
    .map((c) => c.label);
const strongLabels = (kind: LineStats['kind'], set: ColumnSet) =>
  columns(kind, set)
    .filter((c) => c.strong)
    .map((c) => c.label);

describe('columns', () => {
  it.each<[LineStats['kind'], ColumnSet, string[], string[], string[]]>([
    ['hockey_skater', 'today', ['G', 'A', '+/-', 'SOG', 'TOI'], ['TOI'], ['G', 'A']],
    ['hockey_goalie', 'today', ['SV/SA', 'SV%', 'GA', 'DEC'], ['SV/SA'], ['DEC']],
    ['basketball_player', 'today', ['PTS', 'REB', 'AST', 'MIN'], [], ['PTS']],
    [
      'hockey_skater',
      'box',
      ['G', 'A', 'PTS', '+/-', 'SOG', 'TOI', 'PIM', 'HIT', 'BLK', 'PPG'],
      ['TOI'],
      ['PTS'],
    ],
    ['hockey_goalie', 'box', ['SV/SA', 'SV%', 'GA', 'TOI', 'DEC'], ['SV/SA', 'TOI'], []],
    [
      'basketball_player',
      'box',
      [
        'MIN',
        'PTS',
        'REB',
        'AST',
        'FG',
        '3PT',
        'FT',
        'OREB',
        'DREB',
        'STL',
        'BLK',
        'TO',
        'PF',
        '+/-',
      ],
      ['FG', '3PT', 'FT'],
      ['PTS'],
    ],
  ])('%s %s columns are labelled, sized and weighted', (kind, set, expected, wide, strong) => {
    expect(labels(kind, set)).toEqual(expected);
    expect(wideLabels(kind, set)).toEqual(wide);
    expect(strongLabels(kind, set)).toEqual(strong);
  });
});

describe('values', () => {
  it('a skater today shows goals, assists, signed plus-minus, shots and time on ice', () => {
    expect(values(skater, 'today')).toEqual(['1', '1', '+1', '3', '17:05']);
  });

  it('a goalie today shows saves of shots, save percentage, goals against and decision', () => {
    expect(values(goalie, 'today')).toEqual(['25/27', '.926', '2', 'W']);
  });

  it('a goalie without a save percentage or decision shows dashes there', () => {
    const line: LineStats = {
      kind: 'hockey_goalie',
      stats: { ...goalieStats, savePct: null, decision: null },
    };
    expect(values(line, 'today')).toEqual(['25/27', '–', '2', '–']);
  });

  it('a basketball player today shows points, rebounds, assists and minutes', () => {
    expect(values(porzingis, 'today')).toEqual(['30', '5', '4', '26']);
  });

  it('a basketball box line shows every counting and shooting stat', () => {
    expect(values(porzingis, 'box')).toEqual([
      '26',
      '30',
      '5',
      '4',
      '8-13',
      '1-5',
      '13-14',
      '1',
      '4',
      '0',
      '2',
      '3',
      '2',
      '-7',
    ]);
  });

  it('a skater box line shows points, penalty minutes, hits, blocks and power-play goals', () => {
    expect(values(skater, 'box')).toEqual(['1', '1', '2', '+1', '3', '17:05', '2', '4', '1', '0']);
  });

  it('a skater box line without the optional stats shows dashes for them', () => {
    const line: LineStats = {
      kind: 'hockey_skater',
      stats: { goals: 1, assists: 1, points: 2, plusMinus: 1, shots: 3, toiSeconds: 1025 },
    };
    expect(values(line, 'box').slice(6)).toEqual(['–', '–', '–', '–']);
  });

  it('a goalie box line adds time on ice before the decision', () => {
    expect(values(goalie, 'box')).toEqual(['25/27', '.926', '2', '60:00', 'W']);
  });

  it.each<[LineStats, ColumnSet]>([
    [skater, 'today'],
    [goalie, 'today'],
    [porzingis, 'today'],
    [skater, 'box'],
    [goalie, 'box'],
    [porzingis, 'box'],
  ])('values line up with the columns (case %#)', (line, set) => {
    expect(values(line, set)).toHaveLength(columns(line.kind, set).length);
  });
});

const player = (id: string) => ({ id, firstName: 'A', lastName: id, nationality: null });
const lineRow = (id: string, line: LineStats): PlayerRow => ({
  type: 'line',
  side: 'away',
  player: player(id),
  line,
});
const dnpRow = (id: string): PlayerRow => ({
  type: 'dnp',
  side: 'away',
  player: player(id),
  reason: null,
});

describe('todayGroups', () => {
  it('starts a new group at every kind change and keeps server order', () => {
    const rows = [
      lineRow('nhl-1', skater),
      lineRow('nhl-2', skater),
      lineRow('nhl-3', goalie),
      dnpRow('nhl-4'),
      lineRow('nhl-5', skater),
    ];
    const groups = todayGroups(rows);
    expect(groups.map((g) => g.kind)).toEqual([
      'hockey_skater',
      'hockey_goalie',
      null,
      'hockey_skater',
    ]);
    expect(groups.map((g) => g.rows)).toEqual([
      [rows[0], rows[1]],
      [rows[2]],
      [rows[3]],
      [rows[4]],
    ]);
  });

  it('no rows make no groups', () => {
    expect(todayGroups([])).toEqual([]);
  });
});

describe('boxGroups', () => {
  it('puts skaters first, then goalies, then text rows, each in server order', () => {
    const shown = (row: PlayerRow, isShown: boolean): BoxScoreRow => ({ ...row, shown: isShown });
    const goalieShown = shown(lineRow('nhl-1', goalie), true);
    const nilShown = shown({ type: 'not-in-lineup', side: 'away', player: player('nhl-2') }, true);
    const skater1 = shown(lineRow('nhl-3', skater), false);
    const skater2 = shown(lineRow('nhl-4', skater), false);
    const goalie2 = shown(lineRow('nhl-5', goalie), false);
    const dnp = shown(dnpRow('nhl-6'), false);
    expect(boxGroups([goalieShown, nilShown, skater1, skater2, goalie2, dnp])).toEqual([
      { kind: 'hockey_skater', rows: [skater1, skater2] },
      { kind: 'hockey_goalie', rows: [goalieShown, goalie2] },
      { kind: null, rows: [nilShown, dnp] },
    ]);
  });

  it('drops empty groups', () => {
    const p1 = lineRow('nba-1', porzingis);
    const p2 = lineRow('nba-2', porzingis);
    expect(boxGroups([p1, p2])).toEqual([{ kind: 'basketball_player', rows: [p1, p2] }]);
  });
});

describe('columnWidth', () => {
  it.each<[boolean, number, number]>([
    [false, 1, 34],
    [true, 1, 52],
    [true, 2, 104],
    [false, 0.85, 34],
    [false, 1.3, 45],
  ])('wide %s at font scale %s is %s', (wide, fontScale, expected) => {
    expect(columnWidth(wide, fontScale)).toBe(expected);
  });
});

import type { BoxScoreRow, GameResponse } from '@our-players/shared';
import { describe, expect, it } from 'vitest';
import {
  boxSections,
  gameWhen,
  type PeriodTable,
  periodTable,
  periodTableLabel,
} from '../src/lib/game-page';

const hockey: GameResponse = {
  id: 'nhl-2025021126',
  league: 'NHL',
  seasonType: 'REG',
  gameDate: '2026-03-16',
  startTimeUtc: '2026-03-16T23:00:00.000Z',
  status: 'FINAL',
  endedIn: 'REG',
  away: { abbrev: 'PIT', score: 7 },
  home: { abbrev: 'COL', score: 2 },
  rows: [],
  periodScores: [
    { period: '1', away: 2, home: 1 },
    { period: '2', away: 3, home: 0 },
    { period: '3', away: 2, home: 1 },
  ],
};

describe('periodTableLabel', () => {
  it('names each period beside its goals', () => {
    const table: PeriodTable = {
      labels: ['1', '2', '3', 'OT', 'SO', 'T'],
      rows: [
        { abbrev: 'CBJ', cells: ['1', '1', '1', '0', '1', '4'] },
        { abbrev: 'PIT', cells: ['0', '2', '1', '0', '0', '3'] },
      ],
    };
    expect(periodTableLabel(table)).toBe(
      'CBJ, period 1: 1, period 2: 1, period 3: 1, OT: 0, SO: 1, total: 4; ' +
        'PIT, period 1: 0, period 2: 2, period 3: 1, OT: 0, SO: 0, total: 3',
    );
  });

  it('a quarter keeps its own name', () => {
    const table: PeriodTable = {
      labels: ['Q1', 'Q2', 'Q3', 'Q4', 'T'],
      rows: [{ abbrev: 'DAL', cells: ['30', '25', '28', '27', '110'] }],
    };
    expect(periodTableLabel(table)).toBe('DAL, Q1: 30, Q2: 25, Q3: 28, Q4: 27, total: 110');
  });
});

describe('periodTable', () => {
  it.each<[string, GameResponse, PeriodTable]>([
    [
      'a regulation game has three periods and the total',
      hockey,
      {
        labels: ['1', '2', '3', 'T'],
        rows: [
          { abbrev: 'PIT', cells: ['2', '3', '2', '7'] },
          { abbrev: 'COL', cells: ['1', '0', '1', '2'] },
        ],
      },
    ],
    [
      'an overtime game adds the OT column',
      {
        ...hockey,
        endedIn: 'OT',
        away: { abbrev: 'PIT', score: 3 },
        home: { abbrev: 'COL', score: 2 },
        periodScores: [
          { period: '1', away: 1, home: 0 },
          { period: '2', away: 0, home: 1 },
          { period: '3', away: 1, home: 1 },
          { period: 'OT', away: 1, home: 0 },
        ],
      },
      {
        labels: ['1', '2', '3', 'OT', 'T'],
        rows: [
          { abbrev: 'PIT', cells: ['1', '0', '1', '1', '3'] },
          { abbrev: 'COL', cells: ['0', '1', '1', '0', '2'] },
        ],
      },
    ],
    [
      'a shootout game totals the final score',
      {
        ...hockey,
        endedIn: 'SO',
        away: { abbrev: 'CBJ', score: 4 },
        home: { abbrev: 'PIT', score: 3 },
        periodScores: [
          { period: '1', away: 1, home: 1 },
          { period: '2', away: 1, home: 2 },
          { period: '3', away: 1, home: 0 },
          { period: 'OT', away: 0, home: 0 },
          { period: 'SO', away: 1, home: 0 },
        ],
      },
      {
        labels: ['1', '2', '3', 'OT', 'SO', 'T'],
        rows: [
          { abbrev: 'CBJ', cells: ['1', '1', '1', '0', '1', '4'] },
          { abbrev: 'PIT', cells: ['1', '2', '0', '0', '0', '3'] },
        ],
      },
    ],
    [
      'a basketball overtime game has quarters, OT and the total',
      {
        ...hockey,
        id: 'nba-401810000',
        league: 'NBA',
        endedIn: 'OT',
        away: { abbrev: 'GS', score: 137 },
        home: { abbrev: 'DAL', score: 131 },
        periodScores: [
          { period: 'Q1', away: 30, home: 28 },
          { period: 'Q2', away: 31, home: 33 },
          { period: 'Q3', away: 29, home: 30 },
          { period: 'Q4', away: 32, home: 31 },
          { period: 'OT', away: 15, home: 9 },
        ],
      },
      {
        labels: ['Q1', 'Q2', 'Q3', 'Q4', 'OT', 'T'],
        rows: [
          { abbrev: 'GS', cells: ['30', '31', '29', '32', '15', '137'] },
          { abbrev: 'DAL', cells: ['28', '33', '30', '31', '9', '131'] },
        ],
      },
    ],
    [
      'a live game totals the current score',
      {
        ...hockey,
        status: 'LIVE',
        endedIn: null,
        away: { abbrev: 'PIT', score: 2 },
        home: { abbrev: 'COL', score: 3 },
        periodScores: [
          { period: '1', away: 1, home: 2 },
          { period: '2', away: 1, home: 1 },
        ],
      },
      {
        labels: ['1', '2', 'T'],
        rows: [
          { abbrev: 'PIT', cells: ['1', '1', '2'] },
          { abbrev: 'COL', cells: ['2', '1', '3'] },
        ],
      },
    ],
  ])('%s', (_, game, table) => {
    expect(periodTable(game)).toEqual(table);
  });

  it('a missing score totals the periods', () => {
    const game: GameResponse = {
      ...hockey,
      away: { abbrev: 'PIT', score: null },
      home: { abbrev: 'COL', score: null },
    };
    expect(periodTable(game)?.rows.map((r) => r.cells.at(-1))).toEqual(['7', '2']);
  });

  it.each<[string, GameResponse['periodScores']]>([
    ['no periods', []],
    ['no box score', null],
  ])('%s gives no table', (_, periodScores) => {
    expect(periodTable({ ...hockey, periodScores })).toBeNull();
  });
});

const row = (side: 'away' | 'home', id: string, shown: boolean): BoxScoreRow => ({
  type: 'upcoming',
  side,
  player: { id, firstName: 'A', lastName: id, nationality: null },
  shown,
});

describe('boxSections', () => {
  it('splits rows into away then home, each in server order', () => {
    const rows = [
      row('home', 'nhl-3', true),
      row('away', 'nhl-1', true),
      row('home', 'nhl-4', false),
      row('away', 'nhl-2', false),
    ];
    expect(boxSections({ ...hockey, rows })).toEqual([
      { side: 'away', abbrev: 'PIT', rows: [rows[1], rows[3]] },
      { side: 'home', abbrev: 'COL', rows: [rows[0], rows[2]] },
    ]);
  });

  it('leaves out a side with no rows', () => {
    const rows = [row('home', 'nhl-3', true)];
    expect(boxSections({ ...hockey, status: 'SCHEDULED', rows })).toEqual([
      { side: 'home', abbrev: 'COL', rows },
    ]);
  });
});

describe('gameWhen', () => {
  it('a start on the next local day shows its weekday', () => {
    expect(gameWhen(hockey, 'en-GB', 'Europe/Riga')).toBe('Mon, Mar 16, Tue 01:00');
  });
});

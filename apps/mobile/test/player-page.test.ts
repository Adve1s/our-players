import type { GameLogEntry, PlayerResponse, SeasonStatsEntry } from '@our-players/shared';
import { describe, expect, it } from 'vitest';
import {
  age,
  bioLines,
  logCaption,
  logLines,
  seasonCells,
  seasonHeading,
} from '../src/lib/player-page';

const skater: SeasonStatsEntry = {
  kind: 'hockey_skater',
  season: '2025-26',
  seasonType: 'REG',
  basis: 'totals',
  stats: {
    gamesPlayed: 82,
    goals: 30,
    assists: 45,
    points: 75,
    plusMinus: -3,
    shots: 210,
    pim: 20,
    powerPlayGoals: 9,
    toiPerGameSeconds: 1112.4,
  },
};
const goalieStats = {
  gamesPlayed: 50,
  gamesStarted: 49,
  wins: 25,
  losses: 18,
  otLosses: 6,
  saves: 1300,
  shotsAgainst: 1420,
  goalsAgainst: 120,
  goalsAgainstAverage: 2.456,
  shutouts: 3,
  toiSeconds: 175000,
};
const goalie: SeasonStatsEntry = {
  kind: 'hockey_goalie',
  season: '2025-26',
  seasonType: 'REG',
  basis: 'totals',
  stats: { ...goalieStats, savePct: 0.9154 },
};
const goalieNoShots: SeasonStatsEntry = {
  kind: 'hockey_goalie',
  season: '2025-26',
  seasonType: 'REG',
  basis: 'totals',
  stats: goalieStats,
};
const basketballStats = {
  gamesPlayed: 50,
  minutes: 1600,
  points: 1003,
  rebounds: 360,
  assists: 140,
  turnovers: 80,
  steals: 30,
  blocks: 90,
  fouls: 120,
  fgMade: 350,
  fgAttempted: 772,
  threeMade: 110,
  threeAttempted: 300,
  ftMade: 190,
  ftAttempted: 230,
  fgPct: 0.4531,
  threePct: 0.3667,
  ftPct: 0.826,
};
const basketball: SeasonStatsEntry = {
  kind: 'basketball_player',
  season: '2025-26',
  seasonType: 'REG',
  basis: 'totals',
  stats: basketballStats,
};

describe('seasonCells', () => {
  it.each<[string, SeasonStatsEntry, [string, string][]]>([
    [
      'a skater shows signed +/- and TOI per game as m:ss',
      skater,
      [
        ['GP', '82'],
        ['G', '30'],
        ['A', '45'],
        ['PTS', '75'],
        ['+/-', '-3'],
        ['SOG', '210'],
        ['TOI/GP', '18:32'],
      ],
    ],
    [
      'a goalie shows GAA to two decimals and SV% as .915',
      goalie,
      [
        ['GP', '50'],
        ['W', '25'],
        ['L', '18'],
        ['OTL', '6'],
        ['GAA', '2.46'],
        ['SV%', '.915'],
        ['SO', '3'],
      ],
    ],
    [
      'a goalie without a save percentage shows a dash',
      goalieNoShots,
      [
        ['GP', '50'],
        ['W', '25'],
        ['L', '18'],
        ['OTL', '6'],
        ['GAA', '2.46'],
        ['SV%', '–'],
        ['SO', '3'],
      ],
    ],
    [
      'basketball totals become per-game averages and percentages lose the sign',
      basketball,
      [
        ['GP', '50'],
        ['MIN', '32.0'],
        ['PTS', '20.1'],
        ['REB', '7.2'],
        ['AST', '2.8'],
        ['FG%', '45.3'],
        ['3P%', '36.7'],
        ['FT%', '82.6'],
      ],
    ],
    [
      'basketball per-game values are shown as they are',
      {
        ...basketball,
        basis: 'per_game',
        stats: { ...basketballStats, minutes: 31.96, points: 20.06, rebounds: 7.2, assists: 2.8 },
      },
      [
        ['GP', '50'],
        ['MIN', '32.0'],
        ['PTS', '20.1'],
        ['REB', '7.2'],
        ['AST', '2.8'],
        ['FG%', '45.3'],
        ['3P%', '36.7'],
        ['FT%', '82.6'],
      ],
    ],
    [
      'basketball with no games played shows dashes for the averages',
      {
        ...basketball,
        stats: {
          ...basketballStats,
          gamesPlayed: 0,
          minutes: 0,
          points: 0,
          rebounds: 0,
          assists: 0,
          fgPct: 0,
          threePct: 0,
          ftPct: 0,
        },
      },
      [
        ['GP', '0'],
        ['MIN', '–'],
        ['PTS', '–'],
        ['REB', '–'],
        ['AST', '–'],
        ['FG%', '0.0'],
        ['3P%', '0.0'],
        ['FT%', '0.0'],
      ],
    ],
  ])('%s', (_, entry, cells) => {
    expect(seasonCells(entry)).toEqual(cells.map(([label, value]) => ({ label, value })));
  });
});

describe('seasonHeading', () => {
  it.each<[SeasonStatsEntry['seasonType'], string]>([
    ['REG', 'Regular season 2025-26'],
    ['POST', 'Playoffs 2025-26'],
  ])('%s is headed %s', (seasonType, heading) => {
    expect(seasonHeading({ ...skater, seasonType })).toBe(heading);
  });
});

describe('age', () => {
  it.each<[string, string, number]>([
    ['the day before the birthday', '2026-06-12', 32],
    ['on the birthday', '2026-06-13', 33],
    ['the day after the birthday', '2026-06-14', 33],
  ])('%s', (_, today, years) => {
    expect(age('1993-06-13', today)).toBe(years);
  });
});

const player: PlayerResponse = {
  id: 'nhl-8478007',
  league: 'NHL',
  firstName: 'Elvis',
  lastName: 'Merzlikins',
  position: 'G',
  team: { abbrev: 'CBJ', name: 'Columbus Blue Jackets' },
  nationality: 'LVA',
  active: true,
  positionGroup: 'goalie',
  jersey: '90',
  birthDate: '1994-04-13',
  birthCity: 'Riga',
  birthCountry: 'LVA',
  nationalitySource: 'birth',
  seasonStats: [],
  gameLog: [],
};

describe('bioLines', () => {
  const today = '2026-10-22';
  it.each<[string, PlayerResponse, string[]]>([
    [
      'a full player shows team, age, birthplace and nationality',
      player,
      ['CBJ · NHL · G · #90', 'Age 32 · Born Riga, LVA', 'Nationality LVA'],
    ],
    [
      'a free agent without a jersey shows No team and no number',
      { ...player, team: null, jersey: null, position: 'D' },
      ['No team · NHL · D', 'Age 32 · Born Riga, LVA', 'Nationality LVA'],
    ],
    [
      'an override nationality is marked',
      { ...player, birthCountry: 'USA', nationalitySource: 'override' },
      ['CBJ · NHL · G · #90', 'Age 32 · Born Riga, USA', 'Nationality LVA (override)'],
    ],
    [
      'no nationality leaves the nationality line out',
      { ...player, nationality: null, nationalitySource: null },
      ['CBJ · NHL · G · #90', 'Age 32 · Born Riga, LVA'],
    ],
    [
      'no birth data leaves the age and birthplace line out',
      { ...player, birthDate: null, birthCity: null, birthCountry: null },
      ['CBJ · NHL · G · #90', 'Nationality LVA'],
    ],
    [
      'only a birth country shows Born with it alone',
      { ...player, birthDate: null, birthCity: null },
      ['CBJ · NHL · G · #90', 'Born LVA', 'Nationality LVA'],
    ],
  ])('%s', (_, p, lines) => {
    expect(bioLines(p, today)).toEqual(lines);
  });
});

const game: GameLogEntry['game'] = {
  id: 'nba-401810000',
  league: 'NBA',
  seasonType: 'REG',
  gameDate: '2026-03-23',
  startTimeUtc: '2026-03-23T23:30:00.000Z',
  status: 'FINAL',
  endedIn: 'OT',
  away: { abbrev: 'GS', score: 137 },
  home: { abbrev: 'DAL', score: 131 },
};

describe('logCaption', () => {
  it('a finished overtime game reads day · score · status', () => {
    const entry: GameLogEntry = { type: 'dnp', game, side: 'away', reason: null };
    expect(logCaption(entry, 'en-GB', 'Europe/Riga')).toBe(
      'Mon, Mar 23 · GS 137 – 131 DAL · Final/OT',
    );
  });
});

describe('logLines', () => {
  it.each<[string, GameLogEntry, string[]]>([
    [
      'a skater line is the card text',
      {
        type: 'line',
        game,
        side: 'away',
        line: {
          kind: 'hockey_skater',
          stats: { goals: 1, assists: 1, points: 2, plusMinus: 2, shots: 4, toiSeconds: 1112 },
        },
      },
      ['1 G · 1 A · +2 · 4 SOG · 18:32'],
    ],
    [
      'a DNP shows its reason in sentence case',
      { type: 'dnp', game, side: 'away', reason: "COACH'S DECISION" },
      ["DNP — Coach's decision"],
    ],
  ])('%s', (_, entry, lines) => {
    expect(logLines(entry)).toEqual(lines);
  });
});

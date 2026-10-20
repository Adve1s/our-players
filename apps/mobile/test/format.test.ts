import type {
  DayGameResponse,
  GameStatus,
  League,
  MetaResponse,
  PlayerRow,
} from '@our-players/shared';
import { describe, expect, it } from 'vitest';
import {
  dateParam,
  dayLabel,
  latestDate,
  rowLabel,
  rowText,
  scoreText,
  startTime,
  statusLabel,
} from '../src/lib/format';

const player: PlayerRow['player'] = {
  id: 'nhl-8478007',
  firstName: 'Elvis',
  lastName: 'Merzlikins',
  nationality: 'LVA',
};

const skaterRow: PlayerRow = {
  type: 'line',
  side: 'away',
  player,
  line: {
    kind: 'hockey_skater',
    stats: { goals: 1, assists: 1, points: 2, plusMinus: 2, shots: 4, toiSeconds: 1112 },
  },
};
const goalieRow: PlayerRow = {
  type: 'line',
  side: 'away',
  player,
  line: {
    kind: 'hockey_goalie',
    stats: {
      saves: 28,
      shotsAgainst: 30,
      goalsAgainst: 2,
      savePct: 0.9333,
      toiSeconds: 3600,
      decision: 'W',
    },
  },
};
// Porziņģis, 2026-03-23; the fields the card doesn't show are zero.
const basketballRow: PlayerRow = {
  type: 'line',
  side: 'away',
  player,
  line: {
    kind: 'basketball_player',
    stats: {
      points: 22,
      rebounds: 7,
      assists: 5,
      minutes: 29,
      fgMade: 7,
      fgAttempted: 17,
      threeMade: 2,
      threeAttempted: 6,
      ftMade: 6,
      ftAttempted: 7,
      turnovers: 0,
      steals: 0,
      blocks: 0,
      offRebounds: 0,
      defRebounds: 0,
      fouls: 0,
      plusMinus: 0,
    },
  },
};
const dnpRow = (reason: string | null): PlayerRow => ({
  type: 'dnp',
  side: 'away',
  player,
  reason,
});
const notInLineupRow: PlayerRow = { type: 'not-in-lineup', side: 'away', player };
const upcomingRow: PlayerRow = { type: 'upcoming', side: 'away', player };

describe('startTime', () => {
  it('reads 24-hour time in the given locale and time zone', () => {
    expect(startTime('2026-10-17T01:00:00Z', 'en-GB', 'Europe/Riga')).toBe('04:00');
  });

  it('reads 12-hour time for en-US in New York', () => {
    // ICU may put a narrow or no-break space before AM/PM.
    const text = startTime('2026-10-17T01:00:00Z', 'en-US', 'America/New_York');
    expect(text.replace(/[  ]/g, ' ')).toBe('9:00 PM');
  });
});

describe('dayLabel', () => {
  it.each([
    ['2026-03-16', 'Mon, Mar 16'],
    ['2026-10-11', 'Sun, Oct 11'],
    ['2027-01-01', 'Fri, Jan 1'],
  ])('%s reads %s', (date, text) => {
    expect(dayLabel(date)).toBe(text);
  });
});

describe('statusLabel', () => {
  const START = '2026-10-17T01:00:00Z';
  it.each<[Pick<DayGameResponse, 'status' | 'endedIn'>, string]>([
    [{ status: 'FINAL', endedIn: 'OT' }, 'Final/OT'],
    [{ status: 'FINAL', endedIn: 'SO' }, 'Final/SO'],
    [{ status: 'FINAL', endedIn: 'REG' }, 'Final'],
    [{ status: 'LIVE', endedIn: null }, 'Live'],
    [{ status: 'POSTPONED', endedIn: null }, 'Postponed'],
    [{ status: 'CANCELLED', endedIn: null }, 'Cancelled'],
  ])('%o reads %s', (game, text) => {
    expect(statusLabel({ ...game, startTimeUtc: START })).toBe(text);
  });

  it('a SCHEDULED game reads its start time in the given locale and time zone', () => {
    const game = { status: 'SCHEDULED', endedIn: null, startTimeUtc: START } as const;
    expect(statusLabel(game, 'en-GB', 'Europe/Riga')).toBe('04:00');
  });
});

describe('scoreText', () => {
  it('with both scores reads away score – home score', () => {
    const game = { away: { abbrev: 'CBJ', score: 3 }, home: { abbrev: 'PIT', score: 2 } };
    expect(scoreText(game)).toBe('CBJ 3 – 2 PIT');
  });

  it('without scores reads away @ home', () => {
    const game = { away: { abbrev: 'CBJ', score: null }, home: { abbrev: 'PIT', score: null } };
    expect(scoreText(game)).toBe('CBJ @ PIT');
  });

  it('with one score missing reads away @ home', () => {
    const game = { away: { abbrev: 'CBJ', score: 3 }, home: { abbrev: 'PIT', score: null } };
    expect(scoreText(game)).toBe('CBJ @ PIT');
  });
});

describe('rowText', () => {
  it.each<[string, PlayerRow, GameStatus, string[]]>([
    ['a skater line', skaterRow, 'FINAL', ['1 G · 1 A · +2 · 4 SOG · 18:32']],
    [
      'a basketball line',
      basketballRow,
      'FINAL',
      ['22 PTS · 7 REB · 5 AST · 29 MIN', 'FG 7-17 · 3PT 2-6 · FT 6-7'],
    ],
    ["a coach's decision DNP", dnpRow("COACH'S DECISION"), 'FINAL', ["DNP — Coach's decision"]],
    ['an injury DNP', dnpRow('INJURY/ILLNESS'), 'FINAL', ['DNP — Injury/illness']],
    ['a DNP without a reason', dnpRow(null), 'FINAL', ['DNP']],
    ['not in lineup', notInLineupRow, 'FINAL', ['Not in lineup']],
    ['upcoming in a SCHEDULED game', upcomingRow, 'SCHEDULED', ['Not started']],
    ['upcoming in a LIVE game', upcomingRow, 'LIVE', ['In progress']],
    ['upcoming in a FINAL game', upcomingRow, 'FINAL', ['Waiting for stats']],
  ])('%s reads its text', (_label, row, status, text) => {
    expect(rowText(row, status)).toEqual(text);
  });
});

describe('rowLabel', () => {
  it('a skater line spells out goals, assists, plus-minus, shots and time on ice', () => {
    expect(rowLabel(skaterRow, 'FINAL', 'CBJ')).toBe(
      'Elvis Merzlikins, CBJ, 1 goal, 1 assist, plus 2, 4 shots on goal, 18 minutes 32 seconds',
    );
  });

  it('a goalie line spells out saves, save percentage, goals against and the decision', () => {
    expect(rowLabel(goalieRow, 'FINAL', 'CBJ')).toBe(
      'Elvis Merzlikins, CBJ, 28 saves on 30 shots, save percentage .933, 2 goals against, win',
    );
  });

  it('a basketball line spells out the counting stats and the shooting', () => {
    expect(rowLabel(basketballRow, 'FINAL', 'CBJ')).toBe(
      'Elvis Merzlikins, CBJ, 22 points, 7 rebounds, 5 assists, 29 minutes, field goals 7 of 17, three-pointers 2 of 6, free throws 6 of 7',
    );
  });

  it('a DNP reads did not play with the reason in sentence case', () => {
    expect(rowLabel(dnpRow("COACH'S DECISION"), 'FINAL', 'CBJ')).toBe(
      "Elvis Merzlikins, CBJ, did not play, Coach's decision",
    );
  });

  it('an upcoming row in a SCHEDULED game reads not started', () => {
    expect(rowLabel(upcomingRow, 'SCHEDULED', 'CBJ')).toBe('Elvis Merzlikins, CBJ, not started');
  });
});

describe('latestDate', () => {
  const meta = (nhl: string | null, nba: string | null): MetaResponse => ({
    leagues: [
      { league: 'NHL', currentSeason: '2025-26', latestGameDate: nhl },
      { league: 'NBA', currentSeason: '2025-26', latestGameDate: nba },
    ],
    dataUpdatedAt: null,
  });

  it.each<[string, MetaResponse, League[], string | null]>([
    [
      'both leagues: the later date',
      meta('2026-01-17', '2026-03-23'),
      ['NBA', 'NHL'],
      '2026-03-23',
    ],
    ['NHL only: the NHL date', meta('2026-01-17', '2026-03-23'), ['NHL'], '2026-01-17'],
    ['no league has a date: null', meta(null, null), ['NBA', 'NHL'], null],
    ['the selected league has no date: null', meta('2026-01-17', null), ['NBA'], null],
  ])('%s', (_label, m, leagues, date) => {
    expect(latestDate(m, leagues)).toBe(date);
  });
});

describe('dateParam', () => {
  it('a YYYY-MM-DD date is kept', () => {
    expect(dateParam('2026-03-16')).toBe('2026-03-16');
  });

  it.each<[string, string | string[] | undefined]>([
    ['missing', undefined],
    ['empty', ''],
    ['not a date', 'foo'],
    ['an impossible date', '2026-02-30'],
    ['an unpadded month', '2026-3-16'],
    ['repeated', ['2026-03-16', '2026-03-17']],
  ])('%s → null', (_label, raw) => {
    expect(dateParam(raw)).toBeNull();
  });
});

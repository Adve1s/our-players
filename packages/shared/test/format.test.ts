import { describe, expect, it } from 'vitest';
import {
  type BasketballPlayerStats,
  type EndedIn,
  finalLabel,
  type GameStatus,
  type HockeyGoalieStats,
  lineText,
  savePct,
  signed,
  toi,
  upcomingText,
} from '../src/index';

describe('toi', () => {
  it.each([
    [1112, '18:32'],
    [5, '0:05'],
    [3900, '65:00'],
  ])('%i seconds reads %s', (seconds, text) => {
    expect(toi(seconds)).toBe(text);
  });
});

describe('savePct', () => {
  it.each([
    [0.9333, '.933'],
    [1, '1.000'],
    [0.9, '.900'],
  ])('%d reads %s', (pct, text) => {
    expect(savePct(pct)).toBe(text);
  });
});

describe('signed', () => {
  it.each([
    [2, '+2'],
    [0, '0'],
    [-1, '-1'],
  ])('%i reads %s', (n, text) => {
    expect(signed(n)).toBe(text);
  });
});

describe('lineText', () => {
  it('a skater line reads goals, assists, plus-minus, shots and time on ice', () => {
    const stats = { goals: 1, assists: 1, points: 2, plusMinus: 2, shots: 4, toiSeconds: 1112 };
    expect(lineText({ kind: 'hockey_skater', stats })).toEqual(['1 G · 1 A · +2 · 4 SOG · 18:32']);
  });

  const goalie: HockeyGoalieStats = {
    saves: 28,
    shotsAgainst: 30,
    goalsAgainst: 2,
    savePct: 0.9333,
    toiSeconds: 3600,
    decision: 'W',
  };

  it('a goalie line reads saves/shots, save percentage, goals against and decision', () => {
    expect(lineText({ kind: 'hockey_goalie', stats: goalie })).toEqual(['28/30 · .933 · 2 GA · W']);
  });

  it('a goalie line without a save percentage or decision leaves those parts out', () => {
    const stats = { ...goalie, savePct: null, decision: null };
    expect(lineText({ kind: 'hockey_goalie', stats })).toEqual(['28/30 · 2 GA']);
  });

  it('a basketball line reads two lines: the counting stats, then shooting', () => {
    // Porziņģis, 2026-03-23; the fields the card doesn't show are zero.
    const stats: BasketballPlayerStats = {
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
    };
    expect(lineText({ kind: 'basketball_player', stats })).toEqual([
      '22 PTS · 7 REB · 5 AST · 29 MIN',
      'FG 7-17 · 3PT 2-6 · FT 6-7',
    ]);
  });
});

describe('finalLabel', () => {
  it.each<[EndedIn | null, string]>([
    ['REG', 'Final'],
    [null, 'Final'],
    ['OT', 'Final/OT'],
    ['SO', 'Final/SO'],
  ])('a game that ended in %s reads %s', (endedIn, text) => {
    expect(finalLabel(endedIn)).toBe(text);
  });
});

describe('upcomingText', () => {
  it.each<[GameStatus, string]>([
    ['SCHEDULED', 'Not started'],
    ['LIVE', 'In progress'],
    ['FINAL', 'Waiting for stats'],
    ['POSTPONED', 'Postponed'],
    ['CANCELLED', 'Cancelled'],
  ])('an upcoming row in a %s game reads %s', (status, text) => {
    expect(upcomingText(status)).toBe(text);
  });
});

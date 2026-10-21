import type { DayGameResponse, DayResponse } from '@our-players/shared';
import { describe, expect, it } from 'vitest';
import { dayMessage } from '../src/lib/day-message';

const withoutRows: DayGameResponse = {
  id: 'nhl-2025021126',
  league: 'NHL',
  seasonType: 'REG',
  gameDate: '2026-03-24',
  startTimeUtc: '2026-03-24T23:00:00.000Z',
  status: 'FINAL',
  endedIn: 'REG',
  away: { abbrev: 'COL', score: 6 },
  home: { abbrev: 'PIT', score: 2 },
  rows: [],
};
const withRows: DayGameResponse = {
  ...withoutRows,
  rows: [
    {
      type: 'upcoming',
      side: 'home',
      player: { id: 'nhl-8481668', firstName: 'Arturs', lastName: 'Silovs', nationality: 'LVA' },
    },
  ],
};

type Day = Pick<DayResponse, 'gameDate' | 'games' | 'prevGameDate' | 'nextGameDate'>;
const day = (over: Partial<Day>): Day => ({
  gameDate: '2026-03-16',
  games: [withoutRows],
  prevGameDate: null,
  nextGameDate: null,
  ...over,
});

describe('dayMessage', () => {
  it('a day with no games says so', () => {
    expect(dayMessage(day({ gameDate: '2026-03-17', games: [] }), '2026-03-23', true)).toEqual({
      text: 'No games on Tue, Mar 17.',
      action: null,
    });
  });

  it('following nothing points to Settings', () => {
    expect(dayMessage(day({}), '2026-03-23', false)).toEqual({
      text: "You're not following any countries or players yet.",
      action: 'settings',
    });
  });

  it('a day with a game that has rows needs no message', () => {
    expect(dayMessage(day({ games: [withRows] }), '2026-03-23', true)).toBeNull();
  });

  it('no rows on a day after the latest game day says who plays, with Next game day', () => {
    const d = day({ gameDate: '2026-03-25', nextGameDate: '2026-03-26' });
    expect(dayMessage(d, '2026-03-23', true)).toEqual({
      text: 'None of your players play on Wed, Mar 25.',
      action: 'next',
    });
  });

  it('no rows on a day after the latest game day with no next game day has no action', () => {
    const d = day({ gameDate: '2026-03-25', nextGameDate: null });
    expect(dayMessage(d, '2026-03-23', true)).toEqual({
      text: 'None of your players play on Wed, Mar 25.',
      action: null,
    });
  });

  it('no rows on a day before the latest game day says who played, with Previous game day', () => {
    const d = day({ gameDate: '2026-03-16', prevGameDate: '2026-03-14' });
    expect(dayMessage(d, '2026-03-23', true)).toEqual({
      text: 'None of your players played on Mon, Mar 16.',
      action: 'prev',
    });
  });

  it('no rows on a past day with no previous game day has no action', () => {
    const d = day({ gameDate: '2026-03-16', prevGameDate: null });
    expect(dayMessage(d, '2026-03-23', true)).toEqual({
      text: 'None of your players played on Mon, Mar 16.',
      action: null,
    });
  });

  it('without a latest game day (meta failed) no rows read as played', () => {
    const d = day({
      gameDate: '2026-03-25',
      prevGameDate: '2026-03-23',
      nextGameDate: '2026-03-26',
    });
    expect(dayMessage(d, null, true)).toEqual({
      text: 'None of your players played on Wed, Mar 25.',
      action: 'prev',
    });
  });

  it('no rows on the latest game day itself read as played', () => {
    const d = day({ gameDate: '2026-03-23', prevGameDate: '2026-03-16' });
    expect(dayMessage(d, '2026-03-23', true)).toEqual({
      text: 'None of your players played on Mon, Mar 23.',
      action: 'prev',
    });
  });
});

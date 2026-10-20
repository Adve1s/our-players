import type { DayResponse } from '@our-players/shared';
import { dayLabel } from './format';

export type DayMessage = { text: string; action: 'prev' | 'next' | 'settings' | null };

// The design's states 4–7, in its priority; null means the day has rows to show.
export function dayMessage(
  day: Pick<DayResponse, 'gameDate' | 'games' | 'prevGameDate' | 'nextGameDate'>,
  latest: string | null,
  following: boolean,
): DayMessage | null {
  const label = dayLabel(day.gameDate);
  if (day.games.length === 0) return { text: `No games on ${label}.`, action: null };
  if (!following)
    return { text: "You're not following any countries or players yet.", action: 'settings' };
  if (day.games.some((g) => g.rows.length > 0)) return null;
  // Without a latest game day (meta failed) the day reads as past.
  if (latest !== null && day.gameDate > latest)
    return {
      text: `None of your players play on ${label}.`,
      action: day.nextGameDate === null ? null : 'next',
    };
  return {
    text: `None of your players played on ${label}.`,
    action: day.prevGameDate === null ? null : 'prev',
  };
}

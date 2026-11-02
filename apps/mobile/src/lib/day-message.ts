import type { DayResponse } from '@our-players/shared';
import type { QueryObserverResult } from '@tanstack/react-query';
import { dayLabel } from './format';

export type DayMessage = { text: string; actions: ('prev' | 'next' | 'settings')[] };

// The design's states 4–7, in its priority; null means the day has rows to show.
export function dayMessage(
  day: Pick<DayResponse, 'gameDate' | 'games' | 'prevGameDate' | 'nextGameDate'>,
  latest: string | null,
  following: boolean,
): DayMessage | null {
  const label = dayLabel(day.gameDate);
  // Nothing stored after a future day means the schedule job hasn't reached it, not a day off.
  const unscheduled = day.nextGameDate === null && latest !== null && day.gameDate > latest;
  if (day.games.length === 0)
    return {
      text: unscheduled
        ? `No games on ${label} yet. The schedule is loaded about a week ahead.`
        : `No games on ${label}.`,
      actions: [
        ...(day.prevGameDate === null ? [] : (['prev'] as const)),
        ...(day.nextGameDate === null ? [] : (['next'] as const)),
      ],
    };
  if (!following)
    return { text: "You're not following any countries or players yet.", actions: ['settings'] };
  if (day.games.some((g) => g.rows.length > 0)) return null;
  // Without a latest game day (meta failed) the day reads as past.
  if (latest !== null && day.gameDate > latest)
    return {
      text: `None of your players play on ${label}.`,
      actions: day.nextGameDate === null ? [] : ['next'],
    };
  return {
    text: `None of your players played on ${label}.`,
    actions: day.prevGameDate === null ? [] : ['prev'],
  };
}

type QueryState = Pick<
  QueryObserverResult,
  'fetchStatus' | 'isRefetchError' | 'isLoadingError' | 'isPlaceholderData'
>;

export type DayBanner = { text: string; retry: boolean };

// The line above the day on screen (`shown`), or null when it is the fresh `requested` day.
export function refreshBanner(
  meta: QueryState,
  day: QueryState,
  requested: string,
  shown: string,
): DayBanner | null {
  const paused = day.fetchStatus === 'paused' && day.isPlaceholderData;
  // A failed step names the day asked for, so it outranks a meta failure.
  if (day.isLoadingError || paused) {
    if (requested !== shown)
      return paused
        ? { text: `You're offline — couldn't open ${dayLabel(requested)}.`, retry: false }
        : { text: `Couldn't load ${dayLabel(requested)}.`, retry: true };
    return {
      text: paused
        ? "You're offline — showing saved data."
        : "Couldn't refresh — showing saved data.",
      // The shown day has the old prefs, and web has no pull to refresh.
      retry: !paused,
    };
  }
  if (meta.fetchStatus === 'paused' || day.fetchStatus === 'paused')
    return { text: "You're offline — showing saved data.", retry: false };
  // A first-load failure has no saved data to show, so only refetch errors count.
  return day.isRefetchError || meta.isRefetchError
    ? { text: "Couldn't refresh — showing saved data.", retry: false }
    : null;
}

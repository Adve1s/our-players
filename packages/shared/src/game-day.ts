import type { GameStatus } from './enums';

// YYYY-MM-DD in a time zone (the device's when none is given).
export function localDate(at: Date, timeZone?: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(at);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

// The league's schedule date for "now" (CLAUDE.md rule 8). The last US games are on the West Coast,
// so the Pacific date stays on last night's game day until every game of it has ended.
export const usGameDay = (now: Date): string => localDate(now, 'America/Los_Angeles');

// The game day the scheduler is "on": the latest one with a game that has started. ISO dates sort as strings.
// A postponed or cancelled game never started, as in the server's playedOrPlaying.
export function latestStartedGameDay(
  games: readonly { gameDate: string; startTimeUtc: Date; status: GameStatus }[],
  now: Date,
): string | null {
  let latest: string | null = null;
  for (const g of games) {
    const started =
      g.startTimeUtc.getTime() <= now.getTime() &&
      g.status !== 'POSTPONED' &&
      g.status !== 'CANCELLED';
    if (started && (latest === null || g.gameDate > latest)) {
      latest = g.gameDate;
    }
  }
  return latest;
}

export function previousGameDay(days: readonly string[], day: string): string | null {
  return days.reduce<string | null>(
    (best, d) => (d < day && (best === null || d > best) ? d : best),
    null,
  );
}

export function nextGameDay(days: readonly string[], day: string): string | null {
  return days.reduce<string | null>(
    (best, d) => (d > day && (best === null || d < best) ? d : best),
    null,
  );
}

// YYYY-MM-DD plus n calendar days; UTC midnight, so no DST shift.
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

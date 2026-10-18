// The league's schedule date for "now" (CLAUDE.md rule 8). The last US games are on the West Coast,
// so the Pacific date stays on last night's game day until every game of it has ended.
export function usGameDay(now: Date): string {
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(now)
      .find((p) => p.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

// The game day the scheduler is "on": the latest one with a game that has started. ISO dates sort as strings.
export function latestStartedGameDay(
  games: readonly { gameDate: string; startTimeUtc: Date }[],
  now: Date,
): string | null {
  let latest: string | null = null;
  for (const g of games) {
    if (g.startTimeUtc.getTime() <= now.getTime() && (latest === null || g.gameDate > latest)) {
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

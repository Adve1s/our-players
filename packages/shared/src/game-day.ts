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

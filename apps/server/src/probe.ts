import { usGameDay } from '@our-players/shared';
import { createPoliteClient, HttpError } from './http/polite-client';
import { espnUrls } from './sources/espn-nba/client';
import { nhlUrls } from './sources/nhl/client';

export type ProbeTarget = { name: string; url: string };

// One request per upstream endpoint the jobs use, IDs taken from recorded fixtures.
export function probeTargets(now: Date): ProbeTarget[] {
  const today = usGameDay(now);
  // From October the new season is under way (NHL games, NBA preseason); before that, the last one is complete.
  const start = now.getUTCMonth() >= 9 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  const season = `${start}${start + 1}`;
  return [
    { name: 'nhl score', url: nhlUrls.score(today) },
    { name: 'nhl schedule', url: nhlUrls.schedule(today) },
    { name: 'nhl schedule-calendar', url: nhlUrls.scheduleCalendar(today) },
    { name: 'nhl boxscore', url: nhlUrls.boxscore('2025021064') },
    { name: 'nhl roster', url: nhlUrls.roster('PIT') },
    { name: 'nhl player-landing', url: nhlUrls.playerLanding('8478007') },
    { name: 'nhl skater-summary', url: nhlUrls.summary('skater', season, 2) },
    { name: 'nhl goalie-summary', url: nhlUrls.summary('goalie', season, 2) },
    { name: 'espn scoreboard', url: espnUrls.scoreboard(today) },
    { name: 'espn summary', url: espnUrls.summary('401810899') },
    { name: 'espn teams', url: espnUrls.teams() },
    { name: 'espn roster', url: espnUrls.roster('9') },
    { name: 'espn athlete', url: espnUrls.athlete('3102531') },
    { name: 'espn byathlete', url: espnUrls.byathlete(String(start + 1), 2, 1) },
  ];
}

export async function runProbe(
  targets: ProbeTarget[],
  o: { userAgent: string; fetch: typeof fetch; minIntervalMs?: number },
): Promise<{ lines: string[]; failed: number }> {
  // Starts when the request leaves (after the per-host wait); stops once the body has been read.
  let started = 0;
  const timed: typeof fetch = (input, init) => {
    started = performance.now();
    return o.fetch(input, init);
  };
  const ms = () => String(Math.round(performance.now() - started)).padStart(5);
  // No retries: the probe shows the first answer each host gives.
  const client = createPoliteClient({
    userAgent: o.userAgent,
    fetch: timed,
    maxRetries: 0,
    minIntervalMs: o.minIntervalMs,
  });

  const lines: string[] = [];
  let failed = 0;
  for (const { name, url } of targets) {
    const host = new URL(url).hostname;
    try {
      const r = await client.get(url);
      const took = ms();
      let note = '';
      try {
        JSON.parse(r.text);
      } catch {
        note = ` not JSON: ${JSON.stringify(r.text.slice(0, 80))}`;
      }
      if (note) failed++;
      const kb = (r.bytes / 1024).toFixed(1).padStart(7);
      lines.push(
        `${note ? 'FAIL' : 'ok  '} ${r.status} ${took} ms ${kb} kB  ${name.padEnd(22)} ${host}${note}`,
      );
    } catch (e) {
      failed++;
      const status = e instanceof HttpError && e.status !== null ? String(e.status) : '---';
      const msg = e instanceof Error ? e.message : String(e);
      lines.push(
        `FAIL ${status} ${ms()} ms ${' '.repeat(7)}     ${name.padEnd(22)} ${host}  ${msg}`,
      );
    }
  }
  return { lines, failed };
}

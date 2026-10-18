import type { GameStatus, League } from '@our-players/shared';
import type { JobName } from '../jobs';
import { CORRECTION_DELAY_MS, RESULTS_WINDOW_MS } from '../jobs/results';

export type SchedulerGame = {
  league: League;
  status: GameStatus;
  startTimeUtc: Date;
  finalAt: Date | null;
  boxscoreFetchedAt: Date | null;
  correctedAt: Date | null;
};
export type SchedulerState = {
  games: readonly SchedulerGame[];
  lastRuns: Partial<Record<League, Partial<Record<JobName, Date>>>>;
  startup: boolean;
};
export type Decision = { league: League; job: Exclude<JobName, 'backfill'>; reason: string };

export const DAILY_SLOTS = { schedule: 9, roster: 10, 'season-stats': 11 } as const; // UTC hours

// Per league, in run order: schedule first so a stale schedule is healed before results runs.
export function decide(now: Date, leagues: readonly League[], state: SchedulerState): Decision[] {
  const t = now.getTime();
  // Any run counts, failed or not: a failing daily job waits for tomorrow instead of re-firing every tick.
  const dailyDue = (league: League, job: keyof typeof DAILY_SLOTS) => {
    const slot = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      DAILY_SLOTS[job],
    );
    const last = state.lastRuns[league]?.[job];
    return t >= slot && (last === undefined || last.getTime() < slot);
  };

  return leagues.flatMap((league) => {
    const games = state.games.filter((g) => g.league === league);
    const decisions: Decision[] = [];
    const add = (job: Decision['job'], reason: string) => decisions.push({ league, job, reason });

    if (state.startup && !games.some((g) => g.startTimeUtc.getTime() > t))
      add('schedule', 'no future games');
    else if (dailyDue(league, 'schedule')) add('schedule', 'daily 09:00');
    const results = resultsReason(t, games, state.startup);
    if (results) add('results', results);
    if (dailyDue(league, 'roster')) add('roster', 'daily 10:00');
    if (dailyDue(league, 'season-stats')) add('season-stats', 'daily 11:00');
    return decisions;
  });
}

function resultsReason(
  t: number,
  games: readonly SchedulerGame[],
  startup: boolean,
): string | null {
  const windowStart = t - RESULTS_WINDOW_MS;
  const awaiting = games.filter(
    (g) =>
      g.startTimeUtc.getTime() <= t &&
      (g.status === 'SCHEDULED' ||
        g.status === 'LIVE' ||
        (g.status === 'FINAL' && g.boxscoreFetchedAt === null)),
  );
  if (awaiting.some((g) => g.startTimeUtc.getTime() >= windowStart)) return 'games in progress';
  if (startup && awaiting.length > 0) return 'catch-up at startup';
  // Windowed too, so a box score that 404s forever doesn't make every tick call upstream.
  const correctionDue = games.some(
    (g) =>
      g.status === 'FINAL' &&
      g.boxscoreFetchedAt !== null &&
      g.correctedAt === null &&
      g.finalAt !== null &&
      g.finalAt.getTime() <= t - CORRECTION_DELAY_MS &&
      (startup || g.finalAt.getTime() > windowStart),
  );
  return correctionDue ? 'corrections due' : null;
}

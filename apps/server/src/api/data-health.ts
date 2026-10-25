import { type GameStatus, type League, leagueSchema } from '@our-players/shared';
import { and, between, desc, eq, inArray, max, ne, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import type { JobStatus } from '../db/job-runs';
import { games, jobRuns } from '../db/schema';

const HOUR = 3_600_000;
// Spec values (S10b): a box score this late, or no schedule run for this long, means ingestion stalled.
const LINES_LATE_MS = 4 * HOUR;
const LINES_WINDOW_MS = 48 * HOUR;
const SCHEDULE_STALE_MS = 50 * HOUR;
const RESULTS_RUNS = 3;

export type DataHealthInput = {
  games: {
    publicId: string;
    status: GameStatus;
    startTimeUtc: Date;
    boxscoreFetchedAt: Date | null;
  }[];
  // per league, the last finished (not 'running') results runs, newest first, at most 3
  resultsRuns: Partial<Record<League, Exclude<JobStatus, 'running'>[]>>;
  lastScheduleSuccess: Date | null; // max finished_at of schedule runs with status succeeded or partial
};

export function staleReasons(now: Date, input: DataHealthInput): string[] {
  const t = now.getTime();
  const reasons: string[] = [];
  for (const g of input.games) {
    const started = g.startTimeUtc.getTime();
    const inWindow = started >= t - LINES_WINDOW_MS && started <= t - LINES_LATE_MS;
    const off = g.status === 'POSTPONED' || g.status === 'CANCELLED';
    const done = g.status === 'FINAL' && g.boxscoreFetchedAt !== null;
    if (inWindow && !off && !done) {
      reasons.push(`${g.publicId}: started over 4 h ago, no box score yet`);
    }
  }
  for (const [league, runs] of Object.entries(input.resultsRuns)) {
    if (runs.length === RESULTS_RUNS && !runs.includes('succeeded')) {
      reasons.push(`${league}: last 3 results runs failed or partial`);
    }
  }
  const last = input.lastScheduleSuccess;
  if (last === null || t - last.getTime() > SCHEDULE_STALE_MS) {
    reasons.push('schedule: no successful run in 50 h');
  }
  return reasons;
}

export async function loadDataHealth(db: Db, now: Date): Promise<string[]> {
  const t = now.getTime();
  const windowGames = await db
    .select({
      publicId: games.publicId,
      status: games.status,
      startTimeUtc: games.startTimeUtc,
      boxscoreFetchedAt: games.boxscoreFetchedAt,
    })
    .from(games)
    .where(between(games.startTimeUtc, new Date(t - LINES_WINDOW_MS), new Date(t - LINES_LATE_MS)));
  const resultsRuns: DataHealthInput['resultsRuns'] = {};
  for (const league of leagueSchema.options) {
    const rows = await db
      .select({ status: jobRuns.status })
      .from(jobRuns)
      .where(
        and(
          eq(jobRuns.job, 'results'),
          eq(sql`${jobRuns.args}->>'league'`, league),
          ne(jobRuns.status, 'running'),
        ),
      )
      // id breaks ties: runs started within one clock tick share a started_at.
      .orderBy(desc(jobRuns.startedAt), desc(jobRuns.id))
      .limit(RESULTS_RUNS);
    // The query already left out 'running'; this only narrows the type.
    resultsRuns[league] = rows.flatMap(({ status }) => (status === 'running' ? [] : [status]));
  }
  // A partial schedule run still stored games, so it counts as a success.
  const [schedule] = await db
    .select({ at: max(jobRuns.finishedAt) })
    .from(jobRuns)
    .where(and(eq(jobRuns.job, 'schedule'), inArray(jobRuns.status, ['succeeded', 'partial'])));
  return staleReasons(now, {
    games: windowGames,
    resultsRuns,
    lastScheduleSuccess: schedule?.at ?? null,
  });
}

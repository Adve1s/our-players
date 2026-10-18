import { type League, leagueSchema } from '@our-players/shared';
import { and, eq, gte, inArray, isNull, lte, max, or, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { games, jobRuns } from '../db/schema';
import { JOBS } from '../jobs';
import { RESULTS_WINDOW_MS } from '../jobs/results';
import { type JobContext, runJob } from '../jobs/runner';
import { type Decision, decide, type SchedulerState } from './decide';

export const TICK_MS = 10 * 60 * 1000;

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

// The rows decide() reads: the 24 h window and the future, uncorrected finals of any age,
// and at startup started-but-unfinished games of any age (catch-up after downtime).
export async function loadState(db: Db, now: Date, startup: boolean): Promise<SchedulerState> {
  const rows = await db
    .select({
      league: games.league,
      status: games.status,
      startTimeUtc: games.startTimeUtc,
      finalAt: games.finalAt,
      boxscoreFetchedAt: games.boxscoreFetchedAt,
      correctedAt: games.correctedAt,
    })
    .from(games)
    .where(
      or(
        gte(games.startTimeUtc, new Date(now.getTime() - RESULTS_WINDOW_MS)),
        and(eq(games.status, 'FINAL'), isNull(games.correctedAt)),
        startup
          ? and(inArray(games.status, ['SCHEDULED', 'LIVE']), lte(games.startTimeUtc, now))
          : undefined,
      ),
    );
  const leagueArg = sql<string | null>`${jobRuns.args}->>'league'`;
  const runs = await db
    .select({ job: jobRuns.job, league: leagueArg, last: max(jobRuns.startedAt) })
    .from(jobRuns)
    .groupBy(jobRuns.job, leagueArg);
  const lastRuns: SchedulerState['lastRuns'] = {};
  for (const { job, league, last } of runs) {
    const known = leagueSchema.safeParse(league);
    if (last && known.success && Object.hasOwn(JOBS, job))
      lastRuns[known.data] = { ...lastRuns[known.data], [job]: last };
  }
  return { games: rows, lastRuns, startup };
}

export async function tick(
  ctx: JobContext,
  leagues: readonly League[],
  startup: boolean,
  run: typeof runJob = runJob,
): Promise<Decision[]> {
  const now = ctx.now();
  const decisions = decide(now, leagues, await loadState(ctx.db, now, startup));
  ctx.log.info('tick', { decisions });
  for (const { job, league } of decisions) {
    try {
      await run(
        ctx,
        job,
        JOBS[job],
        startup && job === 'results' ? { league, catchUp: true } : { league },
      );
    } catch (e) {
      // runJob only rejects when its job_runs write fails; the other decisions still deserve a try.
      ctx.log.error('scheduled job threw', { job, league, error: errorMessage(e) });
    }
  }
  return decisions;
}

export function startScheduler(
  ctx: JobContext,
  leagues: readonly League[] = ['NHL'],
  tickFn: typeof tick = tick,
): { stop(): Promise<void> } {
  let inFlight: Promise<void> | null = null;
  // Until a tick completes: a failed first tick must not lose the startup catch-up.
  let startup = true;
  const fire = () => {
    if (inFlight) {
      ctx.log.warn('tick skipped: previous tick still running');
      return;
    }
    inFlight = tickFn(ctx, leagues, startup).then(
      () => {
        inFlight = null;
        startup = false;
      },
      (e: unknown) => {
        inFlight = null;
        ctx.log.error('tick failed', { error: errorMessage(e) });
      },
    );
  };
  fire();
  const timer = setInterval(fire, TICK_MS);
  return {
    async stop() {
      clearInterval(timer);
      await inFlight;
    },
  };
}

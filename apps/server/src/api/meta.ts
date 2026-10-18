import { type HealthResponse, leagueSchema, type MetaResponse } from '@our-players/shared';
import { and, eq, inArray, lte, max } from 'drizzle-orm';
import type { Db } from '../db/client';
import { currentSeason, playedOrPlaying } from '../db/games';
import { games, jobRuns } from '../db/schema';

export async function loadHealth(db: Db): Promise<HealthResponse> {
  const rows = await db
    .select({ job: jobRuns.job, at: max(jobRuns.finishedAt) })
    .from(jobRuns)
    .where(eq(jobRuns.status, 'succeeded'))
    .groupBy(jobRuns.job);
  const lastSuccess: Record<string, string> = {};
  for (const { job, at } of rows) if (at) lastSuccess[job] = at.toISOString();
  return { ok: true, lastSuccess };
}

export async function loadMeta(db: Db, now: Date): Promise<MetaResponse> {
  const leagues = await Promise.all(
    leagueSchema.options.map(async (league) => {
      const [latest] = await db
        .select({ gameDate: max(games.gameDate) })
        .from(games)
        .where(and(eq(games.league, league), lte(games.startTimeUtc, now), playedOrPlaying));
      return {
        league,
        currentSeason: await currentSeason(db, league, now),
        latestGameDate: latest?.gameDate ?? null,
      };
    }),
  );
  // A partial run still stored data, so it counts as an update.
  const [updated] = await db
    .select({ at: max(jobRuns.finishedAt) })
    .from(jobRuns)
    .where(and(eq(jobRuns.job, 'results'), inArray(jobRuns.status, ['succeeded', 'partial'])));
  return { leagues, dataUpdatedAt: updated?.at?.toISOString() ?? null };
}

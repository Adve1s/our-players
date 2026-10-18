import type { HealthResponse } from '@our-players/shared';
import { eq, max } from 'drizzle-orm';
import type { Db } from '../db/client';
import { jobRuns } from '../db/schema';

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

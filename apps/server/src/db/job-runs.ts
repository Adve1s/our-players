import { eq, sql } from 'drizzle-orm';
import type { Db } from './client';
import { type JOB_STATUSES, jobRuns } from './schema';

export type JobStatus = (typeof JOB_STATUSES)[number];

export async function startJobRun(
  db: Db,
  job: string,
  args: Record<string, unknown>,
): Promise<number> {
  const [row] = await db
    .insert(jobRuns)
    .values({ job, args, status: 'running' })
    .returning({ id: jobRuns.id });
  if (!row) throw new Error(`job run ${job}: insert returned no row`);
  return row.id;
}

export async function finishJobRun(
  db: Db,
  id: number,
  result: {
    status: Exclude<JobStatus, 'running'>;
    counts: Record<string, number>;
    error: string | null;
  },
): Promise<void> {
  const updated = await db
    .update(jobRuns)
    .set({ ...result, finishedAt: sql`now()` })
    .where(eq(jobRuns.id, id))
    .returning({ id: jobRuns.id });
  if (updated.length === 0) throw new Error(`unknown job run ${id}`);
}

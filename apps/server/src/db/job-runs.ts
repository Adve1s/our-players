import type { Db } from './client';
import type { JOB_STATUSES } from './schema';

export type JobStatus = (typeof JOB_STATUSES)[number];

export async function startJobRun(
  _db: Db,
  _job: string,
  _args: Record<string, unknown>,
): Promise<number> {
  throw new Error('not implemented');
}

export async function finishJobRun(
  _db: Db,
  _id: number,
  _result: {
    status: Exclude<JobStatus, 'running'>;
    counts: Record<string, number>;
    error: string | null;
  },
): Promise<void> {
  throw new Error('not implemented');
}

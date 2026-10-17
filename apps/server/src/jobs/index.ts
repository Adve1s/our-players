import { backfillJob } from './backfill';
import { resultsJob } from './results';
import { rosterJob } from './roster';
import type { Job } from './runner';
import { scheduleJob } from './schedule';

export const JOBS = {
  schedule: scheduleJob,
  results: resultsJob,
  roster: rosterJob,
  backfill: backfillJob,
} satisfies Record<string, Job>;
export type JobName = keyof typeof JOBS;

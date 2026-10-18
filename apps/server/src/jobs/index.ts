import { backfillJob } from './backfill';
import { resultsJob } from './results';
import { rosterJob } from './roster';
import type { Job } from './runner';
import { scheduleJob } from './schedule';
import { seasonStatsJob } from './season-stats';

export const JOBS = {
  schedule: scheduleJob,
  results: resultsJob,
  roster: rosterJob,
  'season-stats': seasonStatsJob,
  backfill: backfillJob,
} satisfies Record<string, Job>;
export type JobName = keyof typeof JOBS;

import type { League, PublicId } from '@our-players/shared';
import type { Db } from '../db/client';
import { finishJobRun, type JobStatus, startJobRun } from '../db/job-runs';
import type { PoliteClient } from '../http/polite-client';
import type { NationalityOverride } from '../nationality/overrides';

export type LogLevel = 'info' | 'warn' | 'error';
export type Logger = {
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
  child(fields: Record<string, unknown>): Logger;
};

const defaultWrite = (level: LogLevel, line: string) =>
  level === 'error' ? console.error(line) : console.log(line);

export function createLogger(
  write: (level: LogLevel, line: string) => void = defaultWrite,
): Logger {
  return boundLogger(write, {});
}

function boundLogger(
  write: (level: LogLevel, line: string) => void,
  bound: Record<string, unknown>,
): Logger {
  const at = (level: LogLevel) => (msg: string, fields?: Record<string, unknown>) =>
    write(level, JSON.stringify({ level, msg, ...bound, ...fields }));
  return {
    info: at('info'),
    warn: at('warn'),
    error: at('error'),
    child: (fields) => boundLogger(write, { ...bound, ...fields }),
  };
}

export type JobClient = Pick<PoliteClient, 'get' | 'requestCount'>;
export type JobContext = {
  db: Db;
  client: JobClient;
  now: () => Date;
  log: Logger;
  overrides: ReadonlyMap<PublicId, NationalityOverride>;
};
// catchUp: results takes corrections of any age (the scheduler's startup tick, every manual run).
export type JobArgs = {
  league: League;
  date?: string;
  from?: string;
  to?: string;
  catchUp?: boolean;
};
export type JobRun = {
  counts: Record<string, number>;
  add(key: string, n?: number): void;
  fail(message: string): void;
  log: Logger;
};
export type Job = (ctx: JobContext, run: JobRun, args: JobArgs) => Promise<void>;
export type JobResult =
  | { status: 'skipped' }
  | {
      status: Exclude<JobStatus, 'running'>;
      runId: number;
      counts: Record<string, number>;
      error: string | null;
    };

// shortcut: in-process lock; a second process on the same Postgres isn't locked out (DEPLOY.md stops the API for long manual jobs) — upgrade (advisory lock or a job_runs partial unique index) if manual jobs against prod become routine
const running = new Set<string>();

export async function runJob(
  ctx: JobContext,
  name: string,
  job: Job,
  args: JobArgs,
): Promise<JobResult> {
  if (running.has(name)) {
    // A skipped start isn't a run, so it writes no job_runs row.
    ctx.log.warn('skipped: already running', { job: name });
    return { status: 'skipped' };
  }
  running.add(name);
  try {
    const runId = await startJobRun(ctx.db, name, args);
    const failures: string[] = [];
    const counts: Record<string, number> = {};
    const log = ctx.log.child({ job: name, run: runId });
    const run: JobRun = {
      counts,
      add: (key, n = 1) => {
        counts[key] = (counts[key] ?? 0) + n;
      },
      fail: (message) => {
        failures.push(message);
      },
      log,
    };
    const requestsBefore = ctx.client.requestCount;
    let status: Exclude<JobStatus, 'running'>;
    let error: string | null;
    try {
      await job(ctx, run, args);
      status = failures.length > 0 ? 'partial' : 'succeeded';
      error = failures.length > 0 ? failures.join('; ') : null;
    } catch (e) {
      status = 'failed';
      error = e instanceof Error ? e.message : String(e);
    }
    counts.requests = ctx.client.requestCount - requestsBefore;
    await finishJobRun(ctx.db, runId, { status, counts, error });
    (status === 'failed' ? log.error : log.info)('finished', { status, counts, error });
    return { status, runId, counts, error };
  } finally {
    running.delete(name);
  }
}

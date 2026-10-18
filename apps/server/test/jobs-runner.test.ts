import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { DbHandle } from '../src/db/client';
import { jobRuns } from '../src/db/schema';
import { createLogger, type JobContext, type LogLevel, runJob } from '../src/jobs/runner';
import { createTestDb } from './db';
import { NO_OVERRIDES } from './db-data';
import { fakeClient } from './fake-client';

const URL_A = 'https://api-web.nhle.com/v1/schedule/2026-10-07';

let handle: DbHandle;
let lines: { level: LogLevel; line: string }[];
let ctx: JobContext;

// Migrating the template once can exceed the default hook timeout under a full parallel run.
beforeAll(async () => (await createTestDb()).close(), 30_000);

beforeEach(async () => {
  handle = await createTestDb();
  lines = [];
  ctx = {
    db: handle.db,
    client: fakeClient({ [URL_A]: { gameWeek: [] } }),
    now: () => new Date('2026-10-07T12:00:00Z'),
    log: createLogger((level, line) => lines.push({ level, line })),
    overrides: NO_OVERRIDES,
  };
});

afterEach(() => handle.close());

const parsed = () => lines.map((l) => JSON.parse(l.line) as Record<string, unknown>);
const rows = () => handle.db.select().from(jobRuns);

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('runJob', () => {
  it('a run writes a succeeded job_runs row with its counts and args', async () => {
    const result = await runJob(ctx, 'A', async (_c, run) => run.add('games', 2), {
      league: 'NHL',
    });
    expect(result.status).toBe('succeeded');
    const [row] = await rows();
    expect(row?.status).toBe('succeeded');
    expect(row?.counts).toEqual({ games: 2, requests: 0 });
    expect(row?.args).toEqual({ league: 'NHL' });
    expect(row?.finishedAt).toBeInstanceOf(Date);
    expect(row?.error).toBeNull();
  });

  it("counts.requests is the client's request delta", async () => {
    const result = await runJob(
      ctx,
      'A',
      async (c) => {
        await c.client.get(URL_A);
      },
      { league: 'NHL' },
    );
    expect(result.status).toBe('succeeded');
    const [row] = await rows();
    expect(row?.counts?.requests).toBe(1);
  });

  it('a failed unit makes the run partial with the messages', async () => {
    const result = await runJob(
      ctx,
      'A',
      async (_c, run) => {
        run.fail('day 2026-01-17: boom');
        run.fail('x');
      },
      { league: 'NHL' },
    );
    expect(result.status).toBe('partial');
    const [row] = await rows();
    expect(row?.status).toBe('partial');
    expect(row?.error).toBe('day 2026-01-17: boom; x');
  });

  it('a job that throws records failed with the error and the counts so far', async () => {
    const result = await runJob(
      ctx,
      'A',
      async (_c, run) => {
        run.add('days');
        throw new Error('forced');
      },
      { league: 'NHL' },
    );
    expect(result.status).toBe('failed');
    const [row] = await rows();
    expect(row?.status).toBe('failed');
    expect(row?.error).toBe('forced');
    expect(row?.counts?.days).toBe(1);
  });

  it('starting a job while it runs is skipped and logged', async () => {
    const gate = deferred();
    const first = runJob(ctx, 'A', () => gate.promise, { league: 'NHL' });
    const second = await runJob(ctx, 'A', async () => {}, { league: 'NHL' });
    expect(second).toEqual({ status: 'skipped' });
    const warn = parsed().find((l) => l.level === 'warn');
    expect(warn?.job).toBe('A');
    expect(warn?.msg).toContain('already running');
    gate.resolve();
    await first;
    expect(await rows()).toHaveLength(1);
  });

  it('a different job runs while one is running', async () => {
    const gate = deferred();
    const first = runJob(ctx, 'A', () => gate.promise, { league: 'NHL' });
    const other = await runJob(ctx, 'B', async () => {}, { league: 'NHL' });
    expect(other.status).toBe('succeeded');
    gate.resolve();
    await first;
  });

  it('a job that threw releases its lock', async () => {
    await runJob(
      ctx,
      'A',
      async () => {
        throw new Error('forced');
      },
      { league: 'NHL' },
    );
    const again = await runJob(ctx, 'A', async () => {}, { league: 'NHL' });
    expect(again.status).toBe('succeeded');
  });

  it('log lines carry job and run id', async () => {
    const result = await runJob(ctx, 'A', async (_c, run) => run.log.info('hi'), {
      league: 'NHL',
    });
    const runId = result.status === 'skipped' ? undefined : result.runId;
    const [row] = await rows();
    expect(runId).toBe(row?.id);
    expect(parsed()).toContainEqual({ level: 'info', msg: 'hi', job: 'A', run: row?.id });
  });
});

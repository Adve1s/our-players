import { readFile } from 'node:fs/promises';
import { type ServerType, serve } from '@hono/node-server';
import { leagueSchema } from '@our-players/shared';
import { createApp } from './api/app';
import { loadConfig } from './config';
import { openDb } from './db/client';
import { createPoliteClient, userAgent } from './http/polite-client';
import { createLogger } from './jobs/runner';
import { loadNationalityOverrides } from './nationality/overrides';
import { startScheduler } from './scheduler/scheduler';

// Everything that can fail on bad local files loads before the DB opens, so a failure leaves no PGlite lock behind.
const { port, contactUrl, schedulerEnabled, corsOrigins } = loadConfig(process.env);
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as {
  version: string;
};
const overrides = await loadNationalityOverrides();

// The API reads the DB, so the dev server always holds the PGlite lock (stop it before `pnpm job`).
const handle = openDb();

let server: ServerType | undefined;
let scheduler: ReturnType<typeof startScheduler> | undefined;
// shortcut: under tsx watch a tick longer than 5 s is SIGKILLed mid-job (job_runs row left running, lock taken over on the next start); run without watch, or make jobs abortable, if that bites
let stopping = false;
const shutdown = () => {
  if (stopping) return;
  stopping = true;
  if (scheduler) console.log('stopping scheduler: waiting for the running tick');
  // The server closes first, so no request arrives while the scheduler stops or after the DB is gone.
  new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()))
    .then(() => scheduler?.stop())
    .then(() => handle.close())
    .then(
      () => process.exit(0),
      (e: unknown) => {
        console.error(e instanceof Error ? e.message : String(e));
        process.exit(1);
      },
    );
};
// `on`, not `once`: tsx watch relays Ctrl-C, so a second SIGINT arrives mid-close, and with no
// listener left Node's default action kills the process and leaves the PGlite lock behind.
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

try {
  await handle.migrate();
} catch (e) {
  // Releases the PGlite lock; after a signal, shutdown already closed it, and a second close would hide `e`.
  if (!stopping) await handle.close();
  throw e;
}

// A signal during migrate already has shutdown closing the DB, so nothing may start on it.
if (!stopping) start();

function start() {
  server = serve(
    {
      fetch: createApp({
        db: handle.db,
        now: () => new Date(),
        log: createLogger(),
        corsOrigins,
        rateLimitPerMinute: 120,
      }).fetch,
      port,
    },
    (info) => {
      console.log(`API listening on http://localhost:${info.port}`);
    },
  );

  if (schedulerEnabled) {
    const client = createPoliteClient({ userAgent: userAgent(pkg.version, contactUrl) });
    scheduler = startScheduler(
      {
        db: handle.db,
        client,
        now: () => new Date(),
        log: createLogger(),
        overrides,
      },
      leagueSchema.options,
    );
    console.log('scheduler on');
  } else {
    console.log('scheduler off (set SCHEDULER_ENABLED=1)');
  }
}

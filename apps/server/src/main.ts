import { readFile } from 'node:fs/promises';
import { serve } from '@hono/node-server';
import { leagueSchema } from '@our-players/shared';
import { createApp } from './api/app';
import { loadConfig } from './config';
import { openDb } from './db/client';
import { createPoliteClient, userAgent } from './http/polite-client';
import { createLogger } from './jobs/runner';
import { loadNationalityOverrides } from './nationality/overrides';
import { startScheduler } from './scheduler/scheduler';

const { port, contactUrl, schedulerEnabled, corsOrigins } = loadConfig(process.env);

// The API reads the DB, so the dev server always holds the PGlite lock (stop it before `pnpm job`).
const handle = openDb();
try {
  await handle.migrate();
} catch (e) {
  await handle.close(); // releases the PGlite lock
  throw e;
}

serve(
  {
    fetch: createApp({ db: handle.db, now: () => new Date(), log: createLogger(), corsOrigins })
      .fetch,
    port,
  },
  (info) => {
    console.log(`API listening on http://localhost:${info.port}`);
  },
);

let scheduler: ReturnType<typeof startScheduler> | undefined;
if (schedulerEnabled) {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as {
    version: string;
  };
  const client = createPoliteClient({ userAgent: userAgent(pkg.version, contactUrl) });
  const overrides = await loadNationalityOverrides();
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

// shortcut: under tsx watch a tick longer than 5 s is SIGKILLed mid-job (job_runs row left running, lock taken over on the next start); run without watch, or make jobs abortable, if that bites
let stopping = false;
const shutdown = () => {
  if (stopping) return;
  stopping = true;
  if (scheduler) console.log('stopping scheduler: waiting for the running tick');
  Promise.resolve(scheduler?.stop())
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

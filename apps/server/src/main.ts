import { readFile } from 'node:fs/promises';
import { serve } from '@hono/node-server';
import { app } from './app';
import { loadConfig } from './config';
import { openDb } from './db/client';
import { createPoliteClient, userAgent } from './http/polite-client';
import { createLogger } from './jobs/runner';
import { loadNationalityOverrides } from './nationality/overrides';
import { startScheduler } from './scheduler/scheduler';

const { port, contactUrl, schedulerEnabled } = loadConfig(process.env);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`API listening on http://localhost:${info.port}`);
});

// Only with the scheduler on does the dev server open the DB, so `pnpm job` works alongside it otherwise.
async function runScheduler(): Promise<void> {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as {
    version: string;
  };
  const client = createPoliteClient({ userAgent: userAgent(pkg.version, contactUrl) });
  const overrides = await loadNationalityOverrides();
  const handle = openDb();
  try {
    await handle.migrate();
  } catch (e) {
    await handle.close(); // releases the PGlite lock
    throw e;
  }
  const scheduler = startScheduler({
    db: handle.db,
    client,
    now: () => new Date(),
    log: createLogger(),
    overrides,
  });
  console.log('scheduler on');
  // shortcut: under tsx watch a tick longer than 5 s is SIGKILLed mid-job (job_runs row left running, lock taken over on the next start); run without watch, or make jobs abortable, if that bites
  let stopping = false;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    console.log('stopping scheduler: waiting for the running tick');
    scheduler
      .stop()
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
}

if (schedulerEnabled) {
  runScheduler().catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
} else {
  console.log('scheduler off (set SCHEDULER_ENABLED=1)');
}

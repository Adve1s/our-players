import { readFile } from 'node:fs/promises';
import { parseJobArgs } from '../src/cli-args';
import { loadConfig } from '../src/config';
import { openDb } from '../src/db/client';
import { createPoliteClient, userAgent } from '../src/http/polite-client';
import { JOBS } from '../src/jobs';
import { createLogger, runJob } from '../src/jobs/runner';
import { loadNationalityOverrides } from '../src/nationality/overrides';

const USAGE =
  'usage: pnpm job schedule|results|roster|backfill [--league nhl] [--date YYYY-MM-DD] [--from YYYY-MM-DD --to YYYY-MM-DD]';

async function main(): Promise<number> {
  let parsed: ReturnType<typeof parseJobArgs>;
  try {
    parsed = parseJobArgs(process.argv.slice(2));
  } catch (e) {
    console.error(USAGE);
    throw e;
  }
  const { name, args } = parsed;
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as {
    version: string;
  };
  const client = createPoliteClient({
    userAgent: userAgent(pkg.version, loadConfig(process.env).contactUrl),
  });
  const overrides = await loadNationalityOverrides();
  const handle = openDb();
  try {
    // Migrating first lets a fresh .data directory work without a separate db:migrate.
    await handle.migrate();
    const ctx = { db: handle.db, client, now: () => new Date(), log: createLogger(), overrides };
    const result = await runJob(ctx, name, JOBS[name], args);
    return result.status === 'succeeded' ? 0 : 1;
  } finally {
    const hosts = [...client.requestsByHost].map(([h, n]) => `${h}: ${n}`).join(', ');
    console.log(`requests by host: ${hosts || 'none'}`);
    await handle.close();
  }
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (e: unknown) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exitCode = 1;
  },
);

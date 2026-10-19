// Offline driver: the real Hono app over an in-memory PGlite seeded by the real jobs over
// recorded fixtures (apps/server/test/api-seed.ts). No network, no dev DB, no lock.
//   node_modules/.bin/tsx .claude/skills/run-our-players/driver.ts [--origin URL] [--now ISO] <path>...
import { createApp } from '../../../apps/server/src/api/app';
import { createLogger } from '../../../apps/server/src/jobs/runner';
import { seedApiDb } from '../../../apps/server/test/api-seed';

const args = process.argv.slice(2);
let origin: string | undefined;
let now = '2026-10-18T12:00:00Z'; // the clock the API tests use for players/countries
const paths: string[] = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--origin') origin = args[++i];
  else if (a === '--now') now = args[++i] ?? now;
  else if (a !== undefined) paths.push(a);
}
if (paths.length === 0) {
  console.error(
    'usage: driver.ts [--origin URL] [--now ISO] <path>...   e.g. /v1/players/search?q=porz',
  );
  process.exit(2);
}

const handle = await seedApiDb();
const logs: string[] = [];
const app = createApp({
  db: handle.db,
  now: () => new Date(now),
  log: createLogger((_level, line) => logs.push(line)),
  corsOrigins: ['http://localhost:8081'],
});

for (const path of paths) {
  const res = await app.request(path, { headers: origin ? { Origin: origin } : {} });
  console.log(`GET ${path} -> ${res.status}`);
  for (const h of ['access-control-allow-origin', 'vary', 'cache-control']) {
    const v = res.headers.get(h);
    if (v !== null) console.log(`${h}: ${v}`);
  }
  const text = await res.text();
  try {
    console.log(JSON.stringify(JSON.parse(text), null, 2));
  } catch {
    console.log(text);
  }
}
if (process.env.DRIVER_LOGS === '1') for (const l of logs) console.error(l);
await handle.close();

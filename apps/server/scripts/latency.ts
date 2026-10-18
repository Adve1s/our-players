import { createApp } from '../src/api/app';
import { parseRecapArgs } from '../src/cli-args';
import { openDb } from '../src/db/client';
import { games, statLines } from '../src/db/schema';
import { createLogger } from '../src/jobs/runner';

const USAGE = 'usage: pnpm latency --date YYYY-MM-DD [--countries LVA[,EST…]]';
const N = 100;

async function main(): Promise<void> {
  let parsed: ReturnType<typeof parseRecapArgs>;
  try {
    parsed = parseRecapArgs(process.argv.slice(2));
  } catch (e) {
    console.error(USAGE);
    throw e;
  }
  const { date, countries } = parsed;
  // No migrate: the smoke test only reads.
  const handle = openDb();
  try {
    const { db } = handle;
    console.log(
      `games: ${await db.$count(games)} rows · stat_lines: ${await db.$count(statLines)} rows`,
    );
    const app = createApp({ db, now: () => new Date(), log: createLogger(() => {}) });
    const path = `/v1/days/${date}?countries=${countries.join(',')}`;
    const ms: number[] = [];
    for (let i = 0; i < N; i++) {
      const start = performance.now();
      const res = await app.request(path);
      const body = await res.text();
      ms.push(performance.now() - start);
      if (res.status !== 200) throw new Error(`GET ${path}: ${res.status} ${body}`);
    }
    ms.sort((a, b) => a - b);
    const at = (q: number) => (ms[Math.ceil(q * N) - 1] ?? Number.NaN).toFixed(1);
    console.log(`${N} × GET ${path}: p50 ${at(0.5)} ms · p95 ${at(0.95)} ms · max ${at(1)} ms`);
  } finally {
    await handle.close();
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
});

import { serve } from '@hono/node-server';
import { createApp } from '../src/api/app';
import { resultsJob } from '../src/jobs/results';
import { createLogger, runJob } from '../src/jobs/runner';
import { nhlUrls } from '../src/sources/nhl';
import { seedApiDb, seedUpcoming } from '../test/api-seed';
import { NO_OVERRIDES } from '../test/db-data';
import { fakeClient } from '../test/fake-client';
import { loadFixture } from '../test/fixtures';

// Fixed, so /v1/meta stays on the seeded season and the latest day is 2026-03-23.
const now = () => new Date('2026-03-24T12:00:00Z');
const MIXED_DAY = '2026-03-16';
const MIXED_GAME = '2025021067';

// PIT@COL only: Silovs and Rust next to Porziņģis's NBA line that night.
function mixedScore(): unknown {
  const raw = loadFixture('nhl', 'score', MIXED_DAY) as { games: { id: number }[] };
  raw.games = raw.games.filter((g) => String(g.id) === MIXED_GAME);
  return raw;
}

// The API for `pnpm screenshots` (apps/mobile can't import the server, so it runs this as a child):
// the API tests' seed in memory, so the shots are deterministic and the dev DB is never touched.
const handle = await seedApiDb();
await seedUpcoming(handle);
const mixed = await runJob(
  {
    db: handle.db,
    client: fakeClient({
      [nhlUrls.score(MIXED_DAY)]: mixedScore(),
      [nhlUrls.boxscore(MIXED_GAME)]: loadFixture('nhl', 'boxscore', MIXED_GAME),
    }),
    now,
    log: createLogger(() => {}),
    overrides: NO_OVERRIDES,
  },
  'results',
  resultsJob,
  { league: 'NHL', date: MIXED_DAY },
);
// COL's players aren't on a recorded roster, so they become stubs; only a failed run means no data.
if (mixed.status === 'failed' || mixed.status === 'skipped') {
  const error = mixed.status === 'failed' ? mixed.error : 'skipped';
  throw new Error(`screenshot seed: results NHL ${MIXED_DAY} failed: ${error}`);
}

serve(
  {
    fetch: createApp({
      db: handle.db,
      now,
      log: createLogger(),
      corsOrigins: ['http://localhost:8091'],
    }).fetch,
    port: 3101,
  },
  () => console.log('ready'),
);

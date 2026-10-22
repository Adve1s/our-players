import { serve } from '@hono/node-server';
import { createApp } from '../src/api/app';
import { createLogger } from '../src/jobs/runner';
import { seedApiDb, seedMixedNight, seedUpcoming } from '../test/api-seed';

// Fixed, so /v1/meta stays on the seeded season and the latest day is 2026-03-23.
const now = () => new Date('2026-03-24T12:00:00Z');

// The API for `pnpm screenshots` (apps/mobile can't import the server, so it runs this as a child):
// the API tests' seed in memory, so the shots are deterministic and the dev DB is never touched.
const handle = await seedApiDb();
await seedUpcoming(handle);
await seedMixedNight(handle);

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

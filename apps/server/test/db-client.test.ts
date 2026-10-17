import { sql } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import type { DbHandle } from '../src/db/client';
import { leagues } from '../src/db/schema';
import { createTestDb } from './db';

// Enums sort in declaration order (NHL first), so order by the code as text.
const byCode = sql`${leagues.code}::text`;
const SEEDED = [
  { code: 'NBA', sport: 'basketball', name: 'National Basketball Association' },
  { code: 'NHL', sport: 'hockey', name: 'National Hockey League' },
];

describe('db client', () => {
  let handle: DbHandle | undefined;
  afterEach(async () => {
    await handle?.close();
    handle = undefined;
  });

  it('createTestDb applies the migrations and seeds both leagues', async () => {
    handle = await createTestDb();
    expect(await handle.db.select().from(leagues).orderBy(byCode)).toEqual(SEEDED);
  });

  it('migrating twice changes nothing', async () => {
    handle = await createTestDb();
    await handle.migrate();
    expect(await handle.db.select().from(leagues).orderBy(byCode)).toEqual(SEEDED);
  });
});

import { type DbHandle, openPglite } from '../src/db/client';

// In-memory PGlite with the real migrations, so every DB test starts from the shipped schema.
export async function createTestDb(): Promise<DbHandle> {
  const handle = openPglite();
  await handle.migrate();
  return handle;
}

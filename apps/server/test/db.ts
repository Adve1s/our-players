import { PGlite } from '@electric-sql/pglite';
import { type DbHandle, pgliteHandle } from '../src/db/client';

// Booting and migrating PGlite takes ~2.8 s and clone() of a ready one ~0.5 s, so each test
// file migrates one template once and every test gets its own full copy.
let template: Promise<PGlite> | undefined;

async function migratedTemplate(): Promise<PGlite> {
  const client = new PGlite();
  await pgliteHandle(client).migrate();
  return client;
}

// In-memory PGlite with the real migrations, so every DB test starts from the shipped schema.
export async function createTestDb(): Promise<DbHandle> {
  template ??= migratedTemplate();
  const copy = await (await template).clone();
  // clone() is typed as the PGlite interface; drizzle needs the class, which it returns at runtime.
  if (!(copy instanceof PGlite)) throw new Error('PGlite clone() did not return a PGlite');
  return pgliteHandle(copy);
}

import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { LEAGUE_SPORT, type League, leagueSchema } from '@our-players/shared';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import { Pool } from 'pg';
import { leagues } from './schema';

// The base both drivers extend, so repositories run unchanged on PGlite and Postgres.
export type Db = PgDatabase<PgQueryResultHKT>;
export type DbHandle = { db: Db; migrate: () => Promise<void>; close: () => Promise<void> };

export const DEFAULT_DATA_DIR = fileURLToPath(new URL('../../.data/pglite', import.meta.url));
export const MIGRATIONS_DIR = fileURLToPath(new URL('../../drizzle', import.meta.url));

const LEAGUE_NAMES = {
  NHL: 'National Hockey League',
  NBA: 'National Basketball Association',
} as const satisfies Record<League, string>;

// Seeded in code because migrations are generated and never hand-edited.
export async function seedLeagues(db: Db): Promise<void> {
  await db
    .insert(leagues)
    .values(
      leagueSchema.options.map((code) => ({
        code,
        sport: LEAGUE_SPORT[code],
        name: LEAGUE_NAMES[code],
      })),
    )
    .onConflictDoNothing();
}

export function openPglite(dataDir?: string): DbHandle {
  // shortcut: one process at a time on .data/pglite; S04a settles sharing with pnpm job/recap
  // PGlite creates only the last directory of the path.
  if (dataDir) mkdirSync(dataDir, { recursive: true });
  return pgliteHandle(new PGlite(dataDir));
}

// Exported so tests can wrap a clone of a migrated template (see test/db.ts).
export function pgliteHandle(client: PGlite): DbHandle {
  const db = drizzlePglite(client);
  return {
    db,
    migrate: async () => {
      await migratePglite(db, { migrationsFolder: MIGRATIONS_DIR });
      await seedLeagues(db);
    },
    close: () => client.close(),
  };
}

export function openPostgres(url: string): DbHandle {
  // shortcut: not exercised before S10 (no Postgres in CI); test it when the deploy exists
  const pool = new Pool({ connectionString: url });
  const db = drizzlePg(pool);
  return {
    db,
    migrate: async () => {
      await migratePg(db, { migrationsFolder: MIGRATIONS_DIR });
      await seedLeagues(db);
    },
    close: () => pool.end(),
  };
}

export function openDb(env: Record<string, string | undefined> = process.env): DbHandle {
  return env.DATABASE_URL ? openPostgres(env.DATABASE_URL) : openPglite(DEFAULT_DATA_DIR);
}

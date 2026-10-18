import { closeSync, mkdirSync, openSync, readFileSync, rmSync, writeSync } from 'node:fs';
import { dirname } from 'node:path';
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
  return dataDir ? openLocked(dataDir, false) : pgliteHandle(new PGlite());
}

// For db:reset: the delete runs under the lock, so it can't pull the dir out from under another process.
export function resetPglite(dataDir: string): DbHandle {
  return openLocked(dataDir, true);
}

function openLocked(dataDir: string, wipe: boolean): DbHandle {
  mkdirSync(dirname(dataDir), { recursive: true });
  // PGlite has no lock of its own and two processes on one dir corrupt it; a sibling file survives the wipe.
  const lock = `${dataDir}.lock`;
  takeLock(lock, dataDir);
  let handle: DbHandle;
  try {
    if (wipe) rmSync(dataDir, { recursive: true, force: true });
    // PGlite creates only the last directory of the path.
    mkdirSync(dataDir, { recursive: true });
    handle = pgliteHandle(new PGlite(dataDir));
  } catch (err) {
    rmSync(lock, { force: true });
    throw err;
  }
  return {
    ...handle,
    close: async () => {
      try {
        await handle.close();
      } finally {
        rmSync(lock, { force: true });
      }
    },
  };
}

function takeLock(lock: string, dataDir: string, retry = true): void {
  try {
    createLock(lock);
  } catch (err) {
    if (!retry || (err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
    const held = readFileSync(lock, 'utf8');
    const pid = Number(held);
    const valid = Number.isInteger(pid) && pid > 0;
    if (valid && isAlive(pid)) throw inUse(dataDir, pid);
    // An empty or garbled file (crash mid-write) counts as stale. Only one process can create the guard,
    // so two openers can't both delete the stale lock and the second one delete the first one's fresh lock.
    const guard = `${lock}.${valid ? pid : 'stale'}.takeover`;
    try {
      closeSync(openSync(guard, 'wx'));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
      throw new Error(
        `PGlite ${dataDir} is being taken over by another process (stale lock of ${valid ? pid : 'a crashed process'}); if none is running, delete ${guard}`,
      );
    }
    try {
      // Another takeover finished between our read and our guard: the lock is someone else's now.
      if (readFileSync(lock, 'utf8') !== held) {
        takeLock(lock, dataDir, false);
        return;
      }
      rmSync(lock, { force: true });
      try {
        createLock(lock);
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
        throw inUse(dataDir, Number(readFileSync(lock, 'utf8')));
      }
    } finally {
      rmSync(guard, { force: true });
    }
  }
}

function createLock(lock: string): void {
  const fd = openSync(lock, 'wx');
  writeSync(fd, String(process.pid));
  closeSync(fd);
}

function inUse(dataDir: string, pid: number): Error {
  return new Error(
    `PGlite ${dataDir} is in use by process ${pid} (is pnpm dev:server running?) — stop it, or set DATABASE_URL`,
  );
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM: alive but owned by another user.
    return (err as NodeJS.ErrnoException).code !== 'ESRCH';
  }
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
    // close() on a PGlite that is still booting never settles.
    close: async () => {
      await client.waitReady;
      await client.close();
    },
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

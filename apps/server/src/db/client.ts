import {
  closeSync,
  linkSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
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
import { createLogger, type Logger } from '../jobs/runner';
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

// Exported so a test can reach the no-retry branch, which otherwise needs a rival takeover mid-call.
export function takeLock(lock: string, dataDir: string, retry = true): void {
  try {
    createLock(lock);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
    const held = readFileSync(lock, 'utf8');
    const pid = pidOf(held);
    // No retry: a rival takeover just wrote this lock, so its holder is live.
    if (!retry || (pid && isAlive(pid))) throw inUse(dataDir, pid);
    // An empty or garbled file (a crash, or older code that wrote the pid after creating the file) counts as stale.
    // Only one process can create the guard, so two openers can't both delete the stale lock and the second one
    // delete the first one's fresh lock.
    const guard = `${lock}.${pid ?? 'stale'}.takeover`;
    try {
      closeSync(openSync(guard, 'wx'));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
      throw new Error(
        `PGlite ${dataDir} is being taken over by another process (stale lock of ${pid ?? 'a crashed process'}); if none is running, delete ${guard}`,
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
        throw inUse(dataDir, pidOf(readFileSync(lock, 'utf8')));
      }
    } finally {
      rmSync(guard, { force: true });
    }
  }
}

// link() publishes the lock with its pid already inside, so no opener ever reads it empty and takes it as stale.
function createLock(lock: string): void {
  const tmp = `${lock}.${process.pid}.tmp`;
  try {
    writeFileSync(tmp, String(process.pid));
    linkSync(tmp, lock);
  } finally {
    rmSync(tmp, { force: true });
  }
}

function pidOf(held: string): number | undefined {
  const pid = Number(held);
  return Number.isInteger(pid) && pid > 0 ? pid : undefined;
}

function inUse(dataDir: string, pid: number | undefined): Error {
  return new Error(
    `PGlite ${dataDir} is in use by ${pid ? `process ${pid}` : 'another process'} (is pnpm dev:server running?) — stop it, or set DATABASE_URL`,
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

export function openPostgres(url: string, log: Logger = createLogger()): DbHandle {
  // shortcut: exercised by the local compose smoke run (S10b); still untested in CI
  const pool = new Pool({ connectionString: url });
  // An idle client's error (e.g. Postgres restarting) is emitted on the pool; unhandled, it would crash the API.
  // The pool drops that client and opens a new one on the next query.
  pool.on('error', (e) => log.error('postgres pool error', { error: e.message }));
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

import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type DbHandle, openPglite, resetPglite, takeLock } from '../src/db/client';

// An on-disk PGlite boots slowly, more so under parallel load.
const BOOT = 30_000;

describe('PGlite data-dir lock', () => {
  let base: string;
  let dir: string;
  const handles: DbHandle[] = [];
  beforeEach(() => {
    // The lock is a sibling of the data dir, so both live under `base`.
    base = mkdtempSync(join(tmpdir(), 'db-lock-'));
    dir = join(base, 'pglite');
  });
  afterEach(async () => {
    for (const h of handles.splice(0)) await h.close();
    rmSync(base, { recursive: true, force: true });
  }, BOOT);

  it(
    'a second open of the same dir throws naming the holder',
    async () => {
      handles.push(openPglite(dir));
      expect(() => openPglite(dir)).toThrow(
        /is in use by process \d+ \(is pnpm dev:server running\?\)/,
      );
    },
    BOOT,
  );

  it(
    'close releases the lock',
    async () => {
      await openPglite(dir).close();
      const again = openPglite(dir);
      await again.close();
      expect(existsSync(`${dir}.lock`)).toBe(false);
    },
    BOOT,
  );

  it(
    'a lock left by a dead process is taken over',
    async () => {
      writeFileSync(`${dir}.lock`, '999999999');
      handles.push(openPglite(dir));
      expect(readFileSync(`${dir}.lock`, 'utf8')).toBe(String(process.pid));
    },
    BOOT,
  );

  it(
    'an open that fails after taking the lock removes it',
    async () => {
      // The data dir path is a regular file, so creating the dir throws.
      writeFileSync(dir, 'x');
      expect(() => openPglite(dir)).toThrow(/EEXIST: file already exists, mkdir/);
      expect(existsSync(`${dir}.lock`)).toBe(false);
    },
    BOOT,
  );

  it(
    'a stale lock already being taken over is left alone',
    async () => {
      const guard = `${dir}.lock.999999999.takeover`;
      writeFileSync(`${dir}.lock`, '999999999');
      writeFileSync(guard, '');
      let message = '';
      try {
        openPglite(dir);
      } catch (err) {
        message = (err as Error).message;
      }
      expect(message).toMatch(/being taken over/);
      expect(message).toContain(guard);
      expect(readFileSync(`${dir}.lock`, 'utf8')).toBe('999999999');
    },
    BOOT,
  );

  it(
    'a takeover leaves no guard behind',
    async () => {
      writeFileSync(`${dir}.lock`, '999999999');
      handles.push(openPglite(dir));
      expect(readFileSync(`${dir}.lock`, 'utf8')).toBe(String(process.pid));
      expect(existsSync(`${dir}.lock.999999999.takeover`)).toBe(false);
    },
    BOOT,
  );

  it(
    'an open leaves no temporary lock file behind',
    async () => {
      handles.push(openPglite(dir));
      expect(readdirSync(base).sort()).toEqual(['pglite', 'pglite.lock']);
    },
    BOOT,
  );

  it('a lock taken without retry while another process holds it reports that process', () => {
    // The state a stale takeover reaches when a rival takeover finished first.
    writeFileSync(`${dir}.lock`, '4242');
    expect(() => takeLock(`${dir}.lock`, dir, false)).toThrow(/is in use by process 4242 /);
  });

  it('a lock whose content is not a pid is reported in use without a pid', () => {
    writeFileSync(`${dir}.lock`, '');
    expect(() => takeLock(`${dir}.lock`, dir, false)).toThrow(/is in use by another process /);
  });

  it(
    'a reset while another handle holds the lock is refused and deletes nothing',
    async () => {
      const holder = openPglite(dir);
      handles.push(holder);
      await holder.db.execute(sql`select 1`);
      expect(() => resetPglite(dir)).toThrow(/is in use by process \d+/);
      expect(existsSync(join(dir, 'PG_VERSION'))).toBe(true);
    },
    BOOT,
  );
});

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type DbHandle, openPglite } from '../src/db/client';

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
});

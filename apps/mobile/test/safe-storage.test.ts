import { describe, expect, it } from 'vitest';
import type { StateStorage } from 'zustand/middleware';
import { safeStorage } from '../src/lib/safe-storage';

const base = (getItem: StateStorage['getItem']): StateStorage => ({
  getItem,
  setItem: () => {},
  removeItem: () => {},
});

describe('safeStorage', () => {
  it('passes valid JSON through', async () => {
    const stored = '{"state":{},"version":1}';
    expect(await safeStorage(base(async () => stored)).getItem('prefs')).toBe(stored);
  });

  it('passes a missing value through as null', async () => {
    expect(await safeStorage(base(async () => null)).getItem('prefs')).toBeNull();
  });

  it('reads non-JSON as missing', async () => {
    expect(await safeStorage(base(async () => 'not json')).getItem('prefs')).toBeNull();
  });

  it('reads a failing storage as missing', async () => {
    const failing = base(() => Promise.reject(new Error('disk')));
    expect(await safeStorage(failing).getItem('prefs')).toBeNull();
  });
});

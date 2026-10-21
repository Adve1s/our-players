import { describe, expect, it } from 'vitest';

const P = 'nba-3102531';
const S = 'nhl-8481668';

// The storage edge: AsyncStorage's web build reads window.localStorage, so it must exist before the store loads.
const stored = new Map<string, string>();
Object.assign(globalThis, {
  window: {
    localStorage: {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => {
        stored.set(key, value);
      },
      removeItem: (key: string) => {
        stored.delete(key);
      },
    },
  },
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 10));

describe('usePrefs persistence', () => {
  it('keeps version 1 and stores only the four lists after favorite and hidden actions', async () => {
    const { usePrefs } = await import('../src/state/prefs-store');
    // Hydration of the empty storage would otherwise overwrite the actions below.
    await flush();
    usePrefs.getState().toggleFavorite(P);
    usePrefs.getState().toggleHidden(S);
    await flush();

    const raw = stored.get('prefs');
    expect(raw).toBeDefined();
    const persisted = JSON.parse(raw ?? 'null');
    expect(persisted.version).toBe(1);
    expect(persisted.state.favorites).toEqual([P]);
    expect(persisted.state.hidden).toEqual([S]);
    expect(Object.keys(persisted.state).sort()).toEqual([
      'countries',
      'favorites',
      'hidden',
      'leagues',
    ]);
  });
});

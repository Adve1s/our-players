import { MAX_LIST } from '@our-players/shared';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PREFS,
  markOf,
  restorePrefs,
  type StoredPrefs,
  setMark,
  toggleCountry,
  toggleFavorite,
  toggleHidden,
  toggleLeague,
  toPrefs,
} from '../src/state/prefs';

// Porziņģis, Šilovs, Girgensons: sorted by string, G < S.
const P = 'nba-3102531';
const S = 'nhl-8481668';
const G = 'nhl-8476878';

describe('DEFAULT_PREFS', () => {
  it('is both leagues, Latvia, no favorites and nothing hidden', () => {
    expect(DEFAULT_PREFS).toEqual({
      leagues: ['NBA', 'NHL'],
      countries: ['LVA'],
      favorites: [],
      hidden: [],
    });
  });
});

describe('toggleLeague', () => {
  it('turns a league off', () => {
    expect(toggleLeague(DEFAULT_PREFS, 'NBA').leagues).toEqual(['NHL']);
  });

  it('turns a league back on, keeping the list sorted', () => {
    const off = toggleLeague(DEFAULT_PREFS, 'NBA');
    expect(toggleLeague(off, 'NBA').leagues).toEqual(['NBA', 'NHL']);
  });

  it('returns the same object when asked to turn off the last league', () => {
    const p: StoredPrefs = { ...DEFAULT_PREFS, leagues: ['NHL'] };
    expect(toggleLeague(p, 'NHL')).toBe(p);
  });

  it('does not mutate its input', () => {
    toggleLeague(DEFAULT_PREFS, 'NBA');
    expect(DEFAULT_PREFS.leagues).toEqual(['NBA', 'NHL']);
  });
});

describe('toggleCountry', () => {
  it('adds a country, keeping the list sorted', () => {
    expect(toggleCountry(DEFAULT_PREFS, 'CAN').countries).toEqual(['CAN', 'LVA']);
  });

  it('removes a selected country', () => {
    const withCanada = toggleCountry(DEFAULT_PREFS, 'CAN');
    expect(toggleCountry(withCanada, 'LVA').countries).toEqual(['CAN']);
  });

  it('can remove the last country', () => {
    expect(toggleCountry(DEFAULT_PREFS, 'LVA').countries).toEqual([]);
  });

  it('does not mutate its input', () => {
    toggleCountry(DEFAULT_PREFS, 'CAN');
    toggleCountry(DEFAULT_PREFS, 'LVA');
    expect(DEFAULT_PREFS.countries).toEqual(['LVA']);
  });
});

describe('toPrefs', () => {
  it('gives Sets with the same members', () => {
    const prefs = toPrefs(DEFAULT_PREFS);
    expect(prefs.leagues).toBeInstanceOf(Set);
    expect([...prefs.leagues].sort()).toEqual(['NBA', 'NHL']);
    expect(prefs.countries).toBeInstanceOf(Set);
    expect([...prefs.countries]).toEqual(['LVA']);
    expect(prefs.favorites.size).toBe(0);
    expect(prefs.hidden.size).toBe(0);
  });
});

describe('restorePrefs', () => {
  const valid = {
    leagues: ['NHL', 'NBA', 'NHL'],
    countries: ['SWE', 'LVA'],
    favorites: ['nhl-8476878'],
    hidden: [],
  };

  it('keeps valid prefs, sorted and deduped', () => {
    expect(restorePrefs(valid)).toEqual({
      leagues: ['NBA', 'NHL'],
      countries: ['LVA', 'SWE'],
      favorites: ['nhl-8476878'],
      hidden: [],
    });
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['a string', 'x'],
    ['an empty object', {}],
    ['empty leagues', { ...valid, leagues: [] }],
    ['an unknown league', { ...valid, leagues: ['KHL'] }],
    ['an unknown country code', { ...valid, countries: ['XX'] }],
  ])('gives the defaults for %s', (_label, stored) => {
    expect(restorePrefs(stored)).toEqual(DEFAULT_PREFS);
  });

  it('keeps an empty country list', () => {
    const stored = { leagues: ['NHL'], countries: [], favorites: [], hidden: [] };
    expect(restorePrefs(stored).countries).toEqual([]);
  });

  it('drops only the malformed favorite ID', () => {
    expect(restorePrefs({ ...valid, favorites: ['bad id', 'nhl-8476878'] })).toEqual({
      leagues: ['NBA', 'NHL'],
      countries: ['LVA', 'SWE'],
      favorites: ['nhl-8476878'],
      hidden: [],
    });
  });

  it('drops only the malformed hidden ID', () => {
    expect(restorePrefs({ ...valid, hidden: ['bad id', 'nhl-8481668'] })).toEqual({
      leagues: ['NBA', 'NHL'],
      countries: ['LVA', 'SWE'],
      favorites: ['nhl-8476878'],
      hidden: ['nhl-8481668'],
    });
  });

  it.each(['favorites', 'hidden'] as const)('drops non-string entries from %s', (list) => {
    expect(restorePrefs({ ...valid, [list]: [42, null, 'nhl-8481668'] })[list]).toEqual([
      'nhl-8481668',
    ]);
  });

  it.each(['favorites', 'hidden'] as const)('gives the defaults for a non-array %s', (list) => {
    expect(restorePrefs({ ...valid, [list]: 'x' })).toEqual(DEFAULT_PREFS);
  });
});

const prefsWith = (favorites: string[], hidden: string[]): StoredPrefs => ({
  ...DEFAULT_PREFS,
  favorites,
  hidden,
});

// MAX_LIST valid IDs: the API's limit for one list.
const fullList = Array.from({ length: MAX_LIST }, (_, i) => `nhl-${1000 + i}`).sort();

describe('markOf', () => {
  it.each([
    ['null for an unmarked player', prefsWith([], []), null],
    ["'favorite' for a favorite", prefsWith([P], []), 'favorite'],
    ["'hidden' for a hidden player", prefsWith([], [P]), 'hidden'],
    ["'hidden' for a player in both lists (tampered storage)", prefsWith([P], [P]), 'hidden'],
  ])('gives %s', (_label, prefs, mark) => {
    expect(markOf(prefs, P)).toBe(mark);
  });
});

describe('setMark', () => {
  it('favoriting a hidden player unhides him', () => {
    const next = setMark(prefsWith([], [P]), P, 'favorite');
    expect(next.favorites).toEqual([P]);
    expect(next.hidden).toEqual([]);
  });

  it('hiding a favorite unfavorites him', () => {
    const next = setMark(prefsWith([P], []), P, 'hidden');
    expect(next.hidden).toEqual([P]);
    expect(next.favorites).toEqual([]);
  });

  it.each([
    ['a favorite', prefsWith([P], [])],
    ['a hidden player', prefsWith([], [P])],
    ['a player in both lists', prefsWith([P], [P])],
  ])('null removes %s from both lists', (_label, prefs) => {
    const next = setMark(prefs, P, null);
    expect(next.favorites).toEqual([]);
    expect(next.hidden).toEqual([]);
  });

  it('keeps leagues and countries as they were', () => {
    const prefs: StoredPrefs = {
      ...prefsWith([], []),
      leagues: ['NHL'],
      countries: ['CAN', 'LVA'],
    };
    const next = setMark(prefs, P, 'favorite');
    expect(next.leagues).toEqual(['NHL']);
    expect(next.countries).toEqual(['CAN', 'LVA']);
  });

  it('keeps favorites sorted', () => {
    expect(setMark(prefsWith([S], []), G, 'favorite').favorites).toEqual([G, S]);
  });

  it('keeps hidden sorted', () => {
    expect(setMark(prefsWith([], [S]), G, 'hidden').hidden).toEqual([G, S]);
  });

  it.each(['favorite', 'hidden'] as const)(
    "setting '%s' twice equals setting it once and returns the same object",
    (mark) => {
      const once = setMark(DEFAULT_PREFS, P, mark);
      const twice = setMark(once, P, mark);
      expect(twice).toEqual(once);
      expect(twice).toBe(once);
    },
  );

  it.each([
    ['favorite', prefsWith([P], [])],
    ['hidden', prefsWith([], [P])],
    [null, prefsWith([], [])],
  ] as const)("returns the same object when the player already has mark '%s'", (mark, prefs) => {
    expect(setMark(prefs, P, mark)).toBe(prefs);
  });

  it('does not mutate its input', () => {
    const prefs = prefsWith([S], [P]);
    setMark(prefs, P, 'favorite');
    setMark(prefs, S, 'hidden');
    setMark(prefs, G, 'favorite');
    setMark(prefs, S, null);
    expect(prefs.favorites).toEqual([S]);
    expect(prefs.hidden).toEqual([P]);
  });

  it('returns the same object when adding to a full favorites list', () => {
    const full = prefsWith(fullList, []);
    expect(setMark(full, P, 'favorite')).toBe(full);
  });

  it('returns the same object when adding to a full hidden list', () => {
    const full = prefsWith([], fullList);
    expect(setMark(full, P, 'hidden')).toBe(full);
  });

  it('re-marking an ID already in a full favorites list returns the same object', () => {
    const full = prefsWith(fullList, []);
    expect(setMark(full, 'nhl-1000', 'favorite')).toBe(full);
  });

  it('re-marking an ID already in a full hidden list returns the same object', () => {
    const full = prefsWith([], fullList);
    expect(setMark(full, 'nhl-1000', 'hidden')).toBe(full);
  });

  it('still removes a player from a full list', () => {
    const next = setMark(prefsWith(fullList, []), 'nhl-1000', null);
    expect(next.favorites).toHaveLength(MAX_LIST - 1);
    expect(next.favorites).not.toContain('nhl-1000');
  });
});

describe('toggleFavorite', () => {
  it('makes an unmarked player a favorite', () => {
    const next = toggleFavorite(DEFAULT_PREFS, P);
    expect(next.favorites).toEqual([P]);
    expect(next.hidden).toEqual([]);
  });

  it('unfavorites a favorite', () => {
    const next = toggleFavorite(prefsWith([P], []), P);
    expect(next.favorites).toEqual([]);
    expect(next.hidden).toEqual([]);
  });

  it('makes a hidden player a favorite and unhides him', () => {
    const next = toggleFavorite(prefsWith([], [P]), P);
    expect(next.favorites).toEqual([P]);
    expect(next.hidden).toEqual([]);
  });

  it('twice from unmarked restores the original lists', () => {
    expect(toggleFavorite(toggleFavorite(DEFAULT_PREFS, P), P)).toEqual(DEFAULT_PREFS);
  });
});

describe('toggleHidden', () => {
  it('hides an unmarked player', () => {
    const next = toggleHidden(DEFAULT_PREFS, P);
    expect(next.hidden).toEqual([P]);
    expect(next.favorites).toEqual([]);
  });

  it('unhides a hidden player', () => {
    const next = toggleHidden(prefsWith([], [P]), P);
    expect(next.hidden).toEqual([]);
    expect(next.favorites).toEqual([]);
  });

  it('hides a favorite and unfavorites him', () => {
    const next = toggleHidden(prefsWith([P], []), P);
    expect(next.hidden).toEqual([P]);
    expect(next.favorites).toEqual([]);
  });

  it('twice from unmarked restores the original lists', () => {
    expect(toggleHidden(toggleHidden(DEFAULT_PREFS, P), P)).toEqual(DEFAULT_PREFS);
  });
});

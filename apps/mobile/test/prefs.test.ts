import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PREFS,
  restorePrefs,
  type StoredPrefs,
  toggleCountry,
  toggleLeague,
  toPrefs,
} from '../src/state/prefs';

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
    ['a malformed favorite ID', { ...valid, favorites: ['bad id'] }],
  ])('gives the defaults for %s', (_label, stored) => {
    expect(restorePrefs(stored)).toEqual(DEFAULT_PREFS);
  });

  it('keeps an empty country list', () => {
    const stored = { leagues: ['NHL'], countries: [], favorites: [], hidden: [] };
    expect(restorePrefs(stored).countries).toEqual([]);
  });
});

import type { CountryCode, League, Prefs, PublicId } from '@our-players/shared';

export type StoredPrefs = {
  leagues: League[];
  countries: CountryCode[];
  favorites: PublicId[];
  hidden: PublicId[];
};

export const DEFAULT_PREFS: StoredPrefs = {
  leagues: ['NBA', 'NHL'],
  countries: ['LVA'],
  favorites: [],
  hidden: [],
};

export function toggleLeague(_p: StoredPrefs, _league: League): StoredPrefs {
  throw new Error('not implemented');
}

export function toggleCountry(_p: StoredPrefs, _code: CountryCode): StoredPrefs {
  throw new Error('not implemented');
}

export function toPrefs(_p: StoredPrefs): Prefs {
  throw new Error('not implemented');
}

export function restorePrefs(_stored: unknown): StoredPrefs {
  throw new Error('not implemented');
}

import {
  type CountryCode,
  countryCodeSchema,
  type League,
  leagueSchema,
  type Prefs,
  type PublicId,
  publicIdSchema,
} from '@our-players/shared';
import { z } from 'zod';

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

const sortedUnique = <T extends string>(xs: readonly T[]): T[] => [...new Set(xs)].sort();

const toggle = <T extends string>(xs: readonly T[], x: T): T[] =>
  xs.includes(x) ? xs.filter((y) => y !== x) : sortedUnique([...xs, x]);

export function toggleLeague(p: StoredPrefs, league: League): StoredPrefs {
  // An empty league list would select nothing, so the last league stays on.
  if (p.leagues.length === 1 && p.leagues[0] === league) return p;
  return { ...p, leagues: toggle(p.leagues, league) };
}

export function toggleCountry(p: StoredPrefs, code: CountryCode): StoredPrefs {
  return { ...p, countries: toggle(p.countries, code) };
}

export function toPrefs(p: StoredPrefs): Prefs {
  return {
    leagues: new Set(p.leagues),
    countries: new Set(p.countries),
    favorites: new Set(p.favorites),
    hidden: new Set(p.hidden),
  };
}

const storedPrefsSchema = z.object({
  leagues: z.array(leagueSchema).min(1),
  countries: z.array(countryCodeSchema),
  favorites: z.array(publicIdSchema),
  hidden: z.array(publicIdSchema),
});

// Storage is outside the app's control: junk there must not turn every request into a 400.
export function restorePrefs(stored: unknown): StoredPrefs {
  const parsed = storedPrefsSchema.safeParse(stored);
  if (!parsed.success) return DEFAULT_PREFS;
  const { leagues, countries, favorites, hidden } = parsed.data;
  return {
    leagues: sortedUnique(leagues),
    countries: sortedUnique(countries),
    favorites: sortedUnique(favorites),
    hidden: sortedUnique(hidden),
  };
}

export type Mark = 'favorite' | 'hidden' | null;

export function markOf(p: StoredPrefs, id: PublicId): Mark {
  throw new Error('not implemented');
}

export function setMark(p: StoredPrefs, id: PublicId, mark: Mark): StoredPrefs {
  throw new Error('not implemented');
}

export function toggleFavorite(p: StoredPrefs, id: PublicId): StoredPrefs {
  throw new Error('not implemented');
}

export function toggleHidden(p: StoredPrefs, id: PublicId): StoredPrefs {
  throw new Error('not implemented');
}

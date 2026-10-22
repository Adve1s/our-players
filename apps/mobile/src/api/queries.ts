import { ApiError, type League, type PublicId } from '@our-players/shared';
import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query';
import { type StoredPrefs, toPrefs } from '../state/prefs';
import { api } from './client';

// Once, since the default 3 with backoff makes "API down" take ~7 s to show; never a 404, which
// can't change on retry ("No such player." would show ~1 s late).
export const retryQuery = (failures: number, error: unknown) =>
  failures < 1 && !(error instanceof ApiError && error.status === 404);

// Both leagues always, so the list doesn't change when a league is toggled.
export const useCountries = () =>
  useQuery({ queryKey: ['countries'], queryFn: () => api.countries(new Set(['NBA', 'NHL'])) });

export const useMeta = () => useQuery({ queryKey: ['meta'], queryFn: api.meta });

// The stored lists are sorted, so equal prefs give equal keys.
export const dayQuery = (date: string | null, prefs: StoredPrefs) =>
  queryOptions({
    queryKey: ['day', date, prefs.leagues, prefs.countries, prefs.favorites, prefs.hidden],
    // biome-ignore lint/style/noNonNullAssertion: `enabled` keeps this from running without a date.
    queryFn: () => api.day(date!, toPrefs(prefs)),
    enabled: date !== null,
    // A new day or new prefs keep the old day (and its stepper) on screen until the new one is in;
    // without a date there is none coming, so the screen can say "No games yet."
    placeholderData: date === null ? undefined : keepPreviousData,
  });

export const useDay = (date: string | null, prefs: StoredPrefs) => useQuery(dayQuery(date, prefs));

export const searchQuery = (term: string | null, leagues: League[]) =>
  queryOptions({
    queryKey: ['search', term, leagues],
    // biome-ignore lint/style/noNonNullAssertion: `enabled` keeps this from running without a term.
    queryFn: () => api.searchPlayers(term!, new Set(leagues)),
    enabled: term !== null,
    // Results don't blank between keystrokes, but a league change drops them: a deselected
    // league's players must not stay listed until the new results land.
    placeholderData: (prev, prevQuery) =>
      String(prevQuery?.queryKey[2]) === String(leagues) ? prev : undefined,
  });

export const useSearch = (term: string | null, leagues: League[]) =>
  useQuery(searchQuery(term, leagues));

// Callers pass sorted IDs, so equal lists give equal keys.
export const usePlayers = (ids: PublicId[]) =>
  useQuery({
    queryKey: ['players', ids],
    queryFn: () => api.players(ids),
    enabled: ids.length > 0,
    placeholderData: keepPreviousData,
  });

// The endpoint takes no prefs: the page shows the player whatever is followed.
export const usePlayer = (id: PublicId | null) =>
  useQuery({
    queryKey: ['player', id],
    // biome-ignore lint/style/noNonNullAssertion: `enabled` keeps this from running without an ID.
    queryFn: () => api.player(id!),
    enabled: id !== null,
  });

export const useGame = (id: PublicId | null, prefs: StoredPrefs) =>
  useQuery({
    queryKey: ['game', id, prefs.leagues, prefs.countries, prefs.favorites, prefs.hidden],
    // biome-ignore lint/style/noNonNullAssertion: `enabled` keeps this from running without an ID.
    queryFn: () => api.game(id!, toPrefs(prefs)),
    enabled: id !== null,
    // A prefs change keeps the game on screen while the marks refetch; another game never shows this one.
    placeholderData: (prev, prevQuery) => (prevQuery?.queryKey[1] === id ? prev : undefined),
  });

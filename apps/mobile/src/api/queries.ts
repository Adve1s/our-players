import { useQuery } from '@tanstack/react-query';
import { type StoredPrefs, toPrefs } from '../state/prefs';
import { api } from './client';

// Both leagues always, so the list doesn't change when a league is toggled.
export const useCountries = () =>
  useQuery({ queryKey: ['countries'], queryFn: () => api.countries(new Set(['NBA', 'NHL'])) });

export const useMeta = () => useQuery({ queryKey: ['meta'], queryFn: api.meta });

// The stored lists are sorted, so equal prefs give equal keys.
export const useDay = (date: string | null, prefs: StoredPrefs) =>
  useQuery({
    queryKey: ['day', date, prefs.leagues, prefs.countries, prefs.favorites, prefs.hidden],
    // biome-ignore lint/style/noNonNullAssertion: `enabled` keeps this from running without a date.
    queryFn: () => api.day(date!, toPrefs(prefs)),
    enabled: date !== null,
  });

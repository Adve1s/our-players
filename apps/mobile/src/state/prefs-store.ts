import type { CountryCode, League, PublicId } from '@our-players/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { safeStorage } from '../lib/safe-storage';
import {
  DEFAULT_PREFS,
  type Mark,
  restorePrefs,
  type StoredPrefs,
  setMark,
  toggleCountry,
  toggleFavorite,
  toggleHidden,
  toggleLeague,
} from './prefs';

type PrefsState = StoredPrefs & {
  toggleLeague: (l: League) => void;
  toggleCountry: (c: CountryCode) => void;
  toggleFavorite: (id: PublicId) => void;
  toggleHidden: (id: PublicId) => void;
  setMark: (id: PublicId, mark: Mark) => void;
};

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      ...DEFAULT_PREFS,
      toggleLeague: (l) => set((s) => toggleLeague(s, l)),
      toggleCountry: (c) => set((s) => toggleCountry(s, c)),
      toggleFavorite: (id) => set((s) => toggleFavorite(s, id)),
      toggleHidden: (id) => set((s) => toggleHidden(s, id)),
      setMark: (id, mark) => set((s) => setMark(s, id, mark)),
    }),
    {
      name: 'prefs',
      version: 1,
      storage: createJSONStorage(() => safeStorage(AsyncStorage)),
      partialize: ({ leagues, countries, favorites, hidden }) => ({
        leagues,
        countries,
        favorites,
        hidden,
      }),
      merge: (persisted, current) => ({ ...current, ...restorePrefs(persisted) }),
    },
  ),
);

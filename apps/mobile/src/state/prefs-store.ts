import type { CountryCode, League } from '@our-players/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { safeStorage } from '../lib/safe-storage';
import {
  DEFAULT_PREFS,
  restorePrefs,
  type StoredPrefs,
  toggleCountry,
  toggleLeague,
} from './prefs';

type PrefsState = StoredPrefs & {
  toggleLeague: (l: League) => void;
  toggleCountry: (c: CountryCode) => void;
};

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      ...DEFAULT_PREFS,
      toggleLeague: (l) => set((s) => toggleLeague(s, l)),
      toggleCountry: (c) => set((s) => toggleCountry(s, c)),
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

import type { StateStorage } from 'zustand/middleware';

// Zustand's persist never finishes hydrating when reading fails (bad JSON, a storage error), and the
// root layout waits for it: so unreadable prefs read as none, and the defaults apply.
export function safeStorage(base: StateStorage): StateStorage {
  return {
    getItem: async (name) => {
      try {
        const stored = await base.getItem(name);
        if (stored !== null) JSON.parse(stored);
        return stored;
      } catch {
        return null;
      }
    },
    setItem: (name, value) => base.setItem(name, value),
    removeItem: (name) => base.removeItem(name),
  };
}

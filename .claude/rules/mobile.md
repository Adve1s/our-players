---
paths:
  - "apps/mobile/**"
---

# Mobile app rules

- Routes live in `apps/mobile/src/app/` (Expo Router); components in `src/components/`, API hooks in `src/api/`, preferences in `src/state/`, pure helpers in `src/lib/` (tested with Vitest).
- Route files under `src/app/` use `export default` (Expo Router requires it), an exception to CLAUDE.md's named exports like tool config files (`vitest.config.ts`).
- Server data only through TanStack Query hooks whose query keys include every preference the request sends (`usePlayer`, `useMeta` send none); components never call `fetch` directly.
- Change preferences only through the store's pure update functions; the persisted object keeps its `version`.
- Every screen handles loading, empty, error and offline states.
- Style through the theme tokens (light and dark); no hard-coded colors or font sizes in components.
- Must work on Android and web: no native-only module without a web fallback. Before calling UI work done, run `pnpm screenshots` and look at the images.
- No league or team logos and no player photos (VISION §4.6). Show the country code next to any flag emoji.
- Touchable elements get an `accessibilityLabel`; text respects the system font scale. State goes in `aria-*` props (`aria-checked`, `aria-disabled`, …), not `accessibilityState`: react-native-web 0.21 ignores the latter, and RN maps `aria-*` for Android too.

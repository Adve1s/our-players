---
paths:
  - "apps/mobile/**"
---

# Mobile app rules

- Routes live in `apps/mobile/app/` (Expo Router); components in `src/components/`, API hooks in `src/api/`, preferences in `src/state/`, pure helpers in `src/lib/` (tested with Vitest).
- Server data only through TanStack Query hooks whose query keys include the preferences; components never call `fetch` directly.
- Change preferences only through the store's pure update functions; the persisted object keeps its `version`.
- Every screen handles loading, empty, error and offline states.
- Style through the theme tokens (light and dark); no hard-coded colors or font sizes in components.
- Must work on Android and web: no native-only module without a web fallback. Before calling UI work done, run `pnpm screenshots` and look at the images.
- No league or team logos and no player photos (VISION §4.6). Show the country code next to any flag emoji.
- Touchable elements get an `accessibilityLabel`; text respects the system font scale.

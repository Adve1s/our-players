# S17 Visual Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the app the approved look — neutral greys, sunrise amber, Instrument Sans, A's score plate over a stat table — on every screen, plus the new icon and splash, without changing data, server or app logic.

**Architecture:** Tokens in a react-native-free module (`src/tokens.ts`) that `useTheme()` exposes; every component styles only from the theme. Stat tables are built from pure helpers in `src/lib/stat-table.ts` (tested), rendered by one `StatTable` component used by Today, the player log and the box score. Screens change through shared components; the brand comes from one SVG rendered by the `icons` script.

**Tech Stack:** Expo SDK 58, Expo Router, React Native 0.88 + react-native-web 0.21, TanStack Query, Vitest, Biome; new: `@expo-google-fonts/instrument-sans`, `expo-font` (declared), `@expo/vector-icons` (Ionicons).

**Spec:** `docs/superpowers/specs/2026-11-01-s17-visual-overhaul.md` (design, token table, screen rules) and `docs/SESSIONS.md` §S17. Mockups: `docs/superpowers/specs/s17-mockups/`.

## Global Constraints

- Token values: exactly the design doc's tables (colors per scheme, type styles, space, radius, elevation, motion, icon sizes, content width 600, touch target 48). Copy them; don't round or invent.
- Style only through `useTheme()`; no hex colors, numeric font sizes, `fontWeight`, numeric radii or durations in `apps/mobile/src` outside `src/tokens.ts`. Weights come from `fontFamily`.
- Text follows the system font scale; never `allowFontScaling={false}`. Touchables keep their `accessibilityLabel`s; state in `aria-*`.
- No server, API, contract (`packages/shared`) or preference changes. `lineText`/`dnpText`/`upcomingText` stay (the recap CLI uses them).
- Motion only with React Native's `Animated`; nothing animates when the system's reduce-motion setting is on.
- Owner ruling (2026-11-01): UI/UX changes within the existing API data are allowed; no logic changes. Existing tests change only where the layout changes a text, role or label; each such change is listed in its task.
- From §S17, verbatim — Out of scope: new features, screens or behavior; changed texts beyond labels the new layout needs; logos, team logos and player photos (VISION §4.6); team colors (they'd need data per team from the server — park for v2); server or API changes; moving styling to a UI library (NativeWind, Tamagui, Gluestack, Paper) — style stays in `useTheme()` tokens; a dedicated desktop layout (VISION §5); translations; Play Store graphics (S11b).
- From §S17, verbatim — Acceptance criteria:
  1. The design doc records the mockups shown, your pick, the token set, and each new dependency with why; you approved it.
  2. Components take every color, size, radius and duration from the theme (a grep for hex colors and numeric font sizes in `apps/mobile/src` outside the theme finds nothing new); the contrast test passes for both schemes.
  3. The full `pnpm screenshots` set is re-captured, and every screen and state follows the chosen direction in light and dark (the final reviewer compares with the mockups).
  4. Icon, adaptive icon, splash, favicon and manifest icons come from the new source; `app.json` no longer references Expo's defaults.
  5. No behavior change: the existing tests and screenshot flows pass without edits to what they assert, except the game-page text tweaks in scope (the plan names each changed assertion, e.g. `player-page.test.ts`'s `'0.0'`).
  6. On your Android phone (Expo Go), in light and dark and at the largest font size, and in a desktop browser, the app looks right and nothing is clipped (you).
  7. `pnpm verify` green.
- Screenshots: `PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium pnpm screenshots` (writes `apps/mobile/.screenshots/`). After a task that changes a screen, the task reviewer (not the implementer) compares that screen's light and dark shots with the matching mockup PNG.
- **Session cut (§S17 size rule):** this session runs Tasks 1–6 (tokens, fonts and icons, helpers, shared components, brand) and stops at that task boundary (no `/handoff` mid-plan, SESSIONS.md "Sizing"); Tasks 7–11, the final review and the owner checks run in a Resume session on the same branch, from the same ledger.

## Review Focus

1. Largest system font size (font scale 2.0) on a 360 px phone: stat columns must not clip numbers — column widths scale with the font scale (`columnWidth` test, Task 3).
2. Long names ("Zemgus Girgensons TBL", "Shai Gilgeous-Alexander") in a table: they wrap onto a second line, never truncate or push columns off-screen (Task 4 reviewer checks `night-busy`/`game-*` shots).
3. A goalie line with a null save % or null decision: the cell shows "–", not "null" or ".000" (Task 3 test).
4. Mixed row kinds in one game (skater, goalie, DNP, not in lineup, upcoming) — Today keeps the server's order with a header at each kind change; the box score groups skaters, goalies, then text rows, keeping order inside each group (Task 3 tests).
5. Day strip across a month/year boundary and DST changes: dates come from UTC date math, so 29 consecutive days with no gaps or repeats (Task 7 test).

---

## Part 1 — this session

### Task 1: Tokens, theme and the contrast test

**Files:**
- Create: `apps/mobile/src/tokens.ts`, `apps/mobile/test/tokens.test.ts`
- Modify: `apps/mobile/src/theme.ts`; every file using `t.font`, `t.radius` or `fontWeight` (`src/app/**`, `src/components/**`, 21 files)

**Interfaces:**
- Produces (`src/tokens.ts`, no `react-native` import):
  - `type ColorRole = 'background' | 'surface' | 'plate' | 'onPlate' | 'onPlateMuted' | 'text' | 'textMuted' | 'textDisabled' | 'border' | 'accent' | 'accentFill' | 'onAccent' | 'accentWash' | 'inverse' | 'onInverse' | 'thumb' | 'danger'`; `type Colors = Record<ColorRole, string>`; `light: Colors`, `dark: Colors`
  - `FONTS = { regular: 'InstrumentSans_400Regular', medium: 'InstrumentSans_500Medium', semiBold: 'InstrumentSans_600SemiBold', bold: 'InstrumentSans_700Bold' }`
  - `type = { score, scoreLarge, title, heading, body, bodyStrong, meta, label }`, each `{ fontFamily, fontSize, lineHeight }` per the design doc
  - `space { xs 4, sm 8, md 12, lg 16, xl 24, xxl 32 }`, `radius { control 8, sheet 12, full 999 }`, `motion { press 100, expand 200, pulse 900 }`, `icon { inline 16, bar 22 }`, `layout { target 48, maxWidth 600, hairline 1, markBar 3 }`, `shadow { float: '0 4px 14px rgba(0, 0, 0, 0.25)' }`, `opacity { pressed 0.6, disabled 0.4 }`
- Produces (`src/theme.ts`): `type Theme = { colors: Colors; space; radius; type; motion; icon; layout; shadow; opacity; dark: boolean }`, `useTheme(): Theme` (scheme from `useColorScheme()` as today), `useReducedMotion(): boolean` (`AccessibilityInfo.isReduceMotionEnabled()` plus its `reduceMotionChanged` listener; `false` until known).

- [ ] **Step 1: Write the failing contrast test** `test/tokens.test.ts`: a local `contrast(a, b)` (WCAG relative luminance); `it.each` over both schemes × these pairs, `expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5)`: `text`, `textMuted`, `accent`, `danger` on `background` and on `surface`; `onPlate`, `onPlateMuted` on `plate`; `onAccent` on `accentFill`; `onInverse` on `inverse`; `accent`, `text` on `accentWash`. Plus one test that `contrast('#000000', '#FFFFFF')` is 21.
- [ ] **Step 2:** `pnpm test apps/mobile/test/tokens` → FAIL (module `../src/tokens` not found).
- [ ] **Step 3:** Write `src/tokens.ts` with the design doc's values; rewrite `src/theme.ts` to build `Theme` from it (drop `font` and the numeric `radius`).
- [ ] **Step 4:** `pnpm test apps/mobile/test/tokens` → PASS.
- [ ] **Step 5: Migrate every use site mechanically** — no layout redesign here: `fontSize: t.font.caption` → `...t.type.meta`; `t.font.body` → `...t.type.body`, or `...t.type.bodyStrong` where it had `fontWeight: '600'|'700'`; `t.font.title` → `...t.type.heading` (`...t.type.title` for the player name and the game page's score); `t.font.icon` → `fontSize: t.icon.bar` for the ★ glyph until Task 5 replaces it; `borderRadius: t.radius` → `t.radius.sheet` (search fields and buttons `t.radius.control`); delete every `fontWeight`; the disabled switch's `0.4` → `t.opacity.disabled`.
- [ ] **Step 6: Verify** `pnpm verify` → green, and the criterion-2 grep prints nothing:
  `grep -rnE "#[0-9A-Fa-f]{3,8}\b|fontSize: *[0-9]|fontWeight|borderRadius: *[0-9]|duration: *[0-9]|opacity: *0\." apps/mobile/src | grep -v "src/tokens.ts"`
- [ ] **Step 7: Commit** `feat(mobile): token set and theme for the S17 look`

### Task 2: Typeface and icon set

**Files:**
- Modify: `apps/mobile/package.json` (+ lockfile), `apps/mobile/src/app/_layout.tsx`, `apps/mobile/src/app/(tabs)/_layout.tsx`

**Interfaces:**
- Consumes: `FONTS`, `useTheme()` (Task 1).
- Produces: fonts registered under the `FONTS` names on Android and web; Ionicons usable as `import Ionicons from '@expo/vector-icons/Ionicons'` (its font loaded up front).

- [ ] **Step 1: Install** from `apps/mobile`: `pnpm exec expo install expo-font @expo-google-fonts/instrument-sans @expo/vector-icons` (SDK-matched versions; if pnpm's release-age gate refuses one, stop and report). Context7 first: `expo-font` `useFonts`, `@expo/vector-icons` usage.
- [ ] **Step 2: Load fonts in `RootLayout`:** `useFonts({ [FONTS.regular]: InstrumentSans_400Regular, …four weights, ...Ionicons.font })`; render `null` until prefs are hydrated **and** fonts are loaded or `fontError` is set (an error falls back to the system font instead of blocking). Stack header: background `background`, no shadow (`headerShadowVisible: false`), title in `heading`.
- [ ] **Step 3: Tab bar** (`(tabs)/_layout.tsx`): Ionicons `calendar`/`search`/`options` (`-outline` when not focused), size `t.icon.bar`, label below the icon in `label` style; active tint `accent`, inactive `textMuted`; the active icon sits in an `accentWash` pill (`radius.full`, horizontal padding `lg`); bar background `surface` with a `hairline` top border in `border`. Remove the beside-icon workarounds (`tabBarIconStyle: display none`, `tabBarLabelPosition`).
- [ ] **Step 3b: Check tabular figures:** confirm Instrument Sans has a `tnum` feature (`fc-query` / font tables on the TTF in `node_modules/@expo-google-fonts/instrument-sans`); note the result in the commit message (Task 4 sets `fontVariant: ['tabular-nums']` either way).
- [ ] **Step 4: Verify** `pnpm verify` green; `pnpm screenshots`; look at `light-today.png`/`dark-today.png`: text in Instrument Sans, tab bar with icons. The browser console during screenshots shows no CSP font violation (`font-src 'self' data:` covers the bundled TTFs).
- [ ] **Step 5: Commit** `feat(mobile): Instrument Sans and Ionicons tab bar`

### Task 3: Stat table helpers

**Files:**
- Create: `apps/mobile/src/lib/stat-table.ts`, `apps/mobile/test/stat-table.test.ts`

**Interfaces:**
- Consumes: `LineStats`, `toi`, `savePct`, `signed` from `@our-players/shared`; `PlayerRow`, `BoxScoreRow` types.
- Produces:
  - `type LineKind = LineStats['kind']`; `type ColumnSet = 'today' | 'box'`; `type Column = { label: string; wide: boolean }`
  - `columns(kind: LineKind, set: ColumnSet): Column[]`
  - `values(line: LineStats, set: ColumnSet): string[]` (same length and order as `columns`)
  - `type RowGroup<R> = { kind: LineKind | null; rows: R[] }` (`null` = text rows: dnp, not-in-lineup, upcoming)
  - `todayGroups<R extends { type: string; line?: LineStats }>(rows: R[]): RowGroup<R>[]` — consecutive runs, a new group at every kind change, server order kept
  - `boxGroups<R …>(rows: R[]): RowGroup<R>[]` — skater or basketball group, then goalie group, then text rows; order kept inside each; empty groups dropped
  - `columnWidth(wide: boolean, fontScale: number): number` — `Math.ceil((wide ? 52 : 34) * Math.max(1, fontScale))` (the base widths are layout tokens: add `layout.statColumn 34`, `layout.statColumnWide 52` to `tokens.ts` and import them)

Column sets (labels exact):
- today: skater `G A +/- SOG TOI` (TOI wide); goalie `SV/SA SV% GA DEC` (SV/SA wide); basketball `PTS REB AST MIN`
- box: skater `G A PTS +/- SOG TOI PIM HIT BLK PPG` (TOI wide); goalie `SV/SA SV% GA TOI DEC` (SV/SA, TOI wide); basketball `MIN PTS REB AST FG 3PT FT OREB DREB STL BLK TO PF +/-` (FG, 3PT, FT wide)

- [ ] **Step 1: Write failing tests** with literal values, e.g.:
  - `values(skater{goals 1, assists 1, plusMinus 1, shots 3, toiSeconds 1025}, 'today')` → `['1','1','+1','3','17:05']`
  - goalie `{saves 25, shotsAgainst 27, goalsAgainst 2, savePct 0.926, decision 'W'}` today → `['25/27','.926','2','W']`; with `savePct: null, decision: null` → `['25/27','–','2','–']`
  - basketball Porzingis (30/5/4/26, FG 8-13, 3PT 1-5, FT 13-14) today → `['30','5','4','26']`; box starts `['26','30','5','4','8-13','1-5','13-14', …]`
  - skater without `pim`/`hits`/`blocks`/`powerPlayGoals`, box → those four cells `'–'`
  - `columns(k, s).length === values(line, s).length` for all 6 combinations
  - `todayGroups([skaterA, skaterB, goalie, dnp, skaterC])` → kinds `['hockey_skater','hockey_goalie',null,'hockey_skater']`
  - `boxGroups([goalieShown, nilShown, skater1, skater2, goalie2, dnp])` → `[skater [skater1, skater2]], [goalie [goalieShown, goalie2]], [null [nilShown, dnp]]`
  - `columnWidth(false, 1) === 34`, `columnWidth(true, 2) === 104`, `columnWidth(false, 0.85) === 34`
- [ ] **Step 2:** `pnpm test apps/mobile/test/stat-table` → FAIL (module not found).
- [ ] **Step 3:** Implement `src/lib/stat-table.ts`.
- [ ] **Step 4:** `pnpm test apps/mobile/test/stat-table` → PASS.
- [ ] **Step 5: Commit** `feat(mobile): stat table columns and row groups`

### Task 4: Plate, StatTable and Today's game box

**Files:**
- Create: `apps/mobile/src/components/plate.tsx`, `apps/mobile/src/components/stat-table.tsx`
- Modify: `apps/mobile/src/components/game-card.tsx`

**Interfaces:**
- Consumes: `columns`, `values`, `todayGroups`, `columnWidth` (Task 3); `statusLabel`, `scoreText`, `rowLabel`, `rowText` (`src/lib/format.ts`); theme (Task 1).
- Produces:
  - `Plate({ away, home, status, league, size = 'card', when, onPress, accessibilityLabel }: { away: TeamScore; home: TeamScore; status: string; league: string; size?: 'card' | 'page'; when?: string; onPress?: () => void; accessibilityLabel?: string })` — `plate` background; away abbrev + score left, home score + abbrev right (`heading` abbrevs, `score`/`scoreLarge` numbers with `tabular-nums`); the higher score `onPlate`, the lower `onPlateMuted`, a tie or null scores both `onPlate`; no scores → abbreviations only; middle: `status` (`bodyStrong`, `onPlate`) over `league` (`meta`, `onPlateMuted`); `when` (`meta`) centered under the row when given. Pressable (opacity `pressed`) only when `onPress` is given.
  - `type StatTableRow = { key: string; lead: ReactNode; values: string[] | null; text?: string; label: string; onPress: () => void; marked?: boolean }`
  - `StatTable({ columns, rows, scroll = false }: { columns: Column[] | null; rows: StatTableRow[]; scroll?: boolean })` — header row (`label`, `textMuted`, right-aligned) when `columns` isn't null; each row one `Pressable` (`accessibilityRole="button"`, `accessibilityLabel={label}`, min height `layout.target`, opacity `pressed`) with `lead` in a flexible first column (wraps) and `values` in fixed columns of `columnWidth(col.wide, fontScale)` (`useWindowDimensions().fontScale`), `body` with `tabular-nums`, right-aligned; `values: null` → `text` spans the stat columns (`body`, `textMuted`, right-aligned); `marked` → `markBar` left bar in `accent` inside the box's padding (names stay aligned, as `PlayerRow` does today). `scroll` is added in Task 9; ignore it here.
- `GameCard` becomes: a `surface` box (`radius.sheet`, `overflow: 'hidden'`) with `Plate` (onPress → `/game/{id}`, label unchanged: `${league}, ${scoreText}, ${statusLabel}, open game`) and, under it with padding `lg`, one `StatTable` per `todayGroups(game.rows)` group; lead = name (`bodyStrong`) + team abbrev (`meta`, `textMuted`); row label = `rowLabel(row, status, team)` (unchanged); text rows use `rowText(row, status)[0]`. The `compact` prop goes (Other games gets its own rows in Task 5).

- [ ] **Step 1:** Write the three components (no unit tests: rendering, checked by screenshots; the logic is Task 3's).
- [ ] **Step 2: Verify** `pnpm verify` green (flows assert the same labels); `pnpm screenshots`.
- [ ] **Step 3: Reviewer compares** `{light,dark}-night-mixed.png`, `-dnp.png`, `-upcoming.png`, `-today.png` with `s17-mockups/today-{light,dark}.png` (game boxes only; header, strip and pill come in Task 7).
- [ ] **Step 4: Commit** `feat(mobile): score plate and stat table on Today's cards`

### Task 5: Shared components in the new look

**Files:**
- Modify: `apps/mobile/src/components/{card,caption,accent-button,day-message,error-state,skeleton,other-games,mark-button,search-field,player-item,period-table}.tsx`, `apps/mobile/src/lib/players.ts` (`playerMeta`), `apps/mobile/test/players.test.ts`

**Interfaces:**
- Consumes: theme incl. `useReducedMotion()` (Task 1), Ionicons (Task 2), `Plate` (Task 4, not used here).
- Produces (props unchanged unless listed): `Card` (radius `sheet`, padding `lg`, title in `heading`; `large` stays until Task 10 moves Settings' section titles outside their boxes and removes it), `AccentButton` (`accentFill` / `onAccent`, radius `control`, `bodyStrong`, min height `target`, opacity `pressed`), `OtherGames` (header "Other games (n)" `heading` + Ionicons `chevron-down`/`chevron-up`; open → one `surface` box with a `hairline` row per game: league `label`, score text `bodyStrong` with `tabular-nums`, status `meta`; each row a button to `/game/{id}` labelled `${league}, ${scoreText}, ${statusLabel}, open game`; fades in over `motion.expand` with `Animated.timing`, instant when reduced motion), `MarkToggles` (★ = Ionicons `star`/`star-outline` in `accent`/`textMuted`; Hide = `eye-off-outline` + "Hide"/"Hidden"; same roles, labels and `aria-checked`), `SearchField` (Ionicons `search` inside on the left, radius `control`, focus border 2 px `accent`), `Skeleton` (two game-box shapes: a `plate`-colored bar plus three `border`-colored lines; opacity pulses 1 → 0.5 → 1 over `motion.pulse` in a loop, static with reduced motion; keeps its `progressbar` role and "Loading" label), `PeriodTableView` (header `label`/`textMuted`, cells `body` with `tabular-nums`, total column `bodyStrong`), `DayMessageCard` and `ErrorState` (centered text, button as `AccentButton`), `Caption` (`meta`).
- `playerMeta` joins with `', '` instead of `' · '`.

- [ ] **Step 1: Change the test first:** in `test/players.test.ts`, the `playerMeta` expectations' `' · '` → `', '` (named assertion change: layout text, per the ruling). `pnpm test apps/mobile/test/players` → FAIL on those cases only.
- [ ] **Step 2:** Update `playerMeta`; `pnpm test apps/mobile/test/players` → PASS.
- [ ] **Step 3:** Restyle the components as listed. The screenshot flows click `Other games (8)` by role and name, so keep that button's label.
- [ ] **Step 4: Verify** `pnpm verify` green; the Task 1 grep prints nothing; `pnpm screenshots`.
- [ ] **Step 5: Reviewer compares** `{light,dark}-night-busy.png` (Other games open), `-search-results.png`, `-api-down.png`, `-empty-past.png` with the mockups' boxes, buttons and Other games list.
- [ ] **Step 6: Commit** `feat(mobile): shared components in the S17 look`

### Task 6: Brand — icon, adaptive layers, splash, web icons

**Files:**
- Modify: `apps/mobile/assets/icon.svg`, `apps/mobile/scripts/icons.ts`, `apps/mobile/app.json`, `apps/mobile/public/manifest.json`, `apps/mobile/public/index.html`, the generated PNGs under `apps/mobile/assets/images/` and `apps/mobile/public/`
- Delete: `apps/mobile/assets/expo.icon`

**Interfaces:**
- Produces: `icon.svg` with a 1024 viewBox: full-bleed ink `#1D2024` `<rect id="field">` and a `<g id="mark">` (amber `#FFB547` half-sun cut by a `clipPath` at the horizon, a `#F5F5F4` rounded horizon bar, three amber rays), the mark centered and sized to fit the adaptive safe zone (66/108 of the canvas) at scale 1.
- `icons.ts` renders, besides today's six files (now from the new SVG; the maskable copy scales the mark by 0.72 as before): `assets/images/android-icon-foreground.png` 1024 (mark only, transparent), `android-icon-background.png` 1024 (field only), `android-icon-monochrome.png` 1024 (mark only, every fill `#FFFFFF`, transparent), `splash-icon.png` 1024 (mark only, transparent). The "exactly one `<text>`" guard becomes "exactly one `id="mark"` group and one `id="field"` rect"; variants are made by removing the field or recoloring fills in the SVG string. Keep the IHDR size check and print each file. Rendering transparent PNGs: `page.screenshot({ omitBackground: true })`.
- `app.json`: drop `ios.icon`; `android.adaptiveIcon.backgroundColor` `#1D2024` (images keep their paths, now new art); `expo-splash-screen` `backgroundColor` `#1D2024`, `image` `./assets/images/splash-icon.png`, `imageWidth` 200, and `dark: { backgroundColor: '#1D2024' }` (context7: check the plugin's option names for SDK 58).
- `manifest.json`: `theme_color` and `background_color` `#1D2024`. `index.html`: `theme-color` metas `#F1F1EF` (light) and `#131517` (dark).

- [ ] **Step 1:** Draw `icon.svg`; run `PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium pnpm --filter @our-players/mobile icons` → prints 10 files with the expected sizes.
- [ ] **Step 2:** Look at `icon.png`, the foreground over the background, the monochrome and `icon-maskable-512.png` (Read the PNGs): the sun reads at 48 px (`favicon.png`), nothing is cut by a circle mask.
- [ ] **Step 3:** Update `app.json`, `manifest.json`, `index.html`; delete `assets/expo.icon`. `grep -n "E6F4FE\|208AEF\|expo.icon" apps/mobile/app.json` → nothing. Run `pnpm test apps/mobile/test/web-headers` (it reads `public/`) and `pnpm verify` → green.
- [ ] **Step 4: Commit** `feat(mobile): sunrise icon, adaptive layers and splash from one SVG`

**— Part 1 ends here: `pnpm verify` green, `pnpm screenshots` re-run; the session stops at this boundary and continues with SESSIONS.md's Resume template (the ledger names Task 7 as the next task).**

## Part 2 — Resume session

### Task 7: Today — header, day strip, Latest pill, banners, empty days

**Files:**
- Create: `apps/mobile/src/components/day-strip.tsx`, `apps/mobile/src/components/latest-pill.tsx`
- Modify: `apps/mobile/src/app/(tabs)/index.tsx`, `apps/mobile/src/app/(tabs)/_layout.tsx` (Today `headerShown: false`), `apps/mobile/src/lib/format.ts`, `apps/mobile/src/lib/day-message.ts`, `apps/mobile/src/components/day-message.tsx`, `apps/mobile/test/format.test.ts`, `apps/mobile/test/day-message.test.ts`, `apps/mobile/scripts/screenshots.ts`
- Delete: `apps/mobile/src/components/day-stepper.tsx`

**Interfaces:**
- Produces: `dayTitle(date: string): string` ("Monday, March 16", fixed English names like `dayLabel`); `stripDays(date: string, span = 14): string[]` (2·span+1 consecutive `YYYY-MM-DD`, UTC math, `date` in the middle); `DayMessage = { text: string; actions: ('prev' | 'next' | 'settings')[] }` — "No games on {label}." now gets `['prev', 'next']` filtered to the non-null neighbours; the other cases keep their single action as a one-element array.
- `DayStrip({ date, onGo })`: horizontal `ScrollView` of `stripDays(date)`, initially scrolled so `date` is centered (`onLayout` + `scrollTo`, no animation); each day a button (`accessibilityLabel={dayLabel(d)}`, `aria-selected`), weekday `label` over day number `heading`, the shown day in `accent` with a 3 px underline; full width with a `hairline` bottom border; disabled while the next day loads (as the stepper's ‹ › were).
- `LatestPill({ date, onPress })`: absolutely positioned bottom-center above the tab bar, `inverse`/`onInverse`, `radius.full`, `shadow.float`, text `Latest: ${dayLabel(date)}` + `chevron-forward`, `accessibilityLabel="Latest game day"`; fades in over `motion.expand` (instant with reduced motion); rendered only when the shown day isn't the latest.
- Today: one `ScrollView` (pull to refresh as today) whose children are: header (`Today` `meta` + `dayTitle` `title`, `accessibilityRole="header"` on the title), the `DayStrip` (index 1, sticky via `stickyHeaderIndices={[1]}`, `background` behind it), then banner / message / games / Other games with gutter `md` and gap `md`; content in a centered column of `layout.maxWidth`.
- Banner: `surface` box, `meta` text, a text button "Try again" in `accent` when it retries; keeps `accessibilityRole="alert"`.

- [ ] **Step 1: Failing tests:** `dayTitle('2026-03-16') === 'Monday, March 16'`; `stripDays('2026-01-02')` has 29 entries, first `'2025-12-19'`, last `'2026-01-16'`, index 14 `'2026-01-02'`; `stripDays('2026-03-29')` (EU DST day) has no duplicates; day-message: change `action` → `actions` in every existing expectation (named change) and add "No games" cases → `['prev','next']`, `['prev']`, `[]`. Run → FAIL on these.
- [ ] **Step 2:** Implement the helpers; tests PASS.
- [ ] **Step 3:** Build `DayStrip`, `LatestPill`, the new Today layout; `DayMessageCard` takes `actions: { label: string; onPress: () => void }[]`; delete `DayStepper`.
- [ ] **Step 4: Update the flows** in `scripts/screenshots.ts` (named changes): `getByRole('button', { name: 'Previous game day' })` steps (lines ~283–303) → click the strip's day button by its `dayLabel` name (`'Mon, Mar 23'`, `'Mon, Mar 16'`); `getByRole('heading', { name: 'Mon, Mar 23' })` → `{ name: 'Monday, March 23' }` (and Mar 16). The S10a "step failed / offline" shots keep stepping to the same days. No other assertion changes.
- [ ] **Step 5: Verify** `pnpm verify`; `pnpm screenshots` green.
- [ ] **Step 6: Reviewer compares** `{light,dark}-today.png`, `-night-mixed.png`, `-today-step-failed.png`, `-offline-banner.png`, `-empty-future.png` with `s17-mockups/today-*.png`.
- [ ] **Step 7: Commit** `feat(mobile): Today header, day strip and Latest pill`

### Task 8: Player page

**Files:**
- Modify: `apps/mobile/src/app/player/[id].tsx`, `apps/mobile/src/lib/player-page.ts`, `apps/mobile/test/player-page.test.ts`

**Interfaces:**
- Consumes: `Plate`-style header (use the `plate` colors directly in a box header; `Plate` is for scores), `StatTable` + `columns`/`values` with `'today'` (Tasks 3–4), `MarkToggles` (Task 5).
- Produces: `bioRows(p, today): { label: string; value: string }[]` (Position, Age, Born, Nationality — "LVA (override)" when the source is `override`; rows with null values left out); `playerSubtitle(p): string` ("Golden State, NBA, #8"; `No team` when `team` is null; `#n` left out when no jersey); `logCaption` → `"GS 137 – 131 DAL, Final/OT"` (date moves to the lead); `seasonCells` basketball FG%/3P%/FT% → `'–'` at 0 GP.
- Page: header right = `MarkToggles` via `<Stack.Screen options={{ headerRight, headerTitle: '' }} />` (keep `title` for the document title); one box: `plate` top (name `title` `onPlate`, `playerSubtitle` `meta` `onPlateMuted`), bio rows below (label `textMuted`, value `text`, `body`); season box: `heading` + 4-column grid (`label` over `heading` values with `tabular-nums`); Recent games box: one `StatTable` per run of the same kind, lead = `dayLabel` (`bodyStrong`) over `logCaption` (`meta`), row → `/game/{id}`, label unchanged (`${caption}, ${rowLabel}, open game` with the new caption). Content in the centered `maxWidth` column.

- [ ] **Step 1: Failing tests (named changes in `player-page.test.ts`):** `'0.0'` → `'–'` for FG%/3P%/FT% at 0 GP; `bioLines` cases → `bioRows`/`playerSubtitle` with the values above (`[{ label: 'Position', value: 'R' }, { label: 'Age', value: '34' }, …]`); `logCaption` → comma form. Run → FAIL on these.
- [ ] **Step 2:** Implement; tests PASS. Remove `bioLines`/`logLines` if unused.
- [ ] **Step 3:** Rebuild the page; the `flow-log-to-game` flow clicks the log row by its label, which keeps the same shape.
- [ ] **Step 4: Verify** `pnpm verify`; `pnpm screenshots`.
- [ ] **Step 5: Reviewer compares** `{light,dark}-player-basketball.png`, `-player-skater.png`, `-player-goalie.png`, `-player-override.png` with `s17-mockups/player-*.png`.
- [ ] **Step 6: Commit** `feat(mobile): player page in the S17 look`

### Task 9: Game page and the box score table

**Files:**
- Modify: `apps/mobile/src/app/game/[id].tsx`, `apps/mobile/src/components/stat-table.tsx` (`scroll`), `apps/mobile/src/lib/game-page.ts`, `apps/mobile/test/game-page.test.ts`
- Delete: `apps/mobile/src/components/player-row.tsx` (no users left)

**Interfaces:**
- Consumes: `Plate` with `size="page"` and `when`, `PeriodTableView`, `boxGroups`, `columns`/`values` with `'box'`.
- Produces: `gameWhen` → `"Sat, Jan 17, 02:00"` (comma); `StatTable` `scroll`: the lead column fixed (`width` 140 × font scale, capped at 45% of the box), the header and value columns in one horizontal `ScrollView` so they scroll together, a 1 px `border` divider after the lead column; text rows span outside the scroller.
- Page: one box with `Plate size="page"` (status = `statusLabel`, `when = gameWhen(g)`) and `PeriodTableView` on `surface` below; then per `boxSections(g)` a box with the abbreviation as `heading` and one `StatTable scroll` per `boxGroups(section.rows)` group (`columns` from `'box'`, lead = name `bodyStrong` only — no abbreviation; `marked = row.shown`; label `rowLabel(row, g.status, s.abbrev)` + `', your player'` when shown, as today); no box score → the upcoming rows like Today, or "No box score yet." in a box. Content in the centered `layout.maxWidth` column.

- [ ] **Step 1: Failing test (named change in `game-page.test.ts`):** `gameWhen` expectation `' · '` → `', '`. Run → FAIL.
- [ ] **Step 2:** Implement; PASS.
- [ ] **Step 3:** Build the page and the `scroll` mode; delete `PlayerRow`. Flows at `screenshots.ts` ~538/547/600 match row labels by regex ending `your player` — unchanged.
- [ ] **Step 4: Verify** `pnpm verify`; `pnpm screenshots`.
- [ ] **Step 5: Reviewer compares** `{light,dark}-game-hockey.png`, `-game-basketball.png`, `-game-upcoming.png`, `-game-ot.png` with `s17-mockups/game-*.png`.
- [ ] **Step 6: Commit** `feat(mobile): game page with a scrollable box score`

### Task 10: Search, Settings, Install and the wide-window column

**Files:**
- Modify: `apps/mobile/src/app/(tabs)/search.tsx`, `apps/mobile/src/app/(tabs)/settings.tsx`, `apps/mobile/src/app/(tabs)/_layout.tsx`, `apps/mobile/src/app/install.tsx`, `apps/mobile/src/app/_layout.tsx`

**Interfaces:**
- Search and Settings: navigator header hidden; in-screen `title` ("Search", "Settings", `accessibilityRole="header"`); Search results in one grouped `surface` box with `hairline` rows (`PlayerItem`); Settings: each section's `heading` above its own box (Leagues: `Switch` with `trackColor.true` `accentFill`, thumb `thumb`; Countries: rows with code `bodyStrong`, name `body`, counts `meta`, selected = Ionicons `checkmark` in `accent`; Favorites/Hidden with Remove/Undo rows; About). Install: same title style, steps as a numbered list. Every screen's content in the centered `layout.maxWidth` column; the tab bar's items stay full width.
- Screen titles become in-screen headings with the same names, so `getByRole('tab', …)` flows and the S12/S14b link flows are unchanged.

- [ ] **Step 1:** Restyle the three screens and the wide column.
- [ ] **Step 2: Verify** `pnpm verify`; `pnpm screenshots`.
- [ ] **Step 3: Reviewer compares** `{light,dark}-search-results.png`, `-settings.png`, `-settings-lists.png`, `-settings-undo.png`, `-install.png` with the mockups' palette, boxes and type.
- [ ] **Step 4: Commit** `feat(mobile): Search, Settings and Install in the S17 look`

### Task 11: Full screenshot set and before/after

**Files:**
- Modify: `docs/superpowers/specs/2026-11-01-s17-visual-overhaul.md` (Before / after section)
- Create: `docs/superpowers/specs/s17-after/` (the same 26 file names as `s17-before/`)

- [ ] **Step 1:** `pnpm screenshots`; copy the 26 shots named in `s17-before/` from `.screenshots/` to `s17-after/`.
- [ ] **Step 2:** Fill the Before / after section: one line per screen, `![before](s17-before/light-today.png) ![after](s17-after/light-today.png)` style pairs (light and dark).
- [ ] **Step 3:** `pnpm verify` green; the Task 1 grep prints nothing.
- [ ] **Step 4: Commit** `docs: S17 before/after screenshots`

Then the final whole-branch review (project `reviewer` agent, full screenshot set against the mockups), then the owner's phone and desktop check (criterion 6).

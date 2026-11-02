# S17 — Visual overhaul: design

Session S17 (slice 7), branch `s17-visual-overhaul`. Contract: `docs/SESSIONS.md` §S17; process: D-063. Brainstormed 2026-11-01 with the owner in the visual companion.

## Intent

The app should look like a finished product from a company, not a side project: calm, compact, quick to scan with morning coffee ("morning newspaper rather than flashy sportsbook"), with dark mode as a first-class theme (owner, `design-refs/notes.md`). The owner's references asked for five concrete things, all taken into the design:
- the game score as an object in its own right, not a small line above the players;
- a player's stats on Today as a small table of the few most important numbers, the rest on the game page;
- the box score as a scrollable table, player names tappable, the rest not;
- a scrollable strip of days instead of ‹ › stepping;
- "Latest" as a floating button that appears only when needed, instead of a permanent control.

Anti-goals (owner): animations or accents you notice; the amateur "card" look where a box just holds text running top to bottom.

## Scope ruling (owner, 2026-11-01)

> "i allow you to go past 'no behaviour change' rule, that was more meant to contain within existing api data and overall functionality, so the changes are mostly UI and no logic changes have to be implemented. To improve UI/UX you can go past this rule."

So: any UI/UX change the API's existing data supports is in, including changed texts and interactions (the day strip, the floating Latest, fewer stats on Today's card). Still out: server/API changes, new data, new features, changed rules (selection, ordering on the server, preferences, caching, D-055's kept day). Criterion 5 below is read through this ruling: existing tests change only where the new layout changes a text, role or label, never to make a broken behavior pass; the plan names every changed assertion.

## Mockups shown and the pick

1. **Three directions** (`.superpowers/brainstorm/…/directions.html`, gitignored): A "Scoreboard" (Barlow Semi Condensed, a dark score plate per game, amber), B "Morning Edition" (Schibsted Grotesk, no boxes, hairlines, Latvian carmine), C "First Light" (Instrument Sans, indigo and amber, rounded sheets, stacked teams).
2. **Owner's mix:** A's game box ("the color separation between game score and player list", contained in a box like A and C), a neutral color scheme like B ("basic colors with accent works better than full blue theme"), the day strip across the whole width like B and C, C's font.
3. **Mix v2** with three accents → **sunrise amber**; the header with "Today" small above the full date, and the floating Latest pill, confirmed.
4. **Token sheet and two icon sketches** → tokens approved; icon **ink field, amber sun** (owner's pick over my suggestion of the amber field, which stands out more on a dark wallpaper).

Approved mockups, the reference for every review: `docs/superpowers/specs/s17-mockups/` — `today-{light,dark}.png`, `player-{light,dark}.png` (owner-approved), `game-{light,dark}.png` (Claude's call in the same language; the owner sees it with this doc).

## Token set (approved)

Tokens live in `apps/mobile/src/tokens.ts`, which imports nothing from `react-native` (so Vitest loads it); `src/theme.ts` keeps `useTheme()` and picks the scheme.

**Color roles** (light / dark). Every text role except `textDisabled` reaches ≥ 4.5:1 on the backgrounds it's used on (computed 2026-11-01; lowest 5.4:1).

| Role | Light | Dark | Used for |
|---|---|---|---|
| background | `#F1F1EF` | `#131517` | screen |
| surface | `#FFFFFF` | `#1C1F22` | boxes, tab bar |
| plate | `#1D2024` | `#2B2F34` | score panel, player header |
| onPlate | `#F5F5F4` | `#F5F5F4` | text on plate |
| onPlateMuted | `#A2A7AF` | `#A8ADB4` | loser's score, status sub-line on plate |
| text | `#17191C` | `#ECEDEF` | primary text |
| textMuted | `#5B6068` | `#A2A7AF` | secondary text, column heads |
| textDisabled | `#A3A6AB` | `#5E6268` | disabled controls only (exempt) |
| border | `#E3E3E0` | `#2C3034` | hairlines between rows |
| accent | `#8C5200` | `#FFB547` | accent text, lines, icons, "your player" bar |
| accentFill | `#FFB547` | `#FFB547` | filled accent shapes (buttons, switch track) |
| onAccent | `#2A1700` | `#2A1700` | text/icons on accentFill |
| accentWash | `#FCEBCB` | `#3A2F1C` | active tab indicator, selected-row tint |
| inverse | `#1D2024` | `#ECEDEF` | floating Latest pill |
| onInverse | `#F5F5F4` | `#17191C` | text on inverse |
| thumb | `#FFFFFF` | `#FFFFFF` | switch thumb |
| danger | `#B3261E` | `#F2B8B5` | errors |

The contrast test checks: `text`, `textMuted`, `accent`, `danger` on `background` and `surface`; `onPlate` and `onPlateMuted` on `plate`; `onAccent` on `accentFill`; `onInverse` on `inverse`; `accent` and `text` on `accentWash`; both schemes. (The spec's "`onAccent` on `accent`" becomes `onAccent` on `accentFill`, the role it's drawn on.)

**Type:** Instrument Sans, static weights Regular 400, Medium 500, SemiBold 600, Bold 700, set by `fontFamily` (no `fontWeight`, so Android doesn't synthesize). Named styles (size / line height):

| Style | Size/LH | Weight | Used for |
|---|---|---|---|
| score | 30/34 | Bold, tabular | scores on plates (game page 34/38: `scoreLarge`) |
| title | 26/32 | Bold | page titles, player name |
| heading | 17/22 | SemiBold | section heads, team abbreviations on plates, Other games |
| body | 15/20 | Regular; `bodyStrong` SemiBold | rows, bios, tables |
| meta | 13/18 | Regular | status, sub-lines, captions |
| label | 12/16 | SemiBold | table column heads, tab labels, weekday in the strip |

All numbers in tables use `fontVariant: ['tabular-nums']` (check that the font carries `tnum`; if not, right alignment still holds the columns). Text follows the system font scale; nothing sets `allowFontScaling={false}`.

**Space** (4-pt): `xs 4, sm 8, md 12, lg 16, xl 24, xxl 32`. Screen gutter `md`, padding inside a box `lg`. **Radius:** `sheet 12` (boxes; a plate takes its box's top corners), `control 8` (search field, buttons), `full 999` (pill, tab indicator). **Elevation:** boxes flat, no shadow; one `float` shadow (`0 4px 14px rgba(0,0,0,0.25)` as `boxShadow`) for the Latest pill only. **Hairline:** 1 px `border`. **Motion:** `press 100`, `expand 200`, `pulse 900` ms; with the system's reduce-motion on, nothing animates (end state shown). **Touch target:** 48 minimum. **Content width:** 600 max, centered on wide windows. **Icon sizes:** 16 (inline), 22 (tab bar, header actions).

**Review against frontend-design's generic tells** (changes made before approval): (1) *SaaS card kit* — only games and page sections get a box; Other games, Settings lists and the box score are single grouped boxes with hairlines, boxes have no shadow or gradient, and radius differs by role; (2) *middot meta strings* — stat lines become tables, remaining meta lines use commas; the recap CLI keeps `lineText`; (3) *near-black with one bright accent* — dark mode has three distinct grey steps (background, surface, plate) and amber covers small areas only; (4) *label above a heading* — "Today" over the date stays (owner-approved; it names the tab). Not present: cream/serif/terracotta, broadsheet hairlines with zero radius, all-caps tracked labels, monospace data labels, "→" on links.

## New dependencies (approved with the token set)

- `@expo-google-fonts/instrument-sans` (0.4.2) — the typeface's static TTFs.
- `expo-font` — already in the tree through `expo` (~58.0.8); declared directly because the app imports it (`useFonts`).
- `@expo/vector-icons` — Ionicons, one set with outline and filled variants (☆/★, tab icons idle/active); works on Android, web and Expo Go. Installed with `npx expo install` for the SDK-matched version.

## Screens (the builder follows these; mockups win where they show it)

**Shared chrome.** Tab screens drop the navigator's header and draw their own: `meta` line + `title` (Today: "Today" over "Monday, March 16"; Search and Settings: just the title). Tab bar: surface background, hairline on top, Ionicons `calendar`/`search`/`options` (outline idle, filled active), label under the icon, active item in `accent` with an `accentWash` pill behind the icon. Stack pages (Player, Game): header on `background`, no shadow or hairline, a chevron-back icon, no visible title (the route `title` stays for the web document title and screen readers); the player page's Hide and ★ move into the header's right side. Wide windows: every screen's content in the centered 600 column; the tab bar spans the width with its items inside the same column.

**Today.**
- Header: "Today", the date as `title` (new `dayTitle`, e.g. "Monday, March 16"), then the **day strip**: calendar days, a window of 14 days before and after the shown date, horizontally scrollable, opening centered on the shown day. Each day is a button (weekday `label` over the day number `heading`) labelled `dayLabel` ("Mon, Mar 16") with `aria-selected` on the shown day; the shown day in `accent` with a 3 px underline. Tapping a day goes there (same `onGo` as today's stepper, so `?date=` and D-055 are untouched); the window re-centers on the new day. The ‹ › game-day buttons go; the empty-state jumps to the previous/next game day stay.
- **Scrolling (Claude's call):** "Today" and the date title scroll away with the list; the day strip sticks to the top (`stickyHeaderIndices`), so it's always reachable but costs little height at the largest font size. Pull to refresh works as today.
- **Days without games (Claude's call):** the strip makes "No games on {day}." easy to reach (Mondays, breaks, the off-season), and today that message has no way out. It gets the same jumps the other empty states use, from the response's `prevGameDate`/`nextGameDate`: "Previous game day" and/or "Next game day" buttons when they exist. `dayMessage` and its test change for this (named in the plan).
- **Latest pill:** floats above the tab bar, centered, `inverse` with the `float` shadow, text "Latest: Mon, Mar 23" plus a chevron, label "Latest game day"; shown only when the shown day isn't the latest; fades in/out (`expand`).
- **Game box:** a `plate` on top, then the rows on `surface`. Plate: away abbreviation + score on the left, home score + abbreviation on the right, the winner's score in `onPlate`, the loser's in `onPlateMuted`; in the middle the status (`statusLabel`: Final, Final/OT, Live, a start time, Postponed…) over the league. Scheduled/no-score games show the abbreviations without scores, the start time in the middle. Tapping the plate opens the game (existing label).
- **Rows as a table:** the server's row order is kept; a column header row appears wherever the kind changes (skater: G A +/- SOG TOI; goalie: SV/SA SV% GA DEC, "–" for a null save % or decision; basketball: PTS REB AST MIN — shooting moves to the game page). Name (`bodyStrong`) with the team abbreviation (`meta`, muted) in the first column; long names wrap. DNP, Not in lineup and upcoming rows have no stat cells: their text (`dnpText`, "Not in lineup", `upcomingText`) spans the stat columns, muted. Each row stays one button to the player page with today's labels. Stat column widths scale with the font scale so numbers never clip.
- **Other games:** a header row "Other games (n)" with a chevron-down/up icon, then one grouped box with a hairline row per game (league `label`, "BOS 3 – 4 NJD" `bodyStrong`, status `meta`), each row opening the game. Expanding fades the list in (`expand`). Still collapsed on each new day.
- **Banners** (refresh failed / offline, D-055): a `surface` box at the top of the list with `meta` text and an accent text button "Try again" where there's a retry. **Empty states** (`DayMessageCard`): a centered message in a box, the jump as an `accentFill` button. **Loading:** skeleton boxes shaped like a game box (plate + three rows) pulsing (`pulse`), static under reduce-motion. **Error:** `ErrorState` message plus an `accentFill` "Try again".

**Player page** (mockup `player-*.png`): one box whose top is a `plate` with the name (`title`, `onPlate`) and "Golden State, NBA, #8" (`meta`, `onPlateMuted`; "No team" when there's none), and below it the bio as label/value rows (Position, Age, Born, Nationality — "LVA (override)" when it differs from the birth country, as today). Season box: heading as today ("Regular season 2025-26", playoffs box when present), a 4-column grid of `label` over `heading`-size tabular values; "–" instead of "0.0" for FG%/3P%/FT% at 0 GP. Recent games: a table with the same columns as Today for the player's kind, first column the date (`bodyStrong`) over "GS 137 – 131 DAL, Final/OT" (`meta`); each row opens the game. Not found / error / loading as today, restyled.

**Game page** (mockup `game-*.png`): one box with a large plate (scores `scoreLarge`, status over league in the middle, the local start "Sat, Jan 17, 02:00" under it) and the period table below it on `surface` (header `label`, totals bold). Then one box per team, headed by the team abbreviation (`heading`), with no abbreviation repeated on the rows. Inside: a **Skaters** table and a **Goalies** table (basketball: one table), each with its own header row; your players first within each table (the server already sorts them first), marked with the 3 px `accent` bar; then DNP / Not in lineup rows with their text spanning. Tables have a fixed name column (names tappable to the player page) and horizontally scrollable stat columns showing every stat the line carries: skater G A PTS +/- SOG TOI PIM HIT BLK PPG ("–" when an optional stat is missing); goalie SV/SA SV% GA TOI DEC; basketball MIN PTS REB AST FG 3PT FT OREB DREB STL BLK TO PF +/-. A game without a box score shows the upcoming rows as on Today.

**Search:** title "Search"; the search field (`control` radius, search icon inside, `accent` border when focused, 2 px); results in one grouped box: name `bodyStrong`, meta "NHL, FLA, D, LVA" (commas instead of middots), Hide (eye-off icon + "Hide"/"Hidden") and ★ (`star-outline`/`star` in `accent`). Hidden players stay dimmed as today. Empty, no-match, error, offline: same texts, restyled.

**Settings:** title "Settings"; each section a `heading` above its own grouped box (Leagues switches with `accentFill` track and `thumb`; Countries with the search field, code `bodyStrong`, name + counts, a `checkmark` icon in `accent` when selected; Favorites and Hidden with Remove/Undo rows; About). **Install:** the same title style; its steps are a real sequence, so numbered.

## Brand

One source, `apps/mobile/assets/icon.svg`: an ink (`#1D2024`) field with an amber (`#FFB547`) half-sun on a light (`#F5F5F4`) horizon line and three short rays (the sketch in the token sheet, refined; the half-sun is cut with a clip path, not covered by a background-colored shape, so it works on the transparent foreground, monochrome and splash layers). The `icons` script (`apps/mobile/scripts/icons.ts`) renders from it: `icon.png` 1024, favicon 48, web `icon-192/512`, maskable 512, apple-touch 180, and new: Android adaptive **foreground** (the mark on transparent, inside the 66/108 safe zone), **background** (solid ink), **monochrome** (the mark in one color on transparent), and the **splash** image (the mark on transparent; splash background ink in both schemes). Its "exactly one `<text>`" guard becomes a guard for the mark's group. `app.json`: adaptive icon images from the script with `backgroundColor` `#1D2024`; `expo-splash-screen` `backgroundColor` `#1D2024`, the new splash image; `ios.icon` and `assets/expo.icon` removed (no App Store). Web: `manifest.json` `theme_color` and `background_color` `#1D2024`; `index.html` `theme-color` metas `#F1F1EF` (light) and `#131517` (dark).

## Left to the builder

Component boundaries (e.g. a `StatTable`, `Plate`, `DayStrip`, a themed text helper or spread styles), how fonts gate the first render (the root layout already renders nothing until prefs rehydrate; a font load error falls back to the system font rather than blocking), the pure helpers and their tests (`dayTitle`, the strip's day window, column definitions per stat kind), how the fade animations are built with `Animated`, a small reduce-motion hook, and the exact grep for criterion 2.

## Size

The spec's stop rule applies: if the plan passes ~1,500 changed lines or the context ~200K tokens, this session ends after tokens, shared components and brand, and the screens finish in a Resume session.

## Acceptance criteria (verbatim, §S17)

1. The design doc records the mockups shown, your pick, the token set, and each new dependency with why; you approved it.
2. Components take every color, size, radius and duration from the theme (a grep for hex colors and numeric font sizes in `apps/mobile/src` outside the theme finds nothing new); the contrast test passes for both schemes.
3. The full `pnpm screenshots` set is re-captured, and every screen and state follows the chosen direction in light and dark (the final reviewer compares with the mockups).
4. Icon, adaptive icon, splash, favicon and manifest icons come from the new source; `app.json` no longer references Expo's defaults.
5. No behavior change: the existing tests and screenshot flows pass without edits to what they assert, except the game-page text tweaks in scope (the plan names each changed assertion, e.g. `player-page.test.ts`'s `'0.0'`).
6. On your Android phone (Expo Go), in light and dark and at the largest font size, and in a desktop browser, the app looks right and nothing is clipped (you).
7. `pnpm verify` green.

(Criterion 5 as widened by the owner's ruling above.)

## Out of scope (verbatim, §S17)

New features, screens or behavior; changed texts beyond labels the new layout needs; logos, team logos and player photos (VISION §4.6); team colors (they'd need data per team from the server — park for v2); server or API changes; moving styling to a UI library (NativeWind, Tamagui, Gluestack, Paper) — style stays in `useTheme()` tokens; a dedicated desktop layout (VISION §5); translations; Play Store graphics (S11b).

(The first two items as widened by the owner's ruling above: UI/UX changes within the existing data are in.)

## Before / after

Each line: light before, light after, dark before, dark after (`pnpm screenshots`, 2026-11-02).

- **Today:** ![before](s17-before/light-today.png) ![after](s17-after/light-today.png) ![before](s17-before/dark-today.png) ![after](s17-after/dark-today.png)
- **Night, mixed rows:** ![before](s17-before/light-night-mixed.png) ![after](s17-after/light-night-mixed.png) ![before](s17-before/dark-night-mixed.png) ![after](s17-after/dark-night-mixed.png)
- **Upcoming:** ![before](s17-before/light-upcoming.png) ![after](s17-after/light-upcoming.png) ![before](s17-before/dark-upcoming.png) ![after](s17-after/dark-upcoming.png)
- **DNP:** ![before](s17-before/light-dnp.png) ![after](s17-after/light-dnp.png) ![before](s17-before/dark-dnp.png) ![after](s17-after/dark-dnp.png)
- **Empty past day:** ![before](s17-before/light-empty-past.png) ![after](s17-after/light-empty-past.png) ![before](s17-before/dark-empty-past.png) ![after](s17-after/dark-empty-past.png)
- **API down:** ![before](s17-before/light-api-down.png) ![after](s17-after/light-api-down.png) ![before](s17-before/dark-api-down.png) ![after](s17-after/dark-api-down.png)
- **Game, hockey:** ![before](s17-before/light-game-hockey.png) ![after](s17-after/light-game-hockey.png) ![before](s17-before/dark-game-hockey.png) ![after](s17-after/dark-game-hockey.png)
- **Game, basketball:** ![before](s17-before/light-game-basketball.png) ![after](s17-after/light-game-basketball.png) ![before](s17-before/dark-game-basketball.png) ![after](s17-after/dark-game-basketball.png)
- **Player, skater:** ![before](s17-before/light-player-skater.png) ![after](s17-after/light-player-skater.png) ![before](s17-before/dark-player-skater.png) ![after](s17-after/dark-player-skater.png)
- **Player, basketball:** ![before](s17-before/light-player-basketball.png) ![after](s17-after/light-player-basketball.png) ![before](s17-before/dark-player-basketball.png) ![after](s17-after/dark-player-basketball.png)
- **Search results:** ![before](s17-before/light-search-results.png) ![after](s17-after/light-search-results.png) ![before](s17-before/dark-search-results.png) ![after](s17-after/dark-search-results.png)
- **Settings:** ![before](s17-before/light-settings.png) ![after](s17-after/light-settings.png) ![before](s17-before/dark-settings.png) ![after](s17-after/dark-settings.png)
- **Install:** ![before](s17-before/light-install.png) ![after](s17-after/light-install.png) ![before](s17-before/dark-install.png) ![after](s17-after/dark-install.png)

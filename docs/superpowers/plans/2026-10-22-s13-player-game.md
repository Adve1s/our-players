# S13 — Player page + game page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** the player page (`/player/[id]`) and the game page (`/game/[id]`) with the full box score, reached from Today's cards, Search and the Settings lists, and loadable directly on web.

**Architecture:** the server's `/v1/games/{id}` rows become the full box score (`boxScoreRows` beside `gameDayRows`, `shown` per row in the contract). The app moves its tabs into a `(tabs)` group under a root Stack anchored on it; two new Stack screens render from pure helpers in `src/lib/` (Vitest) and the existing `PlayerRow`/card text. Screenshots prove each page.

**Tech Stack:** Hono + Drizzle on PGlite (tests), zod 4 contract in `packages/shared`, Expo Router 58 (Stack + Tabs, `unstable_settings.anchor`), React Native + react-native-web 0.21, TanStack Query 5, Zustand, Vitest, Playwright (screenshots).

**Spec:** `docs/superpowers/specs/2026-10-22-s13-player-game.md` — read it first; it holds the layouts, copy and the decisions this plan builds.

## Global Constraints

Acceptance criteria (verbatim, SESSIONS.md §S13):
1. Season-stats layout correct per kind (skater, goalie, basketball) — screenshots.
2. Game log: last 10, correct formatting; tapping a row opens that game.
3. Period table correct for regulation, OT and shootout hockey games and an OT basketball game.
4. Full box score: API tests over a fixture game return every stored line of both teams (DNP lines included) plus a shown player's "Not in lineup" row, with shown players first per team and marked, each group in `rank()` order; a game in a deselected league returns the full box score with nobody marked; a scheduled game returns its upcoming rows and no box score; screenshots of a hockey and a basketball box score.
5. Loading `/player/nhl-…` directly on web works.
6. `pnpm verify` green.

Out of scope (verbatim): anything team-based (v2).

Project rules that bind every task:
- The selection rule is `isShown` (`packages/shared/src/selection.ts`) — `shown` on a box-score row is `isShown(player, prefs)`, never re-derived.
- `apps/mobile` never imports `apps/server`; the app reads only `/v1` through `api` (`src/api/client.ts`) and TanStack Query hooks in `src/api/queries.ts` whose keys include what they depend on.
- Preferences change only through the store actions (`toggleFavorite`, `toggleHidden`).
- Style only via `useTheme()` tokens (no hard-coded colours or font sizes); touch targets ≥ 48 px (`t.space.xl * 2`); every pressable has `accessibilityRole` and `accessibilityLabel`; state in `aria-*` props.
- Every screen handles loading, error, offline (`fetchStatus === 'paused'` with nothing cached → `ErrorState`) and empty states.
- Route files use `export default`; everything else named exports, kebab-case files.
- Fixtures are never edited; tests never touch the network. API tests seed through `test/api-seed.ts`.
- Framework APIs: look them up with context7 first (Expo Router `unstable_settings.anchor` already confirmed for SDK 58: `export const unstable_settings = { anchor: '(tabs)' }` in the root Stack layout).
- No new dependency.
- `pnpm verify` green before every commit; Conventional Commits ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Owner answer: IDs in the request-log path stay (no logging change).

## Review Focus

1. A malformed `id` in the URL (`/player/abc`, `/game/`) — the not-found message, no request, no crash (pinned in Task 2 `pageId` tests; seen in Task 3/4 not-found shots).
2. A goalie season row without `savePct` (no shots faced) and an NBA row with `gamesPlayed: 0` — "–", never `NaN` or a crash (pinned in Task 2 `seasonCells` tests).
3. A live game: the period table's total is the current score, and a period table with no periods (`[]`) is not drawn (pinned in Task 2 `periodTable` tests).
4. A player hidden by the owner who played in the game — still in the box score, unmarked (pinned in Task 1's API test).
5. Pref change while a game page is open (star someone on a player page, go back) — the game page refetches without falling back to the skeleton, and a different game ID never shows the previous game (`useGame` placeholder, Task 3; checked in Task 4's `flow-game-to-player` going back).

---

### Task 1: Full box score on `/v1/games/{id}`

**Files:**
- Modify: `packages/shared/src/contract/responses.ts`, `packages/shared/src/contract/index.ts` / `packages/shared/src/index.ts` (exports, if not re-exported by `*`)
- Modify: `apps/server/src/game-day-rows.ts`, `apps/server/src/api/day.ts`
- Modify: `apps/server/test/api-seed.ts` (new `seedMixedNight`), `apps/server/scripts/screenshot-api.ts` (calls it)
- Test: `apps/server/test/api-days.test.ts` (`GET /v1/games/:gameId` block), `apps/server/test/api-upcoming.test.ts`, `apps/server/test/game-day-rows.test.ts`, `packages/shared/test/contract.test.ts`

**Interfaces — Produces:**
```ts
// packages/shared contract
export const boxScoreRowSchema; // playerRowSchema.and(z.object({ shown: z.boolean() }))
export type BoxScoreRow = PlayerRow & { shown: boolean };
// gameResponseSchema: gameSummary + { rows: BoxScoreRow[]; periodScores: {period,away,home}[] | null }
//   (no longer extends dayGameSchema's rows)
// apps/server/src/game-day-rows.ts
export function boxScoreRows(
  day: { games: DayGame[]; lines: DayLine[]; players: DayPlayer[] },
  game: DayGame,
  prefs: Prefs,
): (DayRow & { shown: boolean })[];
// apps/server/test/api-seed.ts
export async function seedMixedNight(handle: DbHandle): Promise<void>; // NHL results 2026-03-16: BOS@NJD + PIT@COL
```

Rules (spec "Server: the box-score contract"): every line of the game (played → `line`, not played → `dnp`) for every player; plus `not-in-lineup`/`upcoming` rows for shown players only, by the exact rule `gameDayRows` uses today — extract that per-player body into one helper both call, don't copy it. Order: away first; within a team shown before not shown; within each group `rank()` then public ID. `gameDayRows` output must not change (its tests stay untouched).

- [ ] **Step 1: Write the failing tests**

`api-days.test.ts`, `describe('GET /v1/games/:gameId')` — replace "returns the game with … shown rows" and "a game in a deselected league is still returned, without rows" (D-049 says these change) with:
- `CBJ@PIT (nhl-2025020760) returns every stored line of both teams plus Girgensons' not-in-lineup row` — `?countries=LVA`; the `line`/`dnp` rows' player IDs equal the set of `stat_lines` rows stored for that game (query `handle.db`), and the only other row is `{ type: 'not-in-lineup', player.id: GIRGENSONS, side: 'away' }`.
- `shown players come first in their team and are the only ones marked` — CBJ (away) rows start `[MERZLIKINS, GIRGENSONS]` with `shown: true`; PIT (home) rows start `[SILOVS]` with `shown: true`; every other row `shown: false`.
- `each group keeps rank() order` — for each (side, shown) group: played skater lines by points descending, then goalie lines, then `dnp`, then `not-in-lineup`; equal keys by player ID ascending.
- `a hidden player who played is listed, unmarked` — `?countries=LVA&hide=nhl-8478007`: Merzļikins' line is present with `shown: false`, and CBJ's first row is Girgensons.
- `GS@DAL (nba-401810899) includes DNP lines and marks Porziņģis first in GS` — `?countries=LVA`: a `dnp` row for LEONS with reason `"COACH'S DECISION"`; the first `away` row is PORZINGIS, `shown: true`.
- `a game in a deselected league returns the full box score with nobody marked` — `nba-401810839?countries=LVA&leagues=NHL`: row count equals that game's stored line count; every `shown` is false.
- `it.each` period labels: `nhl-2025021067` → `['1','2','3']`, `nhl-2025021064` → `['1','2','3','OT']`, `nhl-2025020760` → `['1','2','3','OT','SO']`, `nba-401810899` → `['Q1','Q2','Q3','Q4','OT']` (the two 2026-03-16 NHL games need `seedMixedNight(handle)` in this file's `beforeAll`).
- Keep "a schedule-only game has no period scores and no rows" and the 404 test.

`api-upcoming.test.ts` (has `seedUpcoming`): `a scheduled game returns its upcoming rows and no box score` — `/v1/games/nhl-2026020119?countries=LVA`: `periodScores` null, rows exactly `[{ type: 'upcoming', side: 'away', player.id: SILOVS, shown: true }]`.

`game-day-rows.test.ts`: two pure cases over the file's existing builders — `boxScoreRows lists an unshown player's line` and `boxScoreRows gives an unshown player of the team no not-in-lineup row`.

`packages/shared/test/contract.test.ts`: `gameResponseSchema rejects a row without shown`.

- [ ] **Step 2: Run them and watch them fail for the right reason**

Run: `pnpm test api-days api-upcoming game-day-rows contract`
Expected: the new cases FAIL (missing `shown`, rows only of shown players, `boxScoreRows` not exported); the untouched `/v1/days` tests PASS.

- [ ] **Step 3: Implement** the contract, `boxScoreRows`, `loadGame` (rows = `boxScoreRows(data, stored, prefs)` mapped through `playerRow` plus `shown`; summary fields as today), and `seedMixedNight` (move `mixedScore` + the results run out of `screenshot-api.ts`; the score day keeps games `2025021064` and `2025021067`; both box scores from fixtures). `screenshot-api.ts` calls `seedMixedNight(handle)` instead of its inline run.

- [ ] **Step 4: Run** `pnpm test api-days api-upcoming game-day-rows contract recap` — all PASS; then `pnpm verify` — green.

- [ ] **Step 5: Commit** — `feat(api): full box score on /v1/games, shown players first and marked`

---

### Task 2: Pure page helpers (mobile)

**Files:**
- Create: `apps/mobile/src/lib/player-page.ts`, `apps/mobile/src/lib/game-page.ts`
- Test: `apps/mobile/test/player-page.test.ts`, `apps/mobile/test/game-page.test.ts`

**Interfaces — Produces:**
```ts
// player-page.ts
export type Cell = { label: string; value: string };
export function seasonCells(entry: SeasonStatsEntry): Cell[];
export function seasonHeading(entry: SeasonStatsEntry): string; // "Regular season 2025-26" | "Playoffs 2025-26"
export function age(birthDate: string, today: string): number;    // whole years, both YYYY-MM-DD
export function bioLines(p: PlayerResponse, today: string): string[];
export function logCaption(entry: GameLogEntry, locale?: string, timeZone?: string): string;
export function logLines(entry: GameLogEntry): string[];
// game-page.ts
export function pageId(raw: string | string[] | undefined): PublicId | null; // publicIdSchema, else null
export type PeriodTable = { labels: string[]; rows: { abbrev: string; cells: string[] }[] };
export function periodTable(game: GameResponse): PeriodTable | null;
export type BoxSection = { side: 'away' | 'home'; abbrev: string; rows: BoxScoreRow[] };
export function boxSections(game: GameResponse): BoxSection[];
export function gameWhen(game: GameResponse, locale?: string, timeZone?: string): string;
```

Values (spec "Player page", "Game page"):
- `seasonCells` labels in order — skater `GP G A PTS +/- SOG TOI/GP` (`signed`, `toi(Math.round(toiPerGameSeconds))`); goalie `GP W L OTL GAA SV% SO` (GAA `toFixed(2)`, SV% `savePct` or `–` when absent); basketball `GP MIN PTS REB AST FG% 3P% FT%` — MIN/PTS/REB/AST are `(total / gamesPlayed).toFixed(1)` when `basis === 'totals'` (the value itself `toFixed(1)` when `per_game`), `–` when `gamesPlayed === 0`; percentages `(pct * 100).toFixed(1)`.
- `bioLines`: `[team abbrev or 'No team', league, position, '#'+jersey when not null].join(' · ')`; then `Age N` and `Born <city>, <country>` (whatever is known) joined by ` · `, line left out when both unknown; then `Nationality LVA` + ` (override)` when `nationalitySource === 'override'`, left out when nationality is null.
- `logCaption`: `${dayLabel(game.gameDate)} · ${scoreText(game)} · ${statusLabel(game, locale, timeZone)}`; `logLines`: `lineText(line)` or `[dnpText(reason)]`.
- `periodTable`: null when `periodScores` is null or empty; `labels = [...periods, 'T']`; rows away then home; total = the team's game score (sum of periods if score null).
- `boxSections`: away then home, rows in server order; a side with no rows left out.
- `gameWhen`: `${dayLabel(gameDate)} · ${startTime(startTimeUtc, gameDate, locale, timeZone)}`.

- [ ] **Step 1: Write the failing tests** — `it.each` tables with exact strings, contract-shaped inputs built inline:
  - `seasonCells`: one skater row (e.g. 82 GP, plusMinus −3 → `-3`, toiPerGameSeconds 1112.4 → `18:32`), one goalie with `savePct: 0.9154` → `.915` and GAA 2.456 → `2.46`, a goalie without `savePct` → `–`, a basketball totals row (GP 50, points 1003 → `20.1`, fgPct 0.4531 → `45.3`), basketball GP 0 → `–` for MIN/PTS/REB/AST.
  - `seasonHeading` REG/POST; `age`: day before / on / after the birthday; `bioLines`: full player, free agent without jersey → `No team · NHL · D`, override marked, nationality null → no nationality line, no birth data → no age/born line.
  - `logCaption` for a FINAL/OT line entry (`Mon, Mar 23 · GS 137 – 131 DAL · Final/OT`), `logLines` for a skater line and a DNP with reason `"COACH'S DECISION"` → `DNP — Coach's decision`.
  - `pageId`: `'nhl-8478007'` → id; `'abc'`, `['nhl-1','nhl-2']`, `undefined` → null.
  - `periodTable`: regulation `1 2 3 T`; OT `1 2 3 OT T`; shootout (`1,2,3,OT,SO`, CBJ 4 – 3 PIT, SO cells 1/0) → totals `4`/`3`; NBA OT `Q1–Q4 OT T` with totals 137/131; a LIVE game after 2 periods → total = current score; `[]` and `null` → null.
  - `boxSections`: away first; an upcoming game with rows only for home → one section.
  - `gameWhen` with `en-GB`/`Europe/Riga`: `Mon, Mar 16 · Tue 01:00`-style string for a start on the next local day (use a real start from the seed, e.g. 2026-03-16T23:00:00Z → `Mon, Mar 16 · Tue 01:00`).
- [ ] **Step 2: Run** `pnpm test player-page game-page` — FAIL (modules missing).
- [ ] **Step 3: Implement** both modules, reusing `dayLabel`, `scoreText`, `statusLabel`, `startTime` (`src/lib/format.ts`) and `lineText`, `dnpText`, `savePct`, `signed`, `toi`, `publicIdSchema` (`@our-players/shared`).
- [ ] **Step 4: Run** `pnpm test player-page game-page` — PASS; `pnpm verify` green.
- [ ] **Step 5: Commit** — `feat(mobile): pure helpers for the player and game pages`

---

### Task 3: Stack routes, navigation, player page

**Files:**
- Move (`git mv`): `apps/mobile/src/app/{index,search,settings}.tsx` → `apps/mobile/src/app/(tabs)/`
- Create: `apps/mobile/src/app/(tabs)/_layout.tsx` (the Tabs, unchanged from today's root), `apps/mobile/src/app/player/[id].tsx`, `apps/mobile/src/components/mark-button.tsx` (`MarkButton`), `apps/mobile/src/components/caption.tsx` (`Caption`), `apps/mobile/src/components/skeleton.tsx` (Today's `Skeleton` moved, reused by both pages)
- Modify: `apps/mobile/src/app/_layout.tsx` (root `Stack`, providers kept, `export const unstable_settings = { anchor: '(tabs)' }`, `(tabs)` with `headerShown: false`, header colours from the theme), `src/api/queries.ts`, `src/components/game-card.tsx`, `src/components/player-row.tsx`, `src/components/player-item.tsx`, `src/app/(tabs)/search.tsx` and `settings.tsx` (use the extracted `MarkButton`/`Caption`)
- Modify: `apps/mobile/scripts/screenshots.ts`

**Interfaces:**
- Consumes: Task 2's `pageId`, `seasonCells`, `seasonHeading`, `bioLines`, `logCaption`, `logLines`; `api.player(id)`, `api.game(id, prefs)` (`@our-players/shared` client).
- Produces:
```ts
// src/api/queries.ts
export const usePlayer: (id: PublicId | null) => UseQueryResult<PlayerResponse>; // key ['player', id], enabled when id
export const useGame: (id: PublicId | null, prefs: StoredPrefs) => UseQueryResult<GameResponse>;
//   key ['game', id, leagues, countries, favorites, hidden]; placeholderData keeps prev only when prevQuery.queryKey[1] === id
// components
export function PlayerRow(props: { row: PlayerRowType; status: GameStatus; team: string; marked?: boolean }): JSX.Element;
//   pressable → router.push(`/player/${row.player.id}`); label = rowLabel(...) + (marked ? ', your player' : '');
//   marked → accent bar on the left edge (borderLeftWidth 3, t.colors.accent, padding to match)
export function MarkButton(props: { label: string; checked: boolean; onPress: () => void; children: ReactNode }): JSX.Element;
export function Caption(props: { children: ReactNode }): JSX.Element;
export function Skeleton(): JSX.Element;
```
- `GameCard`: its header row becomes a `Pressable` (`accessibilityRole="button"`, label = today's label + `, open game`) → `router.push(`/game/${game.id}`)`. `PlayerItem`: the name/meta block becomes a `Pressable` (label `Open <full name>`) → `/player/{id}`; the children (★/Hide/Remove) stay outside it.
- Player page (`player/[id].tsx`) per spec "Player page": bio card with ★ (`Favorite <name>`) and Hide (`Hide <name>`) `MarkButton`s as in Search; season blocks as a wrapping grid, four cells per row (`width: '25%'`), label (`Caption`) above value; "No season stats yet."; "Recent games" card, each row a `Pressable` (label `<logCaption>, <rowLabel-like text>, open game`) → `/game/{id}`; "No games yet."; header title via `<Stack.Screen options={{ title }} />` — "Player" until loaded, then the full name. States: `pageId` null or `ApiError` with status 404 → "No such player." (no Try again); no data + error/paused → `ErrorState`; else `Skeleton`. Today = `localDate(new Date())`.

- [ ] **Step 1: Restructure routes and the root Stack; run `pnpm screenshots`** (`PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium pnpm screenshots`) — every existing shot still passes (URLs `/`, `/search`, `/settings` unchanged). If local `pnpm typecheck` fails on stale `.expo/types` route types, regenerate them by running the Expo export/start once and note it as a ruling (CI has no generated types; `Href` is then a string).
- [ ] **Step 2: Add the queries, the extracted components, the pressables and the player page.**
- [ ] **Step 3: Add screenshot states** (spec "Screenshot states"): `player-skater` (`/player/nhl-8475810`, Rust: REG grid + log), `player-goalie` (`/player/nhl-8478007`), `player-basketball` (`/player/nba-3102531`), `player-override` (`/player/nba-3059318`, wait for `(override)`), `player-not-found` (`/player/nhl-1`, and `/player/abc` in `after`: "No such player."), `player-api-down` (route `/v1/players/*` aborted, as `search-api-down` does), `flow-search-to-player` (Search "porzingis", tap `Open Kristaps Porzingis`, wait for the season block), `flow-deep-link` (goto `/player/nhl-8478007` directly; the back arrow exists; tap it → Today's `Other games` visible) — AC5. Each waits for a specific text (a season label value or a log caption).
- [ ] **Step 4: Run `pnpm screenshots`, read every new PNG (light and dark)**; fix layout issues and re-run until the grid, the bio and the log read right at phone width.
- [ ] **Step 5: `pnpm verify`** green.
- [ ] **Step 6: Commit** — `feat(mobile): player page, stacked routes over the tabs, pressable cards and rows`

---

### Task 4: Game page

**Files:**
- Create: `apps/mobile/src/app/game/[id].tsx`, `apps/mobile/src/components/period-table.tsx`
- Modify: `apps/mobile/scripts/screenshots.ts`

**Interfaces:**
- Consumes: Task 2's `pageId`, `periodTable`, `boxSections`, `gameWhen`; Task 3's `useGame`, `PlayerRow` (`marked`), `Skeleton`, `Caption`; `scoreText`, `statusLabel`.
- Produces: `PeriodTable({ table }: { table: PeriodTable })` — fixed-width columns in a horizontal `ScrollView`, first column the abbrev, last `T` bold; `accessible` with a label like `CBJ 1, 2, 0, 0, 1, total 4; PIT …`.

Page per spec "Game page": header card (league `Caption`, `scoreText` at `t.font.title`, `statusLabel`, `gameWhen`); `PeriodTable` when `periodTable(game)` isn't null; one card per `boxSections` entry headed by the abbrev, rows as `PlayerRow` with `marked={row.shown}`; no sections → "No box score yet."; title `<Stack.Screen options={{ title }} />` "Game" then `scoreText`. States as the player page, "No such game.".

- [ ] **Step 1: Build the page and `PeriodTable`.**
- [ ] **Step 2: Add screenshot states:** `game-hockey` (`/game/nhl-2025020760?…` with default prefs: SO table, CBJ section starts with Merzlikins marked), `game-basketball` (`/game/nba-401810899`: Q1–Q4 + OT, Porzingis marked), `game-regulation` (`/game/nhl-2025021067`), `game-ot` (`/game/nhl-2025021064`), `game-upcoming` (`/game/nhl-2026020119`: "Not started" row for Silovs, no table), `game-not-found` (`/game/nhl-1`), `flow-today-to-game` (Today on `?date=2026-01-17`, tap the CBJ–PIT card header, wait for `SO`), `flow-game-to-player` (on the game page tap Merzlikins' row → player page; go back → the box score is there again without a skeleton), `flow-log-to-game` (Porzingis' page, tap the GS–DAL log row → `Final/OT` and the `OT` column). AC2–AC4.
- [ ] **Step 3: Run `pnpm screenshots`, read every new PNG**; fix and repeat until the table aligns and the box score reads well in both themes.
- [ ] **Step 4: `pnpm verify`** green.
- [ ] **Step 5: Commit** — `feat(mobile): game page with period table and full box score`

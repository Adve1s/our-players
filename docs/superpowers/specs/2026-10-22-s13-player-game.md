# S13 — Player page + game page — design

Spec: `docs/SESSIONS.md` §S13. Goal: the remaining v1 screens (VISION §4.4–§4.5).

## Contract (quoted from §S13)

**Out of scope:** anything team-based (v2).

**Acceptance criteria**
1. Season-stats layout correct per kind (skater, goalie, basketball) — screenshots.
2. Game log: last 10, correct formatting; tapping a row opens that game.
3. Period table correct for regulation, OT and shootout hockey games and an OT basketball game.
4. Full box score: API tests over a fixture game return every stored line of both teams (DNP lines included) plus a shown player's "Not in lineup" row, with shown players first per team and marked, each group in `rank()` order; a game in a deselected league returns the full box score with nobody marked; a scheduled game returns its upcoming rows and no box score; screenshots of a hockey and a basketball box score.
5. Loading `/player/nhl-…` directly on web works.
6. `pnpm verify` green.

## Server: the box-score contract

`/v1/games/{id}` keeps its URL and query (prefs), and its game summary and `periodScores`. Only `rows` changes:

- **Contract** (`packages/shared/src/contract/responses.ts`): `gameResponseSchema.rows` becomes `boxScoreRowSchema[]` = `playerRowSchema` + `shown: boolean`. `/v1/days` rows don't change (every day row is shown). Additive for the game response's old readers: none exist yet (no app build ships before S11b).
- **Which rows** (`boxScoreRows` in `apps/server/src/game-day-rows.ts`, beside `gameDayRows`; same per-player rule, extracted once): every stored line of the game, both teams — played → `line`, not played → `dnp` — for any player, shown or not; plus, for shown players only, the `not-in-lineup` and `upcoming` rows exactly as `gameDayRows` makes them (same "line elsewhere that day" guard, same current-team shortcut). `shown` = `isShown(player, prefs)`; a game in a deselected league therefore returns every line with `shown: false` everywhere (D-049 replaces D-044's empty rows). A game without a stored box score has no lines, so it returns exactly the day's upcoming rows, all `shown: true`; `periodScores` stays `null` for a schedule-only game.
- **Order:** away team first; within a team, shown rows first, then the rest; within each of those two groups the `rank()` order (skaters and basketball players by points, goalies, DNP, not in lineup, upcoming), ties by public ID.
- `loadGame` keeps loading the whole day through `loadRecap` and swaps `dayGames(...).find(...)`'s rows for `boxScoreRows`.
- **Tests** (`api-days.test.ts` `/v1/games` block, rewritten as D-049 says): over CBJ@PIT 2026-01-17 (NHL, shootout) with `countries=LVA` — the rows are every stored line of the game (count and IDs checked against the `stat_lines` table) plus Girgensons' `not-in-lineup` row (CBJ, the seed's existing case), Merzļikins and Girgensons marked and first in CBJ, nobody else marked, each group in points order with goalies after skaters; over GS@DAL 2026-03-23 (NBA, OT) — DNP lines included (Leons' "COACH'S DECISION" among them) and Porziņģis marked first in GS with `countries=LVA`; `leagues=NHL` on an NBA game → all rows, none marked; `nhl-2025021120` (scheduled) → upcoming rows only, `periodScores: null`. Period labels per stored game: `1,2,3` (PIT@COL 2026-03-16), `1,2,3,OT` (BOS@NJD 2026-03-16), `1,2,3,OT,SO` (CBJ@PIT 2026-01-17), `Q1–Q4,OT` (GS@DAL 2026-03-23). The two 2026-03-16 NHL games come from a `seedMixedNight()` in `test/api-seed.ts` (today inlined in `scripts/screenshot-api.ts`, which then calls it; it gains BOS@NJD, so the 2026-03-16 screenshots show one more "Other game").

## App: routes and navigation

```
src/app/_layout.tsx          Stack (providers, theme, header styling); unstable_settings = { anchor: '(tabs)' }
src/app/(tabs)/_layout.tsx   the Tabs, moved unchanged from today's root layout
src/app/(tabs)/index.tsx     Today   (git mv)
src/app/(tabs)/search.tsx    Search  (git mv)
src/app/(tabs)/settings.tsx  Settings (git mv)
src/app/player/[id].tsx      Player page
src/app/game/[id].tsx        Game page
```

URLs stay `/`, `/search`, `/settings` (a group isn't a URL segment). The two pages are Stack screens over the tabs with a header (back arrow; title "Player"/"Game", then the name or the score once loaded). Navigation is `router.push`:

- Today: a game card's header (league · score · status) → `/game/{id}`; each player row on it → `/player/{id}`. Same in "Other games".
- Search results and the Settings Favorites/Hidden rows (`PlayerItem`): the name block → `/player/{id}`; ★/Hide/Remove keep their own targets.
- Player page: a game-log row → `/game/{id}`. Game page: a box-score row → `/player/{id}`.

Every pressable gets a `accessibilityRole="button"` and a label (the card's existing label plus ", open game" / the row label). The `id` param is checked with `publicIdSchema`; a malformed ID shows the not-found state without a request.

**Queries** (`src/api/queries.ts`): `usePlayer(id)` key `['player', id]` (the endpoint takes no prefs); `useGame(id, prefs)` key `['game', id, leagues, countries, favorites, hidden]`, keeping the previous data only while the ID is the same (a pref change refetches without a skeleton flash; a new game never shows the old one).

**States** (both pages): loading skeleton; error with Try again (`ErrorState`, which also covers offline: a paused query with nothing cached reads as "can't reach", as on Today); a 404 → "No such player." / "No such game." without Try again; loaded data stays on screen if a background refetch fails.

## Player page

Top to bottom, in one ScrollView, cards like Today's:

1. **Bio card:** name (large); `PIT · NHL · C · #71` (team abbrev or "No team", league, position, jersey when known); `Age 33 · Born Riga, LVA` (age from `birthDate` and today's local date; parts missing in the data are left out); `Nationality LVA`, plus "(override)" when `nationalitySource === 'override'`. ★ and Hide on the card's edge, the Search row's pair (`toggleFavorite`/`toggleHidden`); `MarkButton` and `Caption` move to `src/components/` (the parking lot's "extract on the third copy").
2. **Season stats:** one block per entry the API returns (REG first, then POST), headed "Regular season 2025-26" / "Playoffs 2025-26". Each block is a grid of label-over-value cells, four per row, wrapping (holds at a large font scale):
   - hockey skater: GP · G · A · PTS / +/- · SOG · TOI/GP — `+/-` signed, TOI/GP as `m:ss` from `toiPerGameSeconds` (rounded).
   - hockey goalie: GP · W · L · OTL / GAA · SV% · SO — GAA two decimals, SV% `.915` (`savePct`), "–" when absent.
   - basketball (per game): GP · MIN · PTS · REB / AST · FG% · 3P% · FT% — the stored rows are ESPN's season totals (`basis: 'totals'`, D-043), so MIN, PTS, REB, AST are total ÷ GP in the app, one decimal (what ESPN's own `avg*` fields show); percentages one decimal without the sign (`45.3`). GP 0 → "–".
   No entries → "No season stats yet."
3. **Recent games:** the API's last 10 (newest first). Each row: caption `Mon, Mar 16 · PIT 7 – 2 COL · Final` (`dayLabel`, `scoreText`, `statusLabel`), then the same text as Today's cards (`lineText`, or `dnpText`). Pressable → that game. None → "No games yet."

Pure helpers in `src/lib/` (Vitest): `seasonCells(entry)` → `{ label, value }[]` per kind, `age(birthDate, today)`, `bioLines(player)`.

## Game page

1. **Header card:** league caption; the score large (`scoreText`); status (`statusLabel`); `Mon, Mar 16 · 02:00` (`dayLabel(gameDate)` · `startTime`, which shows the local weekday when the local date differs, as on Today).
2. **Period table** (only when `periodScores` is non-empty): header row = blank, each stored period label, `T`; one row per team, away first, abbrev then goals/points per period, then the game's final score. Hockey shows `1 2 3` (+ `OT`, `2OT`…, `SO`); basketball `Q1–Q4` (+ `OT`…) — the labels come from the server as stored, so one table serves both sports. Fixed-width columns in a horizontal ScrollView, so a 4OT playoff game still fits. `periodTable(game)` in `src/lib/` builds the columns (tests: regulation, OT, shootout, NBA OT, a live game whose total is the current score).
3. **Box score:** one section per team, away first, headed by the abbrev. Each row is today's `PlayerRow` (name, then the card text: hockey skater `1 G · 1 A · +2 · 4 SOG · 18:32`, goalie `28/30 · .933 · 2 GA · W`, basketball the two lines, DNP "DNP — reason", "Not in lineup", the upcoming text). Shown rows come first and carry an accent bar on their left edge; their screen-reader label ends ", your player". Hockey: skaters by points, then goalies, DNP, not in lineup; basketball: players by points, DNP, not in lineup — both are the server's order, rendered as is. A game with no rows says "No box score yet." (scheduled/postponed with none of your players).

Why the card text, not a column table: the same lines as Today (one formatter, one accessibility label), and it holds at any font scale on a 360 px phone; a basketball table needs 7 numeric columns beside the name. A columns table can follow if the long list reads badly on the phone.

## Deep links on web

Expo Router maps the URL to the route on load, so `/player/nhl-8478007` and `/game/nhl-2025020760` render directly; `anchor: '(tabs)'` puts Today under them, so a reloaded or shared page still has a back arrow to Today. The web build is a single-page app (`web.output: "single"`): the server must answer unknown paths with `index.html` — `expo start` and the screenshot server already do; S14a's static host needs the same (noted for S14a). The root layout keeps rendering nothing until prefs rehydrate (the router mounts after; nothing navigates imperatively at startup).

## Screenshot states (light + dark each)

Loaded by URL unless it says flow:

- `player-skater` (a Penguins skater with REG stats and a log), `player-goalie` (Merzļikins), `player-basketball` (Porziņģis), `player-override` (Embiid, nationality marked override) — AC1.
- `player-not-found` (`/player/nhl-1`), `player-api-down`.
- `game-hockey` (CBJ@PIT: period table with OT and SO, full box score, Latvians marked), `game-basketball` (GS@DAL: Q1–Q4 + OT, Porziņģis marked), `game-regulation` (PIT@COL), `game-upcoming` (a 2026-10-16 FUT game: upcoming rows, no period table), `game-not-found` — AC3, AC4.
- Flows: `flow-today-to-game` (tap the CBJ@PIT card on Today), `flow-game-to-player` (tap Merzļikins in the box score), `flow-log-to-game` (tap a log row) — AC2; `flow-search-to-player`; `flow-deep-link` (load `/player/nhl-…` directly, check the page and the back arrow, tap back → Today) — AC5.

## Decisions made here (Claude's calls)

- `shown` on box-score rows only, not on day rows.
- Box score as card-text rows with an accent bar for your players (above).
- Season stats as a four-per-row grid; TOI/GP from the source's float rounded to seconds; NBA percentages one decimal.
- NBA per-game values divided in the app from the source's totals and games played, not stored (no server or adapter change). Rule 5 forbids season stats computed from game logs; this is arithmetic on the source's own season row. Storing ESPN's `avg*` fields stays possible later (D-043).
- 404 has its own message without Try again.
- The game query keeps old data only for the same game ID.
- Pressable targets: the card header for a game, each row for a player, the name block in list rows.

## Owner answers (2026-10-22)

- PROGRESS's S07 question: a player-page or game-page view puts the ID in the request-log path (`/v1/players/nba-3102531`, `/v1/games/…`). Kept as is: a viewed page is not a stored preference; favorites and hidden travel only in the never-logged query string.
- The design and the calls above: approved.

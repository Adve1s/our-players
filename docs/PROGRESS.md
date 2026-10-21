# Progress

Read this first in every session. **Current state** is rewritten at each `/handoff`; the sections below it are append-only.

## Current state
- **Last session:** S12 — Search, favorites, hidden, 2026-10-21. The Search tab finds any player of the selected leagues (debounced 300 ms, 2–50 characters, `/v1/players/search`); each result has a large ★/☆ on the row's edge (the main action) and a small muted Hide/Hidden (a hidden player's name dims). Settings gains Favorites and Hidden cards (via `/v1/players?ids=`, sorted by last name) with Remove; a removed row stays dimmed with Undo until you leave Settings. Favorites and hidden stay disjoint (`setMark`), each capped at 200; Today follows on its own (`useDay`'s key holds both lists). A deselected league's players are gone from Search and both lists (still stored; back with the league). One malformed stored ID now drops only itself.
- **Branch / PR:** `s12-favorites` → `main`, PR #19, with the `/code-review` fixes (owner merges once CI passes).
- **What works:** `pnpm verify` (65 test files, 1330 tests). `pnpm screenshots` → 52 PNGs (26 states, light/dark; new: `search-empty`, `search-results`, `search-no-match`, `search-api-down`, `settings-lists`, `settings-undo`, `settings-lists-empty`, `flow-favorite`, `flow-hidden`) in `apps/mobile/.screenshots/`. Android (owner, Expo Go over LAN, 2026-10-21): starring Porziņģis with no countries shows him on Mon 16 Mar; hiding a Latvian takes him off Today, unhiding brings him back; screenshots reviewed. The Undo-on-Android fix and the star-first Search row (0cede1a) came after that check and aren't rechecked on the phone yet.
- **How to try it:** `pnpm dev:server` and `pnpm dev:mobile` → `w`, or Expo Go with `EXPO_PUBLIC_API_URL=http://<LAN-IP>:3001` in `apps/mobile/.env` (`ip -4 -brief addr show scope global`). Search "porzingis", tap ☆, untick every country in Settings, step Today to Mon 16 Mar. Screenshots: `PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium pnpm screenshots`. Tests: `pnpm test prefs players search-queries`.
- **Next session:** S10a — Hosting choice + upstream probe is still open (S12 ran before it; D-048 order otherwise unchanged: S10a → S13 → S14a, then launch S10b → S14b → S11b → S15), with the small Today fix below. S13 can go first if the owner prefers; nothing in it needs S10a. S11a runs whenever Play Console finishes verifying the owner's identity.
- **Small Today fix to slot into S10a (owner, 2026-10-21; decided by Claude on the owner's say-so):** a day stepped to with ‹/› that can't load keeps the old day on screen, with Latest working, and says which day didn't open: "You're offline — couldn't open Mon 16 Mar." (`dayLabel`) or "Couldn't load Mon 16 Mar." with Try again. Today it differs by platform: offline on web the step pauses, the old day stays under the plain offline banner with its label unchanged and ‹/› grey, so the tap looks ignored; on Android (no NetInfo) the fetch fails, the placeholder is dropped and "Try again" replaces the whole screen, stepper included. Where: `refreshBanner` (`apps/mobile/src/lib/day-message.ts`, case `day.isPlaceholderData` + paused/error) and the `!day.data` branch of `apps/mobile/src/app/index.tsx` (keep the last shown day when the step fails, e.g. remember it in a ref). Red/green in `apps/mobile/test/today-queries.test.ts` with real observers. Kept the old day rather than an empty screen: it is real, saved data and Latest leads back.
- **Notes for the next sessions:**
  - **App layout:** routes `src/app/` (flat tabs; S13 wraps them when the first stacked page arrives), API hooks `src/api/queries.ts` (`useCountries`, `useMeta` key `['meta']`, `useDay` key `['day', date, leagues, countries, favorites, hidden]`, `useSearch` key `['search', term, leagues]`, `usePlayers` key `['players', ids]`), prefs `src/state/` (`markOf`, `setMark`, `toggleFavorite`, `toggleHidden`), pure helpers `src/lib/` (`format.ts`, `day-message.ts`, `players.ts`: `searchTerm`, `searchView`, `playerMeta`, `listRows`, `listIds`; tests in `apps/mobile/test/`), components `src/components/` (`GameCard`, `PlayerRow`, `DayStepper`, `OtherGames`, `DayMessageCard`, `ErrorState`, `SearchField`, `PlayerItem`). Style only via `useTheme()` tokens. The root layout renders nothing until prefs have rehydrated.
  - **S13 hooks in:** cards and rows aren't pressable yet; `GameCard`, `PlayerRow` and `PlayerItem` (Search and Settings rows) are where navigation goes; the player page's star/hide reuse `toggleFavorite`/`toggleHidden`. `/v1/games/{id}` already returns upcoming rows for a game without a box score.
  - **keepPreviousData and offline:** with `placeholderData: keepPreviousData` a new key starts as success with `isPlaceholderData`, not pending, so "offline" is `fetchStatus === 'paused' && (isPending || isPlaceholderData)` (`searchView`, the Settings lists).
  - **Undo** lives in Settings' screen state (`removed: Map<id, previous mark>`), cleared on blur (`useFocusEffect`); read external state before a React state updater, never inside it (0cede1a).
  - **Text:** v1 is English-only (owner): `dayLabel` and the next-day weekday use fixed English names; only the 12/24 h clock follows the phone. Shared card text (`lineText`, `finalLabel`, `upcomingText`, `dnpText`) is used by both the app and `pnpm recap`.
  - **HTTP cache (D-051):** day and game responses send `public, max-age=0, s-maxage=60`; TanStack Query is the app's only cache (`retry: 1`, `staleTime` 5 min, in memory only). Every request aborts after 10 s. No NetInfo: on Android an offline fetch fails and shows the error.
  - **Accessibility on web:** react-native-web 0.21 ignores `accessibilityState`; use `aria-*` props.
  - **Screenshots:** `apps/server/scripts/screenshot-api.ts` seeds `seedApiDb()` + `seedUpcoming()` + a 2026-03-16 PIT@COL results run; fixed clock 2026-03-24T12:00Z, port 3101; contexts use `Europe/Riga` and `en-GB`; non-default prefs are written to `localStorage` before load. The flows move between tabs through the tab bar; `shown`/`gone` skip aria-hidden subtrees (inactive tabs stay mounted).
  - The dev server always holds the PGlite lock (D-045): stop it before `pnpm job`, `recap`, `latency` or `db:*`.
  - pnpm 12 refuses package versions younger than 1 day (`minimumReleaseAge`); after mise installs a different Node, run `corepack enable && mise reshim` once.
- **Owner question (S07 final review, now for S13):** a player-page view puts the player's ID in the request-log path (`/v1/players/nba-3102531`); fine under "preferences are never logged"? S12 loads the lists through `?ids=` (query string, never logged), so it first matters for S13's player page.

## Known issues
- Flaky test: `apps/server/test/repositories.test.ts` "upsertPlayers > without a birth country nationality and its source are null" sometimes hits Vitest's 5 s timeout under a full `pnpm verify` (seen 2026-10-20 and 2026-10-21; reruns green). Likely a slow in-memory PGlite open under load; a longer timeout for that file or a shared DB per describe would fix it.

## Revisit for v2
Owner topics to look at once v1 (S00–S15) is done, when planning v2 changes. Only things no v1 session already changes.
- **Tab bar: text labels only, no icons** (S08). Icons would need `@expo/vector-icons` or similar.
- **Settings countries list** (S08): ticked countries first, then by player count across both leagues; substring search on code and shortest English name only; no flags.
- **Default when stored preferences are missing or invalid** (S08): falls back to Latvia + NHL + NBA, no favorites or hidden.
- **Everything team-based** (owner, 2026-10-20): team pages, team tabs, teams in search, following a team. No v1 session builds any team logic (VISION §5).
- **Schedule horizon** (owner, 2026-10-20): the schedule job stores about a week ahead; looking further forward would need more.
- **Offline after a restart** (owner, S09 brainstorming, 2026-10-20): server data lives only in memory, so an app started offline (e.g. Android killed it overnight) shows the error, not the planned games. Option: persist loaded days on the device (`@tanstack/query-async-storage-persister` + `@tanstack/react-query-persist-client`), optionally prefetch the next game day.
- **Languages** (owner, S09, 2026-10-21): v1 is English-only — day labels and the "Sat 04:00" weekday use fixed English names; only the 12/24 h clock follows the phone. Translating the app (and following the phone's language) is a v2 idea.

## Parking lot
Ideas that came up but are out of scope for now.
- Today: a `?date=` link to a day that fails to load (no old day to keep) replaces the whole screen with "Try again", stepper included. Show Latest beside the error if that ever happens; the ‹/› case is in Current state's S10a fix (PR #18 review).
- S10b, if the host has a CDN: `s-maxage=60` (D-051) lets a refetch within 60 s of a results run get the old day, which TanStack's 5 min `staleTime` then keeps until focus or a pull. Purge the CDN after a `results` run, or keep `/v1` off the CDN (PR #18 final review).
- Today pull to refresh (`apps/mobile/src/app/index.tsx` `onRefresh`) refetches the old day beside meta; when the new meta moves the latest day, that fetch is wasted and the spinner stops before the new day lands (the old day stays on screen meanwhile, `keepPreviousData`). Fix by refetching meta first and then fetching the day it picks (`dayQuery`), if a morning pull ever feels off (PR #18 review).
- `startTime` (`apps/mobile/src/lib/format.ts`) builds two `Intl.DateTimeFormat`s per scheduled card per render; Hermes builds them slowly. Cache them per `(locale, timeZone)` if Today feels slow on the phone on a busy night (PR #18 review).
- `upcoming` rows (S09, D-049) have no date bound: a past game stuck SCHEDULED/LIVE (`results.ts` `shortcut:`) keeps showing them on its old date, from the current roster, and a FINAL game whose box score never arrives keeps "Waiting for stats". Bound by start time (e.g. started ≤ 24 h ago) if that ever shows up (PR #17 review).
- Mobile typecheck differs between a dev machine and CI: Expo's typed-route and asset types (`.expo/types`, `expo-env.d.ts`) are gitignored and only exist after `expo start`. S08 didn't need it (no `Link href`, no asset imports); settle it in S12/S13, when screens first use `Link href` or import assets — e.g. run `expo customize`/type generation before `tsc` in the mobile `typecheck` script (PR #4 review).
- CI: cache the pnpm store (`corepack enable` before `actions/setup-node`, then `cache: pnpm`) once runs get slow; they take about 20 s now (PR #4 review).
- S01 deferred minors: the polite-client backoff test asserts `≥` delays rather than exact ones; the polite client reads the wall clock (`Date.now`), so a backward clock step could stall a host's queue — inject a monotonic clock if the jobs ever show it (PR #5 review).
- `docs/sources/nhl.md` size table lacks rows for `skater-summary-reg`/`goalie-summary-reg` (~20 KB each).
- `apps/server/test/config.test.ts`: add `' 8080'`, `'1e3'`, `'0x10'`, `'+80'` to the invalid-PORT cases (the inputs its regex exists to reject).
- Nationality upgrade (D-030): NHL stats `bios` `nationalityCode` as a source value between the override and the birth country (override → source → birth; `nationality_source` gains `source`). Backward-compatible: an optional resolver input. Needs the bios pages (~20 requests a season) in the season-stats job.
- `packages/shared/src/model.ts:90` — `shortcut:` `SeasonStats.stats` stays an untyped number record on the write side; S07 types the read side (`seasonStatsEntrySchema`, each stored row parsed by the API).
- S02a deferred test minors: `stats.test.ts` never pins the exact `invalid <kind> stats:` prefix and has no goalie `savePct` < 0 case; `nationality.ts` checks `birthCountry` by truthiness where `selection.ts` uses `!== null`.
- S02b deferred minors (task and final reviews): the stat-payload error drops the zod error as `cause` (`games.ts`); one line-deletion test asserts `≥ 1` where the count is known; the played/sport/team rejection tests match only the `stat line <game>/<player>` prefix; the sport check is tested one direction only; "migrating twice" checks only `leagues` rows; `STAT_BASES` `satisfies` is one-way; `teamIdLookup` filters by `external_id` only (the map keys by source); a line for an unstored team reports "is not the home or away team" rather than "unknown team"; a line's player from the other league isn't rejected.
- `recomputeNationalities` runs one UPDATE per changed row — fine at override scale; batch it if a mass change ever happens.
- S10b: the node-postgres `Pool` has no `'error'` listener (an idle-client error would crash the process); exercise `openPostgres` against the real deploy (`client.ts` `shortcut:`).
- `apps/server/src/db/players.ts:14` — `shortcut:` `searchName` leaves ø, ł, đ undecomposed; search queries go through it too, so only an ASCII query for such a name misses (S07 kept it).
- S03: mapper files are `games.ts`, `boxscore.ts`, `players.ts`, `season-stats.ts`, while `.claude/rules/adapters.md` says `map-*.ts` (the rule was missed in the design; the red tests import these paths). Owner picks: rename the files and their test imports, or amend the rule to allow topic names.
- S03 deferred minors: `mapScore` reads a missing `goals[]` as no goals (a scored game without it would show 0–0 periods; could throw when goal counts ≠ score); `boxscore.ts` `savePctg ?? null` is an unreachable fallback; `periodDescriptor` is `.nullish()` while other optional fields are `.optional()`; no tests for `fetchSchedule`, `fetchPlayerLanding`, skater truncation; `scripts/endpoints.ts` imports `nhl/client`, not `nhl/index`; birthCountry warning tests use `toContain`; `pnpm inspect` joins the fixture id into the path unsanitised (local tool) and its exit/usage behaviour is checked by hand; root `vitest.setup.ts` is lint-only (not typechecked); only `fetch` is blocked in tests, not `node:http`.
- NHL stats REST `start` paging is untested (S03 uses `limit=-1`, probed live 2026-10-17).
- S04a deferred minors (task and final reviews; ledger triage "defer"): `inspect.test.ts` endpoint list is a substring match (`schedule-calendar` unasserted); repository-guards: bare `toThrow()` in the batch test, raw `excluded.*` SQL in the guards; PGlite lock: ENOENT race between EEXIST and read, two simultaneous stale takeovers, pid reuse; logger fields can overwrite `level`/`msg`/`job`/`run`; untested: the runner's summary log line, roster/schedule warnings at warn, reactivation frozen on a partial roster run, `loadRecap`'s "line but current team elsewhere" branch, a goalie with `savePct` null (percentage omitted), four CLI guards; `jobs-results` "seeded stubs keep their names" can't fail; `scoreOnly` helper duplicated in two test files; schedule default-date test at 09:00Z can't tell UTC from local; country error quotes the untrimmed value; spec's sample recap shows a `SV ` prefix the code doesn't print.
- `apps/server/src/game-day-rows.ts:77` — `shortcut:` "Not in lineup" uses the current team, so older dates can be wrong after a trade (VISION §4.1).
- `apps/server/src/jobs/runner.ts:70` — `shortcut:` in-process job lock; a second process on the same Postgres isn't locked out (S10b).
- PR #9 review, deferred (owner decision):
  - ~~`db/client.ts:77` PGlite stale-lock takeover race~~ fixed in S04b (guard file + link-created lock, D-041); still open: pid reuse keeps a stale lock alive, a raw ENOENT if the holder releases between EEXIST and the read.
  - `jobs/results.ts:124` a failed-enrichment stub is never retried: `boxscore_fetched_at` is set, so re-running results/backfill skips him and no roster lists a retired/AHL player, so he never shows in a recap. Needs a retry path (e.g. stubs with no birth country) and a `shortcut:` comment until then.
  - `jobs/roster.ts:15` `--date` changes only the calendar's team list; rosters are always `/roster/{abbrev}/current`, so a past date mixes seasons (ARI → 404, `partial`, no deactivation). Reject `--date` for roster in `parseJobArgs`, or drop the flag.
  - `jobs/results.ts:103` each unknown box-score player costs one team SELECT and one `upsertPlayers` transaction (~40 per first game); batch per game before a season backfill.
  - `jobs/backfill.ts:15` date validation duplicated from `parseJobArgs` (its DAY regex accepts 2026-02-30, `realDate` doesn't); the `message(e)` helper is copied into results, roster and runner. One module, or validate `JobArgs` once in `runJob`.
- S04b shortcuts: `apps/server/src/main.ts:39` tsx watch SIGKILLs a tick longer than 5 s; `apps/server/src/jobs/results.ts:21` stuck-game re-fetch now bounded by the scheduler's 24 h window only.
- S04b deferred minors (task and final reviews): `game-day.test.ts` `latestStartedGameDay` cases not an `it.each`; `db-lock.test.ts` "takeover leaves no guard" overlaps the dead-pid test, the loser test doesn't assert the guard survives; `current-season.test.ts` lacks the fallback's league filter, a future POSTPONED game in the fallback, start == now; `jobs-season-stats` "no games" doesn't assert its log; `results` can fetch one box score twice in a run (first fetch 8.5–12 h after start, > 6 h after final), nested ternary in `finalizeGame`, failed-correction test doesn't assert the error text; `scheduler-decide.test.ts` `uncorrected()` builds finals before their start, the 24 h window edges are untested, `noFuture` helper overwrites `games`; no test for `loadState` ignoring an unknown `job_runs.job` or `stop()` with no tick in flight; PGlite integrity after a SIGKILL mid-write unverified; a crash between the lock's tmp write and link leaves a `.tmp` file.
- Full `pnpm verify` showed PGlite boot timeouts (30 s hooks, 5 s default tests) when the machine's load average was 11–15; one recap test got a 30 s timeout. Revisit (fewer parallel workers, or longer hook timeouts) if CI flakes.
- S04b handoff review minors: after the first Ctrl-C further signals are ignored (outside tsx watch a hung close needs SIGKILL); a signal during `migrate()` comes before the handlers (lock left, taken over next start); a failed `close()` on the migrate-failure path hides the migrate error; a manual `pnpm job schedule` after 09:00 UTC counts as the day's run. Daily slots are UTC and shift an hour in Riga with DST: owner accepted, 2026-10-18 (D-041).
- PR #10 review, deferred:
  - `jobs/results.ts` a DB with finals stored before S04b (e.g. a big backfill made with S04a) re-fetches each of them once on the first startup catch-up (~1 request per game). The owner's DB already did (16 corrections); fix only if someone restores an old backfill: mark rows with `boxscore_fetched_at` ≥ 12 h after the start as corrected.
  - `scheduler/decide.ts` any `job_runs` row of a daily job counts, including a manual `--date` run (already parked above); keyed per league since S05.
  - `db/client.ts:90` raw ENOENT when the holder releases between EEXIST and the read (already parked under PR #9).
  - `main.ts` repeats `scripts/job.ts`'s bootstrap (package version, User-Agent, overrides, open + migrate); extract one `createJobContext()` when S10b rewires the server for deploy.
- Late NHL stat fixes: each game is re-fetched once, ≥ 6 h after the final (D-040), so a fix the NHL makes days later is never picked up. If it matters, add a second re-fetch a few days later (one request per game) (owner question, PR #10).
- `roster` prints each nationality-override warning twice (plain line and JSON log) — seen in the S04b live run.
- S05 deferred minors (task and final reviews): `espn-nba-fetch.test.ts` "caps byathlete at 20 pages" asserts the constant against itself; `COUNTRY_NAMES`/`ESPN_COUNTRY_ALIASES` exported from shared but unused outside `countries.ts`; `jobs-nba.test.ts` `countOf(…) ?? 0` lets a missing counter pass; a LIVE NBA game without linescores gets `periodScores: []` not `null`; the DNP comment in `espn-nba/boxscore.ts` sits two lines above the `reason` read; skip warnings end `…, game skipped`; malformed-payload tests are one `it.each` per file; the recap two-league test checks only headers + the Porziņģis line and doesn't assert the NBA run's status; `roster.ts` "no teams" error is untested and names the league, not the source endpoint; the roster test's copied rosters offset athlete IDs by team × 10M.
- S05 ESPN unknowns: preseason games against non-NBA clubs would store those clubs as NBA teams (unseen); play-in / All-Star season types are skipped with a warning until seen; a hybrid position like "G-F" would throw and sink that game's summary; `byathlete seasontype=1/3` unseen live; the 2026-03-16 recap showed Alberts Smits "Not in lineup" for NYR via the current-team shortcut (`game-day-rows.ts:77`, already parked).
- S06 deferred minors (task and final reviews; final reviewer: none blocks the PR):
  - A 500 logs `err.message`; a Drizzle query error includes its params, and for the prev/next query those are the `leagues` preference — strictly a preference in a log. Log a fixed message (or `err.name`/code) plus the path instead.
  - Tests: contract tests exercise only the skater line variant (API tests cover the rest); `/health` test doesn't pin "latest of several runs"; the 2026-03-16 `leagues=NBA` and `fav=nhl-1` day tests can't fail on their own (other tests cover both); the "no row without a team" API assertion is vacuous (`loadRecap` never loads such a player; `game-day-rows.test.ts` pins it); `latestGameDate`'s status filter isn't pinned separately from its start-time filter (a postponed past game would); health tests and a seed that throws midway leave PGlite handles open.
  - Duplication: `api-seed.ts` copies `recap.test.ts`'s `calendar()`/`score()` filters; `latency.ts` copies `recap.ts`'s arg-parse try/catch; `meta.ts` repeats `currentSeason`'s started-game filter (a `startedBy()` helper would tie them). `latency.ts` `?? Number.NaN` is unreachable; the `params.ts` cap comment says "countries" (also leagues).
- PR #12 review, deferred:
  - `espn-nba/players.ts` `mapAthlete` takes the team from `team.$ref` without reading `active`/`status` or the ref's season; a free agent whose core record still names an old team would be enriched onto it (as active) until the next complete roster run deactivates them. Every recorded athlete is active, so record an inactive one (`pnpm fixtures:record espn-nba athlete <id>`) before deciding: null the team when `active` is false, or check the ref's season.
  - `espn-nba/boxscore.ts` a stub is built for every box-score row, so one unknown position throws for the whole game (the "G-F" unknown above). Needs a rule for an unknown position first (a warning plus a stub without a group, or skip the line); the athlete fetch throws the same way.
  - `espn-nba/games.ts` (and `nhl/games.ts`, which does the same): one malformed event (FINAL without linescores, a bad LIVE score, uneven period scores) throws for the whole day, so the day's other games wait until the source fixes it. Owner decision: keep rule 2 (fail loudly) or extend D-035's skip-with-warning to malformed events in both adapters.
- PR #13 review, deferred to S10b (it rewires `main.ts` for deploy, where restarts happen):
  - `main.ts` startup: the DB opens before `package.json`/overrides load and before the signal handlers are registered, so a bad local overrides file (the committed one is checked by `nationality-overrides.test.ts`) or a Ctrl-C during startup exits with PGlite open; the pid lock is taken over at the next start. Load them before `openDb()` and register `shutdown` right after it.
  - `main.ts` shutdown never closes the `serve()` server: requests that arrive during `scheduler.stop()` or after `handle.close()` get a 500. Keep `serve()`'s return value and `server.close()` it first.
  - `api/day.ts` `loadDay`: if the production p95 misses 150 ms, run the prev/next query alongside `loadRecap` (`Promise.all`; PGlite runs one query at a time, so the dev number won't move) and pass the leagues into `loadRecap`.
- `apps/server/src/api/players.ts:55` — `shortcut:` search is a full scan of `players` (strpos); add a `pg_trgm` index if search shows in the p95.
- S07 deferred minors (task and final reviews): the game log has no tiebreaker after `start_time_utc`; `seed` run guard lets a `partial` job pass; the seed's byathlete cut hard-codes `count: 50`. Tests missing: `_` wildcard, exactly 200 IDs, a preflight from a disallowed origin, `season === null` → `[]`, a POST row, end-to-end `fav` through the client, a non-2xx JSON body of another shape, a client `baseUrl` with a trailing slash.
- S10b (PR #14 review): with `CORS_ORIGINS` unset, `loadConfig` falls back to `http://localhost:8081` in every environment, so a production deploy that forgets the variable starts with only localhost allowed (the web build then fails its CORS checks), and there's no way to allow zero origins. Settle it with S10b's production config: require the variable in production, or default only in dev.
- S10b (PR #14 final review): a D-021 rebuild done during a preseason leaves the player page's season stats empty — `season-stats` and `backfill` fetch only the new season, so last season's REG/POST rows are never stored. Say so in DEPLOY.md, or fetch last season's stats once in the rebuild. Also check one search request on the real Postgres (`collate "und-x-icu"` needs an ICU build).
- `pnpm screenshots` robustness (S08 review, dev script only): a failed API start keeps Node alive until its 60 s timer fires; `decodeURIComponent` and the missing-`index.html` fallback sit outside the request handler's try (an unhandled rejection skips cleanup); only SIGINT is handled (SIGTERM/SIGHUP leave the detached API on :3101, and the next run refuses to start); paths are relative to `apps/mobile` (pnpm guarantees it; `__dirname` would be sturdier); `screenshot-api.ts` listens on all interfaces. `/// <reference types="node" />` in the script also exposes Node globals to the app's typecheck (a `scripts/tsconfig.json` would scope it).
- PR #15 review, deferred:
  - `apps/mobile/src/app/_layout.tsx` renders `null` until prefs rehydrate, so no navigator is mounted on the first render; an imperative `router.*` call or a notification handler in that gap would throw "Attempted to navigate before mounting the Root Layout". Nothing navigates yet; when S13 adds stacked pages, render the navigator first and gate the queries (or hold the splash with `expo-splash-screen` until hydrated).
  - `pnpm screenshots`: ports are written twice (`screenshot-api.ts` 3101 + CORS origin :8091, `screenshots.ts` `API_PORT`/`WEB_PORT`) — pass them from `screenshots.ts` via env; the static server answers a missing asset with `index.html` + 200 (fall back only for extension-less paths). (Belongs with the robustness item above.)
- S08 deferred minors: `countries.ts` sorts names with `localeCompare` without a locale; `restorePrefs` returns the shared mutable `DEFAULT_PREFS`; search doesn't fold apostrophe variants (`'` vs `’`); "Try again" has no pressed feedback; `safeStorage` parses JSON once more than needed; the web-only `activeThumbColor` goes through an object spread (no excess-prop check); an empty country list from the server with nothing selected has no message of its own; the disabled switch's 0.4 opacity is a bare number; the search focus indicator is a 1 px border colour change; `ErrorBoundary` has never run (nothing throws yet); `settings.tsx` shows "Version undefined" if `expoConfig` were missing.

- S12 deferred minors (task and final reviews): Remove/Undo re-renders the whole Settings screen; old results stay up for the 300 ms debounce after clearing the field; `searchTerm`'s 50-character cut can end in a space (the server trims); `restorePrefs` doesn't cap stored lists at 200 (tampered storage only); `settings-about` and `settings-lists-empty` shots look nearly alike. Tests: "drops non-string entries" checks only the affected list; `listRows`' sort test uses ASCII names; no test for favoriting a hidden player when favorites is full.
- Mobile duplication (PR #19 review, deferred): `Caption` is defined in both `search.tsx` and `settings.tsx`, the 48 px touch-target `Pressable` style is repeated (`MarkButton`, Settings' Remove), and the full name is built in three places. Extract `Caption` and a touch-target button into `src/components/` when S13 adds a third copy.
- Search ☆ renders almost solid in headless Chromium's fallback font, so colour carries the state there; check the web build in a real browser in S14a.
- `apps/mobile/src/state/prefs.ts:89` — `shortcut:` a 201st favorite or hidden player is ignored silently (the API caps lists at 200); add a caption if anyone reaches it.

## Session log
<!--
One entry per session, newest last, at most ~12 lines. Format:

### S03 — NHL adapter — 2026-10-12 — PR #2
- Changed: …
- Decisions: … (DECISIONS.md D-0xx)
- Read these: …
- Reviewer: approve-with-fixes; fixed 2 majors, deferred 1 nit (…)
- CI: green
- Follow-ups: …
-->

### K0 — Kit review — 2026-10-03 — PR into `main` (`kit-review`)
- Changed: CLAUDE.md, VISION, SESSIONS, WORKFLOW, DECISIONS, the handoff and slice-review skills. Red-phase commit exception; cloud sessions push the slice branch directly; effort set every session; S02/S04 split into a/b; S10 gains log hygiene, `/health/data` alerting, rate limit, rebuild instead of backups; off-roster players handled; Play Console started in S08; CI on Node 22 + 24.
- Decisions: D-020 (supersedes D-019), D-021.
- Read these: docs/SESSIONS.md (S00, S02a–S04b, S10), docs/VISION.md §4.1, §6.1, §10–§12, docs/DECISIONS.md D-020–D-021.
- Reviewer: approve-with-fixes; fixed 4 majors (split `/health` liveness from `/health/data` freshness; off-roster rule only after a complete league fetch; checkable S10 latency criteria; DEPLOY.md criterion restored) and 5 nits.
- CI: none yet (no package.json before S00).
- Follow-ups: verify D-020 on the first cloud session (does the harness let Claude push the slice branch?).

### Plugin workflow — 2026-10-16 — PR into `main` (`plan-change`)
- Changed: CLAUDE.md (Workflow configures superpowers; test rules beat ponytail), WORKFLOW.md (rewritten around the plugins), SESSIONS.md (per-session branches, brainstorm/plan prompts, R rows and K0 prompt removed, templates updated), handoff skill (per-session PR + `/code-review`), reviewer/test-writer agents, settings (default mode, project plugins, ponytail marketplace), `.gitignore` (`.superpowers/`); `/slice-review` and `docs/reviews/` deleted.
- Decisions: D-022 (supersedes D-015), D-023, D-024 (supersedes D-016/D-020 in part), D-025 (amends D-018).
- Read these: docs/WORKFLOW.md (TL;DR, Plugins, GitHub), CLAUDE.md (Workflow), docs/SESSIONS.md (How to run a session, S00 prompt), .claude/skills/handoff/SKILL.md.
- Reviewer: not run (docs-only change; the "Docs review" template is the independent pass).
- CI: none yet (no package.json before S00).
- Follow-ups: check `/usage` after S00; confirm cloud sessions install the project plugins on first cloud run.

### Docs review of the plugin workflow — 2026-10-16 — PR #3 (`plan-change`)
- Changed: CLAUDE.md (stops, owner steps, test-writer routing, Opus-not-Fable, context7 fallback, template sizes), SESSIONS.md (How to run, sizing/resume via the SDD ledger, S01 live calls in helper agents, S02a "write isShown yourself" removed, S10 probe as a brainstorming spike), WORKFLOW.md, handoff skill (branches without a session ID, Rulings section, scoped re-review), reviewer agent (Critical/Important/Minor, design doc/plan/ledger, Declined to judge), settings allow list.
- Decisions: D-022 and D-024 amended in place; no new IDs.
- Read these: CLAUDE.md (Workflow), docs/SESSIONS.md (How to run a session, Sizing, Templates), .claude/agents/reviewer.md.
- Reviewer: approve-with-fixes; fixed 4 Important (S02a red tests left failing — resolved by dropping the owner exercise; handoff review without a session ID; an unused PR-review write rule; owner steps timed after the handoff) and 2 minors.
- CI: none yet (no package.json before S00).
- Follow-ups: watch S00 for test-writer routing and the reviewer → SDD fix-wave hand-off.

### Review fixes for PR #3 — 2026-10-17 — PR #3 (`plan-change`)
- Changed: SESSIONS.md and WORKFLOW.md (a cloud session finishes its plan before teleport — the ledger stays on the VM; cloud starts in Accept edits, Auto before approving the plan; plugin check is 3 project + 1 user; the duplicated session loop now points to SESSIONS.md), test-writer agent (SDD brief/report/commit contract; spec questions → BLOCKED), CLAUDE.md (that BLOCKED is a stop), reviewer agent (fallback range = whole branch), settings (ponytail pinned to `v5.3.1`; `gh api` rules for posting PR comments and replies).
- Decisions: D-023 amended in place (ponytail pin); D-022 amended (new stop).
- Rejected: the `.env.example` deny-rule finding — `!` negation works in deny lists (tested: `.env.example` readable, `.env.local` denied).
- Reviewer: approve; 0 Critical/Important; fixed 3 of 4 minors (missing stub → NEEDS_CONTEXT; follow-up red commit after a spec answer; tag in setup step 6), left 1 (the `gh api` wildcard also matches spaces — guardrail, not a boundary).
- CI: none yet (no package.json before S00).
- Follow-ups: re-add the ponytail marketplace with `@v5.3.1` locally; confirm the cloud dropdown and the pin on the first cloud session.

### S00 — Bootstrap — 2026-10-17 — PR into `main` (`s00-bootstrap`)
- Changed: root tooling (`.tool-versions` Node 24.22.0, pnpm 12.14.0 via `packageManager`, TS ~6.0.3, Biome 2.5.15, Vitest 5), `packages/shared` (`seasonLabel`), `apps/server` (Hono `/health`, `loadConfig`), `apps/mobile` (Expo SDK 58 default template reset and trimmed), `.github/workflows/ci.yml` (`verify (22)`/`verify (24)`), cloud SessionStart install hook, README.
- Decisions: D-026 (toolchain pins), D-027 (Expo template trimmed; TS follows Expo).
- Read these: docs/superpowers/specs/2026-10-17-s00-bootstrap.md, package.json, pnpm-workspace.yaml, apps/server/src/config.ts, apps/mobile/src/app/index.tsx, .github/workflows/ci.yml.
- Reviewer: approve; 0 Critical/Important; 5 minors left (3 parked in the parking lot). Task 3 needed 2 fix rounds over pnpm's release-age exemptions (kept, dated).
- CI: first run on this PR.
- Follow-ups: delete the release-age exemptions after 2026-10-17 20:00 UTC; add `verify (22)`/`verify (24)` as required checks; check `/usage`; watch the cloud install hook on the first cloud session.

### Review fixes for PR #4 — 2026-10-17 — PR #4 (`s00-bootstrap`)
- Changed: `.claude/settings.json` (cloud install hook: `cd "$CLAUDE_PROJECT_DIR"`, matcher `startup|resume`, all output to stderr, `timeout: 600`), `.claude/rules/mobile.md` (Expo Router `export default` exception), `apps/mobile/tsconfig.json` (duplicate `strict` removed), PROGRESS parking lot.
- Decisions: none new.
- Deferred (parking lot): typed-route/asset types differ between dev machine and CI (S08); `web.output: "server"` (S08/S14); pnpm store cache in CI.
- Declined: `seasonLabel` input validation (adapters validate with zod and convert ESPN's end-year label); typechecking the root `vitest.config.ts` (Vitest loads it on every `pnpm verify`).
- Reviewer: approve; 0 Critical/Important; fixed 1 minor (rule wording), left 3 (`timeout: 600` equals the documented default; a failing install's notice shows pnpm's first stderr line; the Vitest-config reply overstates — misspelled options are ignored silently).
- CI: re-run on push.

### S01 — Data spike + fixtures — 2026-10-17 — PR into `main` (`s01-data-spike`)
- Changed: `apps/server/src/http/polite-client.ts` (+17 tests), `src/fixtures/record-fixture.ts` + `scripts/fixtures-record.ts` + `scripts/endpoints.ts`, `loadConfig` gains `contactUrl`, 42 fixtures under `apps/server/test/fixtures/`, throwaway `scripts/spike/spike.ts`, `docs/sources/nhl.md`, `docs/sources/espn-nba.md`.
- Decisions: D-028 (polite client), D-029 (fixture format). Nationality wording proposed in docs/sources for S02a, not adopted.
- Read these: docs/superpowers/specs/2026-10-17-s01-data-spike.md, apps/server/src/http/polite-client.ts, docs/sources/nhl.md, docs/sources/espn-nba.md.
- Reviewer: final whole-branch review found 1 Important (NHL summary rows sum REG+POST) — fixed with `gameTypeId=2` fixtures and doc corrections; cheap doc minors fixed; code minors parked.
- Rulings: 8 (demo date 2026-03-16 because Porziņģis hasn't played in 2026-27; spacing start-to-start; others in the PR briefing).
- Requests: 68 of 250. Owner spot-check of spike numbers: matched.
- CI: first run on this PR.
- Follow-ups: release-age exemptions after 20:00 UTC; delete `s01-data-spike-old`; S02a settles nationality.

### Review fixes for PR #5 — 2026-10-17 — PR #5 (`s01-data-spike`)
- Changed: polite client pauses the whole host during a retry backoff / `Retry-After` (queued requests included); `recordFixture` rejects names that aren't plain file names (`../x`, `a/b`, `.hidden`); `endpoints.ts` escapes every id and uses `satisfies` (keys stay typed); recorder prints "bytes upstream". +7 tests (47).
- Decisions: D-028 corrected (the clock isn't injected; fake timers drive it) and extended (host-wide pause).
- Declined: clock injection (fake timers already make tests deterministic; backward-step risk parked); shared script setup and the scripts' PORT validation (the duplicate lives in the spike, deleted in S04a); the three spike findings (throwaway, replaced by `pnpm recap` in S04a).
- Checked: 41 of 42 recorded fixture URLs rebuild identically from `endpoints.ts` (the 42nd is the `--as`-named states fixture).
- CI: re-run on push.

### S02a — Domain model, selection rule, nationality — 2026-10-17 — PR into `main` (`s02a-domain-model`)
- Changed: `packages/shared/src/` `enums.ts`, `countries.ts` (249 ISO alpha-3 from iso-codes 4.20.1), `ids.ts`, `model.ts`, `stats.ts`, `selection.ts` (`isShown`), `nationality.ts` (`resolveNationality`); `apps/server/src/nationality/overrides.ts` (loader); zod ^4.6.7 in shared + server. +67 tests (114).
- Decisions: D-030 (nationality rule kept: override, else birth, else null; NHL `nationalityCode` parked), D-031 (zod 4; country codes as a literal `z.enum`).
- Read these: docs/superpowers/specs/2026-10-17-s02a-domain-model.md, packages/shared/src/selection.ts, packages/shared/test/selection.test.ts, apps/server/src/nationality/overrides.ts.
- Red/green: test-writer's `949b7a2` — 22/22 failed on "not implemented"; unchanged since; task reviewer ran 12 mutants, each failed ≥ 1 test.
- Reviewer: approve; 0 Critical/Important; 5 minors left (parked: 4 test/style minors; the design doc's zod-hoisting sentence fixed).
- Rulings: none. CI: first run on this PR.
- Follow-ups: release-age exemptions after 20:00 UTC; S03 skips the alpha-3 part of `countries.ts`.

### Review fixes for PR #6 — 2026-10-17 — PR #6 (`s02a-domain-model`)
- Changed: `StatLine` split on `played` (a played line needs stats, a DNP line has none; type test `packages/shared/test/model.test.ts`); `parseStatPayload` throws `invalid stat kind: <kind>` for a kind outside the three (`Object.hasOwn`, so `constructor` is caught too); `publicIdSchema` rejects leading zeros; missing overrides file → `<file>: cannot read (ENOENT)`, test anchored; committed-file test no longer pins the count. Design doc snippets updated to match. +4 tests (118).
- Decisions: none new.
- Declined: plain unions instead of the "unused" zod enums (§S02a asks for them; S02b/S03 use them); dropping the `firstIndex` map (a few lines); a subpath export to keep zod out of the mobile bundle (the API contract brings zod in anyway); `XKX` for Kosovo (real limit, no current player needs it).
- Reviewer: approve; 0 findings; 3 minors (stale test count — fixed; design doc snippets — fixed; `?? message` fallback in the missing-file rethrow — left, `readFile` always sets `code`).
- CI: re-run on push.

### S02b — Database schema and repositories — 2026-10-17 — PR #7 (`s02b-database`)
- Changed: `apps/server/src/db/` (`schema.ts`, `client.ts`, `cli.ts`, `upsert.ts`, `teams.ts`, `players.ts`, `games.ts`, `season-stats.ts`, `job-runs.ts`), `src/nationality/recompute.ts`, `drizzle/0000_init.sql` (generated), `drizzle.config.ts`, `test/db.ts`; root `db:*` scripts; `.gitattributes` (migration snapshots), Biome ignores `apps/server/drizzle`. Deps: drizzle-orm 0.45.4, @electric-sql/pglite 0.5.10, pg 8.23.1, drizzle-kit 0.31.11, @types/pg. +91 tests (209).
- Decisions: D-032 (DB clients, own migrate CLI, leagues seeded in code, enums from shared), D-033 (no-op upserts; a game's lines as one set; nationality on write).
- Read these: docs/superpowers/specs/2026-10-17-s02b-database.md, apps/server/src/db/schema.ts, apps/server/src/db/upsert.ts, apps/server/src/db/games.ts, apps/server/src/nationality/recompute.ts.
- Red/green: test-writer's `827224a` + follow-up `3810d24` — 89/89 failed on "not implemented"; unchanged since (only `db-client.test.ts` gained a warm-up hook).
- Reviewer: approve; 0 Critical/Important; 4 optional minors parked with the task-review minors.
- Rulings: 8 (clone-based test DBs, `games.league` FK, `stat_basis` tied to the model, init migration regenerated, warm-up hook, follow-up red tests, Tasks 3+4 in one commit, scope of "tests unchanged").
- Follow-ups: release-age exemptions after 20:00 UTC; S04a settles PGlite sharing and must pass overrides to `upsertPlayers`.

### Review fixes for PR #7 — 2026-10-17 — PR #7 (`s02b-database`)
- Changed: `upsertStatLines` rejects an empty batch (`stat lines <game>: empty batch`) so a broken box score can't wipe a game; `finishJobRun` only finishes a `running` run (`job run <id> is not running`); why-comment on `season_stats.fetched_at`. The two empty-batch tests now pin the rejection (owner decision); +1 test (210).
- Decisions: D-033 amended in place (empty batch rejected; `fetched_at` = when stored, freshness from `job_runs`).
- Declined: injecting a clock for bookkeeping timestamps (owner: use the database clock); bumping `fetched_at` on every fetch (breaks the no-op rule).
- Parked: FINAL-downgrade guard, game league/source/team checks and season-stats kind check (S04a); `teamIdLookup` source filter and batched recompute (already parked).
- Reviewer: approve; 0 Critical/Important; 2 doc minors fixed (D-033 wording, test count).
- Follow-ups: release-age exemptions after 20:00 UTC.

### S03 — NHL adapter — 2026-10-17 — PR (`s03-nhl-adapter`)
- Changed: `apps/server/src/sources/nhl/` (schemas, mappers, `client.ts` URLs + fetchers, `index.ts`), `pnpm inspect` (`src/fixtures/inspect.ts` + `scripts/inspect.ts`), root `vitest.setup.ts` (no network in tests), `ESPN_COUNTRY_ALIASES` scaffold, `scripts/endpoints.ts` reuses `nhlUrls`; `docs/sources/nhl.md` (limit=-1 probes, OVER).
- Decisions: D-034, D-035. Owner rulings in brainstorming: bios fixtures exempt from AC1; TOI 00:00 → DNP line.
- Read these: `docs/superpowers/specs/2026-10-17-s03-nhl-adapter.md`, `apps/server/src/sources/nhl/games.ts`, `boxscore.ts`, `client.ts`, `apps/server/test/nhl-games.test.ts`.
- Red/green: test-writer's `5bcfaeb` — 180/180 failed on "not implemented"; the four mapper test files and `test/json.ts` unchanged since.
- Reviewer: approve-with-fixes; fixed 1 Important (`gameState` OVER → LIVE) and 3 minors (R position test, season-guard test + endpoint in its error, nhl.md paging line); minors parked.
- Rulings: 7 (summary error endpoint names, gameState validated in the mapper, client.ts/index.ts layout vs mapper names, optional-not-nullish raw fields, OVER → LIVE, season TOI float kept, mapper names to the parking lot).
- Follow-ups: S04a live run is the first check of PRE/LIVE/CRIT/OVER/PPD/CNCL and of null-vs-absent fields.

### Review fixes for PR #8 — 2026-10-17 — PR #8 (`s03-nhl-adapter`)
- Changed: an unknown `gameScheduleState` skips only its game (`mapScore`/`mapSchedule` return `warnings`; the old throw test now asserts skip + warning — owner decision); non-league game types dropped before the strict parse; period scores only for LIVE/FINAL games; `fetchRoster(client, { abbrev, externalId })`; boxscore stubs pushed in their own loop + `playedOrDnp`; unused `nhlUrls` summary builders deleted; `inspect` reuses `lookup`. +5 tests (411).
- Decisions: D-035 amended in place; `.claude/rules/adapters.md` (season-stats units, warn-and-skip exceptions); `SeasonStats.basis` comment.
- Declined: #5 recorder `-reg` URLs via `nhlUrls` (they must rebuild the committed fixtures' URLs; `limit=-1` fixtures ~400 KB); #7 `inspect` roster prints the fixture id as team id (owner: local tool, documented).
- Reviewer: approve; 0 findings; 3 doc minors fixed (PROGRESS shapes/count, status note, spec amendment line); its S04a question parked.
- CI: re-run on push.

### S04a — Ingestion jobs + recap CLI — 2026-10-18 — PR (`s04a-jobs-recap`)
- Changed: `apps/server/src/jobs/` (runner, schedule, results + backfill, roster, registry), `src/game-day-rows.ts`, `src/recap.ts`, `src/cli-args.ts`, `scripts/job.ts`, `scripts/recap.ts`; NHL `schedule-calendar` (fixture recorded 2026-10-18); `upsertGames` guards + checks, `upsertSeasonStats` kind check, `teamLookup`/`playerLookup`; PGlite lock + `resetPglite`; spike deleted; docs/sources updated. +96 tests (507).
- Decisions: D-036 (runner + locks), D-037 (ingestion rules), D-038 (game-day rows). Owner rulings: team list from `schedule-calendar`; the recap shows §4.1's rows through one function S06 reuses.
- Read these: `docs/superpowers/specs/2026-10-18-s04a-jobs-recap.md`, `apps/server/src/jobs/results.ts`, `jobs/roster.ts`, `jobs/runner.ts`, `src/game-day-rows.ts`, `src/db/games.ts`.
- Red/green per task (implementers wrote the tests); 9 tasks, one fix round (Task 8: no "Not in lineup" before the box score is stored).
- Reviewer: approve; 0 Critical/Important; fixed 2 minors in the final wave (empty roster = failed fetch; fallback stubs get no current team), rest parked.
- Rulings: 8 (in the PR briefing).
- Live (owner): roster + backfill 2026-10-15..16, recap matched nhl.com.
- Follow-ups: release-age exemptions; S04b decides corrections for backfilled games and catches runner DB errors.

### Review fixes for PR #9 — 2026-10-18 — PR #9 (`s04a-jobs-recap`)
- Changed: `gameDayRows` skips "Not in lineup" for a player with a line that day, breaks ties by public ID; `usGameDay` (shared, Pacific date) is the default date of `schedule` and `roster`; `loadRecap` turns 42P01 into "the database has no tables yet: run `pnpm job` … first"; `upsertGames` coalesces period scores instead of skipping the row (the guard test's start-time assertion flipped — owner decision). +13 tests (520).
- Decisions: D-037, D-038 amended in place; S04a spec amended.
- Deferred (parking lot): PGlite stale-lock race, failed-enrichment stubs never retried, `roster --date`, per-newcomer queries, duplicated date validation.
- Reviewer: approve; 0 findings; 2 doc minors fixed (stale line ref, spec roster default), 2 left as notes (a stale schedule can move a LIVE game back to SCHEDULED or older scores until the next results run).
- CI: re-run on push.

### S04b — Season stats, corrections, scheduler — 2026-10-18 — PR (`s04b-scheduler`)
- Changed: `src/jobs/season-stats.ts` + `currentSeason` (`db/games.ts`); corrections pass in `jobs/results.ts`; `src/scheduler/decide.ts` (pure) + `scheduler.ts` (`loadState`, `tick`, `startScheduler`); `main.ts`/`config.ts` (`SCHEDULER_ENABLED`); shared `latestStartedGameDay`/`previousGameDay`/`nextGameDay`; PGlite lock (no leak on a failed open, guard-file takeover, link-created lock); two `-reg-all` fixtures (`limit=-1`, 2 live requests). +120 tests (640).
- Decisions: D-039 (current season, stored players), D-040 (corrections, 12 h settled rule), D-041 (scheduler, no croner — owner ruling). 
- Read these: `docs/superpowers/specs/2026-10-18-s04b-scheduler.md`, `src/scheduler/decide.ts`, `src/scheduler/scheduler.ts`, `src/jobs/results.ts`, `src/jobs/season-stats.ts`, `src/db/client.ts`.
- Red/green per task (implementers); 6 tasks, one fix round (Task 6: D-041 claimed a graceful stop under tsx watch's 5 s kill).
- Reviewer: approve-with-fixes; fixed 2 Important in the final wave (lock appears with its pid in one step; the race loser reports "in use"), minors parked.
- Live (owner): season-stats 742 rows / 2 requests; scheduler ticks logged; found Ctrl-C leaving the lock (`process.once` + tsx's relayed second SIGINT) — fixed (`process.on` + guard), confirmed by the owner's Ctrl-C.
- Rulings: 7 (in the PR briefing).

### Review fixes for PR #10 — 2026-10-18 — PR #10 (`s04b-scheduler`)
- Changed: `results` corrections only for finals of the last 24 h (`RESULTS_WINDOW_MS`, moved to `jobs/results.ts`) unless `JobArgs.catchUp` — set by the scheduler's startup tick and by every manual `pnpm job results` (owner-agreed); a non-NHL run fails `corrections: … arrives in S05` with no request; ticks stay startup ticks until one completes; `latestStartedGameDay` takes `status` and skips POSTPONED/CANCELLED. "A correction happens only once" now runs its second pass with `catchUp` (the window would make it pass trivially). +13 tests (653).
- Decisions: D-040, D-041 amended in place.
- Deferred (parking lot): pre-S04b finals re-fetched once at startup (owner: note, not fix); daily slot counting any `job_runs` row; ENOENT lock race; `main.ts`/`job.ts` bootstrap; late NHL stat fixes (owner question).
- Declined: bounding `loadState`'s future games (a few ms per tick on local PGlite).
- Reviewer: approve-with-fixes; fixed 1 Important (no test that a later tick runs results without `catchUp`) and stale PROGRESS line refs; left 2 minors (the `cli-args` catch-up test repeats an expectation; an NBA run logs "arrives in S05" per day and for corrections).
- CI: re-run on push.

### Release-age cleanup — 2026-10-18 — PR (`chore-release-age`)
- Changed: `pnpm-workspace.yaml` loses the S00 `minimumReleaseAgeExclude` block (9 Expo SDK 58 exemptions, inert since 2026-10-17 20:00 UTC); `pnpm install --frozen-lockfile` passes without it. Known issues now empty.
- Decisions: D-041 amended in place (owner: UTC daily slots shifting an hour in Riga with DST is fine).
- Housekeeping: merged local branches `s04a-jobs-recap`/`s04b-scheduler` deleted, stale remote-tracking refs pruned; `main` now requires `verify (22)`/`verify (24)` (strict), set by the owner. The remote `slice-0-setup` (closed PR #2, the pre-plugin workflow) stays on purpose as a v2 to try that workflow again — don't delete it.

### S05 — ESPN NBA adapter + jobs — 2026-10-18 — PR (`s05-nba`)
- Changed: `apps/server/src/sources/espn-nba/` (schemas, mappers, `client.ts` with `espnUrls` + fetchers, byathlete paging with a 20-page cap), `src/sources/common.ts` (shared `parsePayload`/`lookup`), `src/jobs/adapters.ts` (one adapter per league; all `arrives in S05` guards gone), `--league nba`, `pnpm inspect espn-nba`, shared `countryFromName` + iso-codes name table, scheduler `lastRuns` per league + both leagues in `main.ts`; ESPN `teams` fixture recorded (1 live request); `docs/sources/espn-nba.md` budget; `.claude/rules/adapters.md` (NBA whole minutes). +227 tests (880).
- Decisions: D-042 (ESPN adapter rules), D-043 (league adapters, byathlete budget); D-041 amended (lastRuns per league). Owner ruling: `overview` fixture exempt from AC1.
- Read these: `docs/superpowers/specs/2026-10-18-s05-nba.md`, `src/sources/espn-nba/boxscore.ts`, `games.ts`, `client.ts`, `src/jobs/adapters.ts`, `src/scheduler/scheduler.ts`, `test/jobs-nba.test.ts`.
- Red/green: test-writer's `9a859f2` — 182/182 failed on "not implemented"; unchanged since. 7 tasks, no fix rounds.
- Reviewer: approve; 0 Critical/Important; minors parked.
- Rulings: 7 (in the PR briefing).
- Live (owner): roster nba (31 req), overrides in the DB, backfill + recap NHL + NBA for 2026-03-16, season-stats nba 474 rows / 12 req; follow-up aliases for 3 live spellings.

### Review fixes for PR #12 — 2026-10-18 — PR #12 (`s05-nba`)
- Changed: `countries.ts` (17 English short-form aliases; Kosovo/Korea/Virgin Islands stay null), `espn-nba` byathlete throws when the response's season or type isn't the one requested, `season-stats` job fetches each season type on its own (`partial` when some fail, `failed` when all do), `addDays` in shared `game-day.ts` (backfill's `nextDay` gone), one `getJson` in `sources/common.ts`. +29 tests (909).
- Review input: `/code-review` (8 comments) + an ultra review (4): fixed 4, deferred 3 (parking lot, "PR #12 review, deferred"), rejected 2 (NBA week all-or-nothing, a ruling; `SEASON_TYPE_IDS` kept, owner).
- Red/green: each fix red first for the right reason (null country, rows resolved instead of a throw, `addDays` not a function, PRE 404 stopping REG).
- Reviewer: approve-with-fixes; 1 Important fixed (the new season check would have stopped REG season stats all season behind a failing PRE); 2 minors left (check season on every byathlete page; a `countries.ts` comment overlaps its test's).
- Note: full `pnpm verify` timed out in PGlite hooks twice at load average ~20 (reviewer running tests in parallel); green when idle (parked flake).

### S06 — API: days, games, meta — 2026-10-19 — PR (`s06-api-days`)
- Changed: `packages/shared/src/contract/` (prefs query → `Prefs`, day/game/meta/health/error schemas), `apps/server/src/api/` (`createApp`, request logs without queries, error format, `/health`, `/v1/meta`, `/v1/days`, `/v1/games`), `main.ts` always opens the DB, `DayGame` + `seasonType`/`gameDate`/`periodScores`, `byStartTime`, `test/api-seed.ts` (real jobs over fixtures), `pnpm latency`; `src/app.ts` removed. +68 tests (977).
- Decisions: D-044 (API contract and routes), D-045 (dev server always holds the DB; amends D-041). Owner approved the design's 7 calls.
- Read these: `docs/superpowers/specs/2026-10-19-s06-api-days.md`, `src/api/day.ts`, `src/api/app.ts`, `packages/shared/src/contract/responses.ts`, `test/api-days.test.ts`, `test/api-seed.ts`.
- Red/green per task (implementer-written); 6 tasks, 2 fix rounds (seed ignored failed jobs; `dataUpdatedAt` test too thin).
- Reviewer: approve; 0 Critical/Important; 5 minors parked.
- Rulings: 2 (repeated unknown params ignored, per the spec; stronger `dataUpdatedAt` test).
- Live (on the owner's DB): curl day 2026-03-16 → Porziņģis + Silovs + 10 other games; `pnpm latency` p95 38.9 ms. The pre-existing `repositories.test.ts:371` flake failed once on main at session start, not since.

### Review fixes for PR #13 — 2026-10-19 — PR #13 (`s06-api-days`)
- Changed: `api/app.ts` onError: only a 400 `HTTPException` echoes its message, any other goes through the generic logged 500; `cli-args.ts` missing-date message is `missing --date YYYY-MM-DD` (latency reuses it); `api/day.ts` `dayGames` matches shown games by `publicId`, not object identity. +1 test (978).
- Review input: `/code-review` (8 comments): fixed 3, deferred 3 to S10 (parking lot, "PR #13 review"), declined 2 with replies (prev/next over all games per D-044; `loadGame` refactor same size).
- Red/green: the 500 test failed on `expected 404 to be 500`, the cli-args one on the old `recap needs` text; the `publicId` change keeps behavior (the exact game-list test guards it).
- Reviewer: approve; no findings.

### S07 — API: players, search, countries — 2026-10-19 — PR (`s07-api-players`)
- Changed: contract (`searchQuerySchema`, `idsQuerySchema`, player summary/detail, typed `seasonStatsEntrySchema`, `gameLogEntrySchema`, countries); `src/api/players.ts` (search, by IDs, detail), `src/api/countries.ts`; CORS on `/v1/*` + `CORS_ORIGINS` in `config.ts`; `packages/shared/src/client.ts` (typed client); `test/api-seed.ts` (NBA teams, Embiid/Towns, inactive Gustavsen, season stats). +94 tests (1072).
- Decisions: D-046 (search, player detail, countries, CORS, typed client). Owner: current players first in search; the game log includes DNP.
- Read these: `docs/superpowers/specs/2026-10-19-s07-api-players.md`, `src/api/players.ts`, `packages/shared/src/contract/responses.ts`, `packages/shared/src/client.ts`, `test/api-players.test.ts`.
- Red/green per task (implementer-written); 6 tasks, 1 fix round (hyphen test passed without the hyphen handling) + the final fix wave (client sorts pref lists; pin the 404 message).
- Reviewer: approve; 0 Critical/Important; 3 minors fixed, the rest parked; 2 owner questions (preseason stats, player ID in log paths).
- Rulings: 5 (byathlete cut `{pages:1, count:50}`; exact hyphen order; `?ids=` skips prefs parsing; async `app.request` wrapper; structural `FetchLike`).
- Live (owner's dev DB): search/detail/countries/CORS curls as in Current state; Merzļikins not in the dev DB (data gap). One re-review was dispatched on sonnet by mistake, stopped and re-run on opus.

### Review fixes for PR #14 — 2026-10-19 — PR #14 (`s07-api-players`)
- Changed: `api/players.ts` search translates hyphens in the query too (word-start rank) and sorts ties by last/first name under `collate "und-x-icu"` (PGlite's database collation is `C`: Ā, Č after Z); player detail calls `currentSeason(…, { skipPreseason: true })` (new option in `db/games.ts`), so the preseason keeps last season's stats (owner); `api/app.ts` `rejectRepeated` makes a repeated `q` or `ids` a 400 like a repeated pref (owner: "do the standard" — this API's standard); `client.ts` sorts `leagues` for `searchPlayers`/`countries` too. D-046 amended. +7 tests (1079).
- Review input: `/code-review` (8 comments): fixed 5, deferred 1 to S10 (parking lot: the `CORS_ORIGINS` default in production), declined 2 with replies (`Promise.all` for the game log: no measured need, PGlite serializes queries; a shared `toGameSummary`: the two inputs differ in shape and the contract type already fails typecheck on a missed field).
- Red/green: the 7 new tests failed on `200 to be 400` (×2), different URLs (×2), C-collation order, hyphen order and `[]` stats before the fixes.
- `pnpm verify`: two runs hit the parked PGlite timeout flake (a different `repositories.test.ts` test each time; the file passes alone), the third was green.
- Reviewer: approve; 0 Critical/Important; 3 minors: one parked (S10 preseason rebuild), two left (the older prefs-URL test could reuse `client(urls)`; the repeated-`q` test's `toContain('q')` is loose, its 400 carries it).

### S08 — App shell, settings, screenshot tooling — 2026-10-19 — PR (`s08-app-shell`)
- Changed: `apps/mobile`: tabs (`src/app/_layout.tsx`, `index`, `search`, `settings`), `src/theme.ts`, `src/state/prefs.ts` + `prefs-store.ts`, `src/api/`, `src/lib/{countries,errors,api-url,safe-storage}.ts`, `src/components/`, `scripts/screenshots.ts`; `apps/server/scripts/screenshot-api.ts`; shared `countryName`; `app.json` web output `"single"`; mobile tsconfig extends `expo/tsconfig.base.json` (Vitest couldn't resolve it). Deps: TanStack Query, Zustand, AsyncStorage 2.2.0, zod; dev Playwright, tsx. +46 tests (1125).
- Decisions: D-047. Owner: every country can be unticked; the row label is just the name (`aria-checked` carries the state); three topics to revisit for v2 (tab icons, countries list, default prefs).
- Read these: `docs/superpowers/specs/2026-10-19-s08-app-shell.md`, `src/state/prefs.ts`, `src/app/settings.tsx`, `src/app/_layout.tsx`, `scripts/screenshots.ts`.
- Red/green: test-writer red commit (41 tests failing on "not implemented"), then green; `safeStorage` tests came with Task 4. 7 tasks, 0 fix rounds; Task 7 = the screenshot review: 5 visual fixes with before/after (tab labels, row alignment, dark switch thumb, focus ring, disabled switch).
- Reviewer: approve-with-fixes; 1 Important fixed (rows had no `aria-checked` on web: RNW ignores `accessibilityState`); minors parked.
- Rulings: 10 (tsconfig `.json`, `safeStorage`, hidden tab icons + shared placeholder, node:http static server, export-based smoke, scratchpad temp dir, fresh implementer for visual fixes, 7th shot, keep the shortest-name rule, keep the ledger until handoff).
- Live: Android in Expo Go over LAN checked by the owner; README's LAN command fixed for Arch (`hostname -I` doesn't exist there).

### Review fixes for PR #15 — 2026-10-19 — PR #15 (`s08-app-shell`)
- Changed: `apps/mobile/src/lib/errors.ts` (ZodError/SyntaxError → "server had a problem"), new `src/lib/timeout-fetch.ts` wired in `src/api/client.ts` (10 s abort; RN OkHttp has no timeouts), shared `countryName` override map for 10 inverted iso-codes names (COD "DR Congo", PSE "Palestine", …; parking-lot item removed). D-047 amended. +16 tests (1141).
- Review input: `/code-review` (8 comments): fixed 3, declined 1 with a reply (memoize `countryRows`: the list is dozens of rows), deferred 4 with replies (`restorePrefs` → S12 note; root layout before hydration → S13; screenshots ports and 200-for-missing-asset → parking lot).
- Red/green: the new tests failed on the old message (×2), the old names (×10 + the comma guard) and a missing `timeout-fetch` module before the fixes.
- `pnpm screenshots`: 14 PNGs; API-down still shows the friendly error through the timeout wrapper. Not seen on a phone: the 10 s timeout against a dead LAN IP.
- Reviewer: approve; 0 findings; 3 minors fixed (parking-lot pointer, duplicate S12 line, the comment names `expo/fetch`), 1 left (searching "Democratic" no longer finds COD).

### Plan change: local-first until launch — 2026-10-20 — PR #16 (`plan-local-first`)
- Changed: SESSIONS.md (Overview; slices 5–7 reordered: S09 → S10a → S12 → S13 → S14a, then launch S10b → S14b → S11b → S15; S11a placeholder Play upload any time after verification; S13 no longer ships to the closed track; S09's local-use note), VISION §9/§11, WORKFLOW one-time setup, PROGRESS parking lot and two code `shortcut:` comments S10 → S10b.
- Decisions: D-048 (supersedes D-014).
- Read these: docs/SESSIONS.md (Overview, S10a, S11a, S10b–S11b), docs/DECISIONS.md D-048.
- Reviewer: approve-with-fixes; fixed 2 Important (S11a's console answers saved in `docs/store/console-answers.md` for S11b; the S09 backfill note says to stop the dev server first) and 3 minors (S11a criterion before S09, the production URL lives in DEPLOY.md, S10a probe wording).
- Owner: Play Console account created; identity verification pending.

### Review fixes for PR #16 — 2026-10-20 — PR #16 (`plan-local-first`)
- Changed: SESSIONS.md (S10a right after S09; S14a's deploy config manual-only until S14b; production `CORS_ORIGINS` owned by S10b with a criterion; S11b verify criterion; S09 sleep/catch-up note matches the scheduler), D-021/D-045/D-048 wording, `runner.ts`/`client.ts` comments S10 → S10b, PROGRESS PR #16.
- Review input: `/code-review` (8 comments): fixed 8 (owner: accept all).
- Reviewer: approve; 0 findings; 3 minors fixed (catch-up wording, CORS criterion, "docs only"), 1 handled here (this log entry).

### Plan change: v1 additions — 2026-10-20 — PR #17 (`plan-v1-additions`)
- Changed: SESSIONS.md (S09: `upcoming` rows in `/v1/days` + `pnpm recap`, criterion 4; S13: full box score via `/v1/games/{id}`, criterion 4, size L, prompt reads D-044/D-049 and `loadGame`), VISION §4.1/§4.5/§5/§10, PROGRESS "Revisit for v2" (team features, schedule horizon).
- Decisions: D-049 (amends D-038, D-044).
- Read these: docs/DECISIONS.md D-049, docs/SESSIONS.md §S09 and §S13, docs/VISION.md §4.1, §4.5.
- Reviewer: approve-with-fixes; fixed 4 Important (VISION §10 contract table; D-049 names amended decisions and the tests whose expectations change; `pnpm recap` prints upcoming rows; S13 prompt reads D-049 and `loadGame`) and 5 minors. Claude's calls: "favorites on top" = shown players (selection rule); a deselected-league game page shows the full box score with nobody marked; upcoming rows also cover a final game still awaiting its box score, shown as "Waiting for stats" (owner, PR #17 review).

### Review fixes for PR #17 — 2026-10-20 — PR #17 (`plan-v1-additions`)
- Changed: D-049 (FINAL-awaiting rows read "Waiting for stats"; D-038's played-elsewhere guard; both changing `game-day-rows.test.ts` tests named; `/v1/games` without a box score returns upcoming rows; box score adds shown players' "Not in lineup" rows, `rank()` order), D-038/D-044 marked "amended by D-049", SESSIONS §S09 (scope, `rowText` exhaustive switch, criterion 4) and §S13 (scope, criterion 4), VISION §4.1 (trade wording, future-day empty state, "Not in lineup" needs a stored box score), §4.5, §10; parking lot: no date bound on upcoming rows.
- Review input: `/code-review` (8 comments): fixed 8 (owner: "Waiting for stats" instead of dropping final-awaiting rows); 1 part deferred (date bound → parking lot).
- Reviewer: approve-with-fixes; fixed 1 Important (dangling "the one that stays" test reference in §S09) and 2 minors (VISION "Not in lineup" needs a stored box score; latest game day of the selected leagues).

### S09 — Main page — 2026-10-21 — PR (`s09-main-page`)
- Changed: `apps/mobile`: Today (`src/app/index.tsx`), `src/api/queries.ts` (`useMeta`, `useDay`), `_layout.tsx` (`focusManager` on `AppState`), components `day-stepper`, `game-card`, `player-row`, `other-games`, `day-message`, `src/lib/{format,day-message}.ts`, theme `textDisabled`, `scripts/screenshots.ts` (12 Today states × light/dark). Server: `gameDayRows` `upcoming` rows, contract row kind, `recap.ts` exhaustive `rowText`; shared `src/format.ts` (card text for app and recap). Fixture `nhl/boxscore/2025021067` recorded for the screenshot night. +103 tests (1244).
- Decisions: D-050. Owner: upcoming text "Not started" / "In progress" / "Waiting for stats"; cache in memory only (persisting on "Revisit for v2"); after the Android check, a night stays on its US game day with an English weekday marker ("Sat 04:00"); v1 English-only (languages on "Revisit for v2").
- Read these: `docs/superpowers/specs/2026-10-20-s09-main-page.md`, `apps/server/src/game-day-rows.ts`, `packages/shared/src/format.ts`, `apps/mobile/src/lib/format.ts`, `apps/mobile/src/app/index.tsx`.
- Red/green: test-writer red commits (7001c74, 1424e71), then green; the weekday marker and English weekday each red first (5 and 1 failing tests).
- Screenshots: first review found 5 issues (dark disabled stepper, unmuted non-stat rows, misaligned compact cards and banner, short button), fixed with before/after.
- Reviewer: approve (twice: at a847ef9 and after the weekday commits); 0 Critical/Important; 2 minors fixed (one date formatter per call, screenshot waits for "Sat 04:00"); the DNP sentence-case minor (`G League` → `g league`) left.
- Rulings: 3 (2026-01-17 row order, red-phase negative tests, `timeStyle: 'short'`).
- Live: Android in Expo Go over LAN checked by the owner (times, stats, Latest, pull to refresh, server off, weekday marker). Without the scheduler, finished games stay "Not started" until a results job runs (by design).

### Review fixes for PR #18 — 2026-10-21 — PR #18 (`s09-main-page`)
- Changed: `apps/mobile/src/api/queries.ts` (`dayQuery` with `keepPreviousData`, none without a date), `src/lib/day-message.ts` `refreshBanner` (meta `isRefetchError`), new `components/accent-button.tsx` (Try again now 48 px), GameCard's dead `compact` branch dropped, settings `shortcut:` restored; restored LIVE + stored box score test in `game-day-rows.test.ts`; new `apps/mobile/test/today-queries.test.ts` (real `QueryObserver`s). +5 tests (1249).
- Review input: `/code-review` (8 comments): fixed 6 (owner: stepper and banner), 2 deferred to the parking lot (pull to refresh's old-day fetch; Intl formatter caching).
- Red/green: the stepper and banner tests failed for the reviewed reasons, then passed; the restored test was the only one to fail when the branch was broken on purpose.
- Reviewer: approve; 0 findings; minor 1 (stepper points at the old day's neighbours while loading) to the parking lot, 2 minors left.
- Owner question: stepping to a day while offline on web now keeps the old day with the offline banner, where before a full-screen "can't reach" appeared.

### Fix: stale day after the startup catch-up — 2026-10-21 — PR #18 (`s09-main-page`)
- Owner found: opening the web app during the startup catch-up left a finished game "Waiting for stats" until the server restarted. The jobs were fine (11 box scores stored in 12 s); `stale-while-revalidate` let the browser hand the app its stale copy while it fetched the new one in the background (reproduced in Chromium). Android's OkHttp disk cache does the same within 60 s.
- Changed: day and game 200s send `public, max-age=0, s-maxage=60` (`apps/server/src/api/app.ts`), header test red then green, VISION §10, D-044 amended.
- Decisions: D-051 (owner picked the server header over an app cache-buster).
- Reviewer: approve; 0 findings; the CDN note went to the parking lot for S10b.

### Review fixes for PR #18, round 2 — 2026-10-21 — PR #18 (`s09-main-page`)
- Changed: `dateParamFor` (stepping onto the latest day drops `?date=`; before, ‹ then › pinned Today to it), ‹/› disabled while the next day loads, shared `dnpText`/`sentenceCase` (`pnpm recap` now prints "DNP — Coach's decision" like the app), shared `localDate`, one `runSeedJob` for the seeds and the screenshot API; `api-meta` dataUpdatedAt cases get 30 s (they migrate their own PGlite; failed once at 5.6 s). +9 tests (1258).
- Review input: `/code-review` (10 comments): fixed 5, 2 already parked (pull-to-refresh old day, Intl formatters), 1 parked (a failing stepped-to day hides the stepper), 2 declined on their threads ("No games yet." pull to refresh; sharing score/status words with the recap).
- Reviewer: approve; 0 findings; 3 minors left (day-message buttons still work while loading, arrows grey briefly on a prefs change, `localDate`'s device-zone default untested).
- Owner: Android rechecked; the offline-step question is settled (keep the old day, name the day that didn't open) and queued as a small fix in S10a.

### S12 — Search, favorites, hidden — 2026-10-21 — PR (`s12-favorites`)
- Changed: `apps/mobile`: Search tab (`src/app/search.tsx`), Favorites/Hidden cards with Remove + Undo in `settings.tsx`, `src/state/prefs.ts` (`Mark`, `markOf`, `setMark`, toggles; `restorePrefs` drops only bad IDs) + store actions, `src/lib/players.ts`, `src/api/queries.ts` (`useSearch`, `usePlayers`), components `search-field` (shared with the country search), `player-item`; `placeholder.tsx` deleted; `scripts/screenshots.ts` (9 new states incl. the favorite/hide flows). +59 tests (1317).
- Decisions: D-052. Owner: favorites/hidden never in the page URL; a deselected league is gone from Search and both lists; everything else delegated to Claude.
- Read these: `docs/superpowers/specs/2026-10-21-s12-favorites.md`, `src/state/prefs.ts`, `src/lib/players.ts`, `src/app/search.tsx`, `src/app/settings.tsx`.
- Red/green: test-writer red commit 2ccfb27 (46 failing on "not implemented", 4 restore cases on value), then green. 6 tasks, 2 fix rounds (offline unreachable after the first search; flow-hidden's gone-check before Today was on screen).
- Reviewer: approve, 0 findings, at 64c3458 and again at handoff over 0cede1a; its doc minor fixed (spec amended for the star-first row), task minors parked.
- Rulings: 5 (restore test row replaced, silent 200 cap, league filter, optional live check in Task 4, deferred minors + empty-copy note).
- Live: Android checked by the owner (criteria 2–4); found Undo missing on Android (old mark read inside a state updater) and Hide louder than the star — both fixed in 0cede1a, not yet rechecked on the phone.

### Review fixes for PR #19 — 2026-10-22 — PR #19 (`s12-favorites`)
- Changed: `apps/mobile/src/lib/players.ts` (`listRows` keeps only requested IDs; new `listView`; `searchView` errors only without data), `src/api/queries.ts` (search placeholder dropped on a league change), `src/state/prefs.ts` (`restorePrefs`: an ID in both lists stays only in hidden), `settings.tsx` (count waits for the list; "None of your favorites play in the leagues you have on."), theme `font.icon`; after the handoff review, a placeholder with no requested row reads as loading, not "none shown". +13 tests (1330).
- Review input: `/code-review` (9 comments): fixed 8 (the two stale-list comments by one `listRows` filter), deferred 1 (Caption / touch-target duplication → parking lot, at S13's third copy). Decisions by Claude on the owner's say-so.
- Red/green: 15 new or changed tests failed (old `listRows` signature, missing `listView`, old refetch/league/restore behaviour, the placeholder flash), then passed.
- Reviewer: approve; 0 findings; minor 1 fixed (placeholder flash), 2 notes left (one cited test passes on the old code at runtime; the none-shown copy also covers IDs the server no longer knows).

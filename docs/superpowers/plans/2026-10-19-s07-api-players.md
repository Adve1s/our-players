# S07 — API: players, search, countries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `GET /v1/players/search`, `/v1/players?ids=`, `/v1/players/{id}`, `/v1/countries`, CORS with configurable origins, and a typed API client in `packages/shared`, tested against the in-memory app.

**Architecture:** New routes in `apps/server/src/api/app.ts` follow S06's pattern (`parse`, `parseQuery`, `badRequest`, `errorBody`), with the queries in `src/api/players.ts` and `src/api/countries.ts`. The contract grows in `packages/shared/src/contract/`. The client (`packages/shared/src/client.ts`) is fetch + contract parse with an injected `fetch`. Test data comes from S06's `seedApiDb()`, extended.

**Tech Stack:** Hono 4.13.13 (`hono/cors`, `app.request`), zod 4.6 (`z.discriminatedUnion`, `z.partialRecord`), Drizzle 0.45 on PGlite, Vitest. Check Hono/zod/Drizzle APIs with context7 before writing code against them.

**Spec:** `docs/superpowers/specs/2026-10-19-s07-api-players.md` (approved 2026-10-19, including its "Owner decisions" and "Calls I made"). Read it first; this plan doesn't repeat its schema listing.

## Global Constraints

From SESSIONS.md §S07, verbatim:

**Out of scope:** app screens.

**Acceptance criteria**
1. Search: "porzingis", "PORZ", "merzlikins" and "girgen" find the right players; an empty query → 400; the limit is respected.
2. Player detail: season stats per kind; game log newest first, at most 10; nationality carries its source (Embiid: USA, `override`).
3. Countries: only countries with active players, with counts per league; Embiid counts for USA, not CMR.
4. CORS: an allowed origin gets the headers; others don't.
5. Typed client tests pass against the in-memory app.
6. `pnpm verify` green.

Also:
- Out of scope (other sessions): per-IP rate limit and `/health/data` (S10), the production CORS origin (S10/S14).
- No new dependency (`hono/cors` ships with Hono). No migration.
- Error body `{ "error": { "code", "message" } }`: `BAD_REQUEST` 400 (via `badRequest()`), `NOT_FOUND` 404, `INTERNAL` 500.
- Response schemas are plain `z.object`, never strict.
- Request logs never contain a query string (the existing middleware covers new routes).
- Search order (owner): `active DESC`, word start `DESC`, `last_name`, `first_name`, `public_id`; limit 20. Hidden players are not filtered.
- Game log (owner): played and DNP lines, newest first by `start_time_utc`, at most 10.
- Season stats: `currentSeason(db, league, now)`, season types REG and POST only.
- `apps/mobile` never imports `apps/server`; the client lives in `packages/shared`.
- Never weaken, skip or delete a test. Updating an existing `loadConfig` `toEqual` expectation to include the new `corsOrigins` field (Task 5) is the one allowed change to an existing assertion.
- Owner steps are not plan tasks: after the final review the controller runs the curls on the owner's dev DB (search, a player, countries, an `Origin` header).

## Review Focus

1. A query with LIKE wildcards (`%`, `_`) → treated as literal characters: `q=%` → 200, `players: []`. Pinned in Task 3.
2. A query with surrounding spaces (`q=%20porz%20`) → trimmed, finds Porziņģis. Pinned in Task 3.
3. A player with no current team (Kārlis Čukste, the seed's free agent) → `team: null` in search and detail. Pinned in Tasks 3 and 4.
4. A player with no season stats and no lines (Embiid) → 200 with `seasonStats: []`, `gameLog: []`. Pinned in Task 4.
5. An error response to an allowed origin (a 400) still carries `Access-Control-Allow-Origin`, so the web app can read the error. Pinned in Task 5.

---

### Task 1: Contract additions

**Files:**
- Modify: `packages/shared/src/contract/params.ts`, `packages/shared/src/contract/responses.ts`, `packages/shared/src/contract/index.ts`, `packages/shared/src/model.ts:90` (the `shortcut:` comment)
- Test: `packages/shared/test/contract.test.ts`

**Interfaces:**
- Produces (all exported from `@our-players/shared`):
  - `searchQuerySchema` = `z.object({ q: z.string().trim().min(1).max(50) })`
  - `idsQuerySchema` = `z.object({ ids: csv(publicIdSchema) })` (reuse the private `csv`; required, `''` → `[]`, ≤ `MAX_LIST`)
  - `lineSchema` (S06's private `line`, renamed and exported; `playerRowSchema` uses it unchanged)
  - `playerSummarySchema` / `PlayerSummary`, `playersResponseSchema` / `PlayersResponse`, `seasonStatsEntrySchema` / `SeasonStatsEntry`, `gameLogEntrySchema` / `GameLogEntry`, `playerResponseSchema` / `PlayerResponse`, `countriesResponseSchema` / `CountriesResponse` — fields exactly as the spec's "Contract additions" block. `gameLogEntrySchema.game` is S06's `gameSummary`; `side` is S06's `side`. Season-stat entries: `{ kind, season: z.string(), seasonType, basis: z.enum(['totals', 'per_game']), stats }`, stats as plain `z.object`s with `z.number()` fields (goalie `savePct` `.optional()`). `counts` = `z.partialRecord(leagueSchema, z.int().positive())`. `nationalitySource` = `nationalitySourceSchema.nullable()`; `positionGroup` = `positionGroupSchema`; `birthDate` = `z.iso.date().nullable()`.

- [ ] **Step 1: Write the failing tests** (add a `describe` per schema to `contract.test.ts`)
  - `idsQuerySchema`: `{ ids: 'nhl-1,nba-2' }` → `ids: ['nhl-1', 'nba-2']`; `{ ids: '' }` → `[]`; `{}` fails; `{ ids: 'x-1' }` fails; 201 IDs fail.
  - `searchQuerySchema`: `{ q: '  porz ' }` → `q: 'porz'`; `''`, `'   '`, `{}` and 51 × `'a'` fail; 50 × `'a'` passes.
  - `seasonStatsEntrySchema`: a goalie entry without `savePct` parses; a skater entry missing `goals` fails; an unknown `kind` fails.
  - `countriesResponseSchema`: `{ countries: [{ code: 'LVA', counts: { NHL: 6 } }] }` parses (NBA absent); `counts: { NHL: 0 }` fails; `code: 'XX'` fails.
  - `playerSummarySchema`: a summary with an extra unknown key parses, and the key is stripped (non-strict).
- [ ] **Step 2: Run** `pnpm test contract` — expect failures on the missing exports (`undefined` schemas / import errors), nothing else.
- [ ] **Step 3: Implement** the schemas and exports. Update the `model.ts` `shortcut:` to say the read side is typed by `seasonStatsEntrySchema` (S07) and the model stays a record the jobs store as mapped.
- [ ] **Step 4: Run** `pnpm test contract` → PASS; `pnpm verify` → green.
- [ ] **Step 5: Commit** `feat(shared): contract for players, search, season stats, game log and countries`

### Task 2: Seed for the player endpoints

**Files:**
- Modify: `apps/server/test/api-seed.ts`
- Test: `apps/server/test/api-seed.test.ts`

**Interfaces:**
- Consumes: `upsertPlayers`, `upsertTeams`, `rosterJob`, `seasonStatsJob`, `runJob`, `loadNationalityOverrides()` (`src/nationality/overrides.ts`, default path = the committed file), `mapTeams`, `mapAthlete`, `espnUrls.byathlete('2026', 2, 1)`, `nhlUrls.summary('skater' | 'goalie', '20252026', 2)`; fixtures `espn-nba/teams/2026-10-18`, `espn-nba/athlete/3059318` (Embiid), `espn-nba/athlete/3136195` (Towns), `nhl/skater-summary-reg-all/20252026`, `nhl/goalie-summary-reg-all/20252026`, `espn-nba/byathlete/2026` (cut `pagination` to `{ pages: 1 }` in memory, as `jobs-nba.test.ts` `pageOne` does).
- Produces (exported constants): `EMBIID = 'nba-3059318'`, `TOWNS = 'nba-3136195'`, `GUSTAVSEN = 'nhl-1000001'`, `FORSLING = 'nhl-8478055'` (Gustav Forsling, FLA roster fixture). Kārlis Čukste stays `FREE_AGENT`.

Seed order: `upsertPlayers` Gustavsen (`{ ...freeAgent, publicId: GUSTAVSEN, externalId: '1000001', firstName: 'Ola', lastName: 'Gustavsen', birthCountry: 'NOR', currentTeamExternalId: null }`) → existing roster/results/schedule runs → existing Girgensons/free-agent upsert → `upsertTeams` (NBA teams fixture) → `upsertPlayers([embiid, towns], await loadNationalityOverrides())` → `season-stats` NHL → `season-stats` NBA (through the seed's `run`, so a failed job throws).

- [ ] **Step 1: Write the failing tests** in `api-seed.test.ts`:
  - Gustavsen is stored inactive (the roster run deactivated him).
  - Embiid: `nationality 'USA'`, `nationalitySource 'override'`, `birthCountry 'CMR'`, active; Towns: `'DOM'`, `'override'`, `'USA'`.
  - `season_stats` has a 2025-26 REG row of kind `hockey_skater` for Girgensons, `hockey_goalie` for Merzlikins, `basketball_player` for Towns.
- [ ] **Step 2: Run** `pnpm test api-seed` — the new tests fail on missing rows / wrong values.
- [ ] **Step 3: Implement** the seed additions above (add the new fixture URLs to the `fakeClient` routes).
- [ ] **Step 4: Run** `pnpm test api` → every S06 API test and the new seed tests PASS.
- [ ] **Step 5: Commit** `test(server): API seed gains a former player, Embiid and Towns with overrides, and season stats`

### Task 3: Search, players by ID, countries

**Files:**
- Create: `apps/server/src/api/players.ts`, `apps/server/src/api/countries.ts`
- Modify: `apps/server/src/api/app.ts`, `apps/server/src/db/players.ts:14` (`shortcut:` wording: the query goes through `searchName` too)
- Test: `apps/server/test/api-players.test.ts` (new; `beforeAll(seedApiDb, 60_000)` and the same `setup()`/`get(path, status, schema)` helper as `api-days.test.ts`)

**Interfaces:**
- Consumes: Task 1 schemas/types; Task 2 seed constants; `searchName` (`src/db/players.ts`).
- Produces:
  - `searchPlayers(db: Db, term: string, leagues: ReadonlySet<League>): Promise<PlayersResponse>` — `term` already normalized.
  - `playersByIds(db: Db, ids: readonly PublicId[]): Promise<PlayersResponse>` — request order, unknown left out, duplicates once.
  - `loadCountries(db: Db, leagues: ReadonlySet<League>): Promise<CountriesResponse>`
  - A private summary select (`players` left join `teams` on `current_team_id`) + row → `PlayerSummary` mapper in `players.ts`, which Task 4 reuses.
  - Routes in `app.ts`, `/v1/players/search` registered before `/v1/players` and before Task 4's `/v1/players/:playerId`: search parses `searchQuerySchema` from `c.req.query()`, then `searchName(q)`; an empty result of that → `badRequest('q: nothing to search for')`; leagues = `parseQuery(c).leagues`. `/v1/players` parses `idsQuerySchema`. `/v1/countries` uses `parseQuery(c).leagues`.

SQL (search), with `$t` the normalized term:
```sql
WHERE strpos(search_name, $t) > 0 AND league IN (…)
ORDER BY active DESC,
         strpos(' ' || translate(search_name, '-', ' '), ' ' || $t) > 0 DESC,
         last_name, first_name, public_id
LIMIT 20
```
Add a `shortcut:` on it: full scan of `players`, add a `pg_trgm` index if search shows in the p95.

Countries: `nationality, league, count(*)` where `active`, `nationality IS NOT NULL`, league in the set, grouped; folded to one entry per code, ordered by code.

- [ ] **Step 1: Write the failing tests** (every response parsed with its schema):
  - `it.each` `['porzingis', 'PORZ', 'Porziņģis']` → `players[0].id === PORZINGIS`.
  - `it.each` `['merzlikins', 'MERZĻIKINS']` → first is `MERZLIKINS`; `'girgen'` → first is `GIRGENSONS`; `it.each` `['cukste', 'Čukste']` → first is `FREE_AGENT`, with `team: null`.
  - `'gus'` → ids exactly `[FORSLING, GIRGENSONS, GUSTAVSEN]`.
  - `'ree'` → `Aston-Reese` (Z. Aston-Reese) and `Reese` (Julian Reese) both before `Green` (Draymond Green) — assert by last names' indices.
  - `'mer'` + `leagues=NBA` → ids exactly `['nba-3074213']` (Omer Yurtseven).
  - `'a'` → exactly 20 players.
  - `'%'` → 200, `players: []`; `'%20porz%20'` → first is `PORZINGIS` (Review Focus 1–2).
  - 400 `BAD_REQUEST` whose message contains `q`: no `q`, `q=`, `q=%20%20%20`, `q=` + 51 × `a`, `q=%CC%81` (a lone combining accent). `q=porz&leagues=xx` → 400 naming `leagues`.
  - a search result row carries `league`, `position`, `nationality`, `active`, `team` (Porziņģis: `team.abbrev 'GS'`, `nationality 'LVA'`, `active true`).
  - `?ids=` `${GIRGENSONS},nhl-999,${PORZINGIS},${GIRGENSONS}` → ids `[GIRGENSONS, PORZINGIS]`; `ids=` → `[]`; no `ids` → 400 naming `ids`; `ids=bad` → 400; 201 IDs → 400.
  - countries: LVA `counts` `{ NHL: 6, NBA: 1 }`; USA `{ NHL: 19, NBA: 1 }`; DOM `{ NBA: 1 }`; no CMR, no NOR entry; `leagues=NBA` → no entry has an `NHL` count and no CAN entry; codes are sorted.
  - If a pinned count differs once the seed is in place, stop and record a `Ruling:` with the query output before changing the number — never loosen to `toBeGreaterThan`.
- [ ] **Step 2: Run** `pnpm test api-players` — failures are 404 `NOT_FOUND` (no route) only.
- [ ] **Step 3: Implement** `players.ts` (search, by IDs, summary mapper), `countries.ts`, the routes.
- [ ] **Step 4: Run** `pnpm test api` → PASS.
- [ ] **Step 5: Commit** `feat(server): /v1/players/search, /v1/players?ids= and /v1/countries`

### Task 4: Player detail

**Files:**
- Modify: `apps/server/src/api/players.ts`, `apps/server/src/api/app.ts`
- Test: `apps/server/test/api-players.test.ts`

**Interfaces:**
- Consumes: Task 3's summary select/mapper; `currentSeason` (`src/db/games.ts`); `lineSchema`, `seasonStatsEntrySchema`, `playerResponseSchema` types.
- Produces: `loadPlayer(db: Db, publicId: PublicId, now: Date): Promise<PlayerResponse | null>` (null = no such player); route `GET /v1/players/:playerId` with `z.object({ playerId: publicIdSchema })` → 404 `NOT_FOUND` `no player <id>` when null.

Season stats: rows of `currentSeason(db, player.league, now)` with `season_type IN ('REG', 'POST')`, ordered by `season_type` then `kind`, each parsed with `seasonStatsEntrySchema.parse` (a stored row the contract rejects throws → 500). Game log: `stat_lines` ⋈ `games` ⋈ home/away `teams` aliases (as in `src/db/games.ts`), `ORDER BY games.start_time_utc DESC LIMIT 10`; played → `{ type: 'line', line: lineSchema.parse({ kind, stats }) }`, else `{ type: 'dnp', reason: dnp_reason }`; `side` from `stat_lines.team_id === games.away_team_id`; `game` fields as `dayGames` builds them.

- [ ] **Step 1: Write the failing tests**:
  - Girgensons: `team.abbrev 'CBJ'`, `birthCountry 'LVA'`, `nationalitySource 'birth'`; `seasonStats` is one entry `{ kind: 'hockey_skater', season: '2025-26', seasonType: 'REG', basis: 'totals' }` with `stats.gamesPlayed 74`, `goals 9`, `assists 11`, `points 20`, `plusMinus 1`, `shots 89`, `toiPerGameSeconds 886.054`.
  - Merzlikins: one `hockey_goalie` REG entry, `gamesPlayed 30`, `wins 14`, `losses 11`, `otLosses 3`, `savePct 0.883`, `shutouts 1`; his log is one `line` entry for `nhl-2025020760`, `side 'away'`.
  - Towns: one `basketball_player` REG entry, `gamesPlayed 75`, `points 1504`, `rebounds 889`, `fgPct` ≈ `0.50097` (`toBeCloseTo(0.501, 3)`); `nationality 'DOM'`, `nationalitySource 'override'`, `birthCountry 'USA'`.
  - Embiid: `nationality 'USA'`, `nationalitySource 'override'`, `birthCountry 'CMR'`, `seasonStats: []`, `gameLog: []` (Review Focus 4).
  - Porziņģis: log game ids `['nba-401810899', 'nba-401810839']` (2026-03-23, then 2026-03-16), both `type 'line'`; the 03-16 line has `points 30`, `side 'away'`.
  - Leons (`LEONS`): the `nba-401810899` entry is `{ type: 'dnp', reason: "COACH'S DECISION" }`.
  - Čukste (`FREE_AGENT`): `team: null` (Review Focus 3).
  - `/v1/players/nhl-999` → 404 `NOT_FOUND`; `/v1/players/bad` → 400 naming `playerId`.
  - Cap, on its own `createTestDb()` (`beforeAll`, closed in `afterAll`): `upsertTeams` with `db-data`'s two NHL teams, `upsertPlayers([girgensons])`, then 11 games `{ ...nhlGame, publicId: 'nhl-20260200NN', externalId: '20260200NN', gameDate: 2026-10-NN, startTimeUtc: 2026-10-NNT23:00Z }` for NN = 01…11, each with `upsertStatLines(db, id, [{ ...girgensonsLine, gamePublicId: id }])` → `gameLog` has 10 entries, first `nhl-2026020011`, last `nhl-2026020002`.
- [ ] **Step 2: Run** `pnpm test api-players` — the new tests fail on 404 (no route) / missing route only.
- [ ] **Step 3: Implement** `loadPlayer` and the route.
- [ ] **Step 4: Run** `pnpm test api` → PASS.
- [ ] **Step 5: Commit** `feat(server): /v1/players/:playerId with bio, nationality source, season stats and game log`

### Task 5: CORS

**Files:**
- Modify: `apps/server/src/api/app.ts`, `apps/server/src/config.ts`, `apps/server/src/main.ts`
- Test: `apps/server/test/api-cors.test.ts` (new; an empty `createTestDb()` is enough — `/v1/meta` answers on it), `apps/server/test/config.test.ts`

**Interfaces:**
- Produces: `ApiDeps.corsOrigins?: readonly string[]` (absent = no origin allowed); `app.use('/v1/*', cors({ origin: [...corsOrigins], allowMethods: ['GET'] }))` registered after the logging middleware, before the routes. `loadConfig(env)` returns `corsOrigins: string[]`: `CORS_ORIGINS` split on `,`, trimmed, empties dropped; unset or empty → `['http://localhost:8081']`; an entry that isn't exactly `new URL(entry).origin` (unparseable, a path, a trailing slash) throws `CORS_ORIGINS: "<entry>" is not an origin (scheme://host[:port])`. `main.ts` passes `corsOrigins` to `createApp`.

- [ ] **Step 1: Write the failing tests**:
  - `createApp({ …, corsOrigins: ['http://localhost:8081'] })`: `GET /v1/meta` with `Origin: http://localhost:8081` → `access-control-allow-origin` = that origin, `vary` contains `Origin`.
  - `Origin: https://evil.example` → no `access-control-allow-origin`; no `Origin` header → none.
  - `OPTIONS /v1/meta` with the allowed `Origin` and `Access-Control-Request-Method: GET` → 204, `access-control-allow-methods` contains `GET`.
  - `GET /v1/days/2026-02-30` with the allowed origin → 400 and still `access-control-allow-origin` (Review Focus 5).
  - `GET /health` with the allowed origin → no `access-control-allow-origin`.
  - `config.test.ts`: default `corsOrigins` `['http://localhost:8081']` (unset and `''`); `'https://a.example, http://localhost:8081'` → both; `it.each` `['https://a.example/', 'https://a.example/app', 'localhost:8081', 'nope']` throw `/CORS_ORIGINS/`. Add `corsOrigins: ['http://localhost:8081']` to the three existing whole-object `toEqual` expectations.
- [ ] **Step 2: Run** `pnpm test cors config` — failures are the missing headers / missing field only.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm test api cors config` → PASS.
- [ ] **Step 5: Commit** `feat(server): CORS on /v1 for configured origins (CORS_ORIGINS)`

### Task 6: Typed API client

**Files:**
- Create: `packages/shared/src/client.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `apps/server/test/api-client.test.ts` (new; `seedApiDb()` in `beforeAll`)

**Interfaces:**
- Consumes: every response schema (S06's and Task 1's); `Prefs`, `League`, `PublicId`.
- Produces (exported from `@our-players/shared`):
  - `type FetchLike = (url: string) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>`
  - `class ApiError extends Error { readonly status: number; readonly code: string }` (`name = 'ApiError'`)
  - `createApiClient(baseUrl: string, fetch: FetchLike)` returning `{ meta(): Promise<MetaResponse>; day(gameDate: string, prefs: Prefs): Promise<DayResponse>; game(gameId: string, prefs: Prefs): Promise<GameResponse>; searchPlayers(q: string, leagues: ReadonlySet<League>): Promise<PlayersResponse>; players(ids: readonly string[]): Promise<PlayersResponse>; player(id: string): Promise<PlayerResponse>; countries(leagues: ReadonlySet<League>): Promise<CountriesResponse> }`, and `type ApiClient = ReturnType<typeof createApiClient>`.
  - Query strings via `URLSearchParams`; prefs always write all four keys `leagues`, `countries`, `fav`, `hide` (comma-joined); path segments `encodeURIComponent`. Non-2xx: body parsed with `errorResponseSchema` → `ApiError(status, code, message)`; unreadable or other body → `ApiError(status, 'HTTP_ERROR', 'HTTP <status>')`. 2xx → `schema.parse(body)`.

- [ ] **Step 1: Write the failing tests** (`client = createApiClient('http://api.test', (url) => app.request(url))`; `prefs(…)` helper building a `Prefs` with all leagues and empty sets by default):
  - `meta()` → two leagues, NHL first.
  - `day('2026-03-16', prefs({ countries: ['LVA'] }))` → the first game's rows include `PORZINGIS`; with `hidden: [PORZINGIS]` too → no game has a row for him.
  - `game('nba-401810839', prefs({ countries: ['LVA'] }))` → `periodScores` non-null, a `PORZINGIS` row.
  - `searchPlayers('porz', new Set(['NBA']))` → first `PORZINGIS`; `players([GIRGENSONS, PORZINGIS])` → those ids in order; `player(EMBIID)` → `nationalitySource 'override'`; `countries(new Set(['NBA']))` → contains `LVA` with `{ NBA: 1 }`.
  - `searchPlayers('', …)` rejects with `ApiError` `{ status: 400, code: 'BAD_REQUEST' }`; `player('nhl-999')` rejects with `{ status: 404, code: 'NOT_FOUND' }`.
  - A `FetchLike` resolving `{ ok: false, status: 502, json: () => Promise.reject(new SyntaxError('html')) }` → `ApiError` `{ status: 502, code: 'HTTP_ERROR' }`.
  - A `FetchLike` resolving `{ ok: true, status: 200, json: async () => ({ leagues: 'nope' }) }` → `meta()` rejects (a ZodError, not `ApiError`).
- [ ] **Step 2: Run** `pnpm test api-client` — fails on the missing `createApiClient` export only.
- [ ] **Step 3: Implement** `client.ts` and the export.
- [ ] **Step 4: Run** `pnpm verify` → green (mobile typecheck included: shared is compiled by the app too).
- [ ] **Step 5: Commit** `feat(shared): typed API client (fetch + contract parse)`

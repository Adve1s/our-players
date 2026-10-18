# S07 — API: players, search, countries: design

Session S07, branch `s07-api-players`. Spec: `docs/SESSIONS.md` §S07. The last v1 read endpoints, CORS, and the typed client the app (S08+) imports. Routes follow S06's pattern in `apps/server/src/api/app.ts`: `parseQuery(c)` for preferences, path params as named zod objects, `badRequest()` → 400 `BAD_REQUEST`, unknown → 404 `NOT_FOUND`, anything thrown → logged 500 `INTERNAL`.

## Contract (verbatim from SESSIONS.md §S07)

**Out of scope:** app screens.

**Acceptance criteria**
1. Search: "porzingis", "PORZ", "merzlikins" and "girgen" find the right players; an empty query → 400; the limit is respected.
2. Player detail: season stats per kind; game log newest first, at most 10; nationality carries its source (Embiid: USA, `override`).
3. Countries: only countries with active players, with counts per league; Embiid counts for USA, not CMR.
4. CORS: an allowed origin gets the headers; others don't.
5. Typed client tests pass against the in-memory app.
6. `pnpm verify` green.

Also out of scope (other sessions): the per-IP rate limit and `/health/data` (S10), the production CORS origin (S10/S14). No new dependency (`hono/cors` ships with Hono). No migration.

## Owner decisions (brainstorming, 2026-10-19)
- **Search order:** current players first. Within current players, word-start matches before inside-a-word matches; then former players the same way.
- **Game log:** DNP lines count as entries (with ESPN's reason), like the day cards. "Not in lineup" doesn't: no line is stored for it.

## Contract additions (`packages/shared/src/contract/`, exported from the index)

Same rules as S06: plain `z.object`, never strict.

```ts
// params.ts
searchQuerySchema = z.object({ q: z.string().trim().min(1).max(50) })   // leagues come from prefsQuerySchema
idsQuerySchema    = z.object({ ids: csv(publicIdSchema) })               // required; "" → []; ≤ 200 (MAX_LIST)

// responses.ts
lineSchema            // S06's `line`, now exported (the game log reuses it)
playerSummarySchema = {
  id: publicId, league, firstName, lastName, position: string,
  team: { abbrev, name } | null,         // current team
  nationality: countryCode | null,
  active: boolean,
}
playersResponseSchema = { players: PlayerSummary[] }                     // search and ?ids=

seasonStatsEntrySchema = discriminatedUnion('kind', [                    // stats typed per kind, keys as the mappers store them
  { kind: 'hockey_skater',     season, seasonType, basis, stats: { gamesPlayed, goals, assists, points, plusMinus, shots,
                                                                   pim, powerPlayGoals, toiPerGameSeconds } },
  { kind: 'hockey_goalie',     …, stats: { gamesPlayed, gamesStarted, wins, losses, otLosses, saves, shotsAgainst,
                                           goalsAgainst, savePct?: optional, goalsAgainstAverage, shutouts, toiSeconds } },
  { kind: 'basketball_player', …, stats: { gamesPlayed, minutes, points, rebounds, assists, turnovers, steals, blocks, fouls,
                                           fgMade, fgAttempted, threeMade, threeAttempted, ftMade, ftAttempted,
                                           fgPct, threePct, ftPct } },
])
gameLogEntrySchema = discriminatedUnion('type', [
  { type: 'line', game: gameSummary, side: 'away' | 'home', line },
  { type: 'dnp',  game: gameSummary, side, reason: string | null },
])
playerResponseSchema = playerSummary + {
  positionGroup, jersey: string | null, birthDate: isoDate | null, birthCity: string | null,
  birthCountry: countryCode | null,
  nationalitySource: 'birth' | 'override' | null,   // "nationality with its source"; the app marks "override"
  seasonStats: SeasonStatsEntry[],
  gameLog: GameLogEntry[],                          // newest first, ≤ 10
}
countriesResponseSchema = { countries: [{ code: countryCode, counts: partialRecord(league, positive int) }] }
```

Season stats were an untyped `Record<string, number>` (model `shortcut:`, parking lot). They're typed here, at the read side only: the API parses each stored row with this schema, so a mapper that drifts from it fails loudly (500 + a failing test) instead of the app showing `undefined`. The model and the jobs stay as they are; the `shortcut:` comment in `model.ts` is updated to say where the type now lives.

## Routes

| Route | Query | Answer |
|---|---|---|
| `GET /v1/players/search` | `q` (required), `leagues` | `playersResponse`, ≤ 20 |
| `GET /v1/players` | `ids` (required) | `playersResponse` in the order asked, unknown IDs left out, duplicates once |
| `GET /v1/players/:playerId` | — | `playerResponse`, or 404 `no player <id>` |
| `GET /v1/countries` | `leagues` | `countriesResponse` |

`/v1/players/search` is registered before `/v1/players/:playerId`. `leagues` (and any other preference given) goes through `parseQuery(c)`, so a repeated or bad preference is a 400 as in S06. No `Cache-Control` on these (VISION §10 names only day and game responses).

## Search (`src/api/players.ts`)

- The query is trimmed and normalized with the existing `searchName()` — the same function that writes `players.search_name` — so "Porziņģis", "PORZ" and "porz" all become plain lowercase ASCII and match the stored "kristaps porzingis". A query that is empty after normalizing (only combining marks) is a 400 too: it would otherwise match everyone.
- Match: `strpos(search_name, $q) > 0`. `strpos`, not `LIKE`: a `%` or `_` in the query is just a character, nothing to escape.
- Word start: `strpos(' ' || translate(search_name, '-', ' '), ' ' || $q) > 0` — the start of the first name, the last name, or a part after a hyphen ("reese" in Aston-Reese).
- `WHERE league IN (prefs.leagues)`; `ORDER BY active DESC, word_start DESC, last_name, first_name, public_id LIMIT 20`.
- Hidden players are not filtered out: search is how a user finds a hidden player to unhide (S12).
- ø, ł, đ (letters NFD doesn't decompose) keep S02b's `shortcut:`: both sides go through `searchName`, so the source's own spelling always matches; only an ASCII query for such a name misses. None in the fixtures or the owner's dev data so far.
- The limit is VISION §10's fixed 20 (my call: no `limit` parameter, nobody needs another size yet).
- A full scan of `players` (~1,500 rows a season): `shortcut:` comment, add a `pg_trgm` index if search ever shows in the p95.

## Player detail (`src/api/players.ts`)

Three queries:
1. The player with his current team (`players` left join `teams`).
2. Season stats: `currentSeason(db, player.league, now)` (S04b's rule), then that season's `season_stats` rows with `season_type` in REG, POST — VISION §4.4: "regular season, plus playoffs when present"; PRE is left out. Ordered REG, POST. Each row is parsed with `seasonStatsEntrySchema`. No current season → `[]`.
3. Game log: `stat_lines` join `games` and both teams, `ORDER BY games.start_time_utc DESC LIMIT 10`. A played line → `{ type: 'line', line }` (parsed with `lineSchema`), a DNP line → `{ type: 'dnp', reason }`. `side` = the line's `team_id` against the game's away/home team. The game summary uses S06's fields.

`createApp` already has `now`; the route passes `now()`.

## Players by ID and countries

- `?ids=`: one `WHERE public_id IN (…)` query, then ordered as asked. Not filtered by league: the favorites and hidden lists show every league.
- Countries: `SELECT nationality, league, count(*) FROM players WHERE active AND nationality IS NOT NULL AND league IN (…) GROUP BY 1, 2`, folded into one entry per country, ordered by code (the app sorts by name; shared has the names). A league with no players there is absent from `counts`.

## CORS

- `app.use('/v1/*', cors({ origin: [...corsOrigins], allowMethods: ['GET'] }))` from `hono/cors`. Checked in the installed Hono 4.13.13 source (`node_modules/hono/dist/middleware/cors/index.js`): an array origin sets `Access-Control-Allow-Origin` only for a listed origin, and appends `Vary: Origin` (which keeps the day responses' public cache per origin); a preflight answers 204. `/health` gets no CORS: the host's checker isn't a browser.
- `ApiDeps` gains `corsOrigins?: readonly string[]` (none by default, so `pnpm latency` and existing tests don't change).
- `loadConfig` reads `CORS_ORIGINS`, comma-separated, default `http://localhost:8081` (the Expo web dev server). Each entry must equal its own `new URL(x).origin`, else startup throws naming it — a trailing slash or a path would otherwise silently never match. `main.ts` passes it to `createApp`. The production origin is set at deploy (S10/S14).

## Typed client (`packages/shared/src/client.ts`, exported from the index)

The app imports it; the server tests run it against `createApp`. It lives in shared because `apps/mobile` may not import `apps/server` (rule 10) and the tests can't import the app.

```ts
type FetchLike = (url: string) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;
class ApiError extends Error { status: number; code: string }

createApiClient(baseUrl: string, fetch: FetchLike) → {
  meta(), day(gameDate, prefs), game(gameId, prefs),
  searchPlayers(q, leagues), players(ids), player(id), countries(leagues),
}
```

- `fetch` is injected: the app passes the global `fetch`, tests pass `(url) => app.request(url)`. A structural type, because `packages/shared` has neither DOM nor Node types.
- Prefs (`Prefs`, the Sets `selection.ts` takes) are written as `leagues=…&countries=…&fav=…&hide=…`, all four always, so the same prefs give the same URL (cache key). Path segments are `encodeURIComponent`ed.
- 2xx: `schema.parse(body)`; a contract mismatch throws the ZodError. Non-2xx: the error body → `ApiError(status, code, message)`; a body that isn't our error format (a proxy's HTML page) → `ApiError(status, 'HTTP_ERROR', 'HTTP <status>')`.
- No retries or caching: TanStack Query does that in the app (S08). `/health` is left out (the app doesn't call it).

## Test data (`test/api-seed.ts` additions)

All through real code: jobs over fixtures, or the repository calls the jobs use.
- A former player, "Ola Gustavsen" (NHL, NOR, no team), upserted **before** the roster run, so the real roster job deactivates him (its 3-team fetch is complete). He's the inactive row for search order and countries.
- The 30 NBA teams from the `teams` fixture; Embiid and Towns mapped from their `athlete` fixtures and upserted with the committed overrides file (as `jobs-nba.test.ts` AC4 does): Embiid USA/override (born CMR), Towns DOM/override (born USA).
- `season-stats` NHL (skater + goalie `-reg-all` fixtures) and NBA (byathlete page 1, `pagination` cut to one page in memory, as `jobs-nba.test.ts` does) at the end, after every player is stored. Season 2025-26 REG gives Girgensons a skater row, Merzlikins a goalie row, Towns a basketball row.

S06's API tests must stay green on the bigger seed.

The "at most 10" game-log case uses its own `createTestDb()` with 11 NHL games for one player written through `upsertTeams`/`upsertGames`/`upsertStatLines`: no player has more than two stored games in the fixtures.

## Tests → acceptance criteria

Every response is parsed with its contract schema (S06's `get(path, status, schema)` helper).

- **AC1** (`test/api-players.test.ts`): "porzingis", "PORZ", "Porziņģis" → `nba-3102531` first; "merzlikins", "MERZĻIKINS" → `nhl-8478007`; "girgen" → `nhl-8476878`; "cukste" and "Čukste" → Kārlis Čukste (a name stored with diacritics); "gus" → Gustav Forsling, Zemgus Girgensons, Ola Gustavsen in that order (current word start, current inside, former); "ree" → Aston-Reese and Julian Reese before Draymond Green (hyphen word start); "mer" with `leagues=NBA` → only Omer Yurtseven; "a" → exactly 20; `q` missing, `""`, `"   "` and 51 characters → 400 naming `q`; `leagues=xx` → 400.
- **`?ids=`**: request order kept, an unknown ID left out, a duplicate once; `ids` missing → 400; a malformed ID → 400; 201 IDs → 400; `ids=` → `[]`.
- **AC2**: Girgensons → one `hockey_skater` REG 2025-26 row with the fixture's values; Merzlikins → `hockey_goalie` with wins and save percentage; Towns → `basketball_player`, and DOM/`override`, birth country USA; Embiid → USA, `override`, birth country CMR; Porziņģis's log → 2026-03-23 then 2026-03-16, both `line`; Leons's log has the DNP entry with its reason; 11 stored games → the 10 newest, newest first; unknown ID → 404 `NOT_FOUND`; malformed ID → 400.
- **AC3**: LVA with its NHL and NBA counts from the seed; USA's NBA count is 1 (Embiid) and CMR is absent; NOR absent (Gustavsen is inactive); `leagues=NBA` → no NHL counts and no NHL-only country (CAN).
- **AC4** (`test/api-cors.test.ts`, `test/config.test.ts`): an allowed `Origin` → `Access-Control-Allow-Origin` = that origin and `Vary` contains `Origin`; another origin and no origin → no `Access-Control-Allow-Origin`; a preflight from the allowed origin → 204 with `GET` allowed; `/health` has no CORS header; `CORS_ORIGINS` parsing: default, two origins, an entry with a path or trailing slash throws.
- **AC5** (`test/api-client.test.ts`): each client method against `createApp` over the seed returns parsed data (meta; a day with `countries=LVA` shows Porziņģis; hiding him through the client's prefs removes him; a game; search; players; player; countries); a bad request → `ApiError` `BAD_REQUEST` 400; an unknown player → `ApiError` `NOT_FOUND` 404; a non-JSON error body → `HTTP_ERROR`.
- **AC6**: `pnpm verify`.

Proof for the owner: the test output, plus `curl` against `pnpm dev:server` on the owner's dev DB for search, a player, countries, and an `Origin` header.

## Calls I made (check these)
1. Season stats typed in the contract only (the read side), not in the model or the mappers.
2. Search limit fixed at 20, no `limit` parameter.
3. Search doesn't filter hidden players; `?ids=` doesn't filter by league.
4. Player detail: current season's REG and POST only (PRE left out, per VISION §4.4).
5. `CORS_ORIGINS` default `http://localhost:8081`; `/health` without CORS.
6. ø/ł/đ stay a `shortcut:`.
7. The client lives in `packages/shared` with an injected `fetch`.
8. The 10-game cap is tested on its own small DB written through the repositories, not the fixture seed.
9. A query that is empty once diacritics are removed → 400.
10. Basketball season stats are the source's totals (D-043); per-game averages for the player page stay with S13.

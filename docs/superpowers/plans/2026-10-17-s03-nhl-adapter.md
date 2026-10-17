# S03 — NHL adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** NHL raw JSON → the shared normalized model through pure mappers proven against every recorded fixture of an endpoint S03 maps, plus fetchers over the polite client and `pnpm inspect`.

**Architecture:** `apps/server/src/sources/nhl/` holds raw zod schemas, pure mappers (take `unknown`, parse inside, return model objects), URL builders and fetchers (`client.get` → `JSON.parse` → mapper). The mappers are specified first by the test-writer from the fixtures, then implemented. `pnpm inspect` runs a mapper over a fixture file.

**Tech Stack:** TypeScript strict, zod 4, Vitest 5, Biome, tsx.

**Spec:** `docs/superpowers/specs/2026-10-17-s03-nhl-adapter.md` — it holds the module layout, raw schemas, mapper outputs, mapping tables, error wording and the fixture test list; this plan doesn't repeat them. Read it before each task.

## Global Constraints

- **Out of scope:** DB writes and jobs (S04a/S04b), ESPN (S05).
- **Acceptance criteria**
  1. Every NHL fixture has at least one mapper test asserting specific values read from the raw JSON (no whole-object snapshots).
  2. Covered: skater line, goalie line with decision, OT and shootout games, preseason season type, scheduled vs final, period scores, TOI parsing, season-ID normalization.
  3. A malformed payload (mutated inside the test, never in the file) throws an error naming source and endpoint.
  4. Tests can't reach the network: the test setup fails any real fetch.
  5. `pnpm inspect nhl boxscore <id>` works.
  6. `pnpm verify` green.
- Owner rulings: AC1 exempts the bios fixtures (`skater-bios`, `goalie-bios`, `skater-bios-lva`, `goalie-bios-lva`); a box-score line with TOI `00:00` is a DNP line (`played: false`, `stats: null`, `dnpReason: null`).
- No new dependencies. Fixtures are never edited (mutate a copy inside a test). `apps/mobile` is not touched; `packages/shared` only gains `ESPN_COUNTRY_ALIASES`.
- No `any`; `unknown` + zod. Named exports; kebab-case files; comments explain why; `shortcut: <limit>, <when to upgrade>` for known limits.
- Red/green: Task 2's tests are not changed afterwards. If one looks wrong, stop and report it (owner decides).
- Small Conventional Commits; `pnpm verify` green before each commit, except Task 2's red-phase `test: NHL mapper spec from fixtures` (only the new tests may fail, only on "not implemented"). Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Look up zod 4 and Vitest APIs with context7 before writing code against them; confirm against the installed types under `node_modules`.

## Review Focus

Inputs no fixture contains; Task 2 covers each with a mutated copy of a fixture:
1. **A live game** (`gameState` `LIVE`, no `gameOutcome`, goals so far) → status LIVE, endedIn null, scores as given, period scores for periods 1..current.
2. **A postponed game** (`gameScheduleState` `PPD`, `gameState` `FUT`) → POSTPONED; `CNCL` → CANCELLED.
3. **Playoff double overtime** (`periodDescriptor` `{ number: 5, periodType: 'OT' }`) → period labels `1`,`2`,`3`,`OT`,`2OT`; `gameType` 3 → POST.
4. **A retired player's landing** (no `sweaterNumber`, no `currentTeamId`) → `jersey` null, `currentTeamExternalId` null, no throw.
5. **A goalie who played but faced no shots** (`toi` `"02:10"`, `shotsAgainst` 0, no `savePctg`) → played line, `savePct` null.

---

### Task 1: stubs, no-network setup, fixture loader, country alias scaffold

**Files:**
- Create: `apps/server/src/sources/nhl/games.ts`, `boxscore.ts`, `players.ts`, `season-stats.ts`; `vitest.setup.ts` (repo root); `apps/server/test/fixtures.ts`; `apps/server/test/no-network.test.ts`
- Modify: `vitest.config.ts` (`setupFiles: ['./vitest.setup.ts']`), `packages/shared/src/countries.ts`, `packages/shared/src/index.ts`

**Interfaces:**
- Produces (stubs, bodies `throw new Error('not implemented')`):
  - `games.ts`: `mapScore(raw: unknown): { games: Game[]; teams: Team[] }`; `mapSchedule(raw: unknown): { games: Game[]; teams: Team[] }`
  - `boxscore.ts`: `mapBoxscore(raw: unknown): { lines: StatLine[]; teams: Team[]; players: Player[] }`
  - `players.ts`: `mapRoster(raw: unknown, teamExternalId: string): { players: Player[]; warnings: string[] }`; `mapPlayerLanding(raw: unknown): { player: Player; warnings: string[] }`
  - `season-stats.ts`: `mapSkaterSummary(raw: unknown, seasonType: SeasonType): { seasonStats: SeasonStats[]; total: number }`; `mapGoalieSummary(raw: unknown, seasonType: SeasonType): { seasonStats: SeasonStats[]; total: number }`
  - `test/fixtures.ts`: `loadFixture(source: string, endpoint: string, id: string): unknown` — reads `apps/server/test/fixtures/<source>/<endpoint>/<id>.json` (path from `import.meta.url`) and returns a fresh parsed copy each call, so tests can mutate it.
  - `countries.ts`: `ESPN_COUNTRY_ALIASES: Readonly<Record<string, CountryCode>>` = `{ USA: 'USA', England: 'GBR', Scotland: 'GBR', Wales: 'GBR' }` with `// shortcut: aliases only; S05 adds the full ESPN country-name table and the lookup`; exported from `index.ts`.

- [ ] **Step 1: Write `no-network.test.ts`**: `a real fetch fails in tests` — `await expect(fetch('https://api-web.nhle.com/v1/score/2026-03-24')).rejects.toThrow(/network disabled in tests/)`. Run `pnpm test no-network`: FAIL (the request is attempted, or resolves).
- [ ] **Step 2: Write `vitest.setup.ts`**: replace `globalThis.fetch` with a function that rejects with `network disabled in tests: <url>`; register it in `vitest.config.ts`. Run `pnpm test`: all 210 old tests plus the new one pass. If PGlite tests break because PGlite fetches in Node, reject only `http:`/`https:` URLs and pass the rest to the original fetch; say which in the report.
- [ ] **Step 3: Write the stubs, `test/fixtures.ts` and the alias map** per Interfaces (types from `@our-players/shared`).
- [ ] **Step 4: Verify** — `pnpm verify` green; paste the test summary.
- [ ] **Step 5: Commit** — `feat(server): NHL mapper stubs and a no-network test setup`.

### Task 2 (*test-writer*): NHL mapper spec — red

**Files:**
- Create: `apps/server/test/nhl-games.test.ts`, `nhl-boxscore.test.ts`, `nhl-players.test.ts`, `nhl-season-stats.test.ts`

**Interfaces:**
- Consumes: Task 1's stubs and `loadFixture`; types from `@our-players/shared`.

The test-writer works from the spec's Mappers, Mapping tables, Errors and Test cases sections, VISION §6.2 and §8, and `docs/sources/nhl.md`. Every expected value is read from the raw fixture JSON by hand (cite the player/game ID in the test name or a comment), never from running code. No whole-object snapshots.

- [ ] **Step 1: Write the four test files** covering every row of the spec's Test cases table (each non-bios NHL fixture at least once; `right-rail/2025020760` as the expected period scores of the SO game), and:
  - AC2: skater line (all ten fields), goalie line with each decision W/L/OTL, the TOI 00:00 DNP line, OT and SO games (endedIn + period labels), preseason `PRE`, `FUT` → SCHEDULED vs `OFF`/`FINAL` → FINAL, TOI `"65:00"` → 3900 and `"12:49"` → 769, `seasonId` 20252026 → `"2025-26"` and 20262027 → `"2026-27"`.
  - AC3, `it.each` over every mapper: a mutated copy (a missing used field, a wrong type) throws matching `/^nhl <endpoint>: invalid payload/`; plus `gameState` `"XYZ"` → `/^nhl score: .*gameState/`, `season` 20252027 → throws `/^nhl score/`, `toi` `"abc"` → throws `/^nhl boxscore/`, `decision` `"T"` → throws `/^nhl boxscore/`.
  - A roster player with `birthCountry` `"XXX"` → `birthCountry` null and one warning containing `nhl roster`, the player ID and `"XXX"`; a `gameType` 4 game is absent from `games`.
  - Teams: deduped by `externalId` (a day's team list has no duplicates), `name` `"Blue Jackets"` for `29` from both `score/2026-01-17` and `boxscore/2025020760`.
  - Review Focus 1–5, each a mutated copy with the expected values listed there.
- [ ] **Step 2: Run** `pnpm test nhl-`. Expected: every new test fails with `Error: not implemented` (or a wrong value), none on imports, syntax or types; older tests pass; `pnpm typecheck` and `pnpm lint` pass. Paste the summary.
- [ ] **Step 3: Commit** only the four test files: `test: NHL mapper spec from fixtures`.

### Task 3: NHL mappers — green

**Files:**
- Create: `apps/server/src/sources/nhl/schemas.ts`, `common.ts`
- Modify: `games.ts`, `boxscore.ts`, `players.ts`, `season-stats.ts`

**Interfaces:**
- Consumes: Task 1's signatures; Task 2's tests (read-only); `seasonLabel`, `countryCodeSchema`, model types from `@our-players/shared`.
- Produces (`common.ts`, used by later tasks only through the mappers): `parsePayload<T>(schema: z.ZodType<T>, endpoint: string, raw: unknown): T` (throws `nhl <endpoint>: invalid payload\n<z.prettifyError>`).

- [ ] **Step 1: Implement** `schemas.ts` per the spec's Raw schemas (`z.object`, used fields only, optional where the spec marks `?`), the `common.ts` helpers (season ID → label with the 8-digit/next-year check, `"MM:SS"` → seconds, position group, team, birth country → code or null + warning), and the mappers per the spec's Mappers and Mapping tables. Period scores: periods 1..`periodDescriptor.number`, goals counted by period number and `teamAbbrev` against `awayTeam.abbrev`/`homeTeam.abbrev`, labels per the spec.
- [ ] **Step 2: Verify** — `pnpm test nhl-` all pass; `git diff HEAD --stat -- apps/server/test` is empty (HEAD is the red commit); `pnpm verify` green.
- [ ] **Step 3: Commit** — `feat(server): NHL mappers for score, schedule, boxscore, roster, landing and season summaries`.

### Task 4: URL builders and fetchers

**Files:**
- Create: `apps/server/src/sources/nhl/urls.ts`, `fetch.ts`; `apps/server/test/nhl-fetch.test.ts`
- Modify: `apps/server/scripts/endpoints.ts` (its `score`, `schedule`, `boxscore`, `roster`, `player-landing` NHL entries call `nhlUrls`; recording-only variants unchanged)

**Interfaces:**
- Consumes: Task 3's mappers; `PoliteClient` from `src/http/polite-client.ts`.
- Produces:
  - `urls.ts`: `nhlUrls = { score(date: string), schedule(date: string), boxscore(gameId: string), roster(teamAbbrev: string), playerLanding(playerId: string), skaterSummary(seasonId: string, gameTypeId: 1 | 2 | 3), goalieSummary(seasonId: string, gameTypeId: 1 | 2 | 3) }`, each `→ string`, path parts `encodeURIComponent`-escaped. Summary: `https://api.nhle.com/stats/rest/en/<skater|goalie>/summary?limit=-1&cayenneExp=<encodeURIComponent('seasonId=<id> and gameTypeId=<n>')>`.
  - `fetch.ts` (`type Client = Pick<PoliteClient, 'get'>`): `fetchScore(client, date)`, `fetchSchedule(client, date)`, `fetchBoxscore(client, gameId)`, `fetchRoster(client, teamAbbrev, teamExternalId)`, `fetchPlayerLanding(client, playerId)` → the matching mapper's result; `fetchSkaterSummary(client, season: string, seasonType: SeasonType)` / `fetchGoalieSummary(…)` → `SeasonStats[]` (`season` `"2025-26"` → seasonId `20252026`; PRE/REG/POST → 1/2/3).

- [ ] **Step 1: Write `nhl-fetch.test.ts`** with a fake client (`{ get: vi.fn(async (url) => ({ url, status: 200, text, bytes })) }` serving the fixture file's text):
  - `fetchBoxscore(client, '2025020760')` requests `https://api-web.nhle.com/v1/gamecenter/2025020760/boxscore` and returns Merzlikins' line (saves 30).
  - `fetchScore` requests `…/v1/score/2026-01-17`; `fetchRoster(client, 'FLA', '13')` requests `…/v1/roster/FLA/current` and sets `currentTeamExternalId` `'13'`.
  - `fetchSkaterSummary(client, '2025-26', 'REG')` requests exactly `https://api.nhle.com/stats/rest/en/skater/summary?limit=-1&cayenneExp=seasonId%3D20252026%20and%20gameTypeId%3D2` and, served `skater-summary-lva`, returns 5 rows; `fetchGoalieSummary` served a copy of `goalie-summary-reg` with `total` set to its row count returns 50 rows; served the untouched `goalie-summary-reg` it throws `nhl goalie-summary: truncated, 50 of 98 rows`.
  - A body `"<html>"` throws `/^nhl boxscore: response is not JSON/`; an `HttpError` from the client propagates unchanged.
  Run `pnpm test nhl-fetch`: FAIL (module not found).
- [ ] **Step 2: Implement** `urls.ts`, `fetch.ts`, and the `endpoints.ts` reuse. `pnpm test nhl-fetch record-fixture` pass.
- [ ] **Step 3: Verify** — `pnpm verify` green.
- [ ] **Step 4: Commit** — `feat(server): NHL URL builders and fetchers`.

### Task 5: pnpm inspect

**Files:**
- Create: `apps/server/src/fixtures/inspect.ts`, `apps/server/scripts/inspect.ts`, `apps/server/test/inspect.test.ts`
- Modify: `apps/server/package.json` (`"inspect": "tsx scripts/inspect.ts"`), root `package.json` (`"inspect": "pnpm --filter @our-players/server inspect"`)

**Interfaces:**
- Consumes: Task 3's mappers.
- Produces: `inspectFixture(source: string, endpoint: string, id: string, root?: string): Promise<unknown>` — reads `<root>/<source>/<endpoint>/<id>.json` (default root `apps/server/test/fixtures`) and returns the mapper's result per the spec's pnpm inspect section; throws `unknown source "<s>"; valid: nhl`, `espn-nba arrives in S05`, `unknown endpoint "<e>" for nhl; valid: <list>`, and the read error for a missing fixture.

- [ ] **Step 1: Write `inspect.test.ts`**: `nhl boxscore 2025020760` → `lines` include `nhl-8478007` with `stats.saves` 30; `nhl roster FLA` → Vilmanis with `currentTeamExternalId` `'FLA'`; `nhl right-rail 2025020760` → throws the unknown-endpoint message listing the seven endpoints; `espn-nba scoreboard x` → throws `/S05/`. Run: FAIL (module not found).
- [ ] **Step 2: Implement** `inspectFixture` and the CLI (`parseArgs` positionals like `scripts/fixtures-record.ts`; prints `JSON.stringify(result, null, 2)`; on error prints `usage: pnpm inspect <source> <endpoint> <fixture-id>` and the message to stderr, exit 1). Tests pass.
- [ ] **Step 3: Verify AC5** — run `pnpm inspect nhl boxscore 2025020760 | head -40` and `pnpm inspect nhl nope 1; echo exit=$?`; paste both. `pnpm verify` green.
- [ ] **Step 4: Commit** — `feat(server): pnpm inspect prints a fixture's normalized result`.

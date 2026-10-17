# S04a — Ingestion jobs + recap CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** NHL data flows into the DB through `pnpm job schedule|results|roster|backfill`, and `pnpm recap` prints the day's shown players from the DB.

**Architecture:** Jobs in `apps/server/src/jobs/` run through one runner (in-process lock, `job_runs` row, JSON-line logs) over an injected `JobContext` (db, polite client, clock, logger, overrides). Results and backfill share `ingestDay`/`finalizeGame`. Repository guards (FINAL never downgraded, period scores kept, league/team/kind checks) live in `src/db/`. The recap's row logic is the pure `gameDayRows`, which S06 reuses.

**Tech Stack:** TypeScript (strict, ESM), Drizzle 0.45 over PGlite 0.5, zod 4, Vitest 5, tsx scripts. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-18-s04a-jobs-recap.md` (read it with this plan; it holds every algorithm step).

## Global Constraints

**Out of scope:** season stats, corrections and the scheduler (S04b); ESPN; API; app.

**Acceptance criteria** (verbatim, SESSIONS.md §S04a)
1. Job tests (PGlite + fixture-backed fetcher): results stores lines for final games only; re-running changes nothing; a schedule re-run never downgrades a stored FINAL game; an unknown player becomes an enriched stub; roster sets a player who is missing from every roster of his league to `active = false` with no current team, and restores him when he reappears; when any of that league's roster fetches fails, no `active` flag changes and `job_runs` records the partial failure.
2. Starting a job while the same job runs is skipped and logged.
3. Every run writes a `job_runs` row with counts; a forced failure records the error.
4. Live, run by you: `pnpm job roster --league nhl`, `pnpm job backfill --league nhl --from <d> --to <d>`, then `pnpm recap --date <d> --countries LVA` shows the Latvians' lines matching nhl.com.
5. Spike removed; scripts and docs updated.
6. `pnpm verify` green.

- AC4 is the owner's step: not a task here.
- No new runtime or dev dependency.
- Fixtures are never edited by hand; the one new fixture comes from `pnpm fixtures:record`. Tests may trim/mutate a loaded fixture in memory.
- Tests never touch the network (the root setup already fails real fetches).
- Every `upsertPlayers` call in a job passes `ctx.overrides`.
- Bookkeeping timestamps (`final_at`, `boxscore_fetched_at`, `updated_at`) use SQL `now()`; logic that asks "has it started?" uses the injected `ctx.now()`.
- Red/green per task: write the failing test, run it and see it fail for the right reason, implement, see it pass. `pnpm verify` green before every commit (no red-phase commits in this plan).
- Look up Drizzle APIs (`setWhere`, `inArray`, `notInArray`, `and`/`or`, `sql`) with context7 before writing code against them.
- Code must run on Node 22 and 24, Linux (Arch + Ubuntu CI).

## Review Focus

1. One bad day in a backfill range (a `score` fetch 404s or its payload is invalid) → the other days are still ingested, run `partial`, error names the day. Test in Task 5.
2. A job that throws releases its lock → the next start of the same job runs instead of being skipped. Test in Task 4.
3. A `pglite.lock` left by a crashed process (dead pid) → the next open takes it over instead of refusing forever. Test in Task 3.
4. Invalid CLI input (`2026-02-30`, `--from` after `--to`, `--from` on a non-backfill job, `--league nba`, an unknown country code) → usage error before the DB is opened. Tests in Task 9.
5. A recap date with no games, or games but no shown player → `No players from LVA on <date>.`, exit 0. Test in Task 8.

---

### Task 1: NHL `schedule-calendar` endpoint (team list)

**Files:**
- Create: `apps/server/test/fixtures/nhl/schedule-calendar/<date>.json` (+ `.meta.json`) — recorded, not written
- Create: `apps/server/src/sources/nhl/teams.ts`, `apps/server/test/nhl-teams.test.ts`
- Modify: `apps/server/src/sources/nhl/schemas.ts`, `client.ts`, `index.ts`, `apps/server/scripts/endpoints.ts`, `apps/server/src/fixtures/inspect.ts`, `docs/sources/nhl.md`, `apps/server/test/nhl-fetch.test.ts`

**Interfaces:**
- Produces: `nhlUrls.scheduleCalendar(date: string): string` (`https://api-web.nhle.com/v1/schedule-calendar/{date}`); `mapScheduleCalendar(raw: unknown): { teams: Team[] }`; `fetchScheduleCalendar(client, date: string): Promise<{ teams: Team[] }>`; all exported from `sources/nhl/index.ts`.

- [ ] **Step 1: Add the URL builder and the recorder entry, then record the fixture.** Add `scheduleCalendar` to `nhlUrls`, map `'schedule-calendar': nhlUrls.scheduleCalendar` in `scripts/endpoints.ts`, and run `pnpm fixtures:record nhl schedule-calendar 2026-10-18`. Expected: a 200 and ~12 KB written. If the dated URL doesn't return 32 teams, use `/schedule-calendar/now` with the date ignored (record with `--as 2026-10-18`) and say so in the commit message. One upstream request.
- [ ] **Step 2: Write the failing tests** in `nhl-teams.test.ts`: `mapScheduleCalendar` returns 32 teams; the first is `{ league: 'NHL', source: 'nhl', externalId: '1', abbrev: 'NJD', name: <the commonName.default read from the fixture, as toTeam gets it for score games> }`; the abbrevs include `UTA` and `CBJ` (CBJ's externalId `'29'`); a payload with `teams[0].id` deleted throws matching `/^nhl schedule-calendar: invalid payload/`. In `nhl-fetch.test.ts`: `fetchScheduleCalendar` requests `nhlUrls.scheduleCalendar('2026-10-18')`.
- [ ] **Step 3: Run** `pnpm test nhl-teams nhl-fetch` → FAIL (`mapScheduleCalendar` not exported).
- [ ] **Step 4: Implement** the raw schema (`teams[]` of `id`, `abbrev`, `commonName.default` — only those), `mapScheduleCalendar` with `parsePayload` + `toTeam`, `fetchScheduleCalendar` via `getJson`; add `'schedule-calendar'` to `inspect.ts`; add a `schedule-calendar` row to the `docs/sources/nhl.md` endpoint table (32 current-season teams, `seasonId` per team).
- [ ] **Step 5: Run** `pnpm test nhl-` → PASS; `pnpm verify` green.
- [ ] **Step 6: Commit** `feat(server): NHL schedule-calendar team list` (mention the recorded fixture and its URL).

### Task 2: Repository guards and consistency checks

**Files:**
- Modify: `apps/server/src/db/games.ts`, `apps/server/src/db/season-stats.ts`
- Create: `apps/server/test/repository-guards.test.ts`

**Interfaces:**
- Produces: unchanged signatures of `upsertGames(db, list): Promise<number>` and `upsertSeasonStats(db, list): Promise<number>`, with new behavior below.

- [ ] **Step 1: Write the failing tests** (data from `test/db-data.ts`, `createTestDb`; store `cbj`, `nyi`, `celtics`, `sixers` first):
  - `a stored FINAL game is not set back to SCHEDULED`: upsert `nhlGame`, then `{ ...nhlGame, status: 'SCHEDULED', homeScore: null, awayScore: null, periodScores: null, endedIn: null }` → returns 0; stored row still `FINAL`, `3`/`2`, 4 period scores, `OT`, `updated_at` unchanged.
  - `a stored FINAL game is not set back to LIVE` (LIVE with period scores) → returns 0, row unchanged.
  - `a FINAL game still takes a FINAL correction`: `{ ...nhlGame, homeScore: 4 }` → returns 1, `home_score` 4.
  - `a row without period scores never replaces stored ones`: store `{ ...nhlGame, status: 'LIVE', endedIn: null }`, then the same with `periodScores: null` and `startTimeUtc` moved → returns 0, period scores kept.
  - `a SCHEDULED game still takes a new start time` (no period scores on either side) → returns 1.
  - `rejects a game whose league doesn't fit its source`: `{ ...nhlGame, source: 'espn' }` (teams `celtics`/`sixers` external IDs) → throws `/^game nhl-2026020001: league NHL does not fit source espn/`.
  - `rejects a team from another league`: an NBA game whose home team external ID is an `nhl`-source team is impossible by lookup, so instead store `{ ...cbj, source: 'espn', externalId: '99', league: 'NHL' }` and an NBA game with home `'99'` → throws `/team espn\/99 is in league NHL/`.
  - `rejects home == away` → throws `/home and away are the same team/`.
  - `a rejected game rejects the whole batch`: `[validGame, badGame]` → throws and no `games` row exists.
  - `upsertSeasonStats rejects a kind outside the player's league`: `{ ...nhlSeasonStats, kind: 'basketball_player' }` → throws `/^season stats nhl-8476878\/2026-27: basketball_player is not a hockey kind/`.
- [ ] **Step 2: Run** `pnpm test repository-guards` → the guard and check tests FAIL (rows overwritten / no throw), the "still takes" tests pass.
- [ ] **Step 3: Implement.** `upsertGames`: before writing, check each game (`SOURCE_LEAGUES: Record<Source, League> = { nhl: 'NHL', espn: 'NBA' }` beside it), read the teams' leagues in the same query as the ID lookup or one extra query, and throw `game <publicId>: <problem>`; extend the conflict clause's `setWhere` with `and not (games.status = 'FINAL' and excluded.status <> 'FINAL') and not (games.period_scores is not null and excluded.period_scores is null)`, keeping the distinctness check. `upsertSeasonStats`: read the players' leagues and check `kind.startsWith(LEAGUE_SPORT[league] + '_')`.
- [ ] **Step 4: Run** `pnpm test repository-guards repositories` → PASS (existing repository tests unchanged and green); `pnpm verify` green.
- [ ] **Step 5: Commit** `feat(server): never downgrade a FINAL game; check game and season-stats consistency`.

### Task 3: PGlite data-dir lock

**Files:**
- Modify: `apps/server/src/db/client.ts`
- Test: `apps/server/test/db-lock.test.ts`

**Interfaces:**
- Produces: `openPglite(dataDir?: string): DbHandle` — unchanged signature; with a `dataDir` it holds `<dataDir>.lock` until `close()`.

- [ ] **Step 1: Write the failing tests** (each in a fresh `mkdtemp` dir under `os.tmpdir()`, removed in `afterEach`):
  - `a second open of the same dir throws naming the holder`: `openPglite(dir)` then `openPglite(dir)` → throws matching `` /is in use by process \d+ \(is pnpm dev:server running\?\)/ ``.
  - `close releases the lock`: open, `close()`, open again → succeeds; the lock file is gone after the second `close()`.
  - `a lock left by a dead process is taken over`: write `<dir>.lock` containing `999999999`, then `openPglite(dir)` succeeds and the file now holds `process.pid`.
- [ ] **Step 2: Run** `pnpm test db-lock` → FAIL (second open doesn't throw).
- [ ] **Step 3: Implement** in `openPglite`: `openSync(lock, 'wx')` + write `process.pid`; on `EEXIST` read the pid, `process.kill(pid, 0)` (ESRCH → stale: remove and retry once; alive → throw `PGlite <dataDir> is in use by process <pid> (is pnpm dev:server running?) — stop it, or set DATABASE_URL`); `close()` closes PGlite then removes the lock. No lock when `dataDir` is undefined. Replace the `shortcut:` comment with a one-line why.
- [ ] **Step 4: Run** `pnpm test db-lock db-client` → PASS; `pnpm verify` green.
- [ ] **Step 5: Commit** `feat(server): lock the dev PGlite dir to one process`.

### Task 4: Job runner, logger, fake client

**Files:**
- Create: `apps/server/src/jobs/runner.ts`, `apps/server/test/fake-client.ts`, `apps/server/test/jobs-runner.test.ts`

**Interfaces:**
- Consumes: `startJobRun`, `finishJobRun`, `JobStatus` (`src/db/job-runs.ts`); `PoliteClient`, `HttpError` (`src/http/polite-client.ts`); `NationalityOverride` (`src/nationality/overrides.ts`).
- Produces (all from `runner.ts`):
  ```ts
  export type LogLevel = 'info' | 'warn' | 'error';
  export type Logger = {
    info(msg: string, fields?: Record<string, unknown>): void;
    warn(msg: string, fields?: Record<string, unknown>): void;
    error(msg: string, fields?: Record<string, unknown>): void;
    child(fields: Record<string, unknown>): Logger;
  };
  // One JSON line per call: { level, msg, ...bound fields, ...fields }. Default write: console.log / console.error for 'error'.
  export function createLogger(write?: (level: LogLevel, line: string) => void): Logger;
  export type JobClient = Pick<PoliteClient, 'get' | 'requestCount'>;
  export type JobContext = { db: Db; client: JobClient; now: () => Date; log: Logger;
    overrides: ReadonlyMap<PublicId, NationalityOverride> };
  export type JobArgs = { league: League; date?: string; from?: string; to?: string };
  export type JobRun = { counts: Record<string, number>; add(key: string, n?: number): void;
    fail(message: string): void; log: Logger };   // log = ctx.log.child({ job, run: <id> })
  export type Job = (ctx: JobContext, run: JobRun, args: JobArgs) => Promise<void>;
  export type JobResult = { status: 'skipped' } | { status: Exclude<JobStatus, 'running'>;
    runId: number; counts: Record<string, number>; error: string | null };
  export function runJob(ctx: JobContext, name: string, job: Job, args: JobArgs): Promise<JobResult>;
  ```
- Produces (`test/fake-client.ts`): `fakeClient(routes: Record<string, unknown>): JobClient & { requests: string[] }` — known URL → `{ url, status: 200, text: JSON.stringify(payload), bytes }`; unknown → throws `new HttpError(url, 404, 'HTTP 404 ' + url)`; `requestCount` counts every `get`.

- [ ] **Step 1: Write the failing tests** (`createTestDb`, `fakeClient({})`, a capturing logger):
  - `a run writes a succeeded job_runs row with its counts and args`: a job doing `run.add('games', 2)` → result `succeeded`; the row has `status 'succeeded'`, `counts { games: 2, requests: 0 }`, `args { league: 'NHL' }`, `finished_at` set, `error` null.
  - `counts.requests is the client's request delta`: a job that `get`s one known URL → `counts.requests` 1.
  - `a failed unit makes the run partial with the messages`: `run.fail('day 2026-01-17: boom'); run.fail('x')` → `partial`, `error` `'day 2026-01-17: boom; x'`.
  - `a job that throws records failed with the error and the counts so far`: `run.add('days'); throw new Error('forced')` → `failed`, `error` `'forced'`, `counts.days` 1; `runJob` resolves (doesn't reject).
  - `starting a job while it runs is skipped and logged`: start job A awaiting a deferred promise, start A again → second resolves `{ status: 'skipped' }`; a captured `warn` line has `job: 'A'` and `msg` containing `already running`; after resolving the first, exactly one `job_runs` row.
  - `a different job runs while one is running` (B during A) → not skipped.
  - `a job that threw releases its lock`: after a throwing run, the same job starts again and is not skipped.
  - `log lines carry job and run id`: a `run.log.info('hi')` line parses to `{ level: 'info', msg: 'hi', job: 'A', run: <row id> }`.
- [ ] **Step 2: Run** `pnpm test jobs-runner` → FAIL (`runner.ts` missing).
- [ ] **Step 3: Implement** per the spec's "Job runner" section. The lock is a module-level `Set<string>` keyed by job name, with the spec's `shortcut:` comment.
- [ ] **Step 4: Run** `pnpm test jobs-runner` → PASS; `pnpm verify` green.
- [ ] **Step 5: Commit** `feat(server): job runner with overlap lock, job_runs and JSON logs`.

### Task 5: results and backfill jobs

**Files:**
- Create: `apps/server/src/jobs/results.ts`, `apps/server/src/jobs/backfill.ts`, `apps/server/test/jobs-results.test.ts`

**Interfaces:**
- Consumes: Task 4's runner types; Task 2's guarded `upsertGames`; `fetchScore`, `fetchBoxscore`, `fetchPlayerLanding`, `nhlUrls`; `upsertTeams`, `upsertPlayers`, `upsertStatLines`, `playerIdLookup`/a stored-ID query; `fakeClient`.
- Produces: `resultsJob: Job`, `backfillJob: Job` (backfill requires `args.from`/`args.to`), `ingestDay(ctx: JobContext, run: JobRun, league: League, day: string): Promise<void>`.

- [ ] **Step 1: Write the failing tests.** Helper: `scoreOnly(date, keep: string[])` loads `score/<date>` and keeps only the game IDs given; routes keyed with `nhlUrls`. Clock `now = () => new Date('2026-10-18T12:00:00Z')`. Run jobs through `runJob`.
  - `results stores every line of a final game`: routes `score/2026-01-17` trimmed to `2025020760` + `boxscore/2025020760` + both landings (the other unknown players' landings 404, so this run is `partial` — not asserted here) → `stat_lines` for that game = the box score's line count; Merzļikins' line has `saves 30`, `shotsAgainst 33`, `decision 'W'`; game row `final_at` and `boxscore_fetched_at` set; `counts.finalized` 1.
  - `results fetches no box score for a game that hasn't started`: `--date 2026-10-16` with `score/2026-10-16-states` (two FUT games) → games stored `SCHEDULED`, `requests` = [score URL] only, no `stat_lines`.
  - `results with no started, unfinished game makes no request`: games stored SCHEDULED with start after `now`, no `--date` → `requestCount` 0, run `succeeded`, a `job_runs` row exists.
  - `results picks the day of a started game that isn't final`: store a SCHEDULED copy of `2025020760` (start in the past), no `--date` → requests the `score/2026-01-17` URL.
  - `re-running results changes nothing`: run twice → second run makes no request (no candidate day left), every `games`, `players`, `stat_lines` row's `updated_at` identical to after the first run. Also with `--date 2026-01-17` the second run requests only the score URL and writes 0 rows.
  - `an unknown player becomes an enriched stub`: seed `upsertTeams(box.teams)` + `upsertPlayers(box.players minus nhl-8478007, NO_OVERRIDES)` from `mapBoxscore(loadFixture('nhl','boxscore','2025020760'))` → after results: player `nhl-8478007` has first name `Elvis`, birth country/nationality `LVA`, `current_team_id` null (landing team TOR isn't stored), exactly one landing request, a `warn` log naming the unstored team, run `succeeded`, `counts.enriched` 1; the seeded stubs keep their names (not re-fetched).
  - `a failed enrichment keeps the stub and its line`: same, no landing route → Merzļikins stored with the stub's first name (read from the box score) and his line stored; run `partial`, `error` contains `nhl-8478007`.
  - `a failed box score leaves the game for the next run`: no boxscore route → run `partial`, `boxscore_fetched_at` null; adding the route and re-running stores the lines.
  - `backfill ingests each day of the range`: `--from 2026-03-23 --to 2026-03-24` with both scores trimmed to games having recorded box scores (`2025021127` on 03-24; 03-23 trimmed to none) → requests both score URLs in date order, lines stored for `2025021127`.
  - `one failed day doesn't stop a backfill` (Review Focus 1): `--from 2026-03-23 --to 2026-03-24` with no 03-23 route → 03-24 still ingested, run `partial`, `error` contains `2026-03-23`.
- [ ] **Step 2: Run** `pnpm test jobs-results` → FAIL (modules missing).
- [ ] **Step 3: Implement** the spec's results/backfill algorithm (Jobs → results 1–5, backfill). Log every mapper warning via `run.log.warn`. A landing team that isn't stored: check the stored team IDs before `upsertPlayers` and set `currentTeamExternalId: null` with a warning.
- [ ] **Step 4: Run** `pnpm test jobs-results` → PASS; `pnpm verify` green.
- [ ] **Step 5: Commit** `feat(server): results and backfill jobs (finalize box scores, enrich stubs)`.

### Task 6: schedule job

**Files:**
- Create: `apps/server/src/jobs/schedule.ts`, `apps/server/test/jobs-schedule.test.ts`

**Interfaces:**
- Consumes: Task 4 runner, Task 5 `resultsJob` (to set up a stored FINAL game), `fetchSchedule`.
- Produces: `scheduleJob: Job` (date = `args.date ?? ctx.now()` as UTC `YYYY-MM-DD`).

- [ ] **Step 1: Write the failing tests:**
  - `schedule stores the week's games and teams`: `schedule/2026-03-24` → 58 games stored (15+2+13+2+15+6+5), `counts.games` 58; a future game e.g. one from `2026-03-30` is `SCHEDULED`.
  - `a schedule re-run never downgrades a stored FINAL game`: results for `2026-03-24` trimmed to `2025021127` stores it FINAL with period scores; then schedule with `2025021127` mutated in memory to `gameState: 'FUT'` and its scores removed → stored row keeps `FINAL`, both scores, period scores and `ended_in`.
  - `schedule doesn't wipe score-derived period scores`: same setup, unmutated schedule (FINAL, `periodScores` null) → period scores unchanged.
  - `schedule uses today's UTC date by default`: no `--date`, `now` `2026-03-24T09:00:00Z` → requests `nhlUrls.schedule('2026-03-24')`.
- [ ] **Step 2: Run** `pnpm test jobs-schedule` → FAIL.
- [ ] **Step 3: Implement** per spec (schedule 1–3).
- [ ] **Step 4: Run** `pnpm test jobs-schedule` → PASS; `pnpm verify` green.
- [ ] **Step 5: Commit** `feat(server): schedule job`.

### Task 7: roster job

**Files:**
- Create: `apps/server/src/jobs/roster.ts`, `apps/server/test/jobs-roster.test.ts`

**Interfaces:**
- Consumes: Task 1 `fetchScheduleCalendar`; `fetchRoster`; `upsertTeams`, `upsertPlayers`; `recomputeNationalities`; Task 4 runner.
- Produces: `rosterJob: Job`.

- [ ] **Step 1: Write the failing tests.** Routes: calendar trimmed in memory to CBJ, FLA, PIT + the three roster fixtures. Seed `nyi` and `girgensons` (team NYI, active) — on none of the three rosters.
  - `roster stores every player of every team`: player count = the three rosters' total; Šilovs `nhl-8481668` on PIT with nationality `LVA`; `counts.teams` 3.
  - `a player missing from every roster becomes inactive with no team`: Girgensons → `active` false, `current_team_id` null; `counts.deactivated` 1.
  - `he is restored when he reappears`: second run with Girgensons' entry added in memory to CBJ's `forwards` → `active` true, team CBJ; `counts.reactivated` 1.
  - `a failed roster fetch changes no active flag and records partial`: no PIT route → Girgensons still `active` true with team NYI; CBJ/FLA players stored; `job_runs` `partial`, `error` contains `roster PIT`.
  - `a re-run changes nothing`: run twice → second run `deactivated` 0, `reactivated` 0, every `players.updated_at` unchanged.
  - `overrides apply on the roster write`: run with `overrides(override('nhl-8481668', 'Arturs Silovs', 'EST'))` → Šilovs nationality `EST`, source `override`.
  - `a failed calendar fetch fails the run`: no calendar route → `failed`, no player rows.
- [ ] **Step 2: Run** `pnpm test jobs-roster` → FAIL.
- [ ] **Step 3: Implement** per spec (roster 1–6); the active/team updates are two `update … where` statements limited to the league and to rows that would change.
- [ ] **Step 4: Run** `pnpm test jobs-roster` → PASS; `pnpm verify` green.
- [ ] **Step 5: Commit** `feat(server): roster job with off-roster rule`.

### Task 8: game-day rows and the recap

**Files:**
- Create: `apps/server/src/game-day-rows.ts`, `apps/server/src/recap.ts`, `apps/server/test/game-day-rows.test.ts`, `apps/server/test/recap.test.ts`

**Interfaces:**
- Consumes: `isShown`, `Prefs`, `SelectablePlayer`, `StatLine` (shared); Tasks 5/7 jobs to seed the recap test.
- Produces:
  ```ts
  // game-day-rows.ts
  export type DayTeam = { id: number; abbrev: string };
  export type DayGame = { publicId: PublicId; league: League; status: GameStatus; startTimeUtc: string;
    away: DayTeam; home: DayTeam; awayScore: number | null; homeScore: number | null; endedIn: EndedIn | null };
  export type DayPlayer = SelectablePlayer & { firstName: string; lastName: string; currentTeamId: number | null };
  export type DayLine = StatLine & { teamId: number };
  export type DayRow = { player: DayPlayer; team: DayTeam } &
    ({ kind: 'line'; line: DayLine } | { kind: 'dnp'; reason: string | null } | { kind: 'not-in-lineup' });
  export function gameDayRows(day: { games: DayGame[]; lines: DayLine[]; players: DayPlayer[] }, prefs: Prefs):
    { game: DayGame; rows: DayRow[] }[];
  // recap.ts
  export function loadRecap(db: Db, date: string): Promise<{ games: DayGame[]; lines: DayLine[]; players: DayPlayer[] }>;
  export function formatRecap(date: string, countries: readonly CountryCode[], groups: ReturnType<typeof gameDayRows>): string;
  ```

- [ ] **Step 1: Write the failing `gameDayRows` tests** (hand-built games/players/lines, prefs `{ leagues: {NHL,NBA}, countries: {LVA}, favorites: ∅, hidden: ∅ }`):
  - `a shown player with a played line gets a line row`; `a non-LVA player gets no row`; `a hidden LVA player gets no row`; `a favorite non-LVA player gets a row`.
  - `a played: false line is a dnp row with its reason`.
  - `a shown player whose current team played a FINAL game without him is not in lineup`.
  - `no not-in-lineup row when the game isn't FINAL`; `no row for a player with no current team`.
  - `games without shown players are left out; groups are in start-time order`.
  - `rows: away team first; skaters by points descending, then goalies, then dnp and not-in-lineup`.
- [ ] **Step 2: Write the failing `formatRecap` tests** (pure strings):
  - skater line `1 G · 1 A · +2 · 4 SOG · 18:32` (toi 1112 s → `18:32`; plus-minus `0` → `0`, negative `-1`, positive `+2`).
  - goalie line `28/30 · .933 · 2 GA · W` (savePct 0.9333 → `.933`; decision null → omitted).
  - DNP row `DNP — COACH'S DECISION`, without a reason `DNP`; `Not in lineup`.
  - game header `CBJ 4 – 3 PIT  Final/SO` (away first); `Final`, `Final/OT`, `Live`, scheduled `23:00 UTC`, `Postponed`, `Cancelled`.
  - a league heading `NHL 2026-01-17` before that league's games.
  - empty groups → exactly `No players from LVA on 2026-01-17.` (countries joined with `, `).
- [ ] **Step 3: Write the failing `loadRecap` integration test** in `recap.test.ts`: run `rosterJob` (calendar trimmed to CBJ/FLA/PIT) then `resultsJob --date 2026-01-17` (score trimmed to `2025020760`, landing routes for both landings; other unknown players become stubs — run `partial` is fine for seeding), then upsert Girgensons with current team CBJ (`'29'`) → `formatRecap('2026-01-17', ['LVA'], gameDayRows(await loadRecap(db, '2026-01-17'), prefs))` contains `CBJ 4 – 3 PIT  Final/SO`, a Merzlikins line `30/33 · .909 · 3 GA · W`, a Šilovs goalie line (values read from the box score), and `Girgensons` with `Not in lineup`.
- [ ] **Step 4: Run** `pnpm test game-day-rows recap` → FAIL.
- [ ] **Step 5: Implement** `gameDayRows` (filter through `isShown` only — rule 7) and `formatRecap` (spec "Recap rows"); `loadRecap` = the day's games joined to both teams, their `stat_lines`, and the players with a line there or with `current_team_id` among the day's teams.
- [ ] **Step 6: Run** `pnpm test game-day-rows recap` → PASS; `pnpm verify` green.
- [ ] **Step 7: Commit** `feat(server): game-day rows and the recap`.

### Task 9: CLIs, spike removal, docs

**Files:**
- Create: `apps/server/src/jobs/index.ts`, `apps/server/src/cli-args.ts`, `apps/server/scripts/job.ts`, `apps/server/scripts/recap.ts`, `apps/server/test/cli-args.test.ts`
- Modify: `package.json`, `apps/server/package.json`, `docs/sources/nhl.md`, `docs/sources/espn-nba.md`, `docs/PROGRESS.md` (parking-lot spike line only)
- Delete: `apps/server/scripts/spike/`

**Interfaces:**
- Consumes: every job, `runJob`, `createLogger`, `openDb`, `createPoliteClient`/`userAgent`, `loadConfig`, `loadNationalityOverrides`, `loadRecap`, `gameDayRows`, `formatRecap`.
- Produces:
  ```ts
  // jobs/index.ts
  export const JOBS = { schedule: scheduleJob, results: resultsJob, roster: rosterJob, backfill: backfillJob } satisfies Record<string, Job>;
  export type JobName = keyof typeof JOBS;
  // cli-args.ts — each throws an Error with a one-line message; the script prints usage + message, exit 1
  export function parseJobArgs(argv: string[]): { name: JobName; args: JobArgs };
  export function parseRecapArgs(argv: string[]): { date: string; countries: CountryCode[] };
  ```

- [ ] **Step 1: Write the failing `cli-args` tests:**
  - `['results']` → `{ name: 'results', args: { league: 'NHL' } }`; `['results', '--league', 'nhl', '--date', '2026-01-17']` → `date` set.
  - `['backfill', '--from', '2026-03-23', '--to', '2026-03-24']` → from/to set.
  - throws: `[]` and `['nope']` (`unknown job`), `['results', '--league', 'nba']` (`nba arrives in S05`), `['results', '--date', '2026-02-30']` (`invalid date`), `['backfill', '--from', '2026-03-24', '--to', '2026-03-23']` (`--from is after --to`), `['backfill', '--from', '2026-03-23']` (`backfill needs --from and --to`), `['results', '--from', '2026-03-23']` (`only backfill takes --from/--to`). `--date` is accepted by schedule, results and roster (roster: the calendar date).
  - recap: `['--date', '2026-01-17']` → countries `['LVA']`; `['--date', '2026-01-17', '--countries', 'LVA,EST']` → both; throws on a missing date and on `--countries LAV` (`unknown country code LAV`).
- [ ] **Step 2: Run** `pnpm test cli-args` → FAIL.
- [ ] **Step 3: Implement** `cli-args.ts` (`node:util` `parseArgs`, strict; a real-date check via `Date` round-trip), `jobs/index.ts`, `scripts/job.ts` (parse → `openDb()` → `migrate()` → polite client with `userAgent(pkg.version, loadConfig(process.env).contactUrl)` → `loadNationalityOverrides()` → `runJob(ctx, name, JOBS[name], args)` with `now: () => new Date()` → print `requests by host` → `close()`; `process.exitCode = result.status === 'succeeded' ? 0 : 1`), `scripts/recap.ts` (parse → `openDb()` (no migrate) → print `formatRecap(...)` → close). Root `job`/`recap` scripts → `pnpm --filter @our-players/server job|recap`; server scripts `"job": "tsx scripts/job.ts"`, `"recap": "tsx scripts/recap.ts"`. Remove both `spike` scripts and `scripts/spike/`.
- [ ] **Step 4: Docs.** Remove the "Spike limits" bullets in `docs/sources/nhl.md` and `docs/sources/espn-nba.md`, moving any fact still true (the recorded live outputs, ESPN's current-roster limitation) into a neutral quirk line; delete the PROGRESS parking-lot `spike.ts:2` line. CLAUDE.md's command lines already match — check `pnpm job` usage text agrees with them.
- [ ] **Step 5: Smoke without network:** `pnpm recap --date 2026-01-17` on a fresh `pnpm db:reset` DB → prints `No players from LVA on 2026-01-17.`, exit 0; `pnpm job results --league nba` → usage + `nba arrives in S05`, exit 1; `pnpm spike` → pnpm "Missing script". Paste the outputs in the report.
- [ ] **Step 6: Run** `pnpm verify` → green; `git grep -n spike -- ':!docs/superpowers' ':!docs/PROGRESS.md'` → nothing.
- [ ] **Step 7: Commit** `feat(server): pnpm job and pnpm recap; remove the spike`.

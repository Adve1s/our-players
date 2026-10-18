# S04b — Season stats, corrections, scheduler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** the NHL pipeline runs on its own — a `season-stats` job, box-score corrections in `results`, and a dev-server scheduler driven by a pure decision function.

**Architecture:** pure logic first (game-day helpers in `packages/shared`, `decide()` in `apps/server/src/scheduler/decide.ts`), thin DB/IO edges around it (`currentSeason` query, `loadState`, `tick`, `startScheduler`, `main.ts`). Jobs keep S04a's shape: `Job` functions registered in `JOBS`, run through `runJob`.

**Tech Stack:** TypeScript (strict, ESM), Drizzle on PGlite, Vitest, Biome. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-18-s04b-scheduler.md` (read it; this plan cites its sections as §n).

## Global Constraints

Verbatim from `docs/SESSIONS.md` §S04b:

**Out of scope:** ESPN, API, app.

**Acceptance criteria**
1. Season-stats tests over the bulk fixtures: totals stored per rostered player with season and season type. Current-season derivation tested, including preseason and the rollover between seasons.
2. A correction re-fetch updates changed numbers, and happens only once per game (tests).
3. Scheduler decision logic, with an injected clock: no upstream calls when nothing is in progress; polling during game windows; corrections after 6 h; `schedule` at startup when no future games are stored.
4. Game-day helpers tested with an injected clock and time zone.
5. Live, run by you: `pnpm job season-stats --league nhl` logs its request count, and `SCHEDULER_ENABLED=1 pnpm dev:server` logs the decisions of its first ticks.
6. `pnpm verify` green.

Also: no croner and no other new dependency (owner ruling). Red/green for new logic: the failing test first, seen failing for the right reason. Tests follow `.claude/rules/tests.md` (specific values, `it.each` tables, fake only HTTP/clock/DB). Fixtures only via `pnpm fixtures:record`, never hand-edited; a test may mutate its in-memory copy from `loadFixture`. Commit after each task with `pnpm verify` green; Conventional Commits ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Criterion 5 is the owner's — no task runs it.

## Review Focus

1. A daily job whose run failed must not re-fire every tick (any `job_runs` status counts) — pinned in Task 5.
2. A game stuck SCHEDULED for days must not make the scheduler poll every 10 min — pinned in Task 5 (24 h window), with startup catch-up.
3. A box score first fetched long after the game (backfill) must not be corrected again 6 h later — pinned in Task 4.
4. A failed `job_runs` write in one job must not stop the rest of the tick — pinned in Task 6.
5. An opener that fails after taking the lock must not leave a lock behind (a live pid's lock is never taken over) — pinned in Task 2.

---

### Task 1: Game-day helpers

**Files:**
- Modify: `packages/shared/src/game-day.ts`, `packages/shared/src/index.ts` (line 28 exports `usGameDay`; add the three)
- Test: `packages/shared/test/game-day.test.ts` (extend)

**Interfaces:**
- Produces: `latestStartedGameDay(games: readonly { gameDate: string; startTimeUtc: Date }[], now: Date): string | null`; `previousGameDay(days: readonly string[], day: string): string | null`; `nextGameDay(days: readonly string[], day: string): string | null`.

- [ ] **Step 1: Failing tests.** Wrap cases in a `describe.each(['UTC', 'Europe/Riga', 'Pacific/Honolulu'])` that sets `process.env.TZ` in `beforeEach` and restores it in `afterEach`, so every case runs under three host zones. Cases:
  - `latestStartedGameDay`: games `{2026-10-17, 2026-10-18T02:30Z}` and `{2026-10-18, 2026-10-18T23:00Z}`; now `2026-10-18T22:59Z` → `'2026-10-17'`; now `2026-10-18T23:00Z` → `'2026-10-18'` (start ≤ now counts); now before every start → `null`; `[]` → `null`; input order doesn't matter.
  - `previousGameDay(['2026-10-15','2026-10-18','2026-10-15','2026-10-12'], '2026-10-15')` → `'2026-10-12'`; from a non-game day `'2026-10-17'` → `'2026-10-15'`; from the first day → `null`. `nextGameDay` mirrored (`'2026-10-15'` → `'2026-10-18'`, last → `null`).
  - `usGameDay` under the same three zones: `2026-10-18T06:59Z` → `'2026-10-17'`, `2026-10-18T07:00Z` → `'2026-10-18'` (PDT is UTC−7).
- [ ] **Step 2:** `pnpm test game-day` → new tests FAIL (not exported / not a function).
- [ ] **Step 3:** Implement the three functions next to `usGameDay` (compare `getTime()` and `YYYY-MM-DD` strings only — no local-time `Date` methods).
- [ ] **Step 4:** `pnpm test game-day` → PASS.
- [ ] **Step 5:** `pnpm verify`; commit `feat(shared): game-day helpers — latest started, previous and next game day`.

### Task 2: PGlite lock — no leak on a failed open, race-free stale takeover

**Files:**
- Modify: `apps/server/src/db/client.ts` (`openLocked`, `takeLock`)
- Test: `apps/server/test/db-lock.test.ts`

**Interfaces:** unchanged public API (`openPglite`, `resetPglite`).

- [ ] **Step 1: Failing tests** (use the file's `BOOT` timeout and `base`/`dir` setup; dead pid `999999999` as the existing test does):
  - `'an open that fails after taking the lock removes it'`: `writeFileSync(dir, 'x')` (the data dir path is a regular file, so `mkdirSync(dataDir)` throws) → `expect(() => openPglite(dir)).toThrow()`; `existsSync(`${dir}.lock`)` is `false`.
  - `'a stale lock already being taken over is left alone'`: lock `'999999999'` and guard `${dir}.lock.999999999.takeover` exist → `openPglite(dir)` throws `/being taken over/` and the message contains the guard path; the lock still reads `'999999999'`.
  - `'a takeover leaves no guard behind'`: lock `'999999999'` → open succeeds, lock reads `String(process.pid)`, guard path doesn't exist.
  - No true two-process race test: one thread can't interleave between the guard and the re-read. The guard-exists case above pins the losing branch; the takeover case pins the winning one.
- [ ] **Step 2:** `pnpm test db-lock` → the first two FAIL (lock leaked; guard ignored).
- [ ] **Step 3:** Implement per spec §5. `openLocked`: everything after `takeLock` (wipe, `mkdirSync`, `new PGlite`) inside `try { … } catch (e) { rmSync(lock, { force: true }); throw e; }`. `takeLock` stale branch: `guard = `${lock}.${pid}.takeover``; `openSync(guard, 'wx')` (EEXIST → throw `PGlite ${dataDir} is being taken over by another process (stale lock of ${pid}); if none is running, delete ${guard}`); then in `try/finally rmSync(guard)`: re-read the lock — still `pid` → `rmSync(lock)` and `openSync(lock,'wx')` + write our pid (EEXIST → throw the normal "in use by process N" with the new holder's pid); otherwise fall through to one more `takeLock(lock, dataDir, false)` attempt. Keep the existing garbled/empty-file-is-stale rule (guard name uses the raw content sanitized to digits, or `stale` when garbled).
- [ ] **Step 4:** `pnpm test db-lock` → PASS (old tests too).
- [ ] **Step 5:** `pnpm verify`; commit `fix(server): PGlite lock — release on a failed open, guard the stale takeover`.

### Task 3: Season-stats job and current-season derivation

**Files:**
- Record: `apps/server/test/fixtures/nhl/skater-summary-reg-all/20252026.json`, `…/goalie-summary-reg-all/20252026.json` (+ `.meta.json`)
- Modify: `apps/server/src/sources/nhl/client.ts` (export the summary URL as `nhlUrls.summary`), `apps/server/scripts/endpoints.ts`, `apps/server/src/db/games.ts`, `apps/server/src/jobs/index.ts`, `apps/server/scripts/job.ts` (USAGE lists `season-stats`), `docs/sources/nhl.md` (fixture table row)
- Create: `apps/server/src/jobs/season-stats.ts`
- Test: `apps/server/test/current-season.test.ts`, `apps/server/test/jobs-season-stats.test.ts`

**Interfaces:**
- Produces: `nhlUrls.summary(kind: 'skater' | 'goalie', seasonId: string, gameTypeId: 1 | 2 | 3): string` (the existing `summaryUrl`, now public; `fetchSummary` uses it). `currentSeason(db: Db, league: League, now: Date): Promise<string | null>`. `seasonStatsJob: Job`, registered as `JOBS['season-stats']`.

- [ ] **Step 1: Fixtures.** Add endpoints `'skater-summary-reg-all'` and `'goalie-summary-reg-all'` to `scripts/endpoints.ts` as `(seasonId) => nhlUrls.summary(kind, seasonId, 2)` (after exporting it). Run from the repo root: `pnpm fixtures:record nhl skater-summary-reg-all 20252026` and `pnpm fixtures:record nhl goalie-summary-reg-all 20252026` (2 live requests). Check: `total` equals `data.length` in both (expect 940 / 98). Commit the fixtures + endpoints + URL export alone: `test(server): record full 2025-26 regular-season summaries (limit=-1) for the season-stats job`. Add the row to `docs/sources/nhl.md`'s fixture table in the same commit.
- [ ] **Step 2: Failing `currentSeason` tests** (`createTestDb`, `upsertTeams(cbj, nyi…)` + `upsertGames` from `db-data`'s `nhlGame` with overrides of `publicId/externalId/season/seasonType/startTimeUtc/status`). `it.each` rows, each `[name, games, now, expected]`:
  - no games → `null`
  - only future games, earliest `2026-27` PRE → `'2026-27'` (fallback)
  - preseason: `2026-27` PRE started yesterday, REG next week → `'2026-27'`
  - summer: last `2025-26` POST game started in June, `2026-27` PRE scheduled in September; now in August → `'2025-26'`
  - rollover: same data, now just after the first `2026-27` PRE start → `'2026-27'`
  - a POSTPONED `2026-27` game whose start passed, last real start `2025-26` → `'2025-26'`
  - league filter: an `nbaGame` (from `db-data`, season changed to `'2027-28'`) started after the last NHL game → still the NHL season.
- [ ] **Step 3: Failing job tests** (`jobs-season-stats.test.ts`, same harness as `jobs-results.test.ts`: `fakeClient`, `runJob`, `NO_OVERRIDES`, clock `2026-04-20T12:00:00Z`). Seed teams, players `girgensons` (8476878) and `merzlikins` (8478007) from `db-data`, and one `2025-26` REG game started before now. Routes: `nhlUrls.summary('skater','20252026',2)` → `skater-summary-reg-all`, goalie likewise.
  - stores Girgensons' `hockey_skater` REG `2025-26` totals with `basis: 'totals'` and values read by hand from the new fixture (goals, assists, points, gamesPlayed), and Merzlikins' `hockey_goalie` row (wins, saves, gamesPlayed) — specific numbers.
  - `job_runs` counts: `rows: 2`, `skipped` = (940 + 98 − 2), `requests: 2`, status `succeeded`.
  - a re-run writes no row again (`upsertSeasonStats` returns 0 → `rows: 0`) and changes no `fetched_at`.
  - started PRE and REG games in `2025-26` → 4 requests (PRE served from the same payloads at `gameTypeId` 1 URLs, stored with `seasonType: 'PRE'`).
  - no started game, only a future `2026-27` game → 0 requests, `succeeded`, an info log naming the season.
  - no games at all → 0 requests, `succeeded`.
  - a summary that 404s → status `failed`, error names the URL (the fetch error propagates).
- [ ] **Step 4:** `pnpm test current-season jobs-season-stats` → FAIL (not implemented / unknown job).
- [ ] **Step 5:** Implement `currentSeason` in `src/db/games.ts` (two ordered `limit 1` queries per spec §1) and `seasonStatsJob` in `src/jobs/season-stats.ts`: NHL only (other league throws `arrives in S05` like `schedule.ts`); season types = distinct `season_type` of the season's started, non-POSTPONED/CANCELLED games, in PRE/REG/POST order; per type `fetchSkaterSummary` then `fetchGoalieSummary`; keep rows whose `playerPublicId` is stored for the league (one `select public_id from players where league = …`); `run.add('rows', await upsertSeasonStats(...))`, `run.add('skipped', n)`. Register in `JOBS`; extend `USAGE` in `scripts/job.ts`.
- [ ] **Step 6:** `pnpm test current-season jobs-season-stats cli-args` → PASS.
- [ ] **Step 7:** `pnpm verify`; commit `feat(server): season-stats job; current season derived from the stored schedule`.

### Task 4: Corrections in `results`

**Files:**
- Modify: `apps/server/src/jobs/results.ts`
- Test: `apps/server/test/jobs-results.test.ts`

**Interfaces:**
- Produces: `export const CORRECTION_DELAY_MS = 6 * 60 * 60 * 1000;` and `export const SETTLED_AFTER_START_MS = 12 * 60 * 60 * 1000;` in `results.ts` (Task 5 imports the first).

Game `2025020760` starts on 2026-01-17 (read its `startTimeUtc` from the score fixture into a test constant `START`). Seed by running `resultsJob` with `--date 2026-01-17` and the existing `fullRoutes()`.

- [ ] **Step 1: Failing tests** (`describe('corrections')`):
  - `'a first fetch soon after the start leaves the game uncorrected'`: clock `START + 4 h` → `corrected_at` null, `boxscore_fetched_at` set.
  - `'a first fetch 12 h or more after the start counts as corrected'`: clock `START + 12 h` → `corrected_at` set (backfill-like). And via `backfillJob` over 2026-01-17 with the default clock (`2026-10-18`) → `corrected_at` set.
  - `'a correction re-fetch 6 h after final updates changed numbers'`: seed at `START + 4 h`; backdate `final_at` to `START + 3 h` with a test `update`; serve a box score copy with Merzlikins' saves changed (mutate the parsed copy, e.g. +1 save and +1 shot against); run `resultsJob` without `--date` at `START + 9 h` → Merzlikins' line has the new saves, `corrected_at` set, counts `corrected: 1`, exactly one box-score request in that run.
  - `'not yet 6 h after final, nothing is re-fetched'`: same seed, clock `START + 3 h + 5 h 59 m` → 0 requests, `corrected_at` null.
  - `'a correction happens only once'`: after the correction, run again at `START + 30 h` → 0 requests, line unchanged.
  - `'a failed correction is retried next run'`: box score route 404 → status `partial`, `corrected_at` null; next run with the route → corrected.
- [ ] **Step 2:** `pnpm test jobs-results` → new tests FAIL; old ones still pass.
- [ ] **Step 3:** Implement per spec §2: `finalizeGame` gains a `mode: 'first' | 'correction'` (or a boolean); `first` sets `boxscoreFetchedAt: now()` and, when the game's `startTimeUtc ≤ ctx.now() − SETTLED_AFTER_START_MS`, `correctedAt: now()` too (select `startTimeUtc` with the unfetched games); `correction` sets `correctedAt: now()` and counts `corrected` instead of `finalized`. `resultsJob`, after its day loop, selects FINAL games of the league with `boxscoreFetchedAt` not null, `correctedAt` null, `finalAt ≤ new Date(ctx.now().getTime() − CORRECTION_DELAY_MS)`, and runs each in its own try/catch (`run.fail`). Update the `shortcut:` at line 13 to say the scheduler now bounds the trigger (24 h window).
- [ ] **Step 4:** `pnpm test jobs-results` → PASS.
- [ ] **Step 5:** `pnpm verify`; commit `feat(server): results re-fetches each box score once, 6 h after final`.

### Task 5: The pure scheduler decision

**Files:**
- Create: `apps/server/src/scheduler/decide.ts`
- Test: `apps/server/test/scheduler-decide.test.ts`

**Interfaces:**
- Consumes: `CORRECTION_DELAY_MS` (Task 4), `JobName` (`src/jobs/index.ts`, now including `'season-stats'`).
- Produces:
```ts
export type SchedulerGame = {
  league: League; status: GameStatus; startTimeUtc: Date;
  finalAt: Date | null; boxscoreFetchedAt: Date | null; correctedAt: Date | null;
};
export type SchedulerState = { games: readonly SchedulerGame[]; lastRuns: Partial<Record<JobName, Date>>; startup: boolean };
export type Decision = { league: League; job: Exclude<JobName, 'backfill'>; reason: string };
export const DAILY_SLOTS = { schedule: 9, roster: 10, 'season-stats': 11 } as const; // UTC hours
export const RESULTS_WINDOW_MS = 24 * 60 * 60 * 1000;
export function decide(now: Date, leagues: readonly League[], state: SchedulerState): Decision[];
```

Rules and reasons exactly as spec §3's table (`'no future games'`, `'daily 09:00'`, `'games in progress'`, `'catch-up at startup'`, `'corrections due'`, `'daily 10:00'`, `'daily 11:00'`). One decision per job per league; `schedule` with both reasons → one decision, reason `'no future games'`; `results` with several reasons → the first in table order. Order per league: schedule, results, roster, season-stats.

- [ ] **Step 1: Failing tests** — clock `2026-10-18T14:00:00Z` unless stated, `lastRuns` with all three daily jobs at `2026-10-18T09:05Z`, a future game tomorrow, `leagues = ['NHL']`, unless the case says otherwise. `it.each`:
  - quiet afternoon (FINAL, corrected games only + tomorrow's game) → `[]`
  - LIVE game started 1 h ago → `[{ job: 'results', reason: 'games in progress' }]`
  - SCHEDULED game starting in 1 h → `[]`
  - SCHEDULED game whose start passed 10 min ago (stale schedule) → results
  - FINAL without box score, started 3 h ago → results
  - FINAL with box score, `finalAt` now − 5 h 59 m, uncorrected → `[]`; at now − 6 h → `'corrections due'`
  - corrected game with `finalAt` long ago → `[]`
  - SCHEDULED game started 25 h ago → `[]`; same with `startup: true` → `'catch-up at startup'`
  - `startup: true`, no game with start > now → schedule `'no future games'` first, then whatever else is due; `startup: true` with a future game → no schedule
  - `startup: false`, no future games, schedule ran today → no schedule
  - daily slots, `it.each` over the three jobs: clock one minute before the slot with no run today → not due; at the slot (`HH:00:00Z`) with last run yesterday → due with its reason; no run ever → due; run at slot + 5 min and clock 23:59 → not due; a failed run counts (the state carries only start times, so this is the same case — name the test after the behavior)
  - several due at once (startup at 12:00, nothing run, a LIVE game, no future games) → order schedule, results, roster, season-stats
- [ ] **Step 2:** `pnpm test scheduler-decide` → FAIL (module missing).
- [ ] **Step 3:** Implement. Today's slot: `Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour)`; due when `now ≥ slot` and the last run is absent or `< slot`. `job_runs` has no league column, so `lastRuns` is shared across leagues — add `// shortcut: lastRuns is per job, not per league; key job_runs by league when S05 adds NBA`.
- [ ] **Step 4:** `pnpm test scheduler-decide` → PASS.
- [ ] **Step 5:** `pnpm verify`; commit `feat(server): pure scheduler decision — what should run now`.

### Task 6: Scheduler loop, dev-server wiring, decisions and docs

**Files:**
- Create: `apps/server/src/scheduler/scheduler.ts`
- Modify: `apps/server/src/main.ts`, `apps/server/src/config.ts`, `CLAUDE.md` (dev PGlite gotcha), `docs/DECISIONS.md`
- Test: `apps/server/test/scheduler.test.ts`, `apps/server/test/config.test.ts`

**Interfaces:**
- Consumes: `decide`, `SchedulerState` (Task 5); `JOBS`, `runJob`, `JobContext`.
- Produces: `loadState(db: Db, now: Date, startup: boolean): Promise<SchedulerState>`; `tick(ctx: JobContext, leagues: readonly League[], startup: boolean, run?: typeof runJob): Promise<Decision[]>`; `startScheduler(ctx: JobContext, leagues?: readonly League[]): { stop(): Promise<void> }` (first tick immediately with `startup = true`, then `TICK_MS = 10 * 60 * 1000`); `loadConfig` returns `schedulerEnabled: boolean`.

- [ ] **Step 1: Failing tests** (`scheduler.test.ts`, PGlite + `fakeClient`, clock `2026-10-18T14:00:00Z`):
  - `loadState`: a game started 30 h ago and corrected is excluded; a FINAL uncorrected game from last week is included; tomorrow's game is included; `lastRuns` holds each job's latest `started_at` (insert `job_runs` rows with explicit `startedAt`).
  - `'a tick with nothing to do makes no requests'`: today's three daily runs inserted at 09:05/10:05/11:05, only tomorrow's game stored, `startup: false` → returns `[]`, `client.requests` is empty, a `tick` log line with `decisions: []`.
  - `'a tick logs its decisions and runs them in order'`: inject a `run` that records names and resolves `{ status: 'succeeded', … }`; state with schedule and roster due → calls `['schedule', 'roster']`, log line lists both with reasons.
  - `'a rejected runJob is logged and the tick goes on'`: injected `run` rejects for `schedule` → an `error` log naming the job and message, then `roster` still runs.
  - `startScheduler` with `vi.useFakeTimers()`: first tick on start; next after 10 min; `stop()` resolves after the in-flight tick and no tick follows; a tick still running at the next interval is skipped with a `warn` log.
  - `config.test.ts`: `SCHEDULER_ENABLED=1` → `true`; unset, `''`, `'0'`, `'true'` → `false`.
- [ ] **Step 2:** `pnpm test scheduler config` → FAIL.
- [ ] **Step 3:** Implement `scheduler.ts` per spec §3 (one query for games: `start_time_utc >= now − 24 h` or `(status = 'FINAL' and corrected_at is null)` or `(status in ('SCHEDULED','LIVE') and start_time_utc <= now)`; one `select job, max(started_at) … group by job`). Each decision: `await run(ctx, job, JOBS[job], { league })` inside try/catch → `ctx.log.error('scheduled job threw', { job, league, error })`. `loadConfig`: `schedulerEnabled: env.SCHEDULER_ENABLED === '1'`. `main.ts`: when enabled — load overrides, polite client (as `scripts/job.ts`), `openDb()`; `migrate()` in try, on failure `await handle.close()` (releases the lock), print the error, `process.exit(1)`; then `startScheduler(ctx)`; `SIGINT`/`SIGTERM` → `await scheduler.stop()`, `await handle.close()`, `process.exit(0)`. Log `scheduler on` / `scheduler off (set SCHEDULER_ENABLED=1)` at startup.
- [ ] **Step 4:** `pnpm test scheduler config` → PASS.
- [ ] **Step 5: Docs.** `docs/DECISIONS.md`: next free D-number(s), `(2026-10-18, accepted)`, in the file's format — (a) current season derived from the stored schedule (rule, summer/rollover behaviour, `/v1/meta` reuses it); (b) corrections: once, ≥ 6 h after `final_at`; a first fetch ≥ 12 h after start counts as corrected; (c) scheduler: pure `decide`, 10-min `setInterval`, no croner (owner ruling), daily UTC slots 09/10/11 with any run counting, results after schedule, 24 h window + startup catch-up, dev server holds the DB only with the scheduler on. `CLAUDE.md` gotcha: the dev server holds the PGlite lock only with `SCHEDULER_ENABLED=1`.
- [ ] **Step 6:** `pnpm verify`; commit `feat(server): dev-server scheduler — ticks every 10 min with SCHEDULER_ENABLED=1`.

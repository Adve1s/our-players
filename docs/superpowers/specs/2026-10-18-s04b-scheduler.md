# S04b — Season stats, corrections, scheduler: design

Session S04b, branch `s04b-scheduler`. Spec: `docs/SESSIONS.md` §S04b. The pipeline runs on its own: a `season-stats` job, box-score corrections inside `results`, and a scheduler in the dev server driven by a pure "what should run now?" function.

## Contract (verbatim from SESSIONS.md §S04b)

**Out of scope:** ESPN, API, app.

**Acceptance criteria**
1. Season-stats tests over the bulk fixtures: totals stored per rostered player with season and season type. Current-season derivation tested, including preseason and the rollover between seasons.
2. A correction re-fetch updates changed numbers, and happens only once per game (tests).
3. Scheduler decision logic, with an injected clock: no upstream calls when nothing is in progress; polling during game windows; corrections after 6 h; `schedule` at startup when no future games are stored.
4. Game-day helpers tested with an injected clock and time zone.
5. Live, run by you: `pnpm job season-stats --league nhl` logs its request count, and `SCHEDULER_ENABLED=1 pnpm dev:server` logs the decisions of its first ticks.
6. `pnpm verify` green.

**Owner ruling (brainstorming, 2026-10-18):** no croner — Claude's decision, accepted by the owner. A plain 10-minute `setInterval` is enough: a daily job is due when `now` is past today's UTC slot (`Date.UTC(y, m, d, 9)`) and its last `job_runs` start is before that slot, so it fires at the first tick after the slot, at most 10 minutes late, once per day — and right after startup if the server was off at slot time.

No new dependencies.

## 1. Season-stats job (`apps/server/src/jobs/season-stats.ts`)

- **Current season** — `currentSeason(db, league, now)` in `src/db/games.ts` (S06's `/v1/meta` reuses it): the `season` of the game with the latest `start_time_utc ≤ now` whose status isn't POSTPONED/CANCELLED; else the season of the earliest SCHEDULED game with `start_time_utc > now`; else `null`. So the summer stays on the finished season (playoffs were the last started games) and the rollover happens when the first preseason game starts. Recorded in DECISIONS.md.
- **Season types** — the distinct `season_type` of that season's started games (same filter). For each: `fetchSkaterSummary` + `fetchGoalieSummary` (2 requests each, `limit=-1`). No started game in the season → no requests, an info log, status `succeeded`.
- **Players** — rows are kept for players already stored in that league (active or not, stubs included); the rest are counted `skipped`. *(Claude's call: "rostered" read as "stored" — a player waived or sent down mid-season still has real totals.)* `upsertSeasonStats` writes them; counts `rows`, `skipped`, `requests`.
- **Fixtures** — the recorded `*-summary-reg` fixtures hold 50 of 940/98 rows (recorded without `limit=-1`), so the adapter's truncation guard throws on them. Record `skater-summary-reg-all/20252026.json` and `goalie-summary-reg-all/20252026.json` with the adapter's real URLs (`limit=-1`, `seasonId=20252026 and gameTypeId=2`) via `pnpm fixtures:record … --as` — 2 live requests. Tests serve them at the adapter's URL.
- **Registered** in `JOBS` as `season-stats`; `pnpm job season-stats --league nhl` works; the CLI usage line lists it.

## 2. Corrections in `results`

- After the day loop, `results` (with or without `--date`) selects the league's games with `status = FINAL`, `boxscore_fetched_at` set, `corrected_at` null and `final_at ≤ now − 6 h`, and runs `finalizeGame` on each in correction mode: re-fetch the box score, enrich newcomers, `upsertStatLines` (changed numbers update; lines missing from the new box score are already deleted), then set `corrected_at = now()`. Counts `corrected`. A failure is a `run.fail`; `corrected_at` stays null so the next run retries.
- **Settled at first fetch** — when `finalizeGame` first fetches a game whose `start_time_utc ≤ now − 12 h`, it sets `corrected_at` together with `boxscore_fetched_at`: a box score fetched that long after the start was fetched ≥ 6 h after the final horn already (regular-season games end within ~3.5 h; playoff marathons excepted). This covers backfill and catch-up after downtime alike, with no flag. *(Claude's call.)*
- `backfill` calls `ingestDay` only, so it never runs the corrections pass.
- Constants `CORRECTION_DELAY_MS` (6 h) and `SETTLED_AFTER_START_MS` (12 h) live in `results.ts`; the scheduler imports the first so both sides use one rule.

## 3. Scheduler

### Pure decision (`apps/server/src/scheduler/decide.ts`)

```ts
type GameRow = { league; status; startTimeUtc: Date; finalAt: Date | null; boxscoreFetchedAt: Date | null; correctedAt: Date | null };
type SchedulerState = { games: GameRow[]; lastRuns: Partial<Record<JobName, Date>>; startup: boolean };
type Decision = { league: League; job: JobName; reason: string };
function decide(now: Date, leagues: readonly League[], state: SchedulerState): Decision[];
```

Per league, in run order **schedule → results → roster → season-stats** (results after schedule, so a stale schedule that set a LIVE game back to SCHEDULED is healed in the same tick):

| Job | Due when | reason |
|---|---|---|
| `schedule` | startup and no game with `startTimeUtc > now`; or past today's 09:00 UTC with no run since | `no future games` / `daily 09:00` |
| `results` | a game *awaits results* (SCHEDULED/LIVE with `startTimeUtc ≤ now`, or FINAL without a box score) that started within the last 24 h; or at startup, one of any age; or a *correction is due* (FINAL, box score fetched, not corrected, `finalAt ≤ now − 6 h`) | `games in progress` / `catch-up at startup` / `corrections due` |
| `roster` | past today's 10:00 UTC with no run since | `daily 10:00` |
| `season-stats` | past today's 11:00 UTC with no run since | `daily 11:00` |

Any run counts, whatever its status: a failed daily job waits for tomorrow instead of re-firing every tick *(Claude's call)*. `lastRuns` holds each job's latest `job_runs.started_at`; `job_runs` has no league column, which is fine while NHL is the only league (`shortcut:`, S05 adds NBA). The 24 h window bounds the stuck-game shortcut (`results.ts:13`): a game that vanished from the payload no longer triggers polling, only startup catch-up — when results runs for another reason, its own day selection still re-fetches that day.

**Test cases** (`decide.test.ts`, `it.each` where it fits): quiet afternoon with all daily jobs done → `[]` (no upstream calls); a game started 1 h ago, LIVE → results; a game starting in 1 h → nothing; FINAL without box score → results; FINAL with box score at final + 5 h 59 m → nothing, at + 6 h → results; corrected game → nothing; a SCHEDULED game started 25 h ago → nothing, but results at startup; startup with no future games → schedule; startup with future games → no schedule; each daily slot at 08:59 (not due), 09:00 (due), run at 09:05 today and now 15:00 (not due), run yesterday (due); order when several are due; a stale-schedule case (SCHEDULED after start) → results right after schedule.

### Tick and loop (`apps/server/src/scheduler/scheduler.ts`)

- `loadState(db, now, startup)`: games with `start_time_utc ≥ now − 24 h`, or `status = FINAL and corrected_at is null`, or (startup only) SCHEDULED/LIVE with `start_time_utc ≤ now`; plus `max(started_at)` per job from `job_runs`.
- `tick(ctx, startup)`: load state, `decide`, log `{ msg: 'tick', decisions }`, then run each decision in order with `runJob`, each wrapped in try/catch — a rejected `runJob` (a failed `job_runs` write) is logged as an error and the tick moves on. Tested with PGlite + fake client: a tick with nothing to do makes no requests; a rejected `runJob` doesn't stop the next decision.
- `startScheduler(ctx)`: ticks once with `startup = true`, then every 10 min; a tick still running when the next is due skips it (logged). `stop()` clears the interval and resolves when the in-flight tick finishes.

### Dev server (`apps/server/src/main.ts`, `config.ts`)

- `loadConfig` gains `schedulerEnabled` (`SCHEDULER_ENABLED === '1'`).
- Enabled: open the DB (`openDb()`), migrate, load overrides, build the polite client (as `scripts/job.ts` does), start the scheduler. If opening or migrating fails: close the handle (releasing the lock), log, exit 1. SIGINT/SIGTERM: stop the scheduler, await the tick, close the DB, exit. Disabled: unchanged — no DB opened.
- `CLAUDE.md` gotcha already says to stop `pnpm dev:server` before `pnpm job`; it now holds the lock only with the scheduler on — reword.

## 4. Game-day helpers (`packages/shared/src/game-day.ts`)

- `latestStartedGameDay(games: { gameDate: string; startTimeUtc: Date }[], now)` → the `gameDate` of the game with the latest start `≤ now`, or `null`.
- `previousGameDay(days, day)` / `nextGameDay(days, day)` → the nearest game day strictly before/after `day` in `days` (unsorted, duplicates allowed), or `null`; `day` itself needn't be a game day.
- **Time zone** *(Claude's call)*: the helpers work on UTC instants and game-day strings; the tests run each case under `process.env.TZ` = `UTC`, `Europe/Riga` and `Pacific/Honolulu` (restored after), around Pacific and UTC midnight, together with `usGameDay`, to prove the host zone never changes a result.

## 5. PGlite lock (`apps/server/src/db/client.ts`)

- **Leak on a failed open** — `openLocked` removes the lock if `new PGlite` throws; and the returned handle's `close()` already removes it when `waitReady` rejects, so the dev server closes the handle on any open/migrate failure.
- **Takeover race** — taking over a dead pid `P`'s lock first creates `${lock}.${P}.takeover` with `wx` (only one process can). The winner re-reads the lock: still `P` → remove it, create a fresh lock with `wx` (EEXIST → a newcomer won it; report "in use"), remove the guard. Not `P` any more → remove the guard, start over once. A loser (guard EEXIST) reports "in use (being taken over)". A guard left by a crash mid-takeover names itself in the error so the owner can delete it. Tested: two takeovers of the same dead pid in sequence where the second sees the first's fresh lock; an existing guard makes the opener fail without touching the lock; a failed `new PGlite` leaves no lock.

## 6. Docs

DECISIONS.md: current-season derivation; corrections and the 12 h settled rule; the scheduler rules (pure decide, run order, daily slots, 24 h window, no croner). `docs/PROGRESS.md` is `/handoff`'s. CLAUDE.md gotcha reworded (§3).

## 7. Live check (criterion 5, run by the owner)

```bash
pnpm job season-stats --league nhl          # expect 2–4 requests (2026-27 PRE and/or REG), rows > 0
SCHEDULER_ENABLED=1 pnpm dev:server         # first tick logs its decisions; wait for the second (10 min) or Ctrl-C
```

Stop `pnpm dev:server` before any other `pnpm job`/`pnpm recap`.

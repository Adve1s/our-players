# S04a — Ingestion jobs + recap CLI: design

Session S04a, branch `s04a-jobs-recap`. Spec: `docs/SESSIONS.md` §S04a. NHL data flows into the database through four jobs run by hand (`pnpm job`), and `pnpm recap` prints the morning recap from the DB.

## Contract (verbatim from SESSIONS.md §S04a)

**Out of scope:** season stats, corrections and the scheduler (S04b); ESPN; API; app.

**Acceptance criteria**
1. Job tests (PGlite + fixture-backed fetcher): results stores lines for final games only; re-running changes nothing; a schedule re-run never downgrades a stored FINAL game; an unknown player becomes an enriched stub; roster sets a player who is missing from every roster of his league to `active = false` with no current team, and restores him when he reappears; when any of that league's roster fetches fails, no `active` flag changes and `job_runs` records the partial failure.
2. Starting a job while the same job runs is skipped and logged.
3. Every run writes a `job_runs` row with counts; a forced failure records the error.
4. Live, run by you: `pnpm job roster --league nhl`, `pnpm job backfill --league nhl --from <d> --to <d>`, then `pnpm recap --date <d> --countries LVA` shows the Latvians' lines matching nhl.com.
5. Spike removed; scripts and docs updated.
6. `pnpm verify` green.

**Owner ruling (brainstorming, 2026-10-18):** the roster job takes the league's team list from NHL `schedule-calendar` (32 current-season teams, one request), not from stored teams — rosters change in-season (AHL call-ups and send-downs), and an incomplete team list would wrongly deactivate players. This adds one small endpoint to the NHL adapter.

No new dependencies.

## Layout

```
apps/server/src/jobs/
  runner.ts     runJob, the in-process lock, JobContext, the logger
  schedule.ts   scheduleJob
  results.ts    resultsJob + ingestDay (shared with backfill) + finalizeGame
  backfill.ts   backfillJob
  roster.ts     rosterJob
  index.ts      JOBS registry: name → job function
apps/server/src/recap.ts           loadRecap(db, date) + formatRecap(rows) (pure)
apps/server/scripts/job.ts         pnpm job
apps/server/scripts/recap.ts       pnpm recap
apps/server/test/fake-client.ts    fixture-backed fake fetcher
apps/server/src/sources/nhl/       + schedule-calendar: URL builder, raw schema, mapScheduleCalendar → { teams }
apps/server/test/fixtures/nhl/schedule-calendar/<date>.json   recorded with pnpm fixtures:record
```

## Job runner

- `JobContext = { db, client: Pick<PoliteClient, 'get' | 'requestCount'>, now: () => Date, log, overrides }`. The clock and the client are injected; bookkeeping timestamps (`final_at`, `boxscore_fetched_at`, `updated_at`, `job_runs` times) use the DB's `now()` (D-033).
- A job is `(ctx, run, args) => Promise<void>` where `run` carries `counts: Record<string, number>` (the job increments it) and `fail(message)` (records a per-unit failure and keeps going).
- `runJob(ctx, name, args)`:
  1. **Lock:** a module-level `Set` of running job names. If `name` is in it: log `{"level":"warn","job":name,"msg":"skipped: already running"}` and return `{ status: 'skipped' }` — no `job_runs` row (a skipped start isn't a run). `shortcut: in-process lock; a second process on the same Postgres isn't locked out — upgrade (advisory lock or a job_runs partial unique index) if S10 runs a CLI job against prod while the server's scheduler runs`. Two processes on PGlite can't happen (below).
  2. `startJobRun(db, name, args)`.
  3. Run the job. Afterwards: `status` = `succeeded`, or `partial` if `fail` was called; `error` = the failure messages joined with `; ` (null when none). If the job throws: `failed`, `error` = the message; counts gathered so far are kept either way. `counts.requests` = the client's request-count delta.
  4. `finishJobRun`; log one summary line; release the lock in `finally`. Never rethrows — the result goes back to the caller (the CLI sets the exit code).
- **Logger:** `log.info|warn|error(msg, fields)` writes one JSON line (`level`, `job`, `run` id, `msg`, fields) through an injected `write` (default `console.log`/`console.error`); tests capture lines. Every mapper `warnings` entry is logged at `warn` level.

## Sharing the dev PGlite

PGlite has no lock of its own (no pid file in its dist), and two processes on one data dir corrupt it. `openPglite(dataDir)` takes a lock file `<dataDir>.lock` (`openSync(…, 'wx')`, containing the pid) and `close()` removes it. If the file exists and its pid is alive (`process.kill(pid, 0)`), it throws `PGlite <dataDir> is in use by process <pid> (is pnpm dev:server running?) — stop it, or set DATABASE_URL`; a dead pid's lock is taken over. In-memory PGlite (tests) takes no lock. So `pnpm job`/`pnpm recap`/`pnpm db:*` and the dev server (once it opens the DB, S04b/S06) run one at a time, with a clear error instead of corruption. The `client.ts` `shortcut:` comment is replaced.

## Repository carry-overs (S02b, S03)

- **FINAL never downgraded / period scores kept** — in `upsertGames`, so every caller is covered: the conflict update's `setWhere` adds `not (stored status = FINAL and incoming status <> FINAL)`; such a row is skipped whole (no `updated_at` move, not counted). Period scores are written as `coalesce(incoming, stored)`, so a feed without them keeps the stored ones and still updates the rest of the row (amended in PR #9 review; was: the row skipped whole). A FINAL → FINAL write (score change) still updates.
- **Game checks** in `upsertGames`, before writing, any failure rejects the batch: league fits the source (`nhl` → NHL, `espn` → NBA), both teams are in the game's league, home ≠ away. Errors: `game <publicId>: …`.
- **Season-stats check** in `upsertSeasonStats`: the row's `kind` starts with the player's league's sport (as `upsertStatLines` does). Error: `season stats <playerPublicId>/<season>: …`.
- **Overrides on every player write:** jobs get `ctx.overrides` (loaded once by the CLI) and pass it to every `upsertPlayers`.
- **Bad game in a payload:** still fails the whole `score`/`schedule` payload (S03's loud behavior) — my call. Inside a job that is one failed unit (a day), not the whole run.

## Jobs

All take `--league nhl` (the only league; `nba` → "nba arrives in S05").

**schedule** (`--date`, default: the US game day of `ctx.now` — the Pacific date, `usGameDay`; amended in PR #9 review, was the UTC date)
1. `fetchSchedule(date)` (the 7-day `gameWeek`). Log warnings.
2. `upsertTeams`, then `upsertGames` (the guards above keep stored FINAL games and score-derived period scores).
3. Counts: `games`, `teams` (rows written).

**results** (`--date` optional)
1. Days to look at: with `--date`, that day. Otherwise the distinct `game_date`s of this league's stored games that are (status SCHEDULED or LIVE **and** `start_time_utc <= ctx.now()`) or (status FINAL **and** `boxscore_fetched_at` is null). No days → no upstream call; the run still writes its `job_runs` row.
2. For each day, `ingestDay(day)` in its own try/catch (a failure → `fail`, next day):
   1. `fetchScore(day)`; log warnings; `upsertTeams`; `upsertGames`.
   2. `update games set final_at = now() where league, game_date = day, status = FINAL, final_at is null`.
   3. For each stored game of that league and day with status FINAL and `boxscore_fetched_at` null: `finalizeGame` in its own try/catch (failure → `fail`, the game stays unfetched, so the next run retries it).
3. `finalizeGame(game)`:
   1. `fetchBoxscore` → `{ lines, teams, players }`; `upsertTeams(teams)`.
   2. Unknown players = the stubs whose public ID isn't stored. Players already stored are never overwritten by a stub (stub names are `"E."`). For each unknown one: `fetchPlayerLanding` → `upsertPlayers([player], overrides)`, log warnings, `enriched++`. If the landing's current team isn't stored (e.g. Merzļikins' landing says TOR while only CBJ and PIT are stored; or a backfill before any roster run), the player is written with `currentTeamExternalId: null` and a warning — the roster job sets his team (my call: the box score's team is historical, so it isn't used). If the landing fetch or its write fails: write the stub, with no current team, instead, log a warning, `fail(...)`. The line is never dropped. Known limit: a stub left by a failed enrichment is fixed by the next roster run if he's on a roster; a later results run won't retry him.
   3. `upsertStatLines(game, lines)`; then `boxscore_fetched_at = now()`.
4. Counts: `days`, `games`, `finalized`, `lines`, `stubs`, `enriched`, `requests`.
5. Known limit (parked, PR #8): a game that stays SCHEDULED/LIVE after its start (e.g. it vanished from the payload) keeps its day a candidate, so each run re-fetches that day's `score`. The S04b scheduler can bound it.

**backfill** (`--from`, `--to`, inclusive, `from <= to`): `ingestDay` for each day in order — `score` gives every game of the day including future ones, so no `schedule` call is needed. Same counts as results. Re-running fetches one `score` per day and no box scores.

**roster**
1. `fetchScheduleCalendar(--date, default `usGameDay(ctx.now)`)` → the league's teams; `upsertTeams`. A failure here throws (run `failed`: nothing to compare against).
2. For each team: `fetchRoster(team)` in its own try/catch (failure → `fail("roster <abbrev>: …")`); log warnings; collect players.
3. `upsertPlayers(all collected, overrides)`.
4. Only if **every** team's roster was fetched: `active = false, current_team_id = null` for this league's players not in the collected set (where `active` or `current_team_id is not null`, so a re-run is a no-op), and `active = true` for collected players stored inactive. After any failed fetch: no `active` change at all (AC1, VISION §6.1), and the run is `partial`.
5. `recomputeNationalities(db, overrides)`; log its warnings.
6. Counts: `teams`, `teamsFailed`, `players`, `deactivated`, `reactivated`, `nationalitiesUpdated`, `requests`.

## Fake fetcher (`test/fake-client.ts`)

`fakeClient(routes: Record<url, unknown>)` → `{ get, requestCount, requests: string[] }`. `get` returns `{ text: JSON.stringify(payload) }` for a known URL (built with `nhlUrls`), and throws `HttpError(url, 404)` for an unknown one. Tests build routes from `loadFixture`, and may trim or mutate a fixture **in memory** — e.g. keep only the games of `score/2026-01-17` that have a recorded box score (`2025020760`), or cut the calendar to the three recorded rosters (CBJ, FLA, PIT). Fixture files are never edited.

Job test cases (in-memory PGlite via `createTestDb`):
- results over `score/2026-01-17` (trimmed to `2025020760`): lines stored only for the FINAL game; a FUT game (`score/2026-10-16-states`) gets no box-score request; re-run → identical rows (`updated_at` unchanged), 0 box-score requests.
- schedule after results: `schedule` with the game mutated to FUT, and unmutated (FINAL, no period scores) → stored status, scores and period scores unchanged.
- unknown player: seed every box-score player of `2025020760` except Merzļikins (`8478007`); results writes him from `player-landing/8478007` (first name `Elvis`, birth city, LVA; current team null because TOR isn't stored, with a warning) with one landing request, run `succeeded`; with the landing route missing → stub kept, line stored, run `partial`.
- roster: calendar cut to CBJ/FLA/PIT; a seeded player on none of them → `active = false`, team null; a mutated roster listing him → restored; one roster route missing → no `active` change, `job_runs` `partial` with `roster PIT` in `error`.
- runner: same job started twice while the first awaits → second skipped, warn line logged, one `job_runs` row; a job that throws → `failed` row with the message and counts.
- repository: the FINAL/period-score guards and the game/season-stats checks.

## CLI

```
pnpm job schedule|results|roster|backfill [--league nhl] [--date YYYY-MM-DD] [--from YYYY-MM-DD --to YYYY-MM-DD]
pnpm recap --date YYYY-MM-DD [--countries LVA[,EST…]]
```
`scripts/job.ts`: validate arguments (real dates; `--from/--to` only for backfill; usage on error), `openDb()`, `migrate()` (so a fresh `.data` works), the polite client with the honest User-Agent, `loadNationalityOverrides()`, `runJob`, then print requests by host and close. Exit code 0 only for `succeeded`.

`scripts/recap.ts`: no migrate; `loadRecap(db, date)` reads that day's games (with team abbrevs), their stat lines, and the players involved — those with a line plus those whose current team plays that day — then `gameDayRows` picks the rows and `formatRecap` prints them.

### Recap rows (owner ruling, 2026-10-18)

The recap shows VISION §4.1's rows now, through one pure function that S06's `/v1/days` reuses, so the recap and the app can't drift:

`gameDayRows({ games, lines, players }, prefs)` (`apps/server/src/game-day-rows.ts`) → per game with at least one shown player, in start-time order, that game's rows:
- **line** — a shown player with a played line;
- **dnp** — a shown player whose line is `played: false` (`DNP`, plus ` — reason` when there is one);
- **not in lineup** — a shown player whose *current* team played this game, the game is FINAL and its box score is stored, and he has no line (Girgensons as a healthy scratch). A player with no current team (sent to the AHL, released) gets no row. Known limit, as §4.1 says: current team, so older dates can be wrong after a trade.

"Shown" is `isShown` (leagues: all, countries from `--countries`, default `LVA`, no favorites/hidden). Order within a game: away team first; within a team, played skaters by points descending, then goalies, then DNP and not-in-lineup rows.

```
NHL 2026-01-17
CBJ 4 – 3 PIT  Final/SO
  Elvis Merzlikins   CBJ  SV 30/33 · .909 · 3 GA · W
  Arturs Silovs      PIT  SV 25/28 · .893 · 3 GA · L
TBL 2 – 1 BOS  Final
  Zemgus Girgensons  TBL  Not in lineup
```
(Illustrative numbers.)
Card text follows §4.1: skater `1 G · 1 A · +2 · 4 SOG · 18:32`, goalie `28/30 · .933 · 2 GA · W`. Status per §4.1 (`Final`, `Final/OT`, `Final/SO`, `Live`, start time in UTC for scheduled, `Postponed`/`Cancelled`). No shown player → `No players from LVA on 2026-01-17.`

## Spike removal

Delete `apps/server/scripts/spike/`, both `spike` scripts, the "Spike limits" quirks in `docs/sources/nhl.md` and `espn-nba.md` (keep the facts they record), the PROGRESS parking-lot line; root `job`/`recap` scripts point at the new CLIs; `docs/sources/nhl.md` gains the `schedule-calendar` row.

## Live check (AC4, run by you, ~40 requests)

```
pnpm db:reset
pnpm job roster --league nhl                                        # 1 calendar + 32 rosters ≈ 35 s
pnpm job backfill --league nhl --from 2026-10-16 --to 2026-10-17    # 2 scores + 1 per final game + a landing per unknown player
pnpm recap --date 2026-10-17 --countries LVA                        # compare with nhl.com box scores
```
Exact dates are picked at the end so a Latvian played. The live run is also the first check of unrecorded game states and of `null`-vs-absent fields; a failure there is fixed by widening the raw field (`.nullish()`) with a re-recorded fixture.

## Left to the builder

File-internal structure, log field names, recap column widths, the exact SQL shape of the guards and checks, and how `ingestDay` is shared between results and backfill.

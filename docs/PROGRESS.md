# Progress

Read this first in every session. **Current state** is rewritten at each `/handoff`; the sections below it are append-only.

## Current state
- **Last session:** S04b — Season stats, corrections, scheduler, 2026-10-18. The pipeline runs on its own: `season-stats` job (current season derived from the stored schedule), one box-score correction per game ≥ 6 h after final inside `results`, a pure `decide()` driving a 10-minute dev-server scheduler (`SCHEDULER_ENABLED=1`), game-day helpers in shared, a race-free PGlite lock. Then review fixes for PR #10: corrections bounded to finals of the last 24 h (any age on the startup tick and manual runs), NBA guard on the corrections pass, startup catch-up survives a failed first tick, `latestStartedGameDay` skips postponed/cancelled games.
- **Branch / PR:** `s04b-scheduler` → `main`, PR #10. PR #9 (S04a) is merged.
- **What works:** `pnpm verify` (37 test files, 653 tests, ~85 s). Owner's live run 2026-10-18: `pnpm job season-stats --league nhl` → 742 rows, 14 skipped, 2 requests; `SCHEDULER_ENABLED=1 pnpm dev:server` first tick ran schedule (`daily 09:00`), results (`games in progress`; 11 finalized, 16 corrected, 29 requests), roster (`daily 10:00`), later ticks `decisions: []`; Ctrl-C releases the lock.
- **How to try it:** `pnpm job season-stats --league nhl`; `SCHEDULER_ENABLED=1 pnpm dev:server` (watch the `tick` lines, Ctrl-C to stop); `pnpm test game-day db-lock current-season jobs-season-stats jobs-results scheduler cli-args`.
- **Next session:** S05 — ESPN NBA adapter + jobs.
- **Notes for the next sessions:**
  - S05: `decide()` takes `leagues`, but `job_runs` has no league column, so `lastRuns` is per job (`decide.ts:26` `shortcut:`) — key it by league when NBA joins, or a daily NHL run will count for NBA. `startScheduler` defaults to `['NHL']`; every job still throws `arrives in S05` for NBA.
  - S06's `/v1/meta` reuses `currentSeason(db, league, now)` (`src/db/games.ts`, D-039); the main page's default day and prev/next navigation use `latestStartedGameDay`/`previousGameDay`/`nextGameDay` (shared `game-day.ts`; `latestStartedGameDay` needs each game's `status`).
  - `season-stats` stores totals only for players already in the DB (D-039: "rostered" = stored); unknown players are counted `skipped`. Summer re-fetches the finished season daily (2–6 requests).
  - Corrections (D-040): a box score first fetched ≥ 12 h after the start counts as corrected, so backfills are never re-fetched; DB games from before S04b got one correction each on the first results run. Corrections reach only finals of the last 24 h, except on the scheduler's startup tick and a manual `pnpm job results` (`catchUp`).
  - The dev server holds the PGlite lock only with `SCHEDULER_ENABLED=1`; stop it before `pnpm job`/`recap`/`db:*`. Under `tsx watch` a tick longer than 5 s is SIGKILLed on Ctrl-C or an edit-triggered restart: its `job_runs` row stays `running` and the next start takes over the dead pid's lock (`main.ts:39` `shortcut:`, D-041).
  - Daily jobs (09/10/11 UTC) count any run status: a failed roster waits until tomorrow (or a manual `pnpm job`).
  - A box-score newcomer whose landing fetch fails stays a stub and is never retried; `roster --date` only moves the calendar date (parking lot, PR #9).
  - The live runs saw only FINAL/OFF (and now in-progress) games; PRE/CRIT/OVER/PPD/CNCL and null-vs-absent fields are still unseen.
  - pnpm 12 refuses package versions younger than 1 day (`minimumReleaseAge`); after mise installs a different Node, run `corepack enable && mise reshim` once.

## Known issues
- none

## Parking lot
Ideas that came up but are out of scope for now.
- `apps/mobile/app.json` keeps the template's `web.output: "server"`, which `expo export -p web` turns into a server bundle needing a Node host; S08 (screenshots from the web build) or S14 (static home-screen web app) should switch it to `"static"` (PR #4 review).
- Mobile typecheck differs between a dev machine and CI: Expo's typed-route and asset types (`.expo/types`, `expo-env.d.ts`) are gitignored and only exist after `expo start`. Settle it in S08, when screens first use `Link href` or import assets — e.g. run `expo customize`/type generation before `tsc` in the mobile `typecheck` script (PR #4 review).
- CI: cache the pnpm store (`corepack enable` before `actions/setup-node`, then `cache: pnpm`) once runs get slow; they take about 20 s now (PR #4 review).
- S01 deferred minors: the polite-client backoff test asserts `≥` delays rather than exact ones; the polite client reads the wall clock (`Date.now`), so a backward clock step could stall a host's queue — inject a monotonic clock if the jobs ever show it (PR #5 review).
- `docs/sources/nhl.md` size table lacks rows for `skater-summary-reg`/`goalie-summary-reg` (~20 KB each).
- `apps/server/test/config.test.ts`: add `' 8080'`, `'1e3'`, `'0x10'`, `'+80'` to the invalid-PORT cases (the inputs its regex exists to reject).
- Nationality upgrade (D-030): NHL stats `bios` `nationalityCode` as a source value between the override and the birth country (override → source → birth; `nationality_source` gains `source`). Backward-compatible: an optional resolver input. Needs the bios pages (~20 requests a season) in the season-stats job.
- `packages/shared/src/model.ts:84` — `shortcut:` `SeasonStats.stats` is an untyped number record; S04b's season-stats job stores it as mapped, untyped — S07 (player detail) decides whether to type it.
- S02a deferred test minors: `stats.test.ts` never pins the exact `invalid <kind> stats:` prefix and has no goalie `savePct` < 0 case; `nationality.ts` checks `birthCountry` by truthiness where `selection.ts` uses `!== null`.
- S02b deferred minors (task and final reviews): the stat-payload error drops the zod error as `cause` (`games.ts`); one line-deletion test asserts `≥ 1` where the count is known; the played/sport/team rejection tests match only the `stat line <game>/<player>` prefix; the sport check is tested one direction only; "migrating twice" checks only `leagues` rows; `STAT_BASES` `satisfies` is one-way; `teamIdLookup` filters by `external_id` only (the map keys by source); a line for an unstored team reports "is not the home or away team" rather than "unknown team"; a line's player from the other league isn't rejected.
- `recomputeNationalities` runs one UPDATE per changed row — fine at override scale; batch it if a mass change ever happens.
- S10: the node-postgres `Pool` has no `'error'` listener (an idle-client error would crash the process); exercise `openPostgres` against the real deploy (`client.ts` `shortcut:`).
- `apps/server/src/db/players.ts:13` — `shortcut:` `searchName` leaves ø, ł, đ undecomposed; S07's search decides.
- S03: mapper files are `games.ts`, `boxscore.ts`, `players.ts`, `season-stats.ts`, while `.claude/rules/adapters.md` says `map-*.ts` (the rule was missed in the design; the red tests import these paths). Owner picks: rename the files and their test imports, or amend the rule to allow topic names.
- `packages/shared/src/countries.ts:263` — `shortcut:` ESPN aliases only (USA, England/Scotland/Wales → GBR); S05 adds the full ESPN country-name table and the lookup.
- S03 deferred minors: `mapScore` reads a missing `goals[]` as no goals (a scored game without it would show 0–0 periods; could throw when goal counts ≠ score); `boxscore.ts` `savePctg ?? null` is an unreachable fallback; `periodDescriptor` is `.nullish()` while other optional fields are `.optional()`; no tests for `fetchSchedule`, `fetchPlayerLanding`, skater truncation; `scripts/endpoints.ts` imports `nhl/client`, not `nhl/index`; birthCountry warning tests use `toContain`; `pnpm inspect` joins the fixture id into the path unsanitised (local tool) and its exit/usage behaviour is checked by hand; root `vitest.setup.ts` is lint-only (not typechecked); only `fetch` is blocked in tests, not `node:http`.
- NHL stats REST `start` paging is untested (S03 uses `limit=-1`, probed live 2026-10-17).
- S04a deferred minors (task and final reviews; ledger triage "defer"): `inspect.test.ts` endpoint list is a substring match (`schedule-calendar` unasserted); repository-guards: bare `toThrow()` in the batch test, raw `excluded.*` SQL in the guards; PGlite lock: ENOENT race between EEXIST and read, two simultaneous stale takeovers, pid reuse; logger fields can overwrite `level`/`msg`/`job`/`run`; untested: the runner's summary log line, roster/schedule warnings at warn, reactivation frozen on a partial roster run, `loadRecap`'s "line but current team elsewhere" branch, a goalie with `savePct` null (percentage omitted), four CLI guards; `jobs-results` "seeded stubs keep their names" can't fail; `scoreOnly` helper duplicated in two test files; schedule default-date test at 09:00Z can't tell UTC from local; country error quotes the untrimmed value; spec's sample recap shows a `SV ` prefix the code doesn't print.
- `apps/server/src/game-day-rows.ts:77` — `shortcut:` "Not in lineup" uses the current team, so older dates can be wrong after a trade (VISION §4.1).
- `apps/server/src/jobs/runner.ts:63` — `shortcut:` in-process job lock; a second process on the same Postgres isn't locked out (S10).
- S06: `gameDayRows` drops games without shown players; §4.1's "Other games (n)" = the day's games minus its output.
- PR #9 review, deferred (owner decision):
  - ~~`db/client.ts:77` PGlite stale-lock takeover race~~ fixed in S04b (guard file + link-created lock, D-041); still open: pid reuse keeps a stale lock alive, a raw ENOENT if the holder releases between EEXIST and the read.
  - `jobs/results.ts:124` a failed-enrichment stub is never retried: `boxscore_fetched_at` is set, so re-running results/backfill skips him and no roster lists a retired/AHL player, so he never shows in a recap. Needs a retry path (e.g. stubs with no birth country) and a `shortcut:` comment until then.
  - `jobs/roster.ts:15` `--date` changes only the calendar's team list; rosters are always `/roster/{abbrev}/current`, so a past date mixes seasons (ARI → 404, `partial`, no deactivation). Reject `--date` for roster in `parseJobArgs`, or drop the flag.
  - `jobs/results.ts:103` each unknown box-score player costs one team SELECT and one `upsertPlayers` transaction (~40 per first game); batch per game before a season backfill.
  - `jobs/backfill.ts:15` date validation duplicated from `parseJobArgs` (its DAY regex accepts 2026-02-30, `realDate` doesn't); the `message(e)` helper is copied into results, roster and runner. One module, or validate `JobArgs` once in `runJob`.
- S04b shortcuts: `apps/server/src/scheduler/decide.ts:26` `lastRuns` per job, not per league (S05); `apps/server/src/main.ts:39` tsx watch SIGKILLs a tick longer than 5 s; `apps/server/src/jobs/results.ts:21` stuck-game re-fetch now bounded by the scheduler's 24 h window only.
- S04b deferred minors (task and final reviews): `game-day.test.ts` `latestStartedGameDay` cases not an `it.each`; `db-lock.test.ts` "takeover leaves no guard" overlaps the dead-pid test, the loser test doesn't assert the guard survives; `current-season.test.ts` lacks the fallback's league filter, a future POSTPONED game in the fallback, start == now; `jobs-season-stats` "no games" doesn't assert its log; `results` can fetch one box score twice in a run (first fetch 8.5–12 h after start, > 6 h after final), nested ternary in `finalizeGame`, failed-correction test doesn't assert the error text; `scheduler-decide.test.ts` `uncorrected()` builds finals before their start, the 24 h window edges are untested, `noFuture` helper overwrites `games`; no test for `loadState` ignoring an unknown `job_runs.job` or `stop()` with no tick in flight; PGlite integrity after a SIGKILL mid-write unverified; a crash between the lock's tmp write and link leaves a `.tmp` file.
- Full `pnpm verify` showed PGlite boot timeouts (30 s hooks, 5 s default tests) when the machine's load average was 11–15; one recap test got a 30 s timeout. Revisit (fewer parallel workers, or longer hook timeouts) if CI flakes.
- S04b handoff review minors: after the first Ctrl-C further signals are ignored (outside tsx watch a hung close needs SIGKILL); a signal during `migrate()` comes before the handlers (lock left, taken over next start); a failed `close()` on the migrate-failure path hides the migrate error; a manual `pnpm job schedule` after 09:00 UTC counts as the day's run. Daily slots are UTC and shift an hour in Riga with DST: owner accepted, 2026-10-18 (D-041).
- PR #10 review, deferred:
  - `jobs/results.ts` a DB with finals stored before S04b (e.g. a big backfill made with S04a) re-fetches each of them once on the first startup catch-up (~1 request per game). The owner's DB already did (16 corrections); fix only if someone restores an old backfill: mark rows with `boxscore_fetched_at` ≥ 12 h after the start as corrected.
  - `scheduler/decide.ts:35` any `job_runs` row of a daily job counts, including a manual `--date` run (already parked above) and, from S05, another league's run (`shortcut:`).
  - `db/client.ts:90` raw ENOENT when the holder releases between EEXIST and the read (already parked under PR #9).
  - `main.ts` repeats `scripts/job.ts`'s bootstrap (package version, User-Agent, overrides, open + migrate); extract one `createJobContext()` when S10 rewires the server for deploy.
- Late NHL stat fixes: each game is re-fetched once, ≥ 6 h after the final (D-040), so a fix the NHL makes days later is never picked up. If it matters, add a second re-fetch a few days later (one request per game) (owner question, PR #10).
- `roster` prints each nationality-override warning twice (plain line and JSON log) — seen in the S04b live run.

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
- Housekeeping: merged local branches `s04a-jobs-recap`/`s04b-scheduler` deleted, stale remote-tracking refs pruned.

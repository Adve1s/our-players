# Progress

Read this first in every session. **Current state** is rewritten at each `/handoff`; the sections below it are append-only.

## Current state
- **Last session:** S03 — NHL adapter (2026-10-17). `apps/server/src/sources/nhl/`: raw zod schemas and pure mappers (score/schedule → games + teams, boxscore → stat lines + team/player stubs, roster/landing → players, skater/goalie summaries → season stats), URL builders and fetchers over the polite client (`client.ts`), the public surface `index.ts`; `pnpm inspect`; a test setup that fails any real fetch; the ESPN country-alias scaffold. Red/green: the test-writer's 180 mapper tests (`5bcfaeb`) failed on "not implemented", then passed unchanged.
- **Branch / PR:** `s03-nhl-adapter` → `main` (PR opened at this handoff). PR #7 (S02b) is merged.
- **What works:** `pnpm verify` (22 test files, 406 tests, ~45 s). Mappers take parsed JSON (`unknown`) and throw `nhl <endpoint>: invalid payload …` or `nhl <endpoint>: game|player <id>: …`; `mapScore`/`mapSchedule(raw) → { games, teams }`, `mapBoxscore(raw) → { lines, teams, players }`, `mapRoster(raw, teamExternalId)`/`mapPlayerLanding(raw) → { players|player, warnings }`, `mapSkaterSummary`/`mapGoalieSummary(raw, seasonType) → { seasonStats, total }`. Fetchers: `fetchScore`, `fetchSchedule`, `fetchBoxscore`, `fetchRoster(client, abbrev, teamExternalId)`, `fetchPlayerLanding`, `fetchSkaterSummary`/`fetchGoalieSummary(client, '2025-26', 'REG')` (one `limit=-1` request, throws when rows < total). Everything from S00–S02b still works.
- **How to try it:** `pnpm install && pnpm verify`; `pnpm inspect nhl boxscore 2025020760 | jq '.lines[] | select(.playerPublicId=="nhl-8478007")'`; `pnpm inspect nhl score 2026-01-17 | jq '.games[0].periodScores'`; `pnpm test nhl-`; read `docs/superpowers/specs/2026-10-17-s03-nhl-adapter.md`.
- **Next session:** S04a — Ingestion jobs + recap CLI.
- **Notes for the next sessions:**
  - Status: `gameScheduleState` PPD → POSTPONED, CNCL → CANCELLED; else `gameState` FUT/PRE → SCHEDULED, LIVE/CRIT/OVER → LIVE, FINAL/OFF → FINAL; anything else throws. Only FUT/FINAL/OFF are seen in fixtures — S04a's live run is the first real check. Game types other than 1/2/3 (All-Star, international) are skipped.
  - Period scores come from `score`'s `goals[]` (labels `1`..`3`, `OT`, `2OT`…, `SO`; a shootout counts 1 for the winner). `schedule` games have `periodScores: null`, so the schedule job must not write past games over score-derived ones.
  - A box-score line with TOI `00:00` is a DNP line (`played: false`, `stats: null`, `dnpReason: null`) — dressed backup goalies. `mapBoxscore` throws on a game that hasn't started: fetch box scores for finals only. Stubs carry `"E."`/`"Merzlikins"` names and the game's team; enrich from landing.
  - Team `externalId` is the NHL numeric team ID as a string (`"29"`); the roster URL takes the abbrev, so `fetchRoster` needs both. Team `name` is the common name ("Blue Jackets").
  - `mapRoster`/`mapPlayerLanding` return `warnings` (an unknown `birthCountry` → `null` + warning): jobs must log them. Optional raw fields accept "absent", not `null`; a live `null` (e.g. a free agent's `currentTeamId`) fails loudly — widen that field to `.nullish()` if it happens.
  - One bad game fails a whole `score`/`schedule` payload (loud by design); S04a decides whether to isolate per game.
  - After 2026-10-17 20:00 UTC, delete the `minimumReleaseAgeExclude` block in `pnpm-workspace.yaml` and confirm `pnpm install --frozen-lockfile` still passes (still pending).
  - pnpm 12 refuses package versions younger than 1 day (`minimumReleaseAge`); after mise installs a different Node, run `corepack enable && mise reshim` once.

## Known issues
- `pnpm-workspace.yaml` exempts 9 Expo SDK 58 packages from pnpm's 1-day release-age check until 2026-10-17 20:00 UTC; delete the block after that.

## Parking lot
Ideas that came up but are out of scope for now.
- `apps/mobile/app.json` keeps the template's `web.output: "server"`, which `expo export -p web` turns into a server bundle needing a Node host; S08 (screenshots from the web build) or S14 (static home-screen web app) should switch it to `"static"` (PR #4 review).
- Mobile typecheck differs between a dev machine and CI: Expo's typed-route and asset types (`.expo/types`, `expo-env.d.ts`) are gitignored and only exist after `expo start`. Settle it in S08, when screens first use `Link href` or import assets — e.g. run `expo customize`/type generation before `tsc` in the mobile `typecheck` script (PR #4 review).
- CI: cache the pnpm store (`corepack enable` before `actions/setup-node`, then `cache: pnpm`) once runs get slow; they take about 20 s now (PR #4 review).
- S01 deferred minors: the polite-client backoff test asserts `≥` delays rather than exact ones; the polite client reads the wall clock (`Date.now`), so a backward clock step could stall a host's queue — inject a monotonic clock if the jobs ever show it (PR #5 review).
- `docs/sources/nhl.md` size table lacks rows for `skater-summary-reg`/`goalie-summary-reg` (~20 KB each).
- `apps/server/scripts/spike/spike.ts:2` — `shortcut:` NBA Latvians come from current rosters; the spike is deleted when S04a adds `pnpm recap`.
- `apps/server/test/config.test.ts`: add `' 8080'`, `'1e3'`, `'0x10'`, `'+80'` to the invalid-PORT cases (the inputs its regex exists to reject).
- Nationality upgrade (D-030): NHL stats `bios` `nationalityCode` as a source value between the override and the birth country (override → source → birth; `nationality_source` gains `source`). Backward-compatible: an optional resolver input. Needs the bios pages (~20 requests a season) in the season-stats job.
- `packages/shared/src/model.ts:84` — `shortcut:` `SeasonStats.stats` is an untyped number record; S03 maps it (`gamesPlayed`, `goals`, … / `wins`, `savePct`, …) without a schema — S04b's season-stats job decides whether to type it (and update the comment's trigger).
- S02a deferred test minors: `stats.test.ts` never pins the exact `invalid <kind> stats:` prefix and has no goalie `savePct` < 0 case; `nationality.ts` checks `birthCountry` by truthiness where `selection.ts` uses `!== null`.
- S02b deferred minors (task and final reviews): the stat-payload error drops the zod error as `cause` (`games.ts`); one line-deletion test asserts `≥ 1` where the count is known; the played/sport/team rejection tests match only the `stat line <game>/<player>` prefix; the sport check is tested one direction only; "migrating twice" checks only `leagues` rows; `STAT_BASES` `satisfies` is one-way; `teamIdLookup` filters by `external_id` only (the map keys by source); a line for an unstored team reports "is not the home or away team" rather than "unknown team"; a line's player from the other league isn't rejected.
- S04a (PR #7 review; now in SESSIONS.md §S04a): `upsertGames` overwrites status and scores with whatever comes in, so a schedule re-run could downgrade a FINAL game to SCHEDULED with null scores — the results/schedule jobs decide the guard (never downgrade FINAL, or don't write past games from the schedule job).
- S04a (PR #7 review; now in SESSIONS.md §S04a): `upsertGames` doesn't check `league` against `source` or the teams' league, and accepts home == away; `upsertSeasonStats` doesn't check `kind` against the player's league. Add the checks when the jobs first write real adapter output.
- `recomputeNationalities` runs one UPDATE per changed row — fine at override scale; batch it if a mass change ever happens.
- S10: the node-postgres `Pool` has no `'error'` listener (an idle-client error would crash the process); exercise `openPostgres` against the real deploy (`client.ts` `shortcut:`).
- `apps/server/src/db/players.ts:13` — `shortcut:` `searchName` leaves ø, ł, đ undecomposed; S07's search decides.
- S03: mapper files are `games.ts`, `boxscore.ts`, `players.ts`, `season-stats.ts`, while `.claude/rules/adapters.md` says `map-*.ts` (the rule was missed in the design; the red tests import these paths). Owner picks: rename the files and their test imports, or amend the rule to allow topic names.
- S03: season `toiPerGameSeconds` is the source float (870.037), per rule 5; `.claude/rules/adapters.md` says "TOI → integer seconds" (meant for box-score strings). Clarify the rule or round in S04b.
- `packages/shared/src/countries.ts:263` — `shortcut:` ESPN aliases only (USA, England/Scotland/Wales → GBR); S05 adds the full ESPN country-name table and the lookup.
- S03 deferred minors: `mapScore` reads a missing `goals[]` as no goals (a scored game without it would show 0–0 periods; could throw when goal counts ≠ score); `boxscore.ts` `savePctg ?? null` is an unreachable fallback; `periodDescriptor` is `.nullish()` while other optional fields are `.optional()`; no tests for `fetchSchedule`, `fetchPlayerLanding`, skater truncation; `scripts/endpoints.ts` imports `nhl/client`, not `nhl/index`; birthCountry warning tests use `toContain`; `pnpm inspect` joins the fixture id into the path unsanitised (local tool) and its exit/usage behaviour is checked by hand; root `vitest.setup.ts` is lint-only (not typechecked); only `fetch` is blocked in tests, not `node:http`.
- NHL stats REST `start` paging is untested (S03 uses `limit=-1`, probed live 2026-10-17).

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

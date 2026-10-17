# Progress

Read this first in every session. **Current state** is rewritten at each `/handoff`; the sections below it are append-only.

## Current state
- **Last session:** Review fixes for PR #5, then S01 — Data spike + fixtures (2026-10-17): polite HTTP client (17 tests), fixture recorder, 42 recorded NHL/ESPN fixtures with `.meta.json`, throwaway `pnpm spike`, and `docs/sources/nhl.md` + `docs/sources/espn-nba.md` answering VISION §9 Q1–Q8 with evidence. 68 live requests of the 250 budget.
- **Branch / PR:** `s01-data-spike` → `main`, PR #5 (review fixes pushed). `origin/s01-data-spike-old` is a backup copy of the same commits; the owner deletes it later.
- **What works:** `pnpm verify` (5 test files, 47 tests); `pnpm fixtures:record <source> <endpoint> <id> [--as <name>] [--force]` (endpoint table in `apps/server/scripts/endpoints.ts`); `pnpm spike --date 2026-03-16` prints Šilovs (PIT, SV 25/27 W) and Porziņģis (GS, 30 PTS) — owner spot-checked against nhl.com/espn.com. Everything from S00 still works.
- **How to try it:** `pnpm install && pnpm verify`; `pnpm spike --date 2026-03-16` (live, ~26 requests, ~25 s); read `docs/sources/nhl.md` and `docs/sources/espn-nba.md`.
- **Next session:** S02a — Domain model, selection rule, nationality, branch `s02a-domain-model`.
- **Notes for the next session:**
  - S02a decides the nationality rule: both source docs end their **Nationality** section with a "Proposal for S02a (not adopted)". NHL stats `bios` carry `nationalityCode` (agrees with `birthCountryCode` for every Latvian); ESPN `citizenship` is often missing and gives Embiid "Cameroon", so overrides stay. VISION §7, CLAUDE.md rule 6 and DECISIONS are unchanged until then.
  - For S03: NHL stats `summary`/`bios` rows without `gameTypeId=2` sum regular season + playoffs and repeat once per game type; NHL boxscore has no period scores (`right-rail` `linescore` has them); NHL preseason finals end in `FINAL`, not `OFF`. ESPN `reason` reads "COACH'S DECISION" even for players who played — read it only when `didNotPlay` is true; `statistics/byathlete` is the bulk season-stats endpoint (578 athletes, 12 pages). See each doc's Quirks.
  - After 2026-10-17 20:00 UTC, delete the `minimumReleaseAgeExclude` block in `pnpm-workspace.yaml` and confirm `pnpm install --frozen-lockfile` still passes (S01 ended before 20:00).
  - pnpm 12 refuses package versions younger than 1 day (`minimumReleaseAge`); after mise installs a different Node, run `corepack enable && mise reshim` once.
  - Still untested: test-writer routing (first use S02a) and the cloud install hook in a real cloud session.
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

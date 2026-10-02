# Session plan

The build, sliced into Claude Code sessions. Each session has a contract (scope, out of scope, acceptance criteria) and a **ready-to-paste prompt**. The prompts are short on purpose: they point Claude at this file and `VISION.md`, so the detail lives in one place and you can edit it here.

How the agents fit in, and why: `docs/WORKFLOW.md`.

## How to run a session

1. Start `claude` in the repo root. The first prompt of each slice has Claude create the slice branch from the latest `main`; later prompts continue on it. Sessions start in plan mode (set in `.claude/settings.json`).
2. If the Overview says effort **high**, run `/effort high` (press `s` to apply it to this session only). Optional: `/rename S03 nhl adapter` so `claude --resume` finds it later.
3. Paste the session's prompt.
4. Read the plan. Push back, or press `Ctrl+G` to edit it. Approve with **"Yes, and use auto mode"** (or **"manually approve edits"** while you're still learning how Claude works).
5. Watch the first few minutes; press `Esc` to interrupt the moment it heads somewhere wrong.
6. When Claude says the work is ready: run **`/handoff`**. It verifies, has the reviewer subagent check the session's changes, updates `PROGRESS.md` and `DECISIONS.md`, commits and pushes (approve the push prompt), opens or updates the slice's draft PR, posts its briefing there, and reports CI — including which files are worth reading.
7. Read those files, in your editor or in the PR's **Files changed** tab. Ask questions, or run `/walkthrough <area>` for a guided tour.
8. Exit. The next session starts fresh; `PROGRESS.md`, git and the PR carry the state.

**In the cloud** (sessions marked "either" in the Overview): start the session at claude.ai/code — pick the repo, the slice branch, **Plan** mode — or with `claude --cloud "<prompt>"` from the repo, and paste the same prompt. A cloud session works on its own branch, so its `/handoff` opens a small PR into the slice branch; merge it on GitHub and the slice PR updates. Live checks ("run by you") stay local: `git pull` the slice branch first, or bring the whole session to your terminal with `claude --teleport`. Details: WORKFLOW.md → Cloud sessions.

**Sizing.** A session is one reviewable change, usually a few hundred to ~1,500 changed lines. Opus 5.5 has a 1M-token window, so `/context` will rarely look full; use an absolute budget instead: if the session passes **~200K tokens** of context before the work is done, stop at a green checkpoint, run `/handoff`, and continue in a new session with the "Resume" template at the bottom. A clean restart beats a long, compacted session.

**Slice ends.** After the slice's last session, start a fresh session on the slice branch and run `/slice-review <n>`. It writes `docs/reviews/slice-<n>.md`, posts it to the PR as a review with inline comments, and marks the PR ready. Read it on GitHub, then run the "Review fixes" template with your decision for each finding, then `/handoff`. When CI is green, merge the PR on GitHub with **Create a merge commit**, then update your local copy: `git switch main && git pull --ff-only`.

## Overview

All sessions run on **Opus 5.5**, the Pro default. **Effort** is what to set with `/effort` (Opus 5.5 defaults to medium); `/slice-review` and the reviewer subagent run at high automatically. **Where**: *local* needs your machine (phone, mise, consoles, secrets, or live upstream calls); *either* also runs well as a cloud session.

| ID | Session | Branch | Size | Effort | Where | You can try afterwards |
|---|---|---|---|---|---|---|
| K0 | Kit review (docs only) | `kit-review` | S | high | either | A plan reviewed by a fresh pair of eyes; the PR flow tried once |
| S00 | Bootstrap | `slice-0-setup` | M | medium | local | App placeholder on phone + web; `/health`; CI on the PR |
| S01 | Data spike + fixtures | `slice-0-setup` | M | medium | local | `pnpm spike --date …` prints Latvians' lines |
| R0 | Slice 0 review + fixes | `slice-0-setup` | S+S | high | either | Slice 0 merged |
| S02 | Schema, domain, selection rule, nationality | `slice-1-data-core` | L | high | either | Selection rule + DB tests; local DB |
| S03 | NHL adapter | `slice-1-data-core` | M | medium | either | `pnpm inspect nhl boxscore …` |
| S04 | Jobs, scheduler, recap CLI | `slice-1-data-core` | L | high | either | `pnpm recap` — terminal morning recap (NHL) |
| R1 | Slice 1 review + fixes | `slice-1-data-core` | S+S | high | either | Slice 1 merged |
| S05 | ESPN NBA adapter + jobs | `slice-2-nba` | L | high | either | `pnpm recap` with NHL + NBA |
| R2 | Slice 2 review + fixes | `slice-2-nba` | S+S | high | either | Slice 2 merged |
| S06 | API: days, games, meta | `slice-3-read-api` | M | high | either | `curl …/v1/days/<date>?countries=LVA` |
| S07 | API: players, search, countries | `slice-3-read-api` | M | medium | either | Search and player detail over HTTP |
| R3 | Slice 3 review + fixes | `slice-3-read-api` | S+S | high | either | Slice 3 merged |
| S08 | App shell, settings, screenshots | `slice-4-app-v1` | M | medium | local | Settings on phone; `pnpm screenshots` |
| S09 | Main page | `slice-4-app-v1` | L | high | local | **The morning recap app** |
| R4 | Slice 4 review + fixes | `slice-4-app-v1` | S+S | high | either | Slice 4 merged |
| S10 | Deploy backend | `slice-6a-ship` | M | medium | local | Public API with a running scheduler |
| S11 | Android build + Play closed test | `slice-6a-ship` | M | medium | local | Friends install it; **14-day clock starts** |
| R6a | Slice 6a review + fixes | `slice-6a-ship` | S+S | high | either | Slice 6a merged |
| S12 | Search, favorites, hidden | `slice-5-players-games` | M | medium | local | Star/hide players |
| S13 | Player page + game page | `slice-5-players-games` | M | medium | local | Full v1 feature set |
| R5 | Slice 5 review + fixes | `slice-5-players-games` | S+S | high | either | Slice 5 merged |
| S14 | Web build as a home-screen app | `slice-6b-web-launch` | M | medium | local | iPhone friends use it |
| S15 | Production access + runbook | `slice-6b-web-launch` | S | medium | local | Public on Google Play |
| R6b | Final review + fixes | `slice-6b-web-launch` | S+S | high | either | v1 done |

Every slice is one pull request; its review rows run on the slice's branch. Slices 6a/6b split the brief's slice 6 so the Play closed test starts before slice 5 (DECISIONS.md D-014).

**Size** is a rough guess at your attention per session: S under 1 h, M 1–2 h, L 2–3 h. An L session may need a second sitting — use the "Resume" template.

---

## Before you start

### K0 — Kit review

**Goal:** an independent check of these docs and the Claude Code setup before any code exists, by a session that never saw how they were written. It also tries the branch → PR → merge flow once, on docs only.

**In scope:** read every file in the repo; find contradictions between files, gaps (things a session will need that no doc defines), instructions Claude could misread, over-engineering for a solo hobby project, sessions that are too big or badly ordered, acceptance criteria that can't be checked, and Claude Code configuration that doesn't match current Claude Code; apply the findings you accept.

**Out of scope:** app code; changing product decisions without asking.

**Acceptance criteria**
1. The review names every file it read.
2. Findings come as a table with severity and a concrete suggested edit each; "no blockers" is a valid result.
3. Accepted edits applied, rejected ones untouched, deferred ones in the PROGRESS.md parking lot.
4. Merged into `main` through a PR.

**You:** read VISION.md yourself first. You're the product owner, so you're the best judge of which findings matter.

```text
Session K0 — Kit review. Locally, first create branch `kit-review` from the latest `main`; in a cloud session, use the session's own branch.

You haven't seen how these docs were written. Review them as a skeptical senior engineer before any code exists. Read every file in the repo: CLAUDE.md, everything in docs/ and .claude/ (settings, hooks, agents, skills, rules), .gitattributes and apps/server/data/nationality-overrides.json. Where a file relies on a Claude Code feature (skill or agent frontmatter, hooks, permission rules, plan or auto mode, cloud sessions), check it against the current docs at code.claude.com/docs instead of trusting it.

Stay in plan mode and don't change files yet. Present your findings as the plan, in a table: ID, severity (blocker / major / minor), file and section, issue, suggested edit. Look for:
- contradictions between files, and things a session will need that no doc defines;
- instructions Claude could misread, or that two people would read differently;
- over-engineering for a solo hobby project, and missing basics;
- session sizing and order, and acceptance criteria that can't be checked;
- Claude Code configuration that doesn't match current behavior;
- product risks in VISION.md that the plan doesn't address.
Skip style nits; "no blockers" is a fine outcome.

I'll reply with a decision for each finding. Then apply the accepted ones, put deferred ones in the PROGRESS.md parking lot, and tell me it's ready for /handoff.
```

---

## Slice 0 — Setup + data spike (`slice-0-setup`)

### S00 — Bootstrap

**Goal:** a working monorepo skeleton where every command in `CLAUDE.md` exists, the app runs on web and Android, and the quality gate (`pnpm verify`) runs locally and in CI on the slice's pull request.

**In scope**
- pnpm workspace (`apps/server`, `apps/mobile`, `packages/shared`), `nodeLinker: hoisted`. The `apps/server/data/` folder already exists with the overrides file — keep it.
- Node 24 LTS and pnpm pinned once, read by all three of: mise (my version manager), corepack (`packageManager`) and GitHub Actions. Cloud sessions ship Node 22, so the code must also run there: `engines.node` is `>=22`.
- Shared TypeScript config (strict, `noUncheckedIndexedAccess`), Biome config (ignores `**/test/fixtures/**`, `.data`, `.expo`, `dist`), Vitest across packages (`pnpm test <filter>` works).
- `apps/server`: Hono app with `GET /health` → `{ "ok": true }` on port 3001; config from env with defaults.
- `apps/mobile`: current stable Expo SDK via `create-expo-app` (default template, example screens removed), one placeholder screen that renders a value imported from `packages/shared`. App identity in `app.json` per VISION §11: name `Our Players`, slug `our-players`, scheme `ourplayers`, `android.package` `io.github.adve1s.ourplayers`.
- `packages/shared`: consumed as TypeScript source by server and app; one trivial pure function with a test.
- Root scripts for every `CLAUDE.md` command; ones that arrive later print which session adds them and exit with code 1.
- CI: `.github/workflows/ci.yml` runs on pull requests and on pushes to `main` — frozen-lockfile install, then `pnpm verify` — in a job named `verify`.
- `README.md`: what the project is, a quick start, links to `docs/`. `.gitignore` additions for the generated stuff.

**Out of scope:** any data fetching, DB, real screens.

**Acceptance criteria**
1. Clean `pnpm install` works; versions pinned as described.
2. `pnpm verify` runs typecheck + Biome + Vitest for all packages and is green, with at least one real test in `shared` and `server`.
3. `curl localhost:3001/health` returns `{"ok":true}` while `pnpm dev:server` runs.
4. `pnpm dev:mobile` → web shows the placeholder including the value from `packages/shared` (proves Metro resolves the workspace package).
5. Every command in `CLAUDE.md` exists; not-yet-implemented ones name their session.
6. Editing a `.ts` file through Claude gets it formatted by the hook (show a before/after).
7. `app.json` carries the app identity from VISION §11.
8. After `/handoff` pushes, the draft PR's `verify` check passes (the handoff reports it).

**You:** run the phone check: allow Metro and the dev API through Omarchy's firewall (WORKFLOW.md → One-time setup, step 5), then scan the QR code with Expo Go and confirm the placeholder renders. After the first green CI run, protect `main` (step 4).

```text
Session S00 — Bootstrap (slice 0). Create branch `slice-0-setup` from the latest `main`.

Read CLAUDE.md, docs/PROGRESS.md, docs/SESSIONS.md §S00 (scope, out-of-scope and acceptance criteria are the contract for this session) and docs/DECISIONS.md. The repo currently holds only docs, .claude/ config and apps/server/data/nationality-overrides.json. I develop on Arch Linux (Omarchy) and install Node with mise; `origin` points to my GitHub repo.

In plan mode, propose:
- the workspace layout and the root package.json scripts — every command listed in CLAUDE.md must exist;
- the exact dependencies per package, one line of justification each (I approve the list once; don't add others without asking);
- how the Node and pnpm versions are pinned so mise, corepack and GitHub Actions all use the same ones (cloud sessions run Node 22, so the code must work there too);
- the Expo setup: current stable SDK via create-expo-app, default template with example screens removed, pnpm nodeLinker hoisted, app identity from VISION §11;
- shared TypeScript, Biome and Vitest config, and the CI workflow;
- how apps/server and apps/mobile consume packages/shared as TypeScript source.
Ask me whatever needs deciding.

After I approve: build it, keeping code minimal — this session is plumbing, not features. Prove each acceptance criterion with command output. When `pnpm verify` is green, tell me it's ready for /handoff.
```

### S01 — Data spike + fixtures

**Goal:** prove both sources deliver what v1 needs, build the two keepers (polite HTTP client, fixture recorder), record a fixture set, and write down what we learned.

**In scope**
- `apps/server/src/http/polite-client.ts`: ≤ 1 request/s per host, User-Agent `OurPlayers/<version> (+<repo URL>)` with the GitHub repo URL as the contact (from config), timeout, retries on 429/5xx/network errors with exponential backoff + jitter, honors `Retry-After`, no retry on other 4xx. Unit-tested with fake timers and a fake fetch.
- `pnpm fixtures:record <source> <endpoint> <id-or-date>` → `apps/server/test/fixtures/<source>/<endpoint>/<id>.json` plus `<id>.meta.json` (url, fetchedAt, status, bytes); refuses to overwrite without `--force`.
- Throwaway `pnpm spike --date YYYY-MM-DD` (in `apps/server/scripts/spike/`): prints Latvian players' lines for that game day in both leagues, plus total requests and runtime. Replaced by `pnpm recap` in S04.
- Fixture set (minimum). It's early October 2026, so use last season's regular season for most, plus one 2026 preseason game per league:
  - NHL: `score` and `schedule` for one game day with Latvians playing; `boxscore` for a game with a Latvian skater, one with a Latvian goalie, an OT game, a shootout game, a preseason game; `roster` for two teams with Latvians; `player-landing` for a Latvian skater and a goalie; first page of `skater-summary` and `goalie-summary`.
  - NBA: `scoreboard` for the same game day; `summary` for a game Porziņģis played, a game with a DNP, an OT game, a preseason game; `athlete` for Porziņģis (3102531), Embiid (3059318) and Towns (3136195) — the latter two exercise country mapping and the overrides; a team `roster` if it carries birthplaces; `overview` (season stats) for Porziņģis.
  - Any response over ~1 MB: propose a pruning rule; don't prune yet.
- `docs/sources/nhl.md` and `docs/sources/espn-nba.md`: endpoints used, verified field paths for everything VISION needs, quirks, and evidence-backed answers to the eight questions in VISION §9.

**Out of scope:** DB, normalized model, adapters, anything in `apps/mobile`.

**Acceptance criteria**
1. Polite-client tests cover spacing, retry with backoff on 429/503, `Retry-After`, timeout, no retry on 404, User-Agent header.
2. `pnpm spike --date <date>` prints at least one NHL and one NBA Latvian line, plus request count and runtime.
3. Fixture set recorded with `.meta.json` files and committed.
4. Both source docs answer all eight questions with evidence (endpoint, field path, example value).
5. `pnpm verify` green.

**You:** spot-check two or three spike numbers against nhl.com / espn.com; skim `docs/sources/`. Then run R0.

```text
Session S01 — Data spike + fixtures (slice 0, branch `slice-0-setup`).

Read docs/PROGRESS.md, docs/SESSIONS.md §S01 (the contract) and docs/VISION.md §6–§9. First run the tests.

This session talks to the live NHL and ESPN APIs. Be polite: every request goes through the polite client (at most 1 request/s per host), and keep the whole session's requests in the low hundreds.

In plan mode, propose: the polite client's API and how you'll test it without network; the recorder's file layout; how the spike finds Latvian players cheaply (check which endpoints carry birth country before assuming); the concrete games and dates you'll record for each fixture item (look them up); and how you'll answer each of the eight questions in VISION §9.

After I approve: red/green for the polite client, then the recorder, fixtures, spike and the two docs/sources files. Prove each acceptance criterion with output, then tell me it's ready for /handoff.
```

### R0 — Slice 0 review
Fresh session on `slice-0-setup`: `/slice-review 0`. It's a light review: plumbing, CI, the polite client, the recorder and the source notes. The fixture JSON is collapsed in the PR's diff view; the review only checks that each fixture came from the recorder. Then **Review fixes** with your decisions → `/handoff` → merge the PR.

---

## Slice 1 — Data core (`slice-1-data-core`)

### S02 — Schema, domain model, selection rule, nationality

**Goal:** the normalized model and database, plus the two pieces of core logic — the selection rule and nationality resolution — written test-first from the spec.

**In scope**
- `packages/shared`: league / status / kind enums, alpha-3 country type, normalized model types (team, player, game, stat line, season stats), zod schemas for stat payloads per kind; `selection.ts` (`isShown` + `Prefs`).
- `apps/server/src/db`: Drizzle `pg-core` schema per VISION §8; PGlite client for dev (file-backed under `.data/`) and tests (in memory); node-postgres client when `DATABASE_URL` is set; generated migrations; `db:migrate`, `db:generate`, `db:reset`.
- Repositories with idempotent upserts by natural key: teams, players (+ external IDs), games, stat lines, season stats, job runs; nationality recomputation.
- Nationality (VISION §7): zod-validated loader for `apps/server/data/nationality-overrides.json` (already holds Embiid and Towns), and a resolver: override if one exists, else birth country, else `null` — with its source.
- Test helper `createTestDb()` (in-memory PGlite with migrations applied).
- `.gitattributes`: mark the generated migration snapshots `linguist-generated`, like the fixtures.

**Out of scope:** adapters, jobs, API, app.

**Acceptance criteria**
1. Selection-rule tests: one per behavior in VISION §3 (test names state the behavior), plus a check over generated inputs that `isShown` matches the set formula.
2. Nationality tests: an override replaces the birth country (source `override`); without one, the birth country is used (source `birth`); an unknown birth country gives `null`; an override whose player isn't in the DB, or whose name doesn't match the stored name, logs a warning; an invalid overrides file (bad JSON, unknown country code, duplicate player) fails with a message naming the file and the entry; the committed overrides file loads cleanly.
3. `pnpm db:migrate` succeeds on a fresh local DB, and `pnpm db:generate` right afterwards produces no new migration.
4. Writing the same normalized game and lines twice leaves identical rows (PGlite test).
5. Invalid stat payloads are rejected on write with a clear error.
6. `pnpm verify` green.

**You (optional, recommended):** write `isShown` yourself. Tell Claude at plan approval: "I'll implement isShown." It writes the stub and has the test-writer produce the tests, then waits; you make them green; Claude reviews your code.

```text
Session S02 — Schema, domain model, selection rule, nationality (slice 1). Create branch `slice-1-data-core` from the latest `main`.

Read docs/PROGRESS.md, docs/SESSIONS.md §S02 (the contract), docs/VISION.md §3, §7 and §8, docs/DECISIONS.md D-004, D-009, D-010, D-012, and docs/sources/*.md. First run the tests.

In plan mode, propose: the shared domain types and zod schemas (show them); the Drizzle schema — tables, keys, indexes — mapped to VISION §8; how the dev, test and prod DB clients differ; the repository functions and their natural keys; how overrides are loaded, validated and applied; and the exact list of test cases for the selection rule and nationality resolution.

After I approve, red/green:
1. Create stubs for isShown and the nationality resolver: real signatures, bodies throw "not implemented".
2. Use the test-writer subagent to write their tests from VISION §3 and §7 only. Run them and confirm they fail on "not implemented". Commit: `test: selection rule and nationality spec`.
3. Implement until green without changing those tests — if one looks wrong, stop and tell me.
4. Then the schema, migrations, repositories and idempotency tests.

Prove each acceptance criterion with output, then tell me it's ready for /handoff.
```

### S03 — NHL adapter

**Goal:** NHL raw JSON → normalized model, proven against every recorded fixture.

**In scope**
- `apps/server/src/sources/nhl/`: URL builders and fetchers (polite client injected), raw zod schemas (only fields we use, unknown fields allowed), and **pure mappers**: schedule/score → games (status, period scores, OT/SO, season, season type, `gameDate`); boxscore → stat lines (skaters vs goalies by box-score section, TOI → seconds, save % as 0–1, decision) plus team/player stubs; roster → players (birth country, position group); landing → player enrichment; skater/goalie summary → season stats (totals).
- `packages/shared/src/countries.ts`: alpha-3 validation; scaffold for the ESPN name → code alias map.
- `pnpm inspect nhl <endpoint> <fixture-id>` prints the normalized result.

**Out of scope:** DB writes and jobs (S04), ESPN (S05).

**Acceptance criteria**
1. Every NHL fixture has at least one mapper test asserting specific values read from the raw JSON (no whole-object snapshots).
2. Covered: skater line, goalie line with decision, OT and shootout games, preseason season type, scheduled vs final, period scores, TOI parsing, season-ID normalization.
3. A malformed payload (mutated inside the test, never in the file) throws an error naming source and endpoint.
4. Tests can't reach the network: the test setup fails any real fetch.
5. `pnpm inspect nhl boxscore <id>` works.
6. `pnpm verify` green.

```text
Session S03 — NHL adapter (slice 1, branch `slice-1-data-core`).

Read docs/PROGRESS.md, docs/SESSIONS.md §S03 (the contract), docs/VISION.md §6.2, §8 and §9, and docs/sources/nhl.md. First run the tests.

In plan mode, propose: the adapter's module layout (fetch layer vs pure mappers), the raw zod schemas (only fields we use), each mapper's signature and output, the status / season / OT mapping tables, and the list of fixture-based test cases (which fixture, which values).

After I approve, red/green:
1. Create mapper stubs that throw "not implemented".
2. Use the test-writer subagent to write the mapper tests from the fixtures and VISION, with expected values read from the raw JSON by hand. Confirm they fail for the right reason. Commit `test: NHL mapper spec from fixtures`.
3. Implement mappers and fetchers until green without changing those tests.
4. Add `pnpm inspect`.

Prove each acceptance criterion with output, then tell me it's ready for /handoff.
```

### S04 — Ingestion jobs, scheduler, recap CLI

**Goal:** NHL data flows into the database on a schedule, and the terminal recap works — the first genuinely usable thing.

**In scope**
- Job runner: `job_runs` rows, per-job overlap lock, structured logs.
- Jobs per VISION §6.1: `schedule`, `results` (finalization + one correction re-fetch ≥ 6 h later), `roster` (with nationality recomputation), `season-stats`, `backfill`; unknown players in box scores become stubs and get enriched.
- Scheduler (croner or similar) driven by a **pure** "what should run now?" function; runs only with `SCHEDULER_ENABLED=1`.
- Game-day helpers in `packages/shared` (latest started game day, previous/next game day).
- `pnpm job …` and `pnpm recap --date … [--countries …]`; remove the spike.
- Fixture-backed fake fetcher for job tests.

**Out of scope:** ESPN, API, app.

**Acceptance criteria**
1. Job tests (PGlite + fixture-backed fetcher): results stores lines for final games only; re-running changes nothing; a correction re-fetch updates changed numbers; an unknown player becomes an enriched stub.
2. Scheduler decision logic, with an injected clock: no upstream calls when nothing is in progress; polling during game windows; corrections after 6 h.
3. Starting a job while the same job runs is skipped and logged.
4. Live, run by you: `pnpm job roster --league nhl`, `pnpm job backfill --league nhl --from <d> --to <d>`, then `pnpm recap --date <d> --countries LVA` shows the Latvians' lines matching nhl.com.
5. Every run writes a `job_runs` row with counts; a forced failure records the error.
6. Spike removed; scripts and docs updated.
7. `pnpm verify` green.

```text
Session S04 — Ingestion jobs, scheduler, recap CLI (slice 1, branch `slice-1-data-core`).

Read docs/PROGRESS.md, docs/SESSIONS.md §S04 (the contract), and docs/VISION.md §6, §7 and §8. First run the tests.

In plan mode, propose: the job runner (locking, job_runs, logging); each job's algorithm step by step — especially results: when to poll, how finalization and corrections work, which games a run looks at; the scheduler's pure "what should run now?" function and its test cases; the fixture-backed fake fetcher; the CLI surface of `pnpm job` and `pnpm recap`; and the live commands I'll run at the end (small request count).

After I approve: red/green for the decision logic and job behavior (you write these tests; no test-writer needed). Prove each criterion with output. For criterion 4, give me the exact commands and wait for my result before calling it done. Then tell me it's ready for /handoff.
```

### R1 — Slice 1 review

Fresh session on `slice-1-data-core`: `/slice-review 1` → read the review on the PR → **Review fixes** with your decisions → `/handoff` → merge the PR. Also run `/walkthrough the ingestion pipeline from a scheduled tick to stat_lines rows` — it's the heart of the backend.

---

## Slice 2 — NBA (`slice-2-nba`)

### S05 — ESPN NBA adapter + jobs

**Goal:** NBA data flows through the same pipeline; the recap shows both leagues.

**In scope**
- `apps/server/src/sources/espn-nba/`: scoreboard → games; summary → stat lines mapped **by label** (DNP + reason, starter, shooting splits like "8-15"), period scores; roster/athlete → players with `birthPlace.country` → alpha-3 via `countries.ts` aliases; season stats per S01's decision (bulk endpoint, or per-athlete calls within the budget written in `docs/sources/espn-nba.md`).
- Season-label and status mapping per VISION; plug the adapter into all jobs; extend `pnpm inspect` and `pnpm recap`.

**Out of scope:** API, app.

**Acceptance criteria**
1. Mapper tests for every NBA fixture with hand-read values: regular line, DNP with reason, OT game, preseason, statuses, period scores, shooting splits.
2. A test that reorders the label and stat arrays gets identical output.
3. Country mapping: "Latvia" → LVA, "Cameroon" → CMR, "USA" → USA; aliases for every spelling seen in fixtures; an unknown name → `null` + warning (tested).
4. Overrides reach NBA players: a test over the Embiid and Towns athlete fixtures yields USA and DOM with source `override`; live, after the roster job, the database shows the same (show the query).
5. NBA ingestion keeps the idempotency and stub/enrichment guarantees (tests).
6. Live, run by you: backfill a date Porziņģis played; `pnpm recap` shows NHL and NBA Latvians.
7. The season-stats job stays within the documented request budget (logged count).
8. `pnpm verify` green.

```text
Session S05 — ESPN NBA adapter + jobs (slice 2). Create branch `slice-2-nba` from the latest `main`.

Read docs/PROGRESS.md, docs/SESSIONS.md §S05 (the contract), docs/VISION.md §7–§9, docs/sources/espn-nba.md, and skim apps/server/src/sources/nhl/ for the established adapter pattern. First run the tests.

In plan mode, propose: module layout mirroring the NHL adapter; raw zod schemas; label-based stat mapping; DNP handling; country-name mapping and aliases; the season-stats strategy with its request budget; how the adapter plugs into the jobs; and the fixture test cases.

After I approve, red/green: mapper stubs → test-writer subagent writes the fixture tests (hand-read values) → confirm red → commit `test: NBA mapper spec from fixtures` → implement until green without changing those tests. Then wire up the jobs, with tests. Give me the live commands for criteria 4 and 6 and wait for my results. Then tell me it's ready for /handoff.
```

### R2 — Slice 2 review
Fresh session on `slice-2-nba`: `/slice-review 2` → read the review on the PR → **Review fixes** with your decisions → `/handoff` → merge the PR.

---

## Slice 3 — Read API (`slice-3-read-api`)

### S06 — API: days, games, meta

**Goal:** the endpoints the Main page and Game page need, typed by a shared contract.

**In scope**
- Hono app structure under `apps/server/src/api/`; zod contract in `packages/shared/src/contract/` (params + responses); preferences parsing and validation.
- `GET /v1/meta`, `GET /v1/days/{gameDate}`, `GET /v1/games/{gameId}`, `GET /health` per VISION §10: ordering rules (§4.1), did-not-play rows, prev/next game day, cache headers, error format, request logs without query strings.
- API test harness: in-memory PGlite seeded by running the real ingestion over fixtures.

**Out of scope:** players, search, countries, CORS (S07); app.

**Acceptance criteria**
1. Every response in tests parses with the shared contract schema.
2. Filtering behavior: followed country shown; hidden player removed; favorite from another country included; league filter applied to everyone.
3. Ordering and rows: games with shown players first; DNP and "Not in lineup" rows; prev/next game day.
4. `latestGameDate` with an injected clock: 08:00 in Riga returns the previous US date.
5. Bad parameters → 400 with the error format; logs contain no query strings (test).
6. With S04/S05 data loaded, `curl "localhost:3001/v1/days/<date>?countries=LVA"` returns that night's lines; 100 sequential requests show p95 under 150 ms (print it).
7. `pnpm verify` green.

```text
Session S06 — API: days, games, meta (slice 3). Create branch `slice-3-read-api` from the latest `main`.

Read docs/PROGRESS.md, docs/SESSIONS.md §S06 (the contract), and docs/VISION.md §3, §4.1, §4.5, §6.2 and §10. First run the tests.

In plan mode, propose: the contract schemas (show them); the route structure; how preferences are parsed and validated; how a day response is assembled (queries, selection rule, ordering, did-not-play rows); the test harness that seeds PGlite through the real ingestion code; and the test list mapped to the acceptance criteria.

After I approve: red/green. Prove each criterion with output (including the curl and the latency measurement), then tell me it's ready for /handoff.
```

### S07 — API: players, search, countries

**Goal:** the remaining v1 endpoints, CORS, and a typed client the app will use.

**In scope**
- `GET /v1/players/search` (diacritic-insensitive via `search_name`; prefix matches before substring matches; current players first), `GET /v1/players?ids=`, `GET /v1/players/{id}` (bio, nationality with its source, season stats, last 10 lines), `GET /v1/countries` (by sporting nationality).
- CORS with configurable allowed origins.
- A small typed API client (fetch + contract parse) the app will import, tested against the in-memory app.

**Out of scope:** app screens.

**Acceptance criteria**
1. Search: "porzingis", "PORZ", "merzlikins" and "girgen" find the right players; an empty query → 400; the limit is respected.
2. Player detail: season stats per kind; game log newest first, at most 10; nationality carries its source (Embiid: USA, `override`).
3. Countries: only countries with players, with counts per league; Embiid counts for USA, not CMR.
4. CORS: an allowed origin gets the headers; others don't.
5. Typed client tests pass against the in-memory app.
6. `pnpm verify` green.

**You:** after the handoff, run `/run-skill-generator` once so the bundled `/run` and `/verify` skills know how to start the server. Re-run it after S08.

```text
Session S07 — API: players, search, countries (slice 3, branch `slice-3-read-api`).

Read docs/PROGRESS.md, docs/SESSIONS.md §S07 (the contract), docs/VISION.md §4.3, §4.4 and §10, and the S06 routes for the established pattern. First run the tests.

In plan mode, propose: the contract additions; the search query and ranking (and how diacritics are handled); the player-detail assembly; CORS config; the typed client's shape and where it lives; and the test list mapped to the acceptance criteria.

After I approve: red/green. Prove each criterion with output, then tell me it's ready for /handoff.
```

### R3 — Slice 3 review
Fresh session on `slice-3-read-api`: `/slice-review 3` → read the review on the PR → **Review fixes** with your decisions → `/handoff` → merge the PR.

---

## Slice 4 — App v1 (`slice-4-app-v1`)

### S08 — App shell, settings, screenshot tooling

**Goal:** the app's skeleton, preferences, Settings screen, and a way for Claude to *see* the UI.

**In scope**
- Expo Router layout: tabs Today, Search (placeholder until S12), Settings; light/dark theme tokens.
- API base URL from `EXPO_PUBLIC_API_URL`: `http://localhost:3001` for web, the computer's LAN address for a phone (on the phone, `localhost` is the phone itself). Document both in the README.
- TanStack Query for server state; preferences store (Zustand + persist on AsyncStorage; `version: 1`; defaults Latvia + NHL + NBA).
- Settings: league toggles (at least one on), countries from `/v1/countries` with search, About with the non-affiliation note.
- `pnpm screenshots`: Playwright against the web build at phone size, light and dark, saved to `apps/mobile/.screenshots/` (gitignored). My machine runs Arch, where Playwright's `--with-deps` installer doesn't work: install the browser without it, and allow pointing Playwright at a system Chromium through an env var if the bundled one won't launch. CI doesn't run screenshots.
- Friendly error and offline states; an error boundary.

**Out of scope:** Main page content (S09), search and favorites (S12), player and game pages (S13).

**Acceptance criteria**
1. A fresh install defaults to Latvia + both leagues; preferences survive a web reload and an Android relaunch.
2. Preferences store logic is unit-tested (pure reducer-style functions).
3. `pnpm screenshots` produces PNGs; Claude looks at them and fixes visible layout problems (show before/after in the session).
4. Runs on Android (Expo Go, talking to the dev API over the LAN) and web without errors; API down → friendly error.
5. `pnpm verify` green.

```text
Session S08 — App shell, settings, screenshot tooling (slice 4). Create branch `slice-4-app-v1` from the latest `main`.

Read docs/PROGRESS.md, docs/SESSIONS.md §S08 (the contract), docs/VISION.md §4.2 and §4.6, and the typed API client from S07. First run the tests.

In plan mode, propose: the route/tab structure; the theme tokens; the preferences store shape and its pure update functions; the Settings screen layout (describe it); how `pnpm screenshots` starts what it needs and which screens/states it captures; and any new dependencies with justification.

After I approve: red/green for the store logic; build the screens; then run `pnpm screenshots`, look at every image, and fix what looks wrong. Prove each criterion, then tell me it's ready for /handoff.
```

### S09 — Main page

**Goal:** the morning recap screen — the reason the app exists.

**In scope**
- Game-day stepper + "Latest"; data from `/v1/meta` and `/v1/days`.
- Game cards (all status variants), stat cards per kind, did-not-play rows, ordering, collapsed "Other games".
- Loading, empty, error and offline states; pull to refresh; local-time formatting; accessibility labels.
- Formatting helpers as pure, tested functions (TOI, SV%, shooting splits, status labels, local start time).

**Out of scope:** navigation targets (player/game pages arrive in S13).

**Acceptance criteria**
1. Formatting helpers unit-tested (e.g. `.933`, `18:32`, `Final/OT`, start time in an injected timezone).
2. Screenshots reviewed and fixed by Claude for: a busy night; a night with a goalie, a skater and an NBA player; DNP rows; an empty day; the error state; dark mode.
3. With default preferences, opening the app shows the latest game day (seeded or real data).
4. Works on web and Android.
5. `pnpm verify` green.

**You:** use it on your phone for a few real mornings (the NHL season will be running) and note anything that annoys you in the PROGRESS.md parking lot.

```text
Session S09 — Main page (slice 4, branch `slice-4-app-v1`).

Read docs/PROGRESS.md, docs/SESSIONS.md §S09 (the contract), docs/VISION.md §2 and §4.1, and the app shell from S08. First run the tests.

In plan mode, propose: the component breakdown (game card, stat card per kind, DNP row, stepper); data fetching and caching (query keys, refetch on focus and pull); exact text formats for every card and status; empty/error/offline designs (describe them); and the screenshot states you'll capture.

After I approve: red/green for the formatting helpers, then the UI. Run `pnpm screenshots`, look at each image, fix what's off, repeat until it looks right. Prove each criterion, then tell me it's ready for /handoff.
```

### R4 — Slice 4 review
Fresh session on `slice-4-app-v1`: `/slice-review 4` → read the review on the PR → **Review fixes** with your decisions → `/handoff` → merge the PR.

---

## Slice 6a — Ship to closed testing (`slice-6a-ship`)

Claude prepares configs, scripts, text and runbooks; you do the account and console steps (hosting provider, Expo/EAS, Play Console) and paste results back.

### S10 — Deploy the backend

**Goal:** the API and scheduler running on an always-on host with Postgres, documented well enough to redeploy from scratch.

**In scope**
- A short hosting options memo (an always-on small VPS with Docker Compose vs a PaaS with managed Postgres: cost, effort, backups, how each runs the scheduler) → you pick.
- An upstream probe script you run **from the candidate host** before committing to it (both APIs answer, normal latency, no block).
- Dockerfile (multi-stage), production config via env, migrations on deploy, scheduler on, health check, log retention, daily DB backup.
- `docs/DEPLOY.md`: deploy, rollback, backup and restore, rotating secrets. Production API URL wired into the app config.

**Out of scope:** Android build (S11), web hosting (S14).

**Acceptance criteria**
1. Probe output from the chosen host shows both APIs reachable (pasted by you).
2. `https://<api>/health` OK; `/v1/meta` fresh; after a few hours, `job_runs` shows scheduled runs.
3. No secrets in git (the reviewer checks).
4. Season-to-date backfill completed in production.
5. `docs/DEPLOY.md` lets someone redeploy from zero.
6. `pnpm verify` green.

```text
Session S10 — Deploy the backend (slice 6a). Create branch `slice-6a-ship` from the latest `main`.

Read docs/PROGRESS.md, docs/SESSIONS.md §S10 (the contract), docs/VISION.md §6, §9 (etiquette) and §11. First run the tests.

In plan mode, start with the hosting options memo and wait for my choice. Then propose: the upstream probe script I'll run on the host; Dockerfile and runtime config; how migrations and the scheduler run in production; backups; and the DEPLOY.md outline. Mark clearly which steps I must do in provider consoles and which you do in the repo.

After I approve: build it, hand me each console/host step as an exact checklist, and wait for my results where criteria depend on them. Then tell me it's ready for /handoff.
```

### S11 — Android build + Play closed test

**Goal:** friends can install the app from Google Play's closed testing track, and the 14-day clock starts.

**In scope**
- App identity per VISION §11, already in `app.json` since S00 (verify it): name **Our Players**, package `io.github.adve1s.ourplayers`. Add icon and adaptive icon, splash, and the production `EXPO_PUBLIC_API_URL`.
- `eas.json` profiles (development, preview, production), version codes, a production AAB build.
- `docs/store/`: listing texts (with the non-affiliation note), Data safety answers, content-rating answers, privacy policy (a hosted page — GitHub Pages works for a public repo), tester invitation message and a "keep testers opted in" plan.
- Internal testing first, then the closed track.

**Out of scope:** new features.

**Acceptance criteria**
1. A production AAB builds (you run the EAS build; Claude fixes config issues).
2. The uploaded AAB's package is `io.github.adve1s.ourplayers` — permanent from this upload on.
3. The internal-testing install on your phone works against the production API.
4. Closed track live with 15+ testers invited and 12+ opted in; day 1 recorded in PROGRESS.md.
5. `docs/store/` complete; privacy policy URL live.
6. In-app About shows the non-affiliation note; no logos or player photos anywhere.

```text
Session S11 — Android build + Play closed test (slice 6a, branch `slice-6a-ship`).

Read docs/PROGRESS.md, docs/SESSIONS.md §S11 (the contract), docs/VISION.md §4.6 and §11. First run the tests.

In plan mode, propose: confirmation that app.json matches the app identity in VISION §11; eas.json profiles and versioning; asset requirements and how we'll make simple text-based icons; the docs/store/ files with draft contents; and the step-by-step console checklist for EAS and Play Console (internal track, then closed track). Keep the Data safety answers strictly truthful to how the app and API behave — check the code.

After I approve: do the repo work, then walk me through the console steps one at a time, waiting for my confirmation. Then tell me it's ready for /handoff.
```

### R6a — Slice 6a review
Fresh session on `slice-6a-ship`: `/slice-review 6a` — focus on secrets, config, and whether `DEPLOY.md` and the Data safety answers match reality. Read the review on the PR → **Review fixes** with your decisions → `/handoff` → merge the PR.

---

## Slice 5 — Favorites, player and game pages (`slice-5-players-games`)

Built while the closed test runs. Ship each finished session to the closed track so testers see progress.

### S12 — Search, favorites, hidden

**Goal:** find any player and star or hide him.

**In scope:** Search tab (debounced, 2+ characters, `/v1/players/search`); star/hide actions that keep favorites and hidden disjoint; Favorites and Hidden lists in Settings (via `/v1/players?ids=`); undo; the Main page refreshes when preferences change.

**Acceptance criteria**
1. Pure tests for preference actions: favoriting unhides; hiding unfavorites; toggles are idempotent; `version` preserved.
2. On a device: search "porzingis" → star → he appears on Main for a day he played, even with no countries followed.
3. Hiding a Latvian removes him from Main; unhiding brings him back.
4. Screenshots reviewed: results, empty search, both lists.
5. `pnpm verify` green.

```text
Session S12 — Search, favorites, hidden (slice 5). Create branch `slice-5-players-games` from the latest `main`.

Read docs/PROGRESS.md, docs/SESSIONS.md §S12 (the contract), docs/VISION.md §3 and §4.2–§4.3, and the preferences store from S08. First run the tests.

In plan mode, propose: the preference actions and their tests; the Search screen and list designs (describe them); how Main reacts to preference changes; and the screenshot states.

After I approve: red/green for the preference logic, then the UI and screenshots. Prove each criterion, then tell me it's ready for /handoff.
```

### S13 — Player page + game page

**Goal:** the remaining v1 screens.

**In scope:** routes `/player/[id]` and `/game/[id]`; navigation from stat cards, game cards and search; player bio, season stats per kind, game log; game page with the period table and lines; loading and error states; web deep links work on reload.

**Acceptance criteria**
1. Season-stats layout correct per kind (skater, goalie, basketball) — screenshots.
2. Game log: last 10, correct formatting; tapping a row opens that game.
3. Period table correct for regulation, OT and shootout hockey games and an OT basketball game.
4. Loading `/player/nhl-…` directly on web works.
5. `pnpm verify` green; you ship a new build to the closed track.

```text
Session S13 — Player page + game page (slice 5, branch `slice-5-players-games`).

Read docs/PROGRESS.md, docs/SESSIONS.md §S13 (the contract), docs/VISION.md §4.4–§4.5, and the API's player and game contracts. First run the tests.

In plan mode, propose: routes and navigation; layouts per stat kind (describe them); the period table for each sport; deep-link handling on web; and the screenshot states.

After I approve: build, screenshot, fix, repeat. Prove each criterion, then tell me it's ready for /handoff.
```

### R5 — Slice 5 review
Fresh session on `slice-5-players-games`: `/slice-review 5` → read the review on the PR → **Review fixes** with your decisions → `/handoff` → merge the PR.

---

## Slice 6b — Web + launch (`slice-6b-web-launch`)

### S14 — Web build as a home-screen app

**Goal:** iPhone friends add the web app to their home screen; PC users open it in a browser.

**In scope:** static web export; web manifest (name, icons, theme color, standalone display); iOS home-screen meta tags and apple-touch-icon; a static host (Claude proposes options — GitHub Pages is one candidate; you choose); SPA fallback so deep links survive reloads; production CORS for the web origin; an "Add to Home Screen" help page.

**Acceptance criteria**
1. The static build is produced by one command and screenshot-checked.
2. Deployed URL works on desktop and iPhone Safari; added to the home screen it opens standalone with the right icon.
3. Deep links work on reload.
4. Production API accepts the web origin and rejects others.
5. `pnpm verify` green.

```text
Session S14 — Web build as a home-screen app (slice 6b). Create branch `slice-6b-web-launch` from the latest `main`.

Read docs/PROGRESS.md, docs/SESSIONS.md §S14 (the contract), docs/VISION.md §11, and docs/DEPLOY.md. First run the tests.

In plan mode, propose: static hosting options with trade-offs (wait for my choice); manifest and icon set; iOS meta tags; deep-link fallback; CORS changes; and the console steps I must do.

After I approve: build it, screenshot the built site, walk me through deployment, and wait for my phone test. Then tell me it's ready for /handoff.
```

### S15 — Production access + runbook

**Goal:** the app is public on Google Play, and future-you knows how to keep it alive.

**In scope**
- Once 12+ testers have been opted in for 14 continuous days: draft the production-access answers (`docs/store/production-access.md`) from the tester feedback log.
- Fix tester-reported issues first, each in its own bug-fix session (template below).
- `docs/RUNBOOK.md`: upstream breakage (detect via `job_runs` → record a fresh fixture → red test → fix the adapter), season rollover, adding a nationality override, adding a league (checklist), switching NHL to the ESPN backup.

**Acceptance criteria**
1. Application submitted; answers saved.
2. `RUNBOOK.md` covers the five scenarios.
3. Production release live (you).

```text
Session S15 — Production access + runbook (slice 6b, branch `slice-6b-web-launch`).

Read docs/PROGRESS.md, docs/SESSIONS.md §S15 (the contract), docs/VISION.md §11, and docs/store/. First run the tests.

In plan mode, propose: the production-access answers based on our real closed test (ask me for tester feedback and numbers); the RUNBOOK.md outline per scenario, grounded in how the code actually works (cite files).

After I approve: write them, and walk me through the release steps. Then tell me it's ready for /handoff.
```

### R6b — Final review
Fresh session on `slice-6b-web-launch`: `/slice-review 6b` → **Review fixes** → `/handoff` → merge the PR. Then one more `/walkthrough the whole system end to end` for yourself.

---

## Templates

**Branches.** During a slice, templates run on the slice branch. Between slices, start the prompt with "Create branch `fix-<slug>` from the latest `main`." — `/handoff` then opens a pull request for it.

**Review fixes** (after `/slice-review`):
```text
Session R<n>-fix — address the slice <n> review (branch `slice-<n>-…`).

Read docs/PROGRESS.md and the review: docs/reviews/slice-<n>.md, or — if the review ran in a cloud session — the review posted on the slice PR. My decisions:
- F1: accept
- F2: reject — <why>
- F3: defer
<one line per finding>

Record my decisions in the Decision column of docs/reviews/slice-<n>.md (create the file from the PR review if it doesn't exist yet). In plan mode: for each accepted finding, propose the smallest fix and the test that proves it. Leave rejected findings alone; move deferred ones to the PROGRESS.md parking lot.

After I approve: red/green per finding. When `pnpm verify` is green, tell me it's ready for /handoff. After the handoff, and once CI is green, I'll merge the PR.
```

**Bug fix:**
```text
Bug: <symptom in one sentence>.
Where/when: <screen, game day, player, request URL, log line, screenshot>.
Expected: <what should happen>.

First run the tests. In plan mode, find the root cause (use a subagent for wide searches) and propose: a failing test that reproduces the bug, the fix, and what else might be affected. Fix the cause, not the symptom. After I approve: red/green, then tell me it's ready for /handoff.
```

**Upstream API changed** (local — cloud sessions can't reach the upstream APIs):
```text
The <nhl|espn-nba> adapter broke. Evidence: <job_runs error / failing endpoint / log line>.

First run the tests. Record a fresh fixture for the failing endpoint with `pnpm fixtures:record` and show me how its shape differs from the existing fixture. Keep the old fixture; the new one becomes an extra test case. In plan mode, propose the adapter change. After I approve: red/green, then tell me it's ready for /handoff.
```

**Small change** (skip plan mode with `Shift+Tab` first):
```text
Small change: <one sentence>. Run the affected tests and `pnpm verify`, then commit with a Conventional Commit message.
```

**Resume an interrupted session:**
```text
Continue session S<nn>. Read docs/PROGRESS.md, `git status` and `git log --oneline -10`, then tell me where we stand against each acceptance criterion in §S<nn> before changing anything.
```

**Explore an idea** (no code changes):
```text
I'm considering <idea>. Stay in plan mode and don't change files. Interview me about it with the AskUserQuestion tool — technical approach, UX, edge cases, trade-offs; skip obvious questions. Then draft a new session section for docs/SESSIONS.md (goal, in scope, out of scope, acceptance criteria, prompt) for me to review.
```

**Docs review** (fresh session at high effort, after you or Claude change VISION.md, SESSIONS.md or the Claude Code setup substantially):
```text
Review the docs changed since <commit or "the last docs review">: <files>. You haven't seen how they were written. Stay in plan mode and don't change files yet. Present findings as the plan, in a table: ID, severity, file and section, issue, suggested edit. Look for contradictions with the rest of docs/ and CLAUDE.md, gaps, ambiguous instructions, scope creep, and acceptance criteria that can't be checked. Skip style nits. I'll reply with a decision for each finding; then apply the accepted ones and tell me it's ready for /handoff.
```

# Session plan

The build, sliced into Claude Code sessions. Each session has a contract (scope, out of scope, acceptance criteria) and a **ready-to-paste prompt**. The prompts are short on purpose: they point Claude at this file and `VISION.md`, so the detail lives in one place and you can edit it here.

How the agents fit in, and why: `docs/WORKFLOW.md`.

## How to run a session

1. Start `claude` in the repo root on an up-to-date `main` (`git switch main && git pull --ff-only`). Sessions start in default mode (set in `.claude/settings.json`).
2. Set the effort the Overview gives: `/effort medium` or `/effort high`. A level typed after `/effort` is also saved as your default, so skipping this step means inheriting the last session's level. Optional: `/rename S03 nhl adapter` so `claude --resume` finds it later.
3. Paste the session's prompt. Claude creates the session branch (the Overview's Branch column) and runs the tests.
4. **Design** (`superpowers:brainstorming`). Answer its questions about gaps in the section and approve the short design doc it writes to `docs/superpowers/specs/`. Push back here — it's the cheapest moment to change direction.
5. **Plan** (`superpowers:writing-plans`). Read the task list in `docs/superpowers/plans/`: tasks map to the acceptance criteria, stay in scope, name any new dependency, and (where the prompt asks for one) the test-writer task comes right after the stubs. Press `Shift+Tab` until the mode reads **auto**, *then* reply with your approval — execution starts on that reply.
6. **Build** (`superpowers:subagent-driven-development`). Opus helper agents implement and review each task without pausing. Claude stops only for destructive, security-sensitive or outside-the-branch actions, a broken plan, a red-phase test or fixture that looks wrong, or a spec question from the test-writer; everything else becomes a ruling it lists at the end. Press `Esc` the moment it heads somewhere wrong. Your steps (the "You:" line and criteria marked "run by you") never go in the plan: after the final review, Claude walks you through the in-session ones one at a time and waits for each result; steps timed later (after `/handoff`, after merging, in parallel) land in the briefing's Next.
7. When Claude says the work is ready: run **`/handoff`**. It updates `PROGRESS.md` and `DECISIONS.md`, commits and pushes (approve the push prompt), opens the session's PR, posts the briefing, runs `/code-review` (findings land as inline PR comments) and reports CI.
8. Read the briefing's files and the review comments on the PR. If you accept any finding, run the "Review fixes" template on the same branch, then `/handoff` again. When CI is green, merge with **Create a merge commit**, then `git switch main && git pull --ff-only`.
9. Exit. The next session starts fresh; `PROGRESS.md`, git and the PRs carry the state.

**In the cloud** (sessions marked "either" in the Overview): start the session at claude.ai/code — pick the repo, branch `main`, **Accept edits** mode (the cloud dropdown has no Default) — or with `claude --cloud "<prompt>"` from `main`, and paste the same prompt. Set effort with `/effort <level>` as the first message. At step 5, switch the dropdown to **Auto** before you reply with your approval. The session creates the session branch itself, so `/handoff` works exactly as it does locally. Live checks ("run by you") stay local: `git fetch && git switch <branch>` first, or, once the plan has finished, bring the whole session to your terminal with `claude --teleport`. Details: WORKFLOW.md → Cloud sessions.

**Sizing.** A session is one reviewable change, usually a few hundred to ~1,500 changed lines. Opus 5.5 has a 1M-token window, so `/context` will rarely look full; use an absolute budget instead: if the session passes **~200K tokens** of context before the work is done, stop at a task boundary (the superpowers ledger shows `Task N: complete`), optionally `git push`, and exit — don't run `/handoff` until the plan is done. Continue in a new session on the same machine with the "Resume" template at the bottom; the ledger under `.superpowers/sdd/` is gitignored and stays on the machine that ran the plan (`claude --teleport` brings the branch and the conversation, not the ledger), so a cloud session always finishes its plan, through the final review and its "Rulings I made" list, before you teleport it. A clean restart beats a long, compacted session.

## Overview

All sessions and their helper agents run on **Opus 5.5**. **Effort** is what to set with `/effort` at the start of every session (Opus 5.5 defaults to medium, but a typed level becomes your default); the reviewer agent runs at high automatically. **Where**: *local* needs your machine (phone, mise, consoles, secrets, or live upstream calls); *either* also runs well as a cloud session. Every session is one branch and one pull request into `main`.

| ID | Session | Branch | Size | Effort | Where | You can try afterwards |
|---|---|---|---|---|---|---|
| K0 | Kit review (docs only) — done | `kit-review` | S | high | either | A plan reviewed by a fresh pair of eyes; the PR flow tried once |
| S00 | Bootstrap | `s00-bootstrap` | M | medium | local | App placeholder on phone + web; `/health`; CI on the PR |
| S01 | Data spike + fixtures | `s01-data-spike` | M | medium | local | `pnpm spike --date …` prints Latvians' lines |
| S02a | Domain model, selection rule, nationality | `s02a-domain-model` | M | high | either | Selection-rule and nationality tests |
| S02b | Database schema + repositories | `s02b-database` | M | high | either | Local DB; idempotency tests |
| S03 | NHL adapter | `s03-nhl-adapter` | M | medium | either | `pnpm inspect nhl boxscore …` |
| S04a | Jobs + recap CLI | `s04a-jobs-recap` | M | high | either | `pnpm recap` — terminal morning recap (NHL) |
| S04b | Season stats, corrections, scheduler | `s04b-scheduler` | M | high | either | The dev server schedules its own runs |
| S05 | ESPN NBA adapter + jobs | `s05-nba` | L | high | either | `pnpm recap` with NHL + NBA |
| S06 | API: days, games, meta | `s06-api-days` | M | high | either | `curl …/v1/days/<date>?countries=LVA` |
| S07 | API: players, search, countries | `s07-api-players` | M | medium | either | Search and player detail over HTTP |
| S08 | App shell, settings, screenshots | `s08-app-shell` | M | medium | local | Settings on phone; `pnpm screenshots` |
| S09 | Main page | `s09-main-page` | L | high | local | **The morning recap app** |
| S10 | Deploy backend | `s10-deploy` | L | medium | local | Public API with a running scheduler and a staleness alert |
| S11 | Android build + Play closed test | `s11-android` | M | medium | local | Friends install it; **14-day clock starts** |
| S12 | Search, favorites, hidden | `s12-favorites` | M | medium | local | Star/hide players |
| S13 | Player page + game page | `s13-player-game` | M | medium | local | Full v1 feature set |
| S14 | Web build as a home-screen app | `s14-web` | M | medium | local | iPhone friends use it |
| S15 | Production access + runbook | `s15-launch` | S | medium | local | Public on Google Play |

Slices group the sessions on the roadmap; they no longer map to a branch or PR. Slices 6a/6b split the brief's slice 6 so the Play closed test starts before slice 5 (DECISIONS.md D-014). Spend the three free `/code-review ultra` runs on the S02a, S04a, S05 and S09 PRs (pick three).

**Size** is a rough guess at your attention per session: S under 1 h, M 1–2 h, L 2–3 h. An L session may need a second sitting — use the "Resume" template.

---

## Before you start

### K0 — Kit review (done)

Done on 2026-10-03 (PR #1): an independent review of these docs and the Claude Code setup before any code existed; 20 findings applied. After the switch to the plugin workflow, use the "Docs review" template at the bottom for the next independent pass over the docs.

---

## Slice 0 — Setup + data spike

### S00 — Bootstrap

**Goal:** a working monorepo skeleton where every command in `CLAUDE.md` exists, the app runs on web and Android, and the quality gate (`pnpm verify`) runs locally and in CI on the session's pull request.

**In scope**
- pnpm workspace (`apps/server`, `apps/mobile`, `packages/shared`), `nodeLinker: hoisted`. The `apps/server/data/` folder already exists with the overrides file — keep it.
- Node 24 LTS and pnpm pinned once, read by all three of: mise (my version manager), corepack (`packageManager`) and GitHub Actions. Cloud sessions ship Node 22, so the code must also run there: `engines.node` is `>=22`.
- Shared TypeScript config (strict, `noUncheckedIndexedAccess`), Biome config (ignores `**/test/fixtures/**`, `.data`, `.expo`, `dist`), Vitest across packages (`pnpm test <filter>` works).
- `apps/server`: Hono app with `GET /health` → `{ "ok": true }` on port 3001; config from env with defaults.
- `apps/mobile`: current stable Expo SDK via `create-expo-app` (default template, example screens removed), one placeholder screen that renders a value imported from `packages/shared`. App identity in `app.json` per VISION §11: name `Our Players`, slug `our-players`, scheme `ourplayers`, `android.package` `io.github.adve1s.ourplayers`.
- `packages/shared`: consumed as TypeScript source by server and app; one trivial pure function with a test.
- Root scripts for every `CLAUDE.md` command; ones that arrive later print which session adds them and exit with code 1.
- CI: `.github/workflows/ci.yml` runs on pull requests and on pushes to `main` — frozen-lockfile install, then `pnpm verify` — in a job named `verify` on a Node 22 and 24 matrix, so the checks read `verify (22)` and `verify (24)`.
- Cloud sessions: a second SessionStart hook that runs `corepack enable && pnpm install --frozen-lockfile` only when `CLAUDE_CODE_REMOTE` is `true` (a no-op locally); then shorten the cloud gotcha in CLAUDE.md.
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
8. After `/handoff` pushes, the PR's `verify (22)` and `verify (24)` checks pass (the handoff reports it).

**You:** run the phone check: allow Metro and the dev API through Omarchy's firewall (WORKFLOW.md → One-time setup, step 5), then scan the QR code with Expo Go and confirm the placeholder renders. After the first green CI run, add the required `verify` checks to `main`'s protection (step 4, second part). After this first helper-agent session, check `/usage` (WORKFLOW.md §9).

```text
Session S00 — Bootstrap (slice 0). Create branch `s00-bootstrap` from the latest `main`.

Read CLAUDE.md, docs/PROGRESS.md, docs/SESSIONS.md §S00 (scope, out-of-scope and acceptance criteria are the contract for this session) and docs/DECISIONS.md. The repo currently holds only docs, .claude/ config and apps/server/data/nationality-overrides.json. I develop on Arch Linux (Omarchy) and install Node with mise; `origin` points to my GitHub repo.

Brainstorm with §S00 as the spec. The design must cover:
- the workspace layout and the root package.json scripts — every command listed in CLAUDE.md must exist;
- the exact dependencies per package, one line of justification each (I approve the list once; don't add others without asking);
- how the Node and pnpm versions are pinned so mise, corepack and GitHub Actions all use the same ones (cloud sessions run Node 22, so the code must work there too);
- the Expo setup: current stable SDK via create-expo-app, default template with example screens removed, pnpm nodeLinker hoisted, app identity from VISION §11;
- shared TypeScript, Biome and Vitest config, and the CI workflow;
- how apps/server and apps/mobile consume packages/shared as TypeScript source.
Ask me whatever needs deciding. Look up current Expo, Hono, Vitest and Biome setup with context7.

Then plan and build it, keeping code minimal — this session is plumbing, not features. This is the first session with helper agents: if superpowers' helper scripts trigger repeated permission prompts, list them for me as candidate allow rules instead of adding them. Prove each acceptance criterion with command output. When `pnpm verify` is green, tell me it's ready for /handoff.
```

### S01 — Data spike + fixtures

**Goal:** prove both sources deliver what v1 needs, build the two keepers (polite HTTP client, fixture recorder), record a fixture set, and write down what we learned.

**In scope**
- `apps/server/src/http/polite-client.ts`: ≤ 1 request/s per host, User-Agent `OurPlayers/<version> (+<repo URL>)` with the GitHub repo URL as the contact (from config), timeout, retries on 429/5xx/network errors with exponential backoff + jitter, honors `Retry-After`, no retry on other 4xx. Unit-tested with fake timers and a fake fetch.
- `pnpm fixtures:record <source> <endpoint> <id-or-date>` → `apps/server/test/fixtures/<source>/<endpoint>/<id>.json` plus `<id>.meta.json` (url, fetchedAt, status, bytes); refuses to overwrite without `--force`; `--as <name>` saves under another file name, so a re-recorded response can sit next to the old one.
- Throwaway `pnpm spike --date YYYY-MM-DD` (in `apps/server/scripts/spike/`): prints Latvian players' lines for that game day in both leagues, plus total requests and runtime. Replaced by `pnpm recap` in S04a.
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

**You:** spot-check two or three spike numbers against nhl.com / espn.com; skim `docs/sources/`. The fixture JSON is collapsed in the PR's diff view; the reviewer agent checks that each fixture came from the recorder (its `.meta.json` and `git log`).

```text
Session S01 — Data spike + fixtures (slice 0). Create branch `s01-data-spike` from the latest `main`.

Read docs/PROGRESS.md, docs/SESSIONS.md §S01 (the contract) and docs/VISION.md §6–§9. First run the tests.

This session talks to the live NHL and ESPN APIs. Be polite: every request goes through the polite client (at most 1 request/s per host), and keep the whole session's requests in the low hundreds.

Brainstorm with §S01 as the spec. The design must cover: the polite client's API and how you'll test it without network; the recorder's file layout; how the spike finds Latvian players cheaply (check which endpoints carry birth country before assuming); the concrete games and dates you'll record for each fixture item (look them up); and how you'll answer each of the eight questions in VISION §9.

Then plan and build: red/green for the polite client, then the recorder, fixtures, spike and the two docs/sources files. Recording and the spike call live APIs and may run in helper agents: the plan's Global Constraints set the request budget (low hundreds in total), each implementer report states the polite client's request count, and you keep a running total in the ledger. Prove each acceptance criterion with output, then tell me it's ready for /handoff.
```

---

## Slice 1 — Data core

### S02a — Domain model, selection rule, nationality

**Goal:** the normalized model in `packages/shared`, plus the two pieces of core logic, the selection rule and nationality resolution, written test-first from the spec. Pure code only; the database follows in S02b.

**In scope**
- `packages/shared`: league / status / kind enums, alpha-3 country type, normalized model types (team, player, game, stat line, season stats), zod schemas for stat payloads per kind; `selection.ts` (`isShown` + `Prefs`).
- Nationality (VISION §7): zod-validated loader for `apps/server/data/nationality-overrides.json` (it already holds Embiid and Towns), and a pure resolver: the override if one exists, else the birth country, else `null`, returned with its source.

**Out of scope:** the database and repositories (S02b), adapters, jobs, API, app.

**Acceptance criteria**
1. Selection-rule tests: one per behavior in VISION §3 (test names state the behavior), plus a check over generated inputs that `isShown` matches the set formula.
2. Nationality tests: an override replaces the birth country (source `override`); without one, the birth country is used (source `birth`); an unknown birth country gives `null`; an invalid overrides file (bad JSON, unknown country code, duplicate player) fails with a message naming the file and the entry; the committed overrides file loads cleanly.
3. The stat payload schemas accept a valid payload of each kind and reject invalid ones with a clear error.
4. `pnpm verify` green.

```text
Session S02a — Domain model, selection rule, nationality (slice 1). Create branch `s02a-domain-model` from the latest `main`.

Read docs/PROGRESS.md, docs/SESSIONS.md §S02a (the contract), docs/VISION.md §3, §7 and §8, docs/DECISIONS.md D-009, D-010 and D-012, and docs/sources/*.md. First run the tests.

Brainstorm with §S02a as the spec. The design must cover: the shared domain types and zod schemas (show them); how overrides are loaded and validated; the resolver's signature; and the exact list of test cases for the selection rule and nationality resolution.

Then plan and build, red/green, in this task order:
1. Create stubs for isShown and the nationality resolver: real signatures, bodies throw "not implemented".
2. The test-writer agent writes their tests from VISION §3 and §7 only. Run them and confirm they fail on "not implemented". Commit: `test: selection rule and nationality spec`.
3. Implement until green without changing those tests — if one looks wrong, stop and tell me.
4. Then the stat payload schemas and the overrides loader, with tests.

Prove each acceptance criterion with output, then tell me it's ready for /handoff.
```

### S02b — Database schema and repositories

**Goal:** the database per VISION §8, and repositories that write the normalized model idempotently.

**In scope**
- `apps/server/src/db`: Drizzle `pg-core` schema per VISION §8; PGlite client for dev (file-backed under `.data/`) and tests (in memory); node-postgres client when `DATABASE_URL` is set; generated migrations; `db:migrate`, `db:generate`, `db:reset`.
- Repositories with idempotent upserts by natural key: teams, players (+ external IDs), games, stat lines (payloads validated with S02a's schemas), season stats, job runs.
- Nationality recomputation: applies S02a's resolver to stored players, and warns about overrides whose player isn't in the DB or whose name doesn't match the stored name.
- Test helper `createTestDb()` (in-memory PGlite with migrations applied).
- `.gitattributes`: mark the generated migration snapshots `linguist-generated`, like the fixtures.

**Out of scope:** adapters, jobs, API, app.

**Acceptance criteria**
1. `pnpm db:migrate` succeeds on a fresh local DB, and `pnpm db:generate` right afterwards produces no new migration.
2. Writing the same normalized game and lines twice leaves identical rows (PGlite test).
3. Invalid stat payloads are rejected on write with a clear error.
4. Nationality recomputation (PGlite tests): stored players get their nationality and its source from the resolver; an override whose player isn't in the DB, or whose name doesn't match the stored name, logs a warning.
5. `pnpm verify` green.

```text
Session S02b — Database schema and repositories (slice 1). Create branch `s02b-database` from the latest `main`.

Read docs/PROGRESS.md, docs/SESSIONS.md §S02b (the contract), docs/VISION.md §7 and §8, docs/DECISIONS.md D-004, D-005, D-010 and D-012, and the shared domain types from S02a. First run the tests.

Brainstorm with §S02b as the spec. The design must cover: the Drizzle schema — tables, keys, indexes — mapped to VISION §8; how the dev, test and prod DB clients differ; the repository functions and their natural keys; how nationality recomputation applies the resolver and reports override warnings; and the test list mapped to the acceptance criteria.

Then plan and build: red/green for the repositories and the recomputation. Check Drizzle and PGlite APIs with context7. Prove each acceptance criterion with output, then tell me it's ready for /handoff.
```

### S03 — NHL adapter

**Goal:** NHL raw JSON → normalized model, proven against every recorded fixture.

**In scope**
- `apps/server/src/sources/nhl/`: URL builders and fetchers (polite client injected), raw zod schemas (only fields we use, unknown fields allowed), and **pure mappers**: schedule/score → games (status, period scores, OT/SO, season, season type, `gameDate`); boxscore → stat lines (skaters vs goalies by box-score section, TOI → seconds, save % as 0–1, decision) plus team/player stubs; roster → players (birth country, position group); landing → player enrichment; skater/goalie summary → season stats (totals).
- `packages/shared/src/countries.ts`: alpha-3 validation; scaffold for the ESPN name → code alias map.
- `pnpm inspect nhl <endpoint> <fixture-id>` prints the normalized result.

**Out of scope:** DB writes and jobs (S04a/S04b), ESPN (S05).

**Acceptance criteria**
1. Every NHL fixture has at least one mapper test asserting specific values read from the raw JSON (no whole-object snapshots).
2. Covered: skater line, goalie line with decision, OT and shootout games, preseason season type, scheduled vs final, period scores, TOI parsing, season-ID normalization.
3. A malformed payload (mutated inside the test, never in the file) throws an error naming source and endpoint.
4. Tests can't reach the network: the test setup fails any real fetch.
5. `pnpm inspect nhl boxscore <id>` works.
6. `pnpm verify` green.

```text
Session S03 — NHL adapter (slice 1). Create branch `s03-nhl-adapter` from the latest `main`.

Read docs/PROGRESS.md, docs/SESSIONS.md §S03 (the contract), docs/VISION.md §6.2, §8 and §9, and docs/sources/nhl.md. First run the tests.

Brainstorm with §S03 as the spec. The design must cover: the adapter's module layout (fetch layer vs pure mappers), the raw zod schemas (only fields we use), each mapper's signature and output, the status / season / OT mapping tables, and the list of fixture-based test cases (which fixture, which values).

Then plan and build, red/green, in this task order:
1. Create mapper stubs that throw "not implemented".
2. The test-writer agent writes the mapper tests from the fixtures and VISION, with expected values read from the raw JSON by hand. Confirm they fail for the right reason. Commit `test: NHL mapper spec from fixtures`.
3. Implement mappers and fetchers until green without changing those tests.
4. Add `pnpm inspect`.

Prove each acceptance criterion with output, then tell me it's ready for /handoff.
```

### S04a — Ingestion jobs + recap CLI

**Goal:** NHL data flows into the database through jobs you run by hand, and the terminal recap works — the first genuinely usable thing.

**In scope**
- Job runner: `job_runs` rows, per-job overlap lock, structured logs.
- Jobs per VISION §6.1: `schedule`; `results` (finalization: for each game that became final, fetch its box score once and store every line); `roster` (nationality recomputation, plus the off-roster rule in §6.1); `backfill`. Unknown players in box scores become stubs and get enriched.
- `pnpm job …` and `pnpm recap --date … [--countries …]`; remove the spike.
- Fixture-backed fake fetcher for job tests.

**Out of scope:** season stats, corrections and the scheduler (S04b); ESPN; API; app.

**Acceptance criteria**
1. Job tests (PGlite + fixture-backed fetcher): results stores lines for final games only; re-running changes nothing; an unknown player becomes an enriched stub; roster sets a player who is missing from every roster of his league to `active = false` with no current team, and restores him when he reappears; when any of that league's roster fetches fails, no `active` flag changes and `job_runs` records the partial failure.
2. Starting a job while the same job runs is skipped and logged.
3. Every run writes a `job_runs` row with counts; a forced failure records the error.
4. Live, run by you: `pnpm job roster --league nhl`, `pnpm job backfill --league nhl --from <d> --to <d>`, then `pnpm recap --date <d> --countries LVA` shows the Latvians' lines matching nhl.com.
5. Spike removed; scripts and docs updated.
6. `pnpm verify` green.

```text
Session S04a — Ingestion jobs + recap CLI (slice 1). Create branch `s04a-jobs-recap` from the latest `main`.

Read docs/PROGRESS.md, docs/SESSIONS.md §S04a (the contract), and docs/VISION.md §6, §7 and §8. First run the tests.

Brainstorm with §S04a as the spec. The design must cover: the job runner (locking, job_runs, logging); each job's algorithm step by step — especially results: which games a run looks at and how finalization works; how roster handles players who left every roster; the fixture-backed fake fetcher; the CLI surface of `pnpm job` and `pnpm recap`; and the live commands I'll run at the end (small request count).

Then plan and build: red/green for job behavior (the implementers write these tests; no test-writer needed). Prove each criterion with output. For criterion 4, give me the exact commands and wait for my result before calling it done. Then tell me it's ready for /handoff.
```

### S04b — Season stats, corrections, scheduler

**Goal:** the pipeline runs on its own: season stats, box-score corrections, and a scheduler that decides what to run.

**In scope**
- `season-stats` job (NHL bulk endpoints, totals) for rostered players. The current season per league is derived from the stored schedule, not configured: the season of the most recent game that has started, falling back to the next scheduled game. Record this in DECISIONS.md; `/v1/meta` reuses it in S06.
- Corrections in `results`: re-fetch each final box score once, at least 6 h after it went final.
- Scheduler (croner or similar) driven by a **pure** "what should run now?" function; runs only with `SCHEDULER_ENABLED=1`.
- Game-day helpers in `packages/shared` (latest started game day, previous/next game day).

**Out of scope:** ESPN, API, app.

**Acceptance criteria**
1. Season-stats tests over the bulk fixtures: totals stored per rostered player with season and season type. Current-season derivation tested, including preseason and the rollover between seasons.
2. A correction re-fetch updates changed numbers, and happens only once per game (tests).
3. Scheduler decision logic, with an injected clock: no upstream calls when nothing is in progress; polling during game windows; corrections after 6 h; `schedule` at startup when no future games are stored.
4. Game-day helpers tested with an injected clock and time zone.
5. Live, run by you: `pnpm job season-stats --league nhl` logs its request count, and `SCHEDULER_ENABLED=1 pnpm dev:server` logs the decisions of its first ticks.
6. `pnpm verify` green.

**You:** after merging, run `/walkthrough the ingestion pipeline from a scheduled tick to stat_lines rows` — it's the heart of the backend.

```text
Session S04b — Season stats, corrections, scheduler (slice 1). Create branch `s04b-scheduler` from the latest `main`.

Read docs/PROGRESS.md, docs/SESSIONS.md §S04b (the contract), docs/VISION.md §6 and §8, and the job runner and jobs from S04a. First run the tests.

Brainstorm with §S04b as the spec. The design must cover: the season-stats job and how the current season is derived; how corrections fit into results; the scheduler's pure "what should run now?" function and its test cases; the game-day helpers; and the live commands I'll run at the end.

Then plan and build: red/green for the decision logic, corrections and season stats. Prove each criterion with output. For criterion 5, give me the exact commands and wait for my result. Then tell me it's ready for /handoff.
```

---

## Slice 2 — NBA

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
Session S05 — ESPN NBA adapter + jobs (slice 2). Create branch `s05-nba` from the latest `main`.

Read docs/PROGRESS.md, docs/SESSIONS.md §S05 (the contract), docs/VISION.md §7–§9, docs/sources/espn-nba.md, and skim apps/server/src/sources/nhl/ for the established adapter pattern. First run the tests.

Brainstorm with §S05 as the spec. The design must cover: module layout mirroring the NHL adapter; raw zod schemas; label-based stat mapping; DNP handling; country-name mapping and aliases; the season-stats strategy with its request budget; how the adapter plugs into the jobs; and the fixture test cases.

Then plan and build, red/green: mapper stubs → the test-writer agent writes the fixture tests (hand-read values) → confirm red → commit `test: NBA mapper spec from fixtures` → implement until green without changing those tests. Then wire up the jobs, with tests. Give me the live commands for criteria 4 and 6 and wait for my results. Then tell me it's ready for /handoff.
```

---

## Slice 3 — Read API

### S06 — API: days, games, meta

**Goal:** the endpoints the Main page and Game page need, typed by a shared contract.

**In scope**
- Hono app structure under `apps/server/src/api/`; zod contract in `packages/shared/src/contract/` (params + responses); preferences parsing and validation.
- `GET /v1/meta`, `GET /v1/days/{gameDate}`, `GET /v1/games/{gameId}`, `GET /health` per VISION §10 (`/health/data` arrives in S10): ordering rules (§4.1), did-not-play rows, prev/next game day, cache headers, error format, request logs without query strings.
- API test harness: in-memory PGlite seeded by running the real ingestion over fixtures.

**Out of scope:** players, search, countries, CORS (S07); app.

**Acceptance criteria**
1. Every response in tests parses with the shared contract schema.
2. Filtering behavior: followed country shown; hidden player removed; favorite from another country included; league filter applied to everyone.
3. Ordering and rows: games with shown players first; DNP and "Not in lineup" rows, and no "Not in lineup" row for a player with no current team; prev/next game day.
4. `latestGameDate` with an injected clock: 08:00 in Riga returns the previous US date.
5. Bad parameters → 400 with the error format; logs contain no query strings (test).
6. With S04a/S05 data loaded, `curl "localhost:3001/v1/days/<date>?countries=LVA"` returns that night's lines; 100 sequential requests print their p95, next to the row counts of `games` and `stat_lines` (a smoke check — the real p95 target is measured in production in S10).
7. `pnpm verify` green.

```text
Session S06 — API: days, games, meta (slice 3). Create branch `s06-api-days` from the latest `main`.

Read docs/PROGRESS.md, docs/SESSIONS.md §S06 (the contract), and docs/VISION.md §3, §4.1, §4.5, §6.2 and §10. First run the tests.

Brainstorm with §S06 as the spec. The design must cover: the contract schemas (show them); the route structure; how preferences are parsed and validated; how a day response is assembled (queries, selection rule, ordering, did-not-play rows); the test harness that seeds PGlite through the real ingestion code; and the test list mapped to the acceptance criteria.

Then plan and build, red/green; check Hono and zod APIs with context7. Prove each criterion with output (including the curl and the latency measurement), then tell me it's ready for /handoff.
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
3. Countries: only countries with active players, with counts per league; Embiid counts for USA, not CMR.
4. CORS: an allowed origin gets the headers; others don't.
5. Typed client tests pass against the in-memory app.
6. `pnpm verify` green.

**You:** after the handoff, run `/run-skill-generator` once so the bundled `/run` and `/verify` skills know how to start the server. Re-run it after S08.

```text
Session S07 — API: players, search, countries (slice 3). Create branch `s07-api-players` from the latest `main`.

Read docs/PROGRESS.md, docs/SESSIONS.md §S07 (the contract), docs/VISION.md §4.3, §4.4 and §10, and the S06 routes for the established pattern. First run the tests.

Brainstorm with §S07 as the spec. The design must cover: the contract additions; the search query and ranking (and how diacritics are handled); the player-detail assembly; CORS config; the typed client's shape and where it lives; and the test list mapped to the acceptance criteria.

Then plan and build, red/green. Prove each criterion with output, then tell me it's ready for /handoff.
```

---

## Slice 4 — App v1

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

**You, in parallel (long lead time for S11):** create the Google Play Console personal developer account and finish its identity verification, which can take days. Start collecting 15+ testers' Google-account email addresses — people who'd actually open the app, since Google also checks that testers used it.

**Acceptance criteria**
1. A fresh install defaults to Latvia + both leagues; preferences survive a web reload and an Android relaunch.
2. Preferences store logic is unit-tested (pure reducer-style functions).
3. `pnpm screenshots` produces PNGs; Claude looks at them and fixes visible layout problems (show before/after in the session).
4. Runs on Android (Expo Go, talking to the dev API over the LAN) and web without errors; API down → friendly error.
5. `pnpm verify` green.

```text
Session S08 — App shell, settings, screenshot tooling (slice 4). Create branch `s08-app-shell` from the latest `main`.

Read docs/PROGRESS.md, docs/SESSIONS.md §S08 (the contract), docs/VISION.md §4.2 and §4.6, and the typed API client from S07. First run the tests.

Brainstorm with §S08 as the spec. The design must cover: the route/tab structure; the theme tokens; the preferences store shape and its pure update functions; the Settings screen layout (describe it); how `pnpm screenshots` starts what it needs and which screens/states it captures; and any new dependencies with justification.

Then plan and build: red/green for the store logic; build the screens (check Expo Router, TanStack Query and Zustand APIs with context7); then run `pnpm screenshots`, look at every image, and fix what looks wrong. Prove each criterion, then tell me it's ready for /handoff.
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
Session S09 — Main page (slice 4). Create branch `s09-main-page` from the latest `main`.

Read docs/PROGRESS.md, docs/SESSIONS.md §S09 (the contract), docs/VISION.md §2 and §4.1, and the app shell from S08. First run the tests.

Brainstorm with §S09 as the spec. The design must cover: the component breakdown (game card, stat card per kind, DNP row, stepper); data fetching and caching (query keys, refetch on focus and pull); exact text formats for every card and status; empty/error/offline designs (describe them); and the screenshot states you'll capture.

Then plan and build: red/green for the formatting helpers, then the UI. Run `pnpm screenshots`, look at each image, fix what's off, repeat until it looks right. Prove each criterion, then tell me it's ready for /handoff.
```

---

## Slice 6a — Ship to closed testing

Claude prepares configs, scripts, text and runbooks; you do the account and console steps (hosting provider, Expo/EAS, Play Console) and paste results back.

### S10 — Deploy the backend

**Goal:** the API and scheduler running on an always-on host with Postgres, documented well enough to rebuild from scratch, and an alert reaches you when data goes stale.

**In scope**
- A short hosting options memo (an always-on small VPS with Docker Compose vs a PaaS with managed Postgres): cost, effort, how each runs the scheduler, and whether its router or reverse proxy logs request query strings — and how to stop that (VISION §11) → you pick.
- An upstream probe script you run **from the candidate host** before committing to it (both APIs answer, normal latency, no block).
- Dockerfile (multi-stage), production config via env, migrations on deploy, scheduler on, health check, log retention. Platform and proxy access logs record no query strings.
- Staleness alerting (VISION §10, §12): `/health/data` returns 503 when, during the season, the last successful `results` run is too old or the last few runs failed (propose the thresholds); a free external uptime monitor polls it and emails you. The host's health check keeps using `/health`, which stays green during upstream outages.
- A per-IP rate limit on the read API (at the reverse proxy or in the app), answering 429 in the error format.
- `docs/DEPLOY.md`: deploy, rollback, rebuild from scratch (migrations, `roster`, the season-to-date `backfill`, then `season-stats`, with request count and duration — DECISIONS.md D-021), rotating secrets. Production API URL wired into the app config.

**Out of scope:** Android build (S11), web hosting (S14).

**Acceptance criteria**
1. Probe output from the chosen host shows both APIs reachable (pasted by you).
2. `https://<api>/health` OK; `/v1/meta` fresh; after a few hours, `job_runs` shows scheduled runs.
3. No secrets in git (the reviewer checks).
4. The rebuild from `docs/DEPLOY.md` performed once on the host (migrations, `roster`, the season-to-date `backfill`, then `season-stats`), with request count and duration recorded in DEPLOY.md.
5. `docs/DEPLOY.md` covers deploy, rollback, rebuild and secret rotation from zero; the reviewer walks through it against the repo.
6. A production access-log line for a `/v1/days` request shows no query string (pasted).
7. A forced staleness or failure makes `/health/data` return 503 and the monitor emails you (you confirm), while `/health` stays 200.
8. `/v1/days/{date}` p95 is under 150 ms server-side against a DB holding a full season — last season backfilled, locally or on the host (VISION §12; print the measurement and the row counts).
9. Lines arrive within ~15 minutes of a game going final (VISION §2): for one night's games, `boxscore_fetched_at` minus the start of the last `results` run that still saw the game not final is at most 15 minutes (show the query).
10. Requests over the rate limit get 429.
11. `pnpm verify` green.

```text
Session S10 — Deploy the backend (slice 6a). Create branch `s10-deploy` from the latest `main`.

Read docs/PROGRESS.md, docs/SESSIONS.md §S10 (the contract), docs/VISION.md §2, §6, §9 (etiquette), §11 and §12, and docs/DECISIONS.md D-021. First run the tests.

Brainstorm with §S10 as the spec. Start with the hosting options memo. Then write the upstream probe script as a brainstorming spike; I run it from the candidate host and paste the output before choosing, and the design keeps the script as an in-scope deliverable. Then the design must cover: Dockerfile and runtime config; how migrations and the scheduler run in production; how access logs avoid query strings; the staleness rule for `/health` and the uptime monitor; the rate limit; the rebuild procedure; and the DEPLOY.md outline. Mark clearly which steps I must do in provider consoles and which you do in the repo.

Then plan and build the repo work. Console and host steps are mine: after the final review, hand me each as an exact checklist, one at a time, and wait for my results where criteria depend on them. Then tell me it's ready for /handoff.
```

### S11 — Android build + Play closed test

**Goal:** friends can install the app from Google Play's closed testing track, and the 14-day clock starts.

**In scope**
- Prerequisite from S08: the Play Console account is verified and the tester list exists.
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

**You:** time a warm open of the installed app on your phone (VISION §2: under 2 s on a mid-range Android) and note the result in PROGRESS.md. Remind testers to open it on match mornings — Google checks that they used it.

```text
Session S11 — Android build + Play closed test (slice 6a). Create branch `s11-android` from the latest `main`.

Read docs/PROGRESS.md, docs/SESSIONS.md §S11 (the contract), docs/VISION.md §4.6 and §11. First run the tests.

Brainstorm with §S11 as the spec. The design must cover: confirmation that app.json matches the app identity in VISION §11; eas.json profiles and versioning; asset requirements and how we'll make simple text-based icons; the docs/store/ files with draft contents; and the step-by-step console checklist for EAS and Play Console (internal track, then closed track). Keep the Data safety answers strictly truthful to how the app and API behave — check the code and the host's log configuration (VISION §11).

Then plan and do the repo work; after the final review, walk me through the console steps one at a time, waiting for my confirmation. Then tell me it's ready for /handoff.
```

---

## Slice 5 — Favorites, player and game pages

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
Session S12 — Search, favorites, hidden (slice 5). Create branch `s12-favorites` from the latest `main`.

Read docs/PROGRESS.md, docs/SESSIONS.md §S12 (the contract), docs/VISION.md §3 and §4.2–§4.3, and the preferences store from S08. First run the tests.

Brainstorm with §S12 as the spec. The design must cover: the preference actions and their tests; the Search screen and list designs (describe them); how Main reacts to preference changes; and the screenshot states.

Then plan and build: red/green for the preference logic, then the UI and screenshots. Prove each criterion, then tell me it's ready for /handoff.
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
Session S13 — Player page + game page (slice 5). Create branch `s13-player-game` from the latest `main`.

Read docs/PROGRESS.md, docs/SESSIONS.md §S13 (the contract), docs/VISION.md §4.4–§4.5, and the API's player and game contracts. First run the tests.

Brainstorm with §S13 as the spec. The design must cover: routes and navigation; layouts per stat kind (describe them); the period table for each sport; deep-link handling on web; and the screenshot states.

Then plan and build: build, screenshot, fix, repeat. Prove each criterion, then tell me it's ready for /handoff.
```

---

## Slice 6b — Web + launch

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
Session S14 — Web build as a home-screen app (slice 6b). Create branch `s14-web` from the latest `main`.

Read docs/PROGRESS.md, docs/SESSIONS.md §S14 (the contract), docs/VISION.md §11, and docs/DEPLOY.md. First run the tests.

Brainstorm with §S14 as the spec. The design must cover: static hosting options with trade-offs (wait for my choice); manifest and icon set; iOS meta tags; deep-link fallback; CORS changes; and the console steps I must do.

Then plan and build it, screenshot the built site, walk me through deployment, and wait for my phone test. Then tell me it's ready for /handoff.
```

### S15 — Production access + runbook

**Goal:** the app is public on Google Play, and future-you knows how to keep it alive.

**In scope**
- Once 12+ testers have been opted in for 14 continuous days: draft the production-access answers (`docs/store/production-access.md`) from the tester feedback log.
- Fix tester-reported issues first, each in its own bug-fix session (template below).
- `docs/RUNBOOK.md`: upstream breakage (detect via the staleness alert and `job_runs` → record a fresh fixture → red test → fix the adapter), season rollover, adding a nationality override, adding a league (checklist), switching NHL to the ESPN backup.

**Acceptance criteria**
1. Application submitted; answers saved.
2. `RUNBOOK.md` covers the five scenarios.
3. Production release live (you).

**You:** afterwards, one more `/walkthrough the whole system end to end` for yourself.

```text
Session S15 — Production access + runbook (slice 6b). Create branch `s15-launch` from the latest `main`.

Read docs/PROGRESS.md, docs/SESSIONS.md §S15 (the contract), docs/VISION.md §11, and docs/store/. First run the tests.

Brainstorm with §S15 as the spec. The design must cover: the production-access answers based on our real closed test (ask me for tester feedback and numbers); the RUNBOOK.md outline per scenario, grounded in how the code actually works (cite files).

Then plan and write them, and walk me through the release steps. Then tell me it's ready for /handoff.
```

---

## Templates

**Size.** Templates skip the design doc and plan file (CLAUDE.md → Workflow). Small change is brainstorming's "quick, clear task": Claude just does it. The others are its "small change" size: the change is agreed in chat first.

**Branches.** A template that changes code runs on its own branch: start the prompt with "Create branch `fix-<slug>` from the latest `main`." — `/handoff` then opens a pull request for it. Review fixes are the exception: they go on the PR's existing branch.

**Review fixes** (after `/code-review` commented on a PR):
```text
Address the /code-review comments on PR #<number> (branch `<branch>`; switch to it if needed).

Read docs/PROGRESS.md and the PR's review comments (`gh pr view <number> --comments`, `gh api repos/{owner}/{repo}/pulls/<number>/comments`). Use superpowers:receiving-code-review. My decisions:
- <comment or file:line>: accept
- <comment or file:line>: reject — <why>
- <comment or file:line>: defer
<one line per finding>

For each accepted finding: the smallest fix plus the test that proves it, red/green. Leave rejected findings alone and reply on their comment with my reason; move deferred ones to the PROGRESS.md parking lot. When `pnpm verify` is green, tell me it's ready for /handoff.
```

**Bug fix:**
```text
Bug: <symptom in one sentence>.
Where/when: <screen, game day, player, request URL, log line, screenshot>.
Expected: <what should happen>.

Create branch `fix-<slug>` from the latest `main`. First run the tests. Use superpowers:systematic-debugging to find the root cause, then show me: a failing test that reproduces the bug, the fix, and what else might be affected. Fix the cause, not the symptom. After I approve: red/green, then tell me it's ready for /handoff.
```

**Upstream API changed** (local — cloud sessions can't reach the upstream APIs):
```text
The <nhl|espn-nba> adapter broke. Evidence: <job_runs error / failing endpoint / log line>.

Create branch `fix-<source>-<slug>` from the latest `main`. First run the tests. Record a fresh fixture for the failing endpoint with `pnpm fixtures:record … --as <id>-<YYYY-MM-DD>` and show me how its shape differs from the existing fixture. Keep the old fixture; the new one becomes an extra test case. Propose the adapter change and wait for my OK. Then red/green, and tell me it's ready for /handoff.
```

**Small change** (no brainstorm or plan):
```text
Small change: <one sentence>. Create branch `chore-<slug>` from the latest `main`, skip brainstorming and planning, run the affected tests and `pnpm verify`, then tell me it's ready for /handoff.
```

**Resume an interrupted session:**
```text
Continue session S<nn> on branch `<branch>`. Read docs/PROGRESS.md, `git status` and `git log --oneline -10`. Re-invoke superpowers:subagent-driven-development on docs/superpowers/plans/<plan file>; it resumes from its ledger under .superpowers/sdd/. Before dispatching anything, tell me where we stand against the plan and each acceptance criterion in §S<nn>.
```

**Explore an idea** (no code changes):
```text
I'm considering <idea>. Don't change code. Use superpowers:brainstorming to interview me — technical approach, UX, edge cases, trade-offs; skip obvious questions. Instead of a design doc, draft a new session section for docs/SESSIONS.md (goal, in scope, out of scope, acceptance criteria, prompt) for me to review.
```

**Docs review** (fresh session at high effort, in plan mode — `Shift+Tab` before pasting — after you or Claude change VISION.md, SESSIONS.md or the Claude Code setup substantially):
```text
Review the docs changed since <commit or "the last docs review">: <files>. You haven't seen how they were written. Don't change files yet. Present findings as the plan, in a table: ID, severity, file and section, issue, suggested edit. Look for contradictions with the rest of docs/, CLAUDE.md and the installed plugins' behavior, gaps, ambiguous instructions, scope creep, and acceptance criteria that can't be checked. Skip style nits. I'll reply with a decision for each finding; then apply the accepted ones and tell me it's ready for /handoff.
```

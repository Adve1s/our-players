# Our Players

Nationality-first sports tracker: shows how athletes from the countries a user follows (default: Latvia) did in NHL and NBA games — a morning recap. Hobby project: the human is product owner and reviewer; Claude writes most of the code.

Read `docs/PROGRESS.md` first in every session (current state + next step). Product spec: `docs/VISION.md`. Session specs: `docs/SESSIONS.md`. Why things are the way they are: `docs/DECISIONS.md`. Upstream API notes: `docs/sources/` (written in S01).

## Repo map
- `apps/server` — Node + TypeScript: Hono read API (`/v1`), ingestion jobs, CLI, Drizzle schema + migrations
  - `src/sources/<source>/` — one adapter per upstream source (raw JSON → normalized model)
  - `src/jobs/` — schedule, results, roster, season-stats, backfill
  - `data/nationality-overrides.json` — sporting-nationality overrides keyed by public player ID (reviewed in git)
  - `test/fixtures/<source>/` — recorded upstream responses (never hand-edited)
- `apps/mobile` — Expo (React Native) app with Expo Router; Android + web from one codebase
- `packages/shared` — domain types, zod schemas (stat lines, API contract), pure logic (selection rule, country codes, game-day math)
- `.github/workflows/` — CI: `pnpm verify` on every pull request (S00)
- `docs/` — VISION, SESSIONS, PROGRESS, DECISIONS, WORKFLOW, `sources/`, `reviews/`

## Commands (repo root)
- `pnpm install`
- `pnpm verify` — typecheck + lint + all tests. Must be green before every commit (one exception under Workflow); CI runs it on every PR.
- `pnpm test [path-or-name-filter]` — Vitest across packages; pass a filter to run one area
- `pnpm dev:server` — API on :3001 with a local PGlite DB (`apps/server/.data/`); scheduler off unless `SCHEDULER_ENABLED=1`
- `pnpm dev:mobile` — Expo dev server (`w` = web, QR = Android via Expo Go)
- `pnpm job <name> [--league nhl|nba] [--date YYYY-MM-DD] [--from --to]` — run one ingestion job now (S04a+)
- `pnpm recap --date YYYY-MM-DD [--countries LVA]` — terminal morning recap from the DB (S04a+)
- `pnpm inspect <source> <endpoint> <fixture-id>` — print the normalized result of a fixture (S03+)
- `pnpm fixtures:record <source> <endpoint> <id-or-date> [--as <name>]` — record a raw upstream response (S01+); `--as` saves it under another file name
- `pnpm db:generate` (new migration after schema change) · `pnpm db:migrate` · `pnpm db:reset` (local only)
- `pnpm screenshots` — capture the web build's key screens to `apps/mobile/.screenshots/` (S08+)

## Architecture rules
1. Users never trigger upstream calls. Jobs fetch by league/game/team on a schedule; the API reads only our DB.
2. Raw upstream JSON never leaves an adapter. Adapters parse with zod (lenient on unknown fields, strict on fields we use) and return the normalized model from `packages/shared`. A parse failure is a loud error naming source + endpoint — never a silent default.
3. All upstream HTTP goes through `apps/server/src/http/polite-client.ts`: ≤ 1 request/s per host, honest User-Agent, timeout, retries with backoff.
4. Jobs are idempotent: re-running a job for the same input changes nothing. Upsert by natural keys.
5. Season stats come from the source, never computed from game logs. Game logs come from stored box scores.
6. Nationality means sporting nationality — the national team a player represents. One ISO 3166-1 alpha-3 code per player (or null): the override if one exists, else the birth country.
7. The selection rule exists once: `packages/shared/src/selection.ts`. Everything that filters players calls it.
8. Timestamps are stored in UTC. A game's `gameDate` is the league's schedule date (US calendar day), not the viewer's local date.
9. Public IDs are derived deterministically from source IDs (`nhl-8478402`, `nba-3102531`) so favorites stored on devices survive DB rebuilds.
10. The app talks only to our `/v1` API, typed by the zod contract in `packages/shared`. `apps/mobile` never imports from `apps/server`.

## Conventions
- TypeScript strict with `noUncheckedIndexedAccess`; ESM; no `any` (use `unknown` + zod). Biome formats and lints; a hook formats each edited file.
- Files kebab-case; DB tables and columns snake_case; TS camelCase; named exports.
- Pure functions for logic; side effects at the edges (jobs, routes, adapter fetch layer). Inject the clock and the HTTP layer so tests are deterministic.
- Jobs fail loudly (log + `job_runs` row). The API returns `{ "error": { "code", "message" } }` with the right status.
- Comments explain why, not what.
- New runtime dependency: name it and say why in the plan, and wait for approval.

## Testing
- Vitest everywhere. Mobile screens are checked with `pnpm screenshots` and on a phone; UI logic worth testing lives in pure modules.
- Adapter tests use recorded fixtures; tests never touch the network.
- API tests run on in-memory PGlite, seeded by running the real ingestion code over fixtures.
- New logic is red/green: write the failing test, watch it fail for the right reason, then implement.
- Never weaken, skip or delete a test to reach green, and never edit a fixture by hand. If a test or fixture looks wrong, stop and tell me.

## Workflow
- Each session follows its section in `docs/SESSIONS.md`: scope, out-of-scope list and acceptance criteria are the contract. Sessions start in plan mode; don't edit until I approve the plan.
- One branch and one pull request per slice (`slice-<n>-<slug>` → `main`). `/handoff` commits, pushes and updates the PR; I merge once CI passes. Never merge, rebase, force-push or push to `main`.
- Small Conventional Commits; `pnpm verify` green before each commit. The one exception is the red-phase `test:` commit a session prompt asks for: there the only failures may be the new tests failing on "not implemented". Use the `gh` CLI for GitHub (PRs, checks, comments).
- In a cloud session, work on the slice branch the prompt names, not the session's own branch: `git switch` to it, or create it from `origin/main` for a slice's first session.
- Stay in scope: put out-of-scope ideas in the PROGRESS.md parking lot instead of doing them.
- If product behavior is unclear, ask. If the same approach fails twice, stop and explain instead of trying a third variant.
- Show evidence, not assertions: paste the command and its output when claiming something works.
- When the session's work is done and `pnpm verify` is green, say so — I'll run `/handoff`.
- When compacting, keep: the session ID, the approved plan, files changed so far, and any failing test names.

## Gotchas
- I develop on Arch Linux (Omarchy); CI runs on Ubuntu. Scripts must work on both — no macOS-only commands or flags (`open`, `pbcopy`, `sed -i ''`).
- Cloud sessions (`CLAUDE_CODE_REMOTE=true`) start without `node_modules`; a SessionStart hook installs them (from S00 on — before that, run `pnpm install` first). They run Node 22 (code must work on Node 22 and 24), and can't reach the NHL/ESPN APIs — tests don't need them.
- Expo + pnpm: keep `nodeLinker: hoisted` in `pnpm-workspace.yaml`; some React Native libraries break with isolated installs.
- NHL `birthCountry` is already alpha-3. ESPN `birthPlace.country` is a name ("Cameroon"; US-born players show "USA") — map it in `packages/shared/src/countries.ts` (ESPN spellings as aliases; England/Scotland/Wales → GBR). Unknown → `null` plus a warning, never a guess.
- NHL season IDs look like `20262027`; ESPN labels a season by its end year (`2027`). Store `"2026-27"`.
- Both upstream APIs are unofficial and change without notice. When a re-recorded fixture breaks a test, fix the adapter, not the fixture.

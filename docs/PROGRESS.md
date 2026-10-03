# Progress

Read this first in every session. **Current state** is rewritten at each `/handoff`; the sections below it are append-only.

## Current state
- **Last session:** S01 — Data spike + fixtures (2026-10-03): polite HTTP client, fixture recorder, 33 recorded fixtures, throwaway spike, `docs/sources/` notes answering VISION §9.
- **Branch / PR:** `slice-0-setup` → `main`, draft PR #2 "Slice 0: Setup + data spike" (S00 and S01 ticked).
- **What works:** `pnpm verify` (45 tests); `pnpm fixtures:record <source> <endpoint> <id> [--as <name>] [--force]`; `pnpm spike --date YYYY-MM-DD` prints Latvians' NHL and NBA lines (2026-03-10: Merzļikins, Girgensons, Balinskis, Šilovs DNP, Porziņģis), about 59 requests and 42 s; plus everything from S00 (`/health`, placeholder app).
- **How to try it:** `pnpm verify`; `pnpm spike --date 2026-03-10` (live APIs, about 1 minute); `pnpm fixtures:record nhl score 2026-03-10` refuses because the file exists (add `--as try` to record a copy, then delete it); read `docs/sources/nhl.md` and `docs/sources/espn-nba.md`.
- **Next session:** R0 — Slice 0 review (`/slice-review 0`, fresh session, same branch), then review fixes and merging PR #2.
- **Notes for the next session:**
  - Every upstream call goes through `upstreamClient(config)` (`apps/server/src/http/upstream.ts`). Endpoint URL builders live in `src/sources/<source>/endpoints.ts`, which the S03/S05 adapters should reuse.
  - Fixtures are pretty-printed re-serializations; `.meta.json` `bytes` is the raw size. Biome ignores `test/fixtures`.
  - Source findings that shape S02a–S05: NHL period scores come from `gamecenter/{id}/right-rail` (not the box score); NHL OT/SO loss decision is `"O"`; preseason finals are `FINAL`, not `OFF`; ESPN has no past-season rosters; ESPN bulk season stats via `statistics/byathlete` (12 requests a season, map by `names`); ESPN DNP = `didNotPlay` only (`reason` also appears on players who played).
  - Decisions this session: D-024 (DNP rows include NHL `toi "00:00"`), D-025 (nationality stays birth country + override).
  - Merzļikins now plays for TOR; the CBJ fixtures are from before the move.
  - The cloud-install hook (S00) still hasn't run in a real cloud session.

## Known issues
- (none)

## Parking lot
Ideas that came up but are out of scope for now.
- S08: add `apps/mobile` to `test.projects` in the root `vitest.config.ts` once `src/lib` has tests; until then mobile tests would silently not run.
- Later (D-025): adopt the NHL `nationalityCode` / ESPN `citizenship` fields for nationality or override suggestions.
- Add a 2026 NBA preseason `summary` fixture with `--as` once a game is final (the S01 one is from Oct 2025).
- Recorder `--drop-keys` if a fixture ever exceeds ~1 MB (pruning proposal in `docs/sources/espn-nba.md` Q8).
- S04a/S06: decide "Not in lineup" behavior for injured-reserve players (NHL `/roster/current` probably lists them, unverified) and G League / two-way players (ESPN roster has no marker). Record a known IR player's roster in S04a to settle the NHL side.
- S05: ESPN box scores can list an athlete without `id`/`displayName` (only `shortName`; `summary/401810401`). VISION §6.1 says "never drop a stat line", but a line without an ID can't be tied to a player. Decide: warn and skip (likely), or a name-keyed stub. Also `MIN "--"` with `didNotPlay: false` — played or DNP?
- S03/S05 adapters: wrap `JSON.parse` so a non-JSON body (HTML block page) fails with source + endpoint named; the S01 spike doesn't.

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

### S00 — Bootstrap — 2026-10-03 — PR (draft, `slice-0-setup`)
- Changed: root workspace (`package.json`, `pnpm-workspace.yaml`, `.tool-versions`, `tsconfig.base.json`, `biome.json`, `vitest.config.ts`, `scripts/not-yet.mjs`); `packages/shared` (`formatFollowing`); `apps/server` (Hono `/health`, zod env config); `apps/mobile` (Expo SDK 57, pruned template, placeholder); CI; cloud-install hook; README.
- Decisions: D-022 (toolchain pins), D-023 (Expo deps and pnpm settings).
- Read these: `pnpm-workspace.yaml`, `.github/workflows/ci.yml`, `apps/server/src/config.ts`, `apps/mobile/app/index.tsx`, `packages/shared/package.json`.
- Reviewer: approve, no findings; fixed 2 nits (hook timeouts, Node types removed from shared), parked 1 (mobile in Vitest projects).
- CI: green (`verify (22)`, `verify (24)`).
- Follow-ups: none; the owner did the phone check and added the required checks on `main`.

### S01 — Data spike + fixtures — 2026-10-03 — PR #2 (draft, `slice-0-setup`)
- Changed: `apps/server/src/http/` (polite client, upstream factory), `src/fixtures/record.ts` + `scripts/fixtures-record.ts`, `src/sources/{nhl,espn-nba}/endpoints.ts`, `scripts/spike/`, `config.ts` (`CONTACT_URL`), 32 fixtures, `docs/sources/`, VISION §4.1 and §7.
- Decisions: D-024 (DNP rows incl. NHL `toi "00:00"`), D-025 (nationality stays birth + override).
- Read these: `apps/server/src/http/polite-client.ts`, `apps/server/src/fixtures/record.ts`, `docs/sources/nhl.md`, `docs/sources/espn-nba.md`, `apps/server/scripts/spike/nhl.ts`.
- Reviewer: approve; fixed 2 minors (excessive `Retry-After` now holds the host; body-stall timeout test) and 4 nits (doc counts, `Object.hasOwn` lookup, re-serialization note); left the spike's bare `JSON.parse` (throwaway; parked for adapters).
- CI: see PR #2.
- Follow-ups: 2026 NBA preseason fixture; IR / G League "Not in lineup" rule; ESPN athletes without an ID (S05). After handoff, the owner hit a spike crash on 2026-01-10 (ESPN athlete without `id`): fixed, fixture `summary/401810401` added. About 215 upstream requests used this session.

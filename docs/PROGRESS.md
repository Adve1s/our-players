# Progress

Read this first in every session. **Current state** is rewritten at each `/handoff`; the sections below it are append-only.

## Current state
- **Last session:** S00 — Bootstrap (2026-10-03): pnpm monorepo, pinned toolchain, Hono `/health`, Expo SDK 57 placeholder app, `pnpm verify`, CI on Node 22 + 24.
- **Branch / PR:** `slice-0-setup` → `main`, draft PR "Slice 0: Setup + data spike".
- **What works:** `pnpm verify` (typecheck + Biome + Vitest, 10 tests); `pnpm dev:server` serves `GET /health` → `{"ok":true}` on :3001; `pnpm dev:mobile` shows a placeholder ("Our Players / Following: LVA", the second line from `packages/shared`) on web and in Expo Go; later commands print the session that adds them and exit 1.
- **How to try it:** `pnpm install && pnpm verify`; `pnpm dev:server` then `curl localhost:3001/health`; `pnpm dev:mobile`, press `w`, or scan the QR code with Expo Go (needs the ufw rule from WORKFLOW.md step 5).
- **Next session:** S01 — Data spike + fixtures (local, same branch).
- **Notes for the next session:**
  - Owner to-dos: phone check in Expo Go; after the first green CI run, add `verify (22)` and `verify (24)` as required checks on `main`.
  - pnpm 12 fails installs on unapproved build scripts: a new dependency with an install script needs an `allowBuilds` entry in `pnpm-workspace.yaml` (only esbuild so far).
  - TypeScript 6 defaults `types` to `[]`: server code that uses Node globals relies on `types: ["node"]` in `apps/server/tsconfig.json`.
  - Server tests run with `apps/server/test/setup.ts`, which makes any real `fetch` throw.
  - The cloud-install hook (D-023) hasn't run in a real cloud session yet; check it in the first cloud session.

## Known issues
- (none)

## Parking lot
Ideas that came up but are out of scope for now.
- S08: add `apps/mobile` to `test.projects` in the root `vitest.config.ts` once `src/lib` has tests; until then mobile tests would silently not run.

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
- CI: see the PR (first run).
- Follow-ups: owner adds required checks on `main` after the first green run.

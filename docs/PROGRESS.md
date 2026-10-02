# Progress

Read this first in every session. **Current state** is rewritten at each `/handoff`; the sections below it are append-only.

## Current state
- **Last session:** K0 — Kit review (2026-10-03): 20 findings, all accepted and applied to the docs and the Claude Code setup.
- **Branch / PR:** `kit-review` → `main` (docs only, no CI yet); merge it on GitHub, then `git switch main && git pull --ff-only`.
- **What works:** nothing runs yet; the repo holds the reviewed docs, `.claude/` config and `apps/server/data/nationality-overrides.json`.
- **How to try it:** — (read `docs/SESSIONS.md`: S02 and S04 are now split into S02a/S02b and S04a/S04b).
- **Next session:** S00 — Bootstrap. Claude creates branch `slice-0-setup`, and its first `/handoff` opens the slice's draft PR.
- **Notes for the next session:**
  - Before S00, the owner protects `main` (WORKFLOW.md setup step 4, first part) and runs `/effort medium` — K0's `/effort high` was saved as the default.
  - S00 scope grew slightly: CI runs on a Node 22 + 24 matrix (`verify (22)`, `verify (24)`), and a SessionStart hook installs dependencies in cloud sessions only.
  - Cloud sessions now push the slice branch directly (DECISIONS.md D-020).

## Known issues
- (none)

## Parking lot
Ideas that came up but are out of scope for now.
- (none)

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

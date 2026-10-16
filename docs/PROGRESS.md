# Progress

Read this first in every session. **Current state** is rewritten at each `/handoff`; the sections below it are append-only.

## Current state
- **Last session:** Plugin workflow (2026-10-16): the kit now runs on superpowers + ponytail + context7 + typescript-lsp; one branch and PR per session, reviewed by the built-in `/code-review` (DECISIONS.md D-022–D-025).
- **Branch / PR:** `plan-change` → `main`, PR #3 (docs and config only, no CI yet).
- **What works:** nothing runs yet; the repo holds the docs, `.claude/` config (with the project plugins) and `apps/server/data/nationality-overrides.json`. `origin/slice-0-setup` keeps an earlier attempt at S00–R0 under the old workflow as a backup — don't merge or modify it.
- **How to try it:** `/plugin` shows four plugins enabled; read `docs/WORKFLOW.md` (TL;DR, Plugins) and `docs/SESSIONS.md` → "How to run a session".
- **Next session:** S00 — Bootstrap. Claude creates branch `s00-bootstrap` from `main`; its `/handoff` opens the PR and runs `/code-review`.
- **Notes for the next session:**
  - Before S00, the owner protects `main` (WORKFLOW.md setup step 4, first part) if it isn't already, and sets effort per the Overview (`/effort medium` for S00).
  - S00 is the first session with Opus helper agents: check `/usage` afterwards (D-025). Note any superpowers helper scripts that prompt repeatedly as candidate allow rules.
  - Optional: a fresh session runs the "Docs review" template over this change before S00.

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

### Plugin workflow — 2026-10-16 — PR into `main` (`plan-change`)
- Changed: CLAUDE.md (Workflow configures superpowers; test rules beat ponytail), WORKFLOW.md (rewritten around the plugins), SESSIONS.md (per-session branches, brainstorm/plan prompts, R rows and K0 prompt removed, templates updated), handoff skill (per-session PR + `/code-review`), reviewer/test-writer agents, settings (default mode, project plugins, ponytail marketplace), `.gitignore` (`.superpowers/`); `/slice-review` and `docs/reviews/` deleted.
- Decisions: D-022 (supersedes D-015), D-023, D-024 (supersedes D-016/D-020 in part), D-025 (amends D-018).
- Read these: docs/WORKFLOW.md (TL;DR, Plugins, GitHub), CLAUDE.md (Workflow), docs/SESSIONS.md (How to run a session, S00 prompt), .claude/skills/handoff/SKILL.md.
- Reviewer: not run (docs-only change; the "Docs review" template is the independent pass).
- CI: none yet (no package.json before S00).
- Follow-ups: check `/usage` after S00; confirm cloud sessions install the project plugins on first cloud run.


# Progress

Read this first in every session. **Current state** is rewritten at each `/handoff`; the sections below it are append-only.

## Current state
- **Last session:** Review fixes for PR #3 (2026-10-17): 9 of 10 `/code-review` findings fixed (docs and `.claude/` config), 1 rejected with a reply on the PR. The kit runs on superpowers + ponytail + context7 (project) and typescript-lsp (user), one branch and PR per session (D-022–D-025).
- **Branch / PR:** `plan-change` → `main`, PR #3 (docs and config only, no CI yet).
- **What works:** nothing runs yet; the repo holds the docs, `.claude/` config (with the project plugins, ponytail pinned to `v5.3.1`) and `apps/server/data/nationality-overrides.json`. `origin/slice-0-setup` keeps an earlier attempt at S00–R0 under the old workflow as a backup — don't merge or modify it.
- **How to try it:** `/plugin` shows the three project plugins (superpowers, context7, ponytail) plus typescript-lsp from your user settings; read `docs/WORKFLOW.md` (TL;DR, Plugins) and `docs/SESSIONS.md` → "How to run a session".
- **Next session:** S00 — Bootstrap. Claude creates branch `s00-bootstrap` from `main`; its `/handoff` opens the PR and runs `/code-review`.
- **Notes for the next session:**
  - Before S00, the owner protects `main` (WORKFLOW.md setup step 4, first part) if it isn't already, and sets effort per the Overview (`/effort medium` for S00).
  - Your own machine registered the ponytail marketplace without a tag; re-add it as `DietrichGebert/ponytail@v5.3.1` (WORKFLOW setup step 6) so a manual update can't follow its `main`.
  - S00 is the first session with Opus helper agents: check `/usage` afterwards (D-025). Note any superpowers helper scripts that prompt repeatedly as candidate allow rules.
  - During plan execution Claude stops only for superpowers' four stops, a red-phase test or fixture that looks wrong, or a test-writer spec question (BLOCKED); everything else is a ruling listed in the PR briefing. Your in-session steps come after the final review.
  - Untested until S00: whether the controller routes a *test-writer* task to the test-writer agent (and follows its new report contract), and whether the reviewer agent's Critical/Important/Minor output feeds superpowers' final fix wave cleanly.
  - Untested until the first cloud session: the ponytail `ref` pin on a fresh install, and the cloud mode dropdown (start in Accept edits, switch to Auto before approving the plan).

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

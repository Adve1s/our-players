---
name: slice-review
description: Independent review of a finished slice's pull request, for a FRESH session on the slice branch. Writes docs/reviews/slice-<n>.md and posts it to the PR as a review. Usage — /slice-review <slice>
disable-model-invocation: true
argument-hint: "<slice>"
arguments: [slice]
effort: high
allowed-tools: Bash(pnpm verify) Bash(git fetch *) Bash(git status *) Bash(git diff *) Bash(git log *) Bash(git show *) Bash(gh pr view *) Bash(gh pr diff *) Bash(gh pr checks *) Bash(gh pr edit *) Bash(gh pr ready *) Bash(gh pr review *) Bash(gh api repos/*/pulls/*/reviews *)
---

# Slice $slice review

You did not build this code. Review slice $slice's pull request the way a skeptical senior engineer would, so the human can decide what must change before it reaches `main`.

## Scope

- **The PR:** run `git fetch origin`, then `gh pr view --json number,title,url,body,isDraft,headRefOid,comments` (in a cloud session, name the slice branch: `gh pr view slice-…`). The comments hold the session handoff briefings; cloud sessions posted theirs on their own small PRs into the slice branch. Your checkout must match the PR: no uncommitted or unpushed changes, and `HEAD` equals `headRefOid`. If it doesn't, stop and tell me.
- **Cloud session** (`CLAUDE_CODE_REMOTE` is `true`): GitHub calls go through a proxy. If a `gh` command is refused, use the built-in GitHub tools or the REST fallback the error names (`gh api repos/{owner}/{repo}/…`).
- **CI:** `gh pr checks`. A failing check is a blocker.
- **Range:** `origin/main...HEAD`. Start with `git log --oneline origin/main..HEAD` and `git diff --stat origin/main...HEAD`. Recorded fixtures and the lockfile are generated: check only that each change has a reason (the recorder, a dependency change). Read everything else with `git diff origin/main...HEAD -- . ':(exclude)*/test/fixtures/*' ':(exclude)pnpm-lock.yaml'`.
- **Contract:** the `docs/SESSIONS.md` sections of this slice's sessions (see its Overview table) and the `docs/VISION.md` sections they reference. CLAUDE.md is already loaded; its Architecture rules are review criteria.
- **History:** this slice's Session log entries in `docs/PROGRESS.md` and its new entries in `docs/DECISIONS.md`.

## Do

1. Read the diff yourself, completely; this review is the main event. Only for a very large diff, use the `reviewer` subagent per area and merge its findings.
2. Run `pnpm verify`.
3. Exercise the slice like a user: run the "Try it" commands from the handoff briefings (local only; ask me before anything that calls the upstream APIs) and check that the output makes sense.
4. Check every acceptance criterion of every session in the slice, with evidence.
5. Hunt for what per-session reviews miss: duplicated logic across sessions, inconsistent naming, drift from VISION.md, a decision made twice in different ways, docs that no longer match the code.
6. Calibrate: blockers and majors only for correctness, requirements, architecture rules and test trustworthiness; at most five optional nits. "No blockers" is a fine outcome.

## Deliver

If you are in plan mode, present the review as your plan; once I approve, do the steps below. Otherwise do them directly. Change no file other than the review file.

1. Write the review to `docs/reviews/slice-$slice.md` (structure below), commit it as `docs: slice $slice review`, and push (I'll approve the prompt). **In a cloud session, skip this step:** you can push only the session's own branch, so the review lives on the PR, and the fix session saves it to `docs/reviews/`.
2. Post it to the PR as one review with event `COMMENT` — GitHub doesn't let you approve or request changes on your own pull request. Use `gh api repos/{owner}/{repo}/pulls/<number>/reviews --method POST --input -` and pass this JSON on stdin: `commit_id` = the PR's head commit (after your push, if you pushed); `event` = `"COMMENT"`; `body` = the verdict and the findings table, plus a link to the review file if you committed one (in a cloud session, the whole review); `comments` = one inline comment `{ "path", "line", "side": "RIGHT", "body": "F<n> (<severity>): …" }` for each finding whose location is a line inside the PR's diff. If GitHub rejects the inline comments, post the review without them: `gh pr review <number> --comment --body-file -`.
3. Tick "Slice review" in the PR description's checklist (`gh pr edit --body-file -`) and mark the PR ready for review (`gh pr ready <number>`). If either is refused, tell me to do it on GitHub.
4. Tell me the verdict, the number of findings per severity, and the PR link.

## Review file structure

```
# Slice $slice review — <date>

**PR:** <url> · **Verdict:** ready to merge | merge after fixes | needs rework — one or two sentences.

## Acceptance criteria
| Session | # | Criterion (short) | Status | Evidence |

## Findings
| ID | Sev | Location | Issue | Why it matters | Suggested fix | Decision |
(IDs F1, F2, … Leave Decision empty: the human decides accept / reject / defer.)

## Tests
Would the tests catch a broken implementation? Any weakened, skipped or snapshot-only
tests? Any fixture change not made by the recorder?

## Simplification opportunities (at most 3)

## Reading guide
5–8 files in reading order, each with what to look for, so the human understands this slice.

## Questions for the human
```

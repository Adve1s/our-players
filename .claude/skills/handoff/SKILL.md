---
name: handoff
description: End-of-session ritual for this repo — verify, independent review, update PROGRESS and DECISIONS, commit, push to the right pull request, and brief the human with a reading list. Run when a session's work is done.
disable-model-invocation: true
argument-hint: "[notes]"
allowed-tools: Bash(pnpm verify) Bash(git status *) Bash(git diff *) Bash(git log *) Bash(git add *) Bash(git commit *) Bash(gh pr view *) Bash(gh pr create *) Bash(gh pr edit *) Bash(gh pr comment *) Bash(gh pr checks *)
---

# Handoff

Do these steps in order. If a step fails, stop and report instead of improvising.

**Where am I?** Work out which case applies before you start:
- **On a slice branch** (`slice-…`): the normal case, locally or in a cloud session.
- **On another branch** (`kit-review`, `fix-…`): its PR goes into `main`.
- **On `main`, or in a cloud session still on its own branch** (`claude/…`): stop and ask me which branch to use.

In a cloud session (`CLAUDE_CODE_REMOTE` is `true`), GitHub calls go through a proxy: if a `gh` command is refused, use the built-in GitHub tools or the REST fallback the error names (`gh api repos/{owner}/{repo}/…`).

Before S00 there's no `package.json`: skip the verify and CI steps.

1. **Verify.** Run `pnpm verify`. If it fails, fix it within this session's scope or stop and report. Never weaken a test to get to green.
2. **Independent review — always.** Use the `reviewer` subagent on this session's changes: everything since this branch was last pushed (`git diff @{upstream}`) or, if it was never pushed, since it left `main` (`git diff $(git merge-base origin/main HEAD)`), plus untracked files from `git status`. Give it the session ID and the acceptance criteria from the session's section of `docs/SESSIONS.md`, and wait for its report. Fix every in-scope blocker and major finding; for any you leave, say why.
3. **Re-verify** if anything changed.
4. **`docs/PROGRESS.md`.** Rewrite "Current state": last session, the slice branch and its PR, what works now, how to try it (exact commands), next session, and anything the next session must know. Append one Session log entry of at most 12 lines. Update Known issues and Parking lot.
5. **`docs/DECISIONS.md`.** Append this session's decisions (next ID, date, decision, why, alternatives). Skip if there were none.
6. **CLAUDE.md.** If you learned something *every* future session needs (a command, a gotcha), show me the exact edit and wait for my OK. Area-specific knowledge belongs in `docs/` or `.claude/rules/`. Keep CLAUDE.md short.
7. **Commit** with Conventional Commit message(s).
8. **Push:** `git push -u origin HEAD` — I'll approve the prompt. If there's no `origin` remote, or `gh` isn't logged in on my machine, stop and tell me.
9. **Pull request.**
   - *Slice branch:* if `gh pr view` finds no PR, create a draft PR into `main` (`gh pr create --draft --base main`) titled `Slice <n>: <slice name>`, whose body holds the slice goal from `docs/SESSIONS.md`, a checklist with one box per session of the slice, and two more boxes: "Slice review" and "Review fixes". If the PR exists, tick this session's box (`gh pr edit --body-file -`).
   - *Any other branch:* create a PR into `main` with a short descriptive title.
10. **Briefing.** Write it in exactly this shape, and post it as a comment headed `S<nn> — <session name>: handoff` on the PR you just created or updated (`gh pr comment --body-file -`):
    - **Done** — 3–6 bullets, user-visible changes first
    - **Decisions** — key choices and why
    - **Read these** — 3–7 files in reading order, one line each on why it matters (core logic over boilerplate)
    - **Try it** — exact commands to see it working
    - **Review** — the reviewer's verdict, what you fixed, what you deliberately left
    - **Open questions / risks**
    - **Next** — the next session ID, and any change you suggest to its prompt in `docs/SESSIONS.md`
11. **CI.** Run `gh pr checks --watch` with a Bash timeout of about 6 minutes (or as a background command). If it reports no checks yet, run it once more.
12. **Reply** with the briefing, then the PR link and the CI result: passed, failed (name the failing check), or still running.

My notes: $ARGUMENTS

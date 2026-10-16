---
name: handoff
description: End-of-session ritual for this repo — verify, make sure the final review ran, update PROGRESS and DECISIONS, commit, push, open the session's pull request, brief the human, run /code-review on the PR and report CI. Run when a session's work is done.
disable-model-invocation: true
argument-hint: "[notes]"
allowed-tools: Bash(pnpm verify) Bash(git status *) Bash(git diff *) Bash(git log *) Bash(git add *) Bash(git commit *) Bash(gh pr view *) Bash(gh pr create *) Bash(gh pr edit *) Bash(gh pr comment *) Bash(gh pr checks *)
---

# Handoff

Do these steps in order. If a step fails, stop and report instead of improvising. This replaces `superpowers:finishing-a-development-branch`: never merge locally.

**Branch.** Any branch except `main` gets its own PR into `main` (normally `s<nn>-<slug>`). On `main`, or in a cloud session still on its own `claude/…` branch, stop and ask me which branch to use. In a cloud session (`CLAUDE_CODE_REMOTE` is `true`), GitHub calls go through a proxy: if a `gh` command is refused, use the built-in GitHub tools or the REST fallback the error names (`gh api repos/{owner}/{repo}/…`).

Before S00 there's no `package.json`: skip the verify and CI steps.

1. **Verify.** Run `pnpm verify`. If it fails, fix it within this session's scope or stop and report. Never weaken a test to get to green.
2. **Final review.** If the `reviewer` agent ran in this session as the final whole-branch review of subagent-driven development, and only its own fix wave and scoped re-review followed, use its report. Otherwise run it now, with the session ID and the acceptance criteria from `docs/SESSIONS.md` (without a session ID: the agreed change from the template prompt or PR body and its checks, and say there is no session section): on a Review fixes handoff, over `git diff @{upstream}`; otherwise over everything since the branch left `main` (`git diff $(git merge-base origin/main HEAD)`, plus untracked files from `git status`). Fix every in-scope Critical and Important finding; for any you leave, say why.
3. **Re-verify** if anything changed.
4. **`docs/PROGRESS.md`.** Rewrite "Current state": last session, branch and PR, what works now, how to try it (exact commands), next session, and anything the next session must know. Append one Session log entry of at most 12 lines. Update Known issues and Parking lot (include new `shortcut:` comments worth tracking).
5. **`docs/DECISIONS.md`.** Append this session's decisions (next ID, date, decision, why, alternatives). Skip if there were none.
6. **CLAUDE.md.** If you learned something *every* future session needs (a command, a gotcha), show me the exact edit and wait for my OK. Area-specific knowledge belongs in `docs/` or `.claude/rules/`. Keep CLAUDE.md short.
7. **Commit** with Conventional Commit message(s), including the session's spec and plan under `docs/superpowers/`.
8. **Push:** `git push -u origin HEAD` — I'll approve the prompt. If there's no `origin` remote, or `gh` isn't logged in on my machine, stop and tell me.
9. **Pull request.** If `gh pr view` finds none, create it (`gh pr create --base main`, not a draft) titled `S<nn> — <session name>`, with the session goal and acceptance criteria from `docs/SESSIONS.md` as a checklist and links to the spec and plan. On a branch without a session ID (`fix-…`, `chore-…`, docs), title it after the change and put the problem and how it was verified in the body. If the PR exists (review fixes), leave its body and continue.
10. **Briefing.** Write it in exactly this shape, and post it as a comment headed `S<nn> — <session name>: handoff`, or `<branch>: handoff` without a session ID (`gh pr comment --body-file -`):
    - **Done** — 3–6 bullets, user-visible changes first
    - **Decisions** — key choices and why
    - **Read these** — 3–7 files in reading order, one line each on why it matters (core logic over boilerplate)
    - **Try it** — exact commands to see it working
    - **Review** — the final review's verdict, what was fixed, what was deliberately left
    - **Rulings** — every `Ruling:` from subagent-driven development's "Rulings I made" list, one line each with its cost if wrong, or "none"
    - **Shortcuts** — new `shortcut:` comments (file:line, one line each), or "none"
    - **Open questions / risks**
    - **Next** — the next session ID, and any change you suggest to its prompt in `docs/SESSIONS.md`
11. **PR review.** Run the built-in `/code-review high <PR number> --comment`, so its findings land as inline PR comments. Skip it when this handoff only pushed fixes for an earlier `/code-review` of the same PR.
12. **CI.** Run `gh pr checks --watch` with a Bash timeout of about 6 minutes (or as a background command). If it reports no checks yet, run it once more.
13. **Reply** with the briefing, the PR link, the number of `/code-review` findings, and the CI result: passed, failed (name the failing check), or still running.

My notes: $ARGUMENTS

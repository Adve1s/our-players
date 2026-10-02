# Agent workflow

How to build Our Players with Claude Code: which agents to use, how they're set up in this repo, how the work flows through GitHub, and the practices behind the setup. Session-by-session prompts are in `docs/SESSIONS.md`.

## TL;DR — the recommendation

| Role | Runs as | When | Worth it? |
|---|---|---|---|
| **Builder** | your main Claude Code session | every session (one row of SESSIONS.md) | — |
| **Reviewer** | read-only subagent (`.claude/agents/reviewer.md`) | **every** session, inside `/handoff`, before the commit | Yes — catches mistakes while the builder still has context to fix them |
| **Slice reviewer** | a **fresh session** you start, running `/slice-review <n>` | once per slice, plus once for the docs themselves (K0); its review is posted to the pull request | Yes — the only truly independent check, and your pull-request review |
| **Test-writer** | subagent (`.claude/agents/test-writer.md`) | only the red phase of contract code: selection rule, nationality, the two adapters | Yes, but narrowly — not as a standing third agent |
| Agent teams, parallel worktrees, autonomous loops | — | — | Not now. Slices depend on each other and your review attention is the bottleneck; more agents mean more to review, not more done |

## Subagent or separate session?

| | Subagent inside the builder's session | Fresh session you start |
|---|---|---|
| Context | Its own window; sees CLAUDE.md plus the brief **the builder writes** | Nothing from the build; you give the brief (`/slice-review`) |
| Independence | Partial — the builder chooses what to ask and can frame it | Full |
| Your effort | None (part of `/handoff`) | Start it, read the review on GitHub, decide per finding |
| Findings go to | The builder, who fixes them right away | A review file plus a PR review with inline comments; a fix session follows |
| Best for | Per-session sanity check before committing | Slice gate, drift across sessions, your own learning |

Use both, at different cadences. A subagent is a fresh context window with its own tools; that's enough to stop the builder grading its own homework session by session. A separate session removes the builder from the loop entirely, which is what you want before code reaches `main`.

**Why only a narrow test-writer?** A separate test author pays off where tests *are* the spec — the selection rule — or encode an external contract — what the fixtures really say — because an author who already has an implementation in mind tends to write tests that confirm it. Everywhere else, red/green discipline in the builder plus the reviewer's test audit covers the risk at lower cost. The test-writer runs *before* the implementation exists, so it can't be biased by it.

## GitHub: one branch and one pull request per slice

| When | What happens | Who |
|---|---|---|
| A slice's first session | Claude creates `slice-<n>-<slug>` from the latest `main` | Claude |
| Every `/handoff` | commit → push → draft PR created (first time) or its session checklist ticked → session briefing posted as a PR comment → CI result reported | Claude; you approve the push |
| Slice end | a fresh session runs `/slice-review <n>`: review file committed, posted as a PR review with inline comments, PR marked ready for review | Claude, fresh context |
| Triage | read the review on GitHub; decide accept / reject / defer per finding | You |
| Fixes | the "Review fixes" template with your decisions, then `/handoff` | Claude |
| Merge | CI green → **Create a merge commit** on GitHub → `git switch main && git pull --ff-only` | You |

- **The PR is the slice's record:** GitHub's diff view, CI status, every session's briefing as a timeline, and the review as inline comments. `.gitattributes` collapses recorded fixtures and the lockfile in the diff view.
- **CI** (GitHub Actions, added in S00) runs `pnpm verify` on every push to the PR. Tests never touch the network, so CI needs no secrets.
- **Merge commits, not squash:** `main` keeps each session's commits — including the red test commits that show the tests came first — while `git log --first-parent main` still reads as one entry per slice.
- **Reviews are comments, not approvals:** GitHub doesn't let you approve or request changes on your own pull request, so the review is posted with event `COMMENT`. The merge button is your approval.
- **Claude never merges.** Pushes always ask for your approval; force pushes and repo deletion are denied; branch protection (setup step 4) is the real guard for `main`.

## Cloud sessions

A cloud session is a Claude Code session that runs on an Anthropic-managed VM against your GitHub repo instead of on your laptop. Start one at claude.ai/code, in the Claude mobile app, in the desktop app (choose **Cloud**), or from the terminal with `claude --cloud "<prompt>"`, which clones your current branch from GitHub (push first). Pull one back into your terminal, conversation and branch included, with `claude --teleport`.

**Your $100 credit.** The cloud session credit on your account pays for cloud sessions first; after it's used up or expires (November 5, 2026), cloud sessions draw on your Pro plan's usage like local ones. It's a dollar balance, so check it after your first cloud session to see what one session costs.

**What fits the cloud in this project:** the sessions marked *either* in the SESSIONS.md Overview — K0, the backend sessions S02–S07 and the slice reviews. They need only the repo, the recorded fixtures and the tests. Keep the *local* ones local: S00 and S01 (your machine's setup, the phone check, recording live API data from your home connection, since unofficial APIs may block cloud IPs), the app sessions (your phone), and the shipping sessions (consoles and secrets). In October this is plenty of work to spend the credit on.

**How a cloud session differs:**
- **Its own branch.** Each cloud session works on a branch of its own, started from the branch you pick (the slice branch), and can push only that branch. `/handoff` therefore opens a small PR from it into the slice branch and posts the briefing there; you merge that PR on GitHub and the slice PR picks up the changes. A cloud `/slice-review` can't push either, so it posts the review to the slice PR only, and the fix session saves it to `docs/reviews/`.
- **Plan mode from the dropdown.** Pick **Plan** in the mode dropdown when you start (cloud sessions offer Accept edits, Plan and Auto) and approve the plan in the browser. Set effort with `/effort high` as the first message where the Overview says high.
- **What it reads:** your repo's CLAUDE.md, `.claude/settings.json` (permissions and hooks), skills, agents and rules — everything committed. Not your personal `~/.claude` settings.
- **Its machine:** Ubuntu with Node 22, pnpm and `gh` preinstalled; `node_modules` is installed fresh each session. Network access is limited to package registries and GitHub by default, so the NHL/ESPN APIs are unreachable — the tests don't need them. Live checks ("run by you") stay on your machine: `git pull` the slice branch, or `claude --teleport` the session.

**One-time setup:** at claude.ai/code, connect GitHub and install the Claude GitHub App on the repo (or run `/web-setup` in Claude Code to reuse your `gh` login). The **Default** environment it creates is fine as is.

## One-time setup

1. **Tools (Omarchy).** Node through mise, as Omarchy does it: `mise use -g node@24`, then `corepack enable` so the repo's pinned pnpm version is used. Install the GitHub CLI if it's missing (`sudo pacman -S github-cli`) and log in with `gh auth login`. Then install Claude Code, and put Expo Go on your Android phone. Accounts needed later: Expo (S11), Google Play Console (S11), a hosting provider (S10).
2. **Repo.** Create it and add this kit:
   ```bash
   mkdir our-players && cd our-players
   git init -b main
   # unzip the kit here: CLAUDE.md, .gitignore, .gitattributes, apps/, docs/, .claude/
   git add -A && git commit -m "chore: project docs and Claude Code setup"
   gh repo create our-players --public --source=. --remote=origin --push
   ```
   A **public** repo is the easy path. Branch protection and GitHub Pages (for the privacy policy) are free for public repos on GitHub Free, Actions minutes are free for public repos, and the API User-Agent can point to a page the API operators can open. A private repo needs GitHub Pro for branch protection; Pro is free for students through GitHub Education.
3. **Repo settings** (GitHub → Settings → General): under Pull Requests, allow merge commits and turn on **Automatically delete head branches**.
4. **Protect `main` after S00's first CI run** (Settings → Branches → add a rule for `main`): **Require a pull request before merging** with no required approvals (you can't approve your own PR), **Require status checks to pass** with the `verify` check, and **Do not allow bypassing the above settings**. Without that last box, repository admins skip the rule — that's you, and Claude working through your `gh` login.
5. **Firewall, for testing on your phone.** Omarchy's firewall blocks incoming connections except SSH and LocalSend, so Expo Go can't reach Metro (8081) or the dev API (3001) on your computer. Allow both from your home network (adjust the range to yours):
   ```bash
   sudo ufw allow proto tcp from 192.168.0.0/16 to any port 8081,3001
   ```
6. **Start Claude Code** in the repo (`claude`) and accept the workspace trust prompt; the project's allow rules only take effect once you trust the folder.
7. **Check the setup:** `/context` (CLAUDE.md loaded), `/hooks` (one SessionStart and one PostToolUse hook), `/skills` (handoff, slice-review, walkthrough), `/permissions`, and ask "which custom subagents are available?" (reviewer, test-writer). Path-scoped rules load only when Claude reads matching files, so check them later: while Claude works on an adapter (S03), `/memory` should list `.claude/rules/adapters.md`.
8. Terminal sessions start in plan mode here (`permissions.defaultMode` in `.claude/settings.json`). If you also use the VS Code extension, set `claudeCode.initialPermissionMode` to `plan` there — the extension doesn't read project settings for the starting mode.
9. **Optional: a desktop notification when Claude needs you** — for example, the push prompt at the end of `/handoff` while you're in another window. Add this to your personal `~/.claude/settings.json` (not the project's):
   ```json
   {
     "hooks": {
       "Notification": [
         {
           "matcher": "permission_prompt|idle_prompt",
           "hooks": [{ "type": "command", "command": "notify-send 'Claude Code' 'Claude needs your attention'" }]
         }
       ]
     }
   }
   ```
10. **Optional, recommended: a status line that shows how full the context is.** Run `/statusline show the model, context tokens used and the git branch` once; Claude writes it to your personal settings. With 1M-token windows, the number of tokens used tells you more than a percentage.
11. Personal preferences go in `.claude/settings.local.json` and `CLAUDE.local.md` — both gitignored.

### What's in the kit

| File | Purpose |
|---|---|
| `.claude/settings.json` | Plan mode by default; allow rules for routine commands and `gh pr …` commands; **ask** rules for pushes, merges, rebases, resets, merging or closing PRs, and dependency changes (these prompt even in auto mode); **deny** rules for force pushes, deleting the repo, reading `.env` files and editing fixtures; the two hooks |
| `.claude/hooks/session-start.mjs` | At startup, after `/clear` and after compaction: prints branch, uncommitted changes, recent commits and PROGRESS.md "Current state" into Claude's context |
| `.claude/hooks/format-file.mjs` | After every Edit/Write: formats that file with Biome (silent; skips fixtures; does nothing until Biome is installed in S00) |
| `.claude/agents/reviewer.md` | Read-only reviewer: checks a diff against acceptance criteria, architecture rules and test trustworthiness; reports, never edits |
| `.claude/agents/test-writer.md` | Writes failing tests from spec + fixtures before implementation; never touches `src/` |
| `.claude/skills/handoff/` | `/handoff` — verify → reviewer → fix → PROGRESS/DECISIONS → commit → push → PR (the slice PR; from a cloud session, a small PR into the slice branch) → briefing posted on it → CI result |
| `.claude/skills/slice-review/` | `/slice-review <n>` — independent review of the slice's PR in a fresh session, at high effort → `docs/reviews/slice-<n>.md` + a PR review with inline comments |
| `.claude/skills/walkthrough/` | `/walkthrough <area>` — a linear, read-in-order tour of code for you to learn from |
| `.claude/rules/*.md` | Path-scoped instructions that load only when Claude works on matching files: adapters, mobile code, tests |
| `.gitattributes` | Collapses recorded fixtures and the lockfile in PR diffs |
| `apps/server/data/nationality-overrides.json` | The sporting-nationality overrides: Embiid → USA, Towns → DOM |

## The session loop

1. **Orient.** The SessionStart hook injects branch, recent commits and the current state. Set the effort the SESSIONS.md Overview gives for the session (`/effort high` or leave the default medium). The prompt tells Claude to read PROGRESS.md and its SESSIONS.md section, and to *first run the tests*.
2. **Plan** (plan mode, read-only). Claude explores, possibly via the built-in Explore/Plan subagents, and proposes a plan. Check that it names files and interfaces, maps tests to the acceptance criteria, stays inside the scope, justifies any new dependency, and asks instead of guessing. Push back, or `Ctrl+G` to edit the plan in your editor (Neovim on Omarchy).
3. **Approve.** "Yes, and use auto mode" lets Claude work without routine prompts while a classifier screens risky actions; your ask rules still stop it before pushes, merges, resets and new dependencies. While you're learning, "Yes, manually approve edits" lets you watch every change.
4. **Build.** Red/green: failing test → watch it fail → implement → green. Interrupt with `Esc` the moment it drifts. One correction is normal; **after two failed corrections, stop**: exit or `/clear`, then restart with a better prompt that includes what you learned.
5. **Verify.** Claude shows evidence for each acceptance criterion and `pnpm verify` is green. For behavior you can run (CLI, API, app), you can also run the bundled `/verify` after `/run-skill-generator` has recorded how to start the project (S07).
6. **`/handoff`.** Verify → reviewer subagent → fix blockers → re-verify → PROGRESS.md and DECISIONS.md → proposed CLAUDE.md edits (your OK) → commit → push (your OK) → PR → briefing → CI result.
7. **Read and learn.** Read the 3–7 files the briefing lists, in your editor or the PR's **Files changed** tab. Ask "why is it built like this?". `/walkthrough <area>` for anything you didn't follow. `/btw <question>` for a side question that shouldn't enter the conversation history.
8. **End.** Exit. The next task gets a fresh session.

## The slice loop

1. The slice's last session is handed off; its PR is still a draft.
2. New terminal on the slice branch: `claude`, then `/slice-review <n>` (or a cloud session started from the slice branch). Approve the review it presents in plan mode; it commits the review file (locally), posts it to the PR and marks the PR ready.
3. Open the PR (`gh pr view --web`): the summary is in the conversation tab, findings sit inline in **Files changed**. Decide accept, reject or defer for each finding.
4. Run the "Review fixes" template from SESSIONS.md with your decisions, then `/handoff`.
5. When CI is green, merge on GitHub with **Create a merge commit**, then `git switch main && git pull --ff-only`. The next slice starts from there.

## The practices behind this setup

Each practice below comes from Anthropic's Claude Code guidance or engineering write-ups, or from well-known practitioners; the arrow shows where it lives in this kit.

### 1. Context is the scarce resource
- Claude's context window fills quickly and performance degrades as it fills; Anthropic organizes its best-practice guide around managing it. Their context-engineering guidance puts it as finding "the smallest possible set of high-signal tokens" for the outcome: every token spends a limited attention budget ("context rot"). A 1M-token window raises the ceiling but doesn't change that. → One session per unit of work; exit or `/clear` between tasks; watch the token count; stop at a green checkpoint around 200K tokens rather than pushing through a crowded window.
- Keep CLAUDE.md short and universally relevant, and point to detail instead of including it ("progressive disclosure"). Bloated instruction files get partially ignored; for each line ask "would removing this cause a mistake?". → CLAUDE.md is ~75 lines; VISION/SESSIONS/sources are read on demand; `.claude/rules/` files load only for matching paths. Run `/doctor` occasionally — it proposes cuts.
- Push investigation and verbose output into subagents; they return summaries. → planning research, the reviewer, the test-writer.

### 2. Explore → plan → code → commit
- Separate research and planning from implementation; skip the plan only when the diff fits in one sentence. → plan mode by default; the "Small change" template skips it.
- The most useful specs are self-contained: they name the files and interfaces, say what's out of scope, and end with an end-to-end check. → every SESSIONS.md section.
- For fuzzy features, have Claude interview you before writing a spec. → the "Explore an idea" template.

### 3. Give Claude a way to verify its work
- The highest-leverage habit: give Claude a check that returns pass/fail — tests, a build, a script, a screenshot — so it iterates until the check passes instead of stopping when the work merely *looks* done. → `pnpm verify` locally and in CI; fixture tests; `pnpm inspect` and `pnpm recap` for eyeballing data; `pnpm screenshots` so Claude can *see* the UI; bundled `/verify`.
- "Use red/green TDD" and "First run the tests" (Simon Willison) are tiny prompts that carry a lot of discipline; a test only counts once it has been seen failing. → every session prompt, CLAUDE.md.
- Ask for evidence, not assertions. → CLAUDE.md; acceptance criteria demand command output.
- What must happen every time belongs in a deterministic gate, not a sentence. → the format hook, CI as a required check. Optional later: a Stop hook that runs `pnpm verify`, or `/goal` with a condition such as "pnpm verify passes", for longer unattended runs.

### 4. Independent review
- A fresh context reviews better because it isn't biased toward code it just wrote; Anthropic recommends a writer/reviewer split and a subagent review step before calling work done. Their long-running app harness found a separate evaluator, with success criteria agreed before each sprint, beat self-evaluation. → acceptance criteria = the agreed contract; reviewer subagent at every handoff; fresh-session slice review on the PR.
- Calibrate the reviewer. One asked to find gaps will find some even in sound work, and chasing every finding leads to over-engineering. → the reviewer reports only correctness, requirements, architecture rules and test trustworthiness as blocking; style is Biome's job; you decide every slice finding.
- Watch for test gaming: weakened assertions, skipped or deleted tests, mocks of the unit under test, edited fixtures. → CLAUDE.md rule, the fixture deny rule, the reviewer's checklist.

### 5. Guardrails: advisory vs enforced
- CLAUDE.md shapes what Claude tries; permission rules, modes and hooks are what Claude Code enforces. HumanLayer's rule of thumb: never send an LLM to do a linter's job. → Biome via hook; `.env` reads and fixture edits denied; pushes, merges, rebases, resets and new dependencies always ask.
- Permission rules match command text, so they're guardrails, not a security boundary — `git push` written another way may slip past a rule. → branch protection on GitHub is what actually keeps `main` safe.
- Auto mode (the default starting mode in current Claude Code) screens risky actions with a classifier and respects boundaries you state in conversation ("don't push") — but a stated boundary can be lost to compaction, so hard limits belong in deny/ask rules.
- Git is the real undo. Checkpoints (`Esc Esc` / `/rewind`) only cover Claude's own file edits, not shell side effects. → a branch per slice, small commits, pushed after every session.

### 6. Memory lives in the repo
- Anthropic's harness for long-running agents keeps a progress file, a structured feature list and git history so each fresh session can orient itself, works on one feature at a time, and leaves the repo committed and clean. → PROGRESS.md (state + log), SESSIONS.md (the feature list with acceptance criteria), DECISIONS.md, the PR timeline, the SessionStart hook, `/handoff`.
- Prefer a fresh session with a structured handoff over a long, repeatedly compacted one; Anthropic found context resets plus handoff artifacts work better than compaction alone for long jobs. → the sizing rule and the "Resume" template.
- Claude Code's auto memory is Claude's private notebook; project truth belongs in files you can review in git.

### 7. Steering
- Correct early (`Esc`), be specific (reference files with `@`, point at existing patterns, name constraints), and park out-of-scope ideas instead of chasing them. → CLAUDE.md workflow rules, the PROGRESS.md parking lot.
- Prefer CLI tools over adding MCP servers; tool definitions cost context. Anthropic recommends `gh` for GitHub specifically. → `/handoff` and `/slice-review` drive GitHub through `gh`.

### 8. Learning while delegating — your goal
- After every session, read the files the briefing lists; use `/walkthrough` — Willison's "linear walkthrough" pattern — for code you didn't write.
- Write some backend logic yourself where the tests already exist: `isShown` in S02; later candidates are country mapping, game-day math and the scheduler's decision function. Claude then reviews *your* code.
- Read the reviewer's findings, especially the inline ones on the PR; they're a running code-review lesson. Ask "why this design?" and capture the answer in DECISIONS.md.

### 9. Models, effort and usage on Pro
- **Model: Opus 5.5**, the default for Pro in Claude Code. Sonnet 5.5 and Haiku are included too; Fable 5.1 (the strongest) bills usage credits on Pro, which this project doesn't need. The subagents use `model: inherit`, so they run on whatever the session runs.
- **Effort** sets how hard the model thinks per turn: `low`, `medium` (Opus 5.5's default), `high`, `xhigh`, `max`. The SESSIONS.md Overview marks each session; run `/effort high` for the marked ones. The reviewer subagent and `/slice-review` set `effort: high` themselves. For one hard question, put `ultrathink` in the prompt instead of raising effort for the whole session. `xhigh` and `max` cost a lot of usage for rare gains.
- **Context:** Opus 5.5 and Sonnet 5.5 have 1M-token windows, and Claude Code auto-compacts only near the end of one. The window is no reason to let sessions grow: quality and usage both get worse as context fills (§1), hence the ~200K-token budget per session.
- **If usage limits bite:** `/model opusplan` uses Opus in plan mode and Sonnet for the implementation, keeping the strong model where the thinking happens. Move sessions marked *either* to the cloud while the credit lasts (see Cloud sessions).
- The reviewer runs at every handoff, as you chose. Subagents draw on the same usage limits as your session; `/usage` shows where usage goes.
- Spreading sessions over days, as you plan, suits usage limits that reset over time. If a session runs out mid-way, stop at a green checkpoint (or `/handoff`) and continue later with the "Resume" template; PROGRESS.md, git and the PR carry the state.
- **Optional:** Pro includes three one-time free runs of `/code-review ultra`, a cloud review by a fleet of agents that reproduces each finding before reporting it (after the free runs it bills usage credits, typically $5–25 per review). Spend them on the riskiest PRs — slices 1, 2 and 4 — with `/code-review ultra <PR number>`. Very large diffs (by default more than 500 files or 8,000 changed lines) are refused.
- **Optional, later:** the Claude Code GitHub Action can run a project skill on PR events and authenticate with your subscription (a token from `claude setup-token`), which would automate the slice review on GitHub. Wait until the local loop feels routine; the local review can run the app and answer your follow-up questions.

## Anti-patterns to watch for

From Anthropic's list: the kitchen-sink session (unrelated tasks in one context), correcting over and over, the over-specified CLAUDE.md, the trust-then-verify gap, and unscoped "investigate X" requests that read hundreds of files.

Specific to this project:
- Raw upstream JSON leaking out of an adapter, or a "just this once" network call in a test.
- Season stats computed from game logs.
- Dates computed in local time (the Riga-morning bug).
- Silent `catch {}` blocks or defaults that hide upstream changes.
- Fixtures edited by hand; tests that snapshot whole objects instead of asserting specific values.
- Speculative abstractions ("AdapterFactory", plugin systems) for two sources.
- Docs drifting from code — `/handoff` updates PROGRESS and DECISIONS every session; challenge stale lines in CLAUDE.md.
- Merging a PR with a red or pending CI check.

## Cheat sheet

| Keys / command | What it does |
|---|---|
| `Shift+Tab` | Cycle permission modes: Manual → Accept edits → Plan (→ Auto) |
| `/plan <prompt>` | Run one prompt in plan mode |
| `Ctrl+G` | Open the proposed plan in your editor |
| `Esc` · `Esc Esc` or `/rewind` | Interrupt · restore code and/or conversation to a checkpoint |
| `/clear` · `/compact <focus>` · `/context` | Reset context · summarize now · see what fills the window |
| `/btw <question>` | Side question that doesn't enter the history |
| `@path` · `@"reviewer (agent)"` | Attach a file · force a specific subagent |
| `/handoff [notes]` · `/slice-review <n>` · `/walkthrough <area>` | This kit's skills |
| `/code-review` · `/code-review ultra <PR>` | Bundled: quick local bug review · deep cloud review (3 free runs on Pro) |
| `/verify` · `/run-skill-generator` | Bundled: run the app to confirm a change · record how to launch it |
| `gh pr view --web` · `gh pr checks` | Open the current branch's PR in the browser · see its CI status |
| `/rename` · `claude --continue` · `claude --resume` | Name and resume sessions |
| `/permissions` · `/hooks` · `/skills` · `/memory` · `/doctor` | Inspect and tidy the configuration |
| `/model` · `/effort high` · `/usage` | Switch model · set effort (`s` = this session only) · see usage |
| `claude --cloud "<prompt>"` · `claude --teleport` | Start a cloud session on the current branch · pull a cloud session into this terminal |
| `/statusline <description>` | Set up a status line, e.g. showing context tokens used |

## Sources

- Anthropic, *Best practices for Claude Code* — https://code.claude.com/docs/en/best-practices
- Anthropic, Claude Code docs: subagents https://code.claude.com/docs/en/sub-agents · skills https://code.claude.com/docs/en/skills · hooks https://code.claude.com/docs/en/hooks-guide · permission modes https://code.claude.com/docs/en/permission-modes · permissions https://code.claude.com/docs/en/permissions · model configuration https://code.claude.com/docs/en/model-config · cloud sessions https://code.claude.com/docs/en/claude-code-on-the-web · cloud environments https://code.claude.com/docs/en/cloud-environments · GitHub Actions https://code.claude.com/docs/en/github-actions · ultrareview https://code.claude.com/docs/en/ultrareview · feature availability https://code.claude.com/docs/en/feature-availability
- Anthropic Engineering, *Effective context engineering for AI agents* (Sep 2025) — https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- Anthropic Engineering, *Effective harnesses for long-running agents* (Nov 2025) — https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents
- Anthropic Engineering, *Harness design for long-running application development* (Mar 2026) — https://www.anthropic.com/engineering/harness-design-long-running-apps
- Simon Willison, *Agentic Engineering Patterns* (red/green TDD, first run the tests, linear walkthroughs) — https://simonwillison.net/guides/agentic-engineering-patterns/
- HumanLayer, *Writing a good CLAUDE.md* — https://www.humanlayer.dev/blog/writing-a-good-claude-md
- GitHub Docs, *About protected branches* — https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches
- Android Developers, *Configure the app module* (application ID rules) — https://developer.android.com/build/configure-app-module
- Google Play Console Help, *App testing requirements for new personal developer accounts* — https://support.google.com/googleplay/android-developer/answer/14151465
- Expo, *Work with monorepos* — https://docs.expo.dev/guides/monorepos/
- The Omarchy 3 Manual: *Security* (firewall) https://learn.omacom.io/2/the-omarchy-manual/93/security · *Development Tools* (mise) https://learn.omacom.io/2/the-omarchy-manual/62/development-tools

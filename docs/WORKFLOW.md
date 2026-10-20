# Agent workflow

How to build Our Players with Claude Code: the plugins, the agents, how a session flows from spec to merged pull request, and the practices behind the setup. Session-by-session prompts are in `docs/SESSIONS.md`.

## TL;DR

The **superpowers** plugin drives every session: brainstorm the design, write a plan, execute it with fresh helper agents that each get a review, then `/handoff` opens a pull request that the built-in `/code-review` reviews inline. You approve the design and the plan, triage the review comments and merge.

| Step | Runs as | Your part |
|---|---|---|
| **Design** | `superpowers:brainstorming` in your session, with the SESSIONS.md section as input → `docs/superpowers/specs/…` | Answer its questions; approve the design |
| **Plan** | `superpowers:writing-plans` → `docs/superpowers/plans/…`: small tasks, each with its test cycle and commit | Switch to auto mode (`Shift+Tab`), then approve the plan |
| **Build** | `superpowers:subagent-driven-development`: a fresh Opus implementer per task, then a task review (spec + quality), up to five fix rounds | Watch or walk away; `Esc` if it drifts |
| **Red tests for contract code** | the project `test-writer` agent, as the task right after the stubs — only for the selection rule, nationality and the two adapters | — |
| **Final review** | the project `reviewer` agent (acceptance criteria, architecture rules, test trustworthiness, the ledger's deferred findings) over the whole branch; one fix wave follows | — |
| **Your steps** | after the final review, Claude walks you through the session's in-session "You:" and "run by you" steps one at a time; later ones go in the briefing's Next | Run each; paste results |
| **Handoff** | `/handoff`: PROGRESS/DECISIONS, commit, push, PR, briefing, `/code-review high --comment`, CI | Approve the push |
| **PR review** | the built-in `/code-review` posts findings as inline PR comments | Decide accept / reject / defer per comment; run "Review fixes" if needed; merge |

Not used: git worktrees, agent teams, parallel sessions. Sessions depend on each other and your review attention is the bottleneck.

## Plugins

| Plugin | Scope | What it's for | Notes |
|---|---|---|---|
| **superpowers** (`claude-plugins-official`) | project | The workflow above, plus `test-driven-development`, `systematic-debugging`, `verification-before-completion` and `receiving-code-review` | A SessionStart hook loads its rules. CLAUDE.md overrides its skills, and the Workflow section there configures it: spec/plan paths, Opus for every helper agent, no worktrees, `/handoff` instead of `finishing-a-development-branch` (which offers a local merge into `main`). Working files go to `.superpowers/` (gitignored). Optional: `SUPERPOWERS_DISABLE_TELEMETRY=1` turns off the brainstorming visual companion's logo request. |
| **ponytail** (third-party marketplace `DietrichGebert/ponytail`) | project | Keeps generated code small: reuse first, standard library first, no speculative abstractions, `shortcut:` comments for known limits | Level `full` (the default). Avoid `ultra`: it challenges the request, but here the acceptance criteria are the contract. Hooks on SessionStart (rules + a small codebase map), SubagentStart (rules in **every** helper agent) and each prompt. CLAUDE.md says the project's test rules beat its "one small test" guidance. Writes local files only (`~/.claude/.ponytail-active`, `~/.config/ponytail/`); the webhook stays empty. Pinned to tag `v5.3.1` (`ref` in `extraKnownMarketplaces`) because its hooks run in every session; bump the tag on purpose after reading what changed. `/ponytail-debt` lists the `shortcut:` comments. |
| **context7** (`claude-plugins-official`) | project | Current docs for Expo, Expo Router, Drizzle, Hono, zod, TanStack Query, Vitest, Biome | Hosted MCP server with two tools, loaded on demand, so the context cost is small. Anonymous by default; set `CONTEXT7_API_KEY` for higher limits. Nothing for the unofficial NHL/ESPN APIs — that's `docs/sources/`. |
| **typescript-lsp** (`claude-plugins-official`) | user | Type errors and go-to-definition right after each edit, cheaper than re-running `tsc` | Needs `typescript-language-server` on `PATH` (`sudo pacman -S typescript-language-server`). Does nothing until S00 creates TypeScript. Diagnostics are hints; `pnpm verify` stays the gate. |

**Not installed: the `code-review` plugin.** Claude Code already includes `/code-review`, the newer version of the same idea: it reviews a local diff or a PR at an effort level, `--comment` posts inline PR comments, `--fix` applies findings, and `ultra` runs a deep cloud review. The plugin skips draft PRs and would add a second command with the same name.

**Project scope** means `.claude/settings.json` lists the plugin (`enabledPlugins`, and `extraKnownMarketplaces` for ponytail), so cloud sessions and fresh clones get the same setup. typescript-lsp is user scope because it needs a binary on your machine.

## GitHub: one branch and one pull request per session

| When | What happens | Who |
|---|---|---|
| Session start | Claude creates `s<nn>-<slug>` from the latest `main` | Claude |
| `/handoff` | commit → push → PR into `main` → briefing comment → `/code-review high --comment` → CI result | Claude; you approve the push |
| Triage | read the inline comments; accept / reject / defer each | You |
| Fixes | the "Review fixes" template on the same branch, then `/handoff` (pushes to the same PR, no second `/code-review`) | Claude |
| Merge | CI green → **Create a merge commit** on GitHub → `git switch main && git pull --ff-only` | You |

- **The PR is the session's record:** diff, CI status, briefing, review comments, plus the spec and plan files in the diff. `.gitattributes` collapses recorded fixtures and the lockfile.
- **Slices** stay as roadmap groups in SESSIONS.md; they no longer map to a branch or PR.
- **CI** (GitHub Actions, added in S00) runs `pnpm verify` on Node 22 and 24 on every push to a PR. Tests never touch the network, so CI needs no secrets.
- **Merge commits, not squash:** `main` keeps each task's commits, including the red test commits that show the tests came first, while `git log --first-parent main` reads as one entry per session.
- **Claude never merges.** Pushes always ask for your approval; force pushes and repo deletion are denied; branch protection (setup step 4) is the real guard for `main`.
- **Backup:** `origin/slice-0-setup` holds the earlier attempt at S00, S01 and R0 under the old workflow. It stays untouched and won't be merged.

## Cloud sessions

A cloud session runs on an Anthropic-managed VM against your GitHub repo. Start one at claude.ai/code, in the Claude apps, or with `claude --cloud "<prompt>"` (clones your current branch — push first); pull one back with `claude --teleport`.

- **Usage:** cloud sessions share your plan's limits with local ones. If your account shows a cloud-session credit, check `/usage` after the first cloud session before relying on it.
- **What fits:** sessions marked *either* in the SESSIONS.md Overview — the backend sessions S02a–S07. Keep S00, S01, the app sessions and the shipping sessions local (machine setup, phone, live upstream calls, consoles).
- **Branch:** it starts on `claude/…` but can push any branch, so it creates `s<nn>-<slug>` from `origin/main` (CLAUDE.md says so). `/handoff` then works as it does locally.
- **Mode:** pick **Accept edits** in the mode dropdown (there is no Default); switch it to **Auto** *before* you reply with your plan approval, because execution starts on that reply.
- **Resume:** the SDD ledger is gitignored and stays on the VM, so let the plan finish in the cloud before you `claude --teleport` the session (SESSIONS.md → Sizing).
- **What it reads:** CLAUDE.md, `.claude/settings.json` (permissions, hooks, project plugins), skills, agents, rules. Not your `~/.claude`, so no typescript-lsp.
- **Its machine:** Ubuntu, Node 22, pnpm, `gh`; `node_modules` installed fresh by a SessionStart hook (from S00). Network is limited to package registries and GitHub: the NHL/ESPN APIs and context7 are unreachable. Live checks ("run by you") stay on your machine.

**One-time setup:** at claude.ai/code, connect GitHub and install the Claude GitHub App on the repo (or `/web-setup`).

## One-time setup

1. **Tools (Omarchy).** `mise use -g node@24`, then `corepack enable`. `sudo pacman -S github-cli typescript-language-server`, then `gh auth login`. Install Claude Code; put Expo Go on your Android phone. Accounts needed later: Google Play Console (start in S08 — verification takes days), Expo (S11a), a hosting provider (S10a, paid from S10b).
2. **Repo.** Public GitHub repo with this kit on `main` (done). Public is the easy path: free branch protection, GitHub Pages and Actions minutes.
3. **Repo settings** (Settings → General → Pull Requests): allow merge commits; turn on **Automatically delete head branches**.
4. **Protect `main`** (Settings → Branches → rule for `main`): **Require a pull request before merging** with no required approvals, and **Do not allow bypassing the above settings** (otherwise admins — you, and Claude through your `gh` login — skip the rule). After S00's first CI run, add **Require status checks to pass** with `verify (22)` and `verify (24)`.
5. **Firewall, for phone testing.** `sudo ufw allow proto tcp from 192.168.0.0/16 to any port 8081,3001` (adjust the range to your network).
6. **Plugins.** In Claude Code, choosing **project** scope except where noted:
   ```
   /plugin install superpowers@claude-plugins-official
   /plugin install context7@claude-plugins-official
   /plugin install typescript-lsp@claude-plugins-official   (user scope)
   /plugin marketplace add DietrichGebert/ponytail@v5.3.1
   /plugin install ponytail@ponytail
   ```
   On a fresh clone the project plugins are already listed in `.claude/settings.json`; Claude Code should offer to install them when you trust the folder (otherwise run the commands above).
7. **Start Claude Code** in the repo and accept the trust prompt (project allow rules apply only after that).
8. **Check the setup:** `/plugin` (superpowers, context7 and ponytail from the project, plus typescript-lsp from your user settings; a fresh clone or cloud session shows only the three project ones), `/skills` (handoff, walkthrough, the superpowers and ponytail skills), `/hooks` (the kit's SessionStart and PostToolUse hooks plus the plugins'), `/mcp` (context7 connected), `/permissions`, and "which custom subagents are available?" (reviewer, test-writer).
9. Sessions start in **default** mode (`permissions.defaultMode`): edits ask until you `Shift+Tab` to auto, right before you approve the plan. In the VS Code extension, set `claudeCode.initialPermissionMode` to `default`.
10. **Optional:** a desktop notification when Claude needs you — a `Notification` hook running `notify-send` in `~/.claude/settings.json`; a status line showing context tokens (`/statusline …`). Both are already set up on your machine.
11. Personal preferences go in `.claude/settings.local.json` and `CLAUDE.local.md` — both gitignored.

### What's in the kit

| File | Purpose |
|---|---|
| `.claude/settings.json` | Default mode; allow rules for routine commands and `gh pr …`; **ask** rules for pushes, merges, rebases, resets, merging or closing PRs and dependency changes (these prompt even in auto mode); **deny** rules for force pushes, deleting the repo, reading `.env` files and editing fixtures; the two hooks; the project plugins |
| `.claude/hooks/session-start.mjs` | At startup, after `/clear` and after compaction: branch, uncommitted changes, recent commits and PROGRESS.md "Current state" |
| `.claude/hooks/format-file.mjs` | After every Edit/Write: formats the file with Biome (silent; skips fixtures; inactive until S00 installs Biome) |
| `.claude/agents/reviewer.md` | Read-only final review: acceptance criteria, architecture rules, test trustworthiness; reports, never edits |
| `.claude/agents/test-writer.md` | Writes failing tests from spec + fixtures before the implementation; never touches `src/` |
| `.claude/skills/handoff/` | `/handoff` — verify → final review (if not already run) → PROGRESS/DECISIONS → commit → push → PR → briefing → `/code-review` → CI |
| `.claude/skills/walkthrough/` | `/walkthrough <area>` — a linear, read-in-order tour of code for you to learn from |
| `.claude/rules/*.md` | Path-scoped instructions that load when Claude works on matching files: adapters, mobile code, tests |
| `.gitattributes` | Collapses recorded fixtures and the lockfile in PR diffs |
| `apps/server/data/nationality-overrides.json` | The sporting-nationality overrides: Embiid → USA, Towns → DOM |

## The session loop

The steps live in one place, SESSIONS.md → "How to run a session"; the TL;DR above summarizes them. Two habits on top:
- **After two failed corrections, stop:** `/clear` and restart with a better prompt.
- **Learn:** `/walkthrough <area>` for anything you didn't follow; `/btw <question>` for side questions.

## The practices behind this setup

Each practice comes from Anthropic's Claude Code guidance or engineering write-ups, or from well-known practitioners; the arrow shows where it lives in this kit.

### 1. Context is the scarce resource
- Performance degrades as the context fills ("context rot"); the goal is "the smallest possible set of high-signal tokens". A 1M window raises the ceiling but doesn't change that. → One session per unit of work; stop at a task boundary around 200K tokens. Helper agents keep implementation detail out of your session's context.
- Keep CLAUDE.md short and point to detail ("progressive disclosure"). → CLAUDE.md ~85 lines; VISION/SESSIONS/sources on demand; `.claude/rules/` per path; context7 tools load on demand.

### 2. Explore → plan → code → commit
- Separate design and planning from implementation. → brainstorming → writing-plans → execution, with your approval between each; the "Small change" template skips it.
- Self-contained specs name files and interfaces, say what's out of scope and end with an end-to-end check. → every SESSIONS.md section, refined into a design doc per session.

### 3. Give Claude a way to verify its work
- A check that returns pass/fail beats "looks done". → `pnpm verify` locally and in CI; fixture tests; `pnpm inspect`, `pnpm recap`, `pnpm screenshots`; superpowers' `verification-before-completion`; LSP diagnostics after each edit.
- Red/green TDD: a test counts only once it has been seen failing. → superpowers' `test-driven-development`, CLAUDE.md, the test-writer's red commits.

### 4. Independent review
- A fresh context reviews better than the author; agree success criteria before the work. → acceptance criteria as the contract; a task review per task; the `reviewer` agent over the branch; `/code-review` on the PR.
- Calibrate reviewers: chasing every finding leads to over-engineering. → the reviewer agent's Critical/Important/Minor scale (only Critical and Important get fixed; correctness, requirements, architecture rules and test trustworthiness); style is Biome's job; ponytail pushes back on bloat; you decide every PR finding.
- Watch for test gaming: weakened assertions, skipped tests, mocks of the unit under test, edited fixtures. → CLAUDE.md, the fixture deny rule, the reviewer's checklist.

### 5. Guardrails: advisory vs enforced
- CLAUDE.md and skills shape what Claude tries; permission rules, modes and hooks are enforced. → Biome via hook; `.env` reads and fixture edits denied; pushes, merges, resets and new dependencies always ask, even in auto mode.
- Permission rules match command text, so they're guardrails, not a security boundary. → branch protection keeps `main` safe.
- Git is the real undo. → a branch per session, a commit per task, pushed at every handoff.

### 6. Memory lives in the repo
- A progress file, a feature list and git history let each fresh session orient itself. → PROGRESS.md, SESSIONS.md, DECISIONS.md, the spec and plan files, the SessionStart hook, `/handoff`.
- Prefer a fresh session with a structured handoff over a long, compacted one. → the sizing rule; the "Resume" template re-invokes subagent-driven development, which picks up from its ledger.

### 7. Steering and tools
- Correct early (`Esc`), be specific, park out-of-scope ideas. → CLAUDE.md, the PROGRESS.md parking lot.
- Tool definitions cost context; prefer CLIs where they exist. → `gh` for GitHub. The one MCP server, context7, earns its place because Expo and friends change faster than model training, and its two tools load on demand.

### 8. Learning while delegating
- Read the briefing's files; `/walkthrough` for code you didn't write; the `/code-review` comments are a running code-review lesson.
- Optional practice after a session merges: rewrite a pure function against its existing tests (`isShown`, country mapping, game-day math, the scheduler's decision function) on a `chore-` branch with the "Small change" template.

### 9. Models, effort and usage on Pro
- **Model: Opus 5.5** for your session and for every helper agent (CLAUDE.md overrides superpowers' default of cheaper models for mechanical tasks). The project agents use `model: inherit`. Fable 5.1 bills usage credits on Pro; not needed.
- **Usage:** subagent-driven development starts a fresh context per task and per review — roughly 15–25 agent runs per session, about 2–4× the usage of building in one context. Short sessions spread over days protect the 5-hour window; the weekly cap is the one to watch in the larger sessions (S02a, S04a, S04b, S05, S09). **Check `/usage` after the first such session.** If it bites: move implementers to Sonnet (one line in CLAUDE.md; reviewers stay on Opus), or use `superpowers:executing-plans` for that session.
- **Effort:** `low` … `max`; the Overview gives each session's level. A typed `/effort <level>` is saved as your default; `/effort` alone opens a slider where `s` applies it to this session only. The reviewer agent pins `effort: high`. `ultrathink` in a prompt raises effort for one question.
- **Context:** stop around 200K tokens even with a 1M window; quality and usage degrade first.
- **`/code-review ultra`:** Pro includes three free runs of the deep cloud review (later billed as usage credits). Spend them on the riskiest PRs — S02a, S04a, S05, S09 — with `/code-review ultra <PR number>`. Diffs over ~8,000 changed lines are refused.

## Anti-patterns to watch for

From Anthropic's list: the kitchen-sink session, correcting over and over, the over-specified CLAUDE.md, the trust-then-verify gap, unscoped "investigate X" requests.

Specific to this project:
- Raw upstream JSON leaking out of an adapter, or a "just this once" network call in a test.
- Season stats computed from game logs.
- Dates computed in local time (the Riga-morning bug).
- Silent `catch {}` blocks or defaults that hide upstream changes.
- Fixtures edited by hand; tests that snapshot whole objects instead of asserting specific values.
- Speculative abstractions ("AdapterFactory", plugin systems) for two sources.
- Approving a plan without reading it — the plan is where hands-off work goes wrong cheaply.
- Docs drifting from code — `/handoff` updates PROGRESS and DECISIONS every session.
- Merging a PR with a red or pending CI check.

## Cheat sheet

| Keys / command | What it does |
|---|---|
| `Shift+Tab` | Cycle permission modes: Default → Accept edits → Plan → Auto |
| `Esc` · `Esc Esc` or `/rewind` | Interrupt · restore code and/or conversation to a checkpoint |
| `/clear` · `/compact <focus>` · `/context` | Reset context · summarize now · see what fills the window |
| `/btw <question>` | Side question that doesn't enter the history |
| `@path` · `@"reviewer (agent)"` | Attach a file · force a specific subagent |
| `/handoff [notes]` · `/walkthrough <area>` | This kit's skills |
| `/code-review high <PR> --comment` · `/code-review ultra <PR>` | Built-in: review a PR with inline comments · deep cloud review (3 free runs on Pro) |
| `/simplify` · `/ponytail-review` | Built-in cleanup pass on the diff · ponytail's review of a change |
| `/ponytail [lite\|full\|ultra\|off]` · `/ponytail-debt` | Change ponytail's level · list `shortcut:` comments |
| "use superpowers:systematic-debugging" | Ask for a superpowers skill by name when it didn't start on its own |
| `/plugin` · `/reload-plugins` · `/mcp` | Manage plugins · reload after changes · MCP status (context7) |
| `/verify` · `/run-skill-generator` | Built-in: run the app to confirm a change · record how to launch it |
| `gh pr view --web` · `gh pr checks` | Open the branch's PR · see its CI status |
| `/rename` · `claude --continue` · `claude --resume` | Name and resume sessions |
| `/permissions` · `/hooks` · `/skills` · `/memory` · `/doctor` | Inspect and tidy the configuration |
| `/model` · `/effort high` · `/usage` | Switch model · set effort (saved as default) · see usage |
| `claude --cloud "<prompt>"` · `claude --teleport` | Start a cloud session on the current branch · pull one into this terminal |

## Sources

- Anthropic, *Best practices for Claude Code* — https://code.claude.com/docs/en/best-practices
- Anthropic, Claude Code docs: subagents https://code.claude.com/docs/en/sub-agents · skills https://code.claude.com/docs/en/skills · plugins https://code.claude.com/docs/en/plugins · hooks https://code.claude.com/docs/en/hooks-guide · permission modes https://code.claude.com/docs/en/permission-modes · permissions https://code.claude.com/docs/en/permissions · model configuration https://code.claude.com/docs/en/model-config · cloud sessions https://code.claude.com/docs/en/claude-code-on-the-web · ultrareview https://code.claude.com/docs/en/ultrareview
- Plugins: superpowers https://github.com/obra/superpowers · ponytail https://github.com/DietrichGebert/ponytail · official marketplace (context7, typescript-lsp) https://github.com/anthropics/claude-plugins-official
- Anthropic Engineering, *Effective context engineering for AI agents* (Sep 2025) — https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- Anthropic Engineering, *Effective harnesses for long-running agents* (Nov 2025) — https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents
- Anthropic Engineering, *Harness design for long-running application development* (Mar 2026) — https://www.anthropic.com/engineering/harness-design-long-running-apps
- Simon Willison, *Agentic Engineering Patterns* — https://simonwillison.net/guides/agentic-engineering-patterns/
- HumanLayer, *Writing a good CLAUDE.md* — https://www.humanlayer.dev/blog/writing-a-good-claude-md
- GitHub Docs, *About protected branches* — https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches
- Android Developers, *Configure the app module* — https://developer.android.com/build/configure-app-module
- Google Play Console Help, *App testing requirements for new personal developer accounts* — https://support.google.com/googleplay/android-developer/answer/14151465
- Expo, *Work with monorepos* — https://docs.expo.dev/guides/monorepos/
- The Omarchy 3 Manual: *Security* https://learn.omacom.io/2/the-omarchy-manual/93/security · *Development Tools* https://learn.omacom.io/2/the-omarchy-manual/62/development-tools

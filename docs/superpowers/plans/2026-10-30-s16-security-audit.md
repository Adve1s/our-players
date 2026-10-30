# S16 — Security fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix every "fix now" finding of the S16 audit that lives in the repo, write `docs/SECURITY-CHECKS.md`, and re-run the scanners.

**Architecture:** Mostly configuration: Claude Code permissions, GitHub workflows, pnpm workspace settings, the Dockerfile, `app.json`, a Cloudflare `_headers` file. One code change: Hono's built-in `secureHeaders` middleware on the API. Host, console and deploy steps are owner steps after the final review and are not tasks here.

**Tech Stack:** Hono 4 (`hono/secure-headers`), Vitest, pnpm 12 workspace settings, GitHub Actions, Cloudflare Workers static assets (`_headers`), Expo config, Docker/podman.

**Spec:** `docs/superpowers/specs/2026-10-30-s16-security-audit.md` (the audit report; finding IDs below refer to its table).

## Global Constraints

From `docs/SESSIONS.md` §S16, verbatim:

**Out of scope:** new features; load or DoS testing against production (one small shared host; the rate limit is checked with a few requests, not a flood); scanning or probing anything we don't own (NHL, ESPN, Cloudflare's or Linode's infrastructure); certificate pinning (no secrets travel, and pinning breaks on Let's Encrypt renewals); accounts, auth and encryption at rest (there are no accounts or personal data); the paid `claude-code-security-review` GitHub Action (needs a billed API key) and the `security-guidance` plugin (an LLM review on every turn; too much usage on Pro); the visual overhaul (S17).

**Acceptance criteria**
1. Every scanner in step 1 ran on the session's start commit; command and summarized result are in the design doc. No secret value is ever printed, pasted or committed — file, line and kind only.
2. A `claude-security` codebase scan ran; its severity counts and Coverage section are summarized in the design doc; the report folder is not committed.
3. Every manual-checklist item has evidence (command and output) or is marked "you confirm" and confirmed by you.
4. Every finding has a severity and a decision you agreed to; fixed ones name their commit, accepted ones their reason, parked ones a PROGRESS.md parking-lot line.
5. No Critical or High finding is left unfixed, unless the fix is outside the repo, the host and the consoles you can reach — then it's parked with a date.
6. After the fixes the scanners re-run without the fixed findings; the API is deployed from the session branch and the live checks repeated against production (pasted). Web-only fixes deploy on merge, so their live re-check, and redeploying the API from `main` after the merge, go to the briefing's Next.
7. `docs/SECURITY-CHECKS.md` written; the reviewer walks through it against the repo.
8. `pnpm verify` green.

Project-wide, for every task:
- Never print, paste or commit a secret value (file, line and kind only). Never `Read` a real `.env`.
- New runtime/dev dependency: only `wrangler` (exact `4.151.3`, devDependency of `apps/mobile`), owner-approved (C4). Nothing else.
- `pnpm verify` green before each commit (on this laptop: `pnpm typecheck && pnpm lint && pnpm test --maxWorkers=2`). Conventional Commits, ending with the attribution line from the session.
- Never run `deploy/deploy.sh`, ssh to the host, or change GitHub/Cloudflare settings in a task: those are owner steps after the final review.
- Comments explain why; a known limit gets `shortcut: <limit>, <when to upgrade>`.

## Review Focus

1. **API error paths without the new headers:** a 400, 404, 429 or 500 response must carry `Strict-Transport-Security` and `X-Content-Type-Options` like a 200 does (Task 1 tests 400, 404, 429 and `/health`).
2. **`secureHeaders`' default `Cross-Origin-Resource-Policy: same-origin` breaking the web app's cross-origin API calls:** the web app calls the API from another origin; `pnpm screenshots` (web build on one port, API on 3101) must still render data (Task 1, step 5).
3. **The CSP blocking what react-native-web injects at runtime** (inline `<style>` tags, `data:` images/fonts) or the API call: the built site under `wrangler dev` must show no CSP violation in the console (Task 3, step 5).
4. **The API image without npm/corepack failing to run scripts:** `docker compose run --rm api tsx scripts/…` and the compose health check (`node -e fetch(…)`) must still work (Task 5, step 3).
5. **`/handoff` losing its unattended gh calls:** after Task 2, `gh pr create/edit/comment` must prompt (ask), not fail; the skill's text still names them (Task 2, step 4).

---

### Task 1: Security headers on every API response (H1)

**Files:**
- Create: `apps/server/test/api-security-headers.test.ts`
- Modify: `apps/server/src/api/app.ts` (in `createApp`, before the request logger)

**Interfaces:**
- Consumes: `createApp(deps: ApiDeps): Hono` (unchanged signature), `createTestDb()` from `test/db.ts`, `createLogger` from `src/jobs/runner`.
- Produces: nothing new for later tasks.

- [ ] **Step 1: Write the failing test** (style of `test/api-cors.test.ts`: `handle = await createTestDb()` in `beforeAll`, `app = createApp({ db: handle.db, now, log: createLogger(() => {}) })`, `handle.close()` in `afterAll`)

```ts
describe('security headers on API responses', () => {
  it.each([
    ['a 200 from /v1', '/v1/meta'],
    ['/health', '/health'],
    ['a 400', '/v1/days/2026-13-45'],
    ['a 404', '/v1/nope'],
  ])('%s carries HSTS and nosniff', async (_name, path) => {
    const res = await app.request(path);
    expect(res.headers.get('strict-transport-security')).toBe('max-age=15552000; includeSubDomains');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('a 429 over the rate limit carries HSTS and nosniff', async () => {
    // A second app on the same test DB with rateLimitPerMinute: 2 and a fixed clock: the third request is over.
    const limited = createApp({ db: handle.db, now: () => new Date('2026-03-24T06:00:00Z'), log: createLogger(() => {}), rateLimitPerMinute: 2 });
    await limited.request('/v1/meta');
    await limited.request('/v1/meta');
    const res = await limited.request('/v1/meta');
    expect(res.status).toBe(429);
    expect(res.headers.get('strict-transport-security')).toBe('max-age=15552000; includeSubDomains');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm test api-security-headers`
Expected: FAIL, `expected null to be 'max-age=15552000; includeSubDomains'`.

- [ ] **Step 3: Add `app.use(secureHeaders())`** from `hono/secure-headers` as the first middleware in `createApp`, with Hono's defaults (HSTS `max-age=15552000; includeSubDomains`, nosniff, `X-Frame-Options`, `Referrer-Policy: no-referrer`, …). One-line why comment (Caddy adds none; S16 H1).

- [ ] **Step 4: Run the test and the API suite**

Run: `pnpm test apps/server/test/api`
Expected: all PASS (CORS, rate-limit and the new file).

- [ ] **Step 5: Check the web app still reads the API cross-origin**

Run: `PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium pnpm screenshots`, then open two of `apps/mobile/.screenshots/` (Today and a player page).
Expected: both show players' lines (data from the API on :3101), no error card. If the API calls fail because of `Cross-Origin-Resource-Policy`, pass `crossOriginResourcePolicy: false` and record a `Ruling:`.

- [ ] **Step 6: Commit** — `fix(api): send security headers (HSTS, nosniff) on every response`

### Task 2: Claude Code permissions and plugin pin (A1, A2, A3, T1, T2)

**Files:**
- Modify: `.claude/settings.json`
- Modify: `.claude/skills/handoff/SKILL.md:6` (frontmatter `allowed-tools`)
- Modify: `docs/WORKFLOW.md` (one line where permissions/plugins are described: gh writes ask, why)

**Interfaces:** none.

- [ ] **Step 1: Narrow the allow list.** In `permissions.allow`: replace `Bash(git fetch *)` with `Bash(git fetch)` and `Bash(git fetch origin)`; replace `Bash(git pull --ff-only *)` with `Bash(git pull --ff-only)`; remove `Bash(gh pr create *)`, `Bash(gh pr edit *)`, `Bash(gh pr comment *)` and the three `Bash(gh api repos/*/pulls/*/comments…)` rules. Add those six to `permissions.ask` unchanged (so they prompt instead of being refused). Keep the read-only `gh pr view/diff/checks/list` and `gh run list/view` rules.
- [ ] **Step 2: Deny nested env files.** Add `Read(**/.env)` and `Read(**/.env.*)` to `permissions.deny` next to the existing `.env` rules.
- [ ] **Step 3: Pin ponytail by commit.** `extraKnownMarketplaces.ponytail.source.ref`: `"6f1c2bfff0c837d268929a7c4e490918eb4fab29"` (what tag `v5.3.1` points to; a tag can be moved).
- [ ] **Step 4: Handoff skill.** Remove `Bash(gh pr create *) Bash(gh pr edit *) Bash(gh pr comment *)` from its `allowed-tools`; the body still tells the agent to run them (they now ask).
- [ ] **Step 5: Check.** `node -e 'JSON.parse(require("fs").readFileSync(".claude/settings.json"))'` exits 0. Create `docs/.env` containing `DUMMY=1`, try the Read tool on it: expected "denied by permission settings"; delete the file. `git diff --stat` touches only the three files.
- [ ] **Step 6: Commit** — `fix(claude): ask before gh writes, exact git fetch/pull rules, pin ponytail by SHA`

### Task 3: Supply chain in CI and the web deploy (C1, C2, C3, C4)

**Files:**
- Modify: `apps/mobile/package.json`, `pnpm-lock.yaml` (via `pnpm add`)
- Modify: `.github/workflows/ci.yml`, `.github/workflows/deploy-web.yml`
- Modify: `docs/DEPLOY.md` §10.1 step 3, §10.3 (wrangler commands)

**Interfaces:**
- Produces: `wrangler` resolvable as `pnpm --filter @our-players/mobile exec wrangler` (Task 4 uses it for `wrangler dev`).

- [ ] **Step 1: Add wrangler, locked.** `pnpm --filter @our-players/mobile add -D --save-exact wrangler@4.151.3` (owner-approved; it prompts). If pnpm reports ignored build scripts (e.g. `workerd`, `sharp`), add each to `allowBuilds` in `pnpm-workspace.yaml` as `false` with a one-line comment; turning one to `true` is a stop-and-ask.
- [ ] **Step 2: Pin actions by commit, drop persisted credentials.** In both workflows: `actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1` with `persist-credentials: false`; `actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0`.
- [ ] **Step 3: Deploy job.** In `deploy-web.yml`: `environment: production` on the `deploy` job (secrets move there in an owner step; keep the `if: main` guard); the deploy step becomes `pnpm exec wrangler deploy` (working directory `apps/mobile`); replace the `wrangler-action`/dlx comment with the new why (lockfile pins wrangler's whole tree; the job holds the Cloudflare token).
- [ ] **Step 4: Docs.** DEPLOY.md §10.1 step 3 and §10.3: `pnpm dlx wrangler@4.151.3 …` → `pnpm exec wrangler …` (run in `apps/mobile`); §10.1 step 2: the two secrets are set on the `production` environment (`gh secret set NAME --env production`), created with deployment branches limited to `main`.
- [ ] **Step 5: Check.** `zizmor .github/workflows` → no `unpinned-uses`, `artipacked` or `secrets-outside-env`. `pnpm --filter @our-players/mobile exec wrangler --version` prints `4.151.3`. `pnpm install --frozen-lockfile` succeeds.
- [ ] **Step 6: Commit** — `fix(ci): pin actions by SHA, lock wrangler, deploy from the production environment`

### Task 4: Web security headers (W1)

**Files:**
- Create: `apps/mobile/public/_headers`
- Create: `apps/mobile/test/web-headers.test.ts`

**Interfaces:**
- Consumes: `wrangler` from Task 3.

- [ ] **Step 1: Write the failing test.** Read `apps/mobile/public/_headers` (path from the test file's `import.meta.url`), parse the `/*` block (`Name: value` lines, indented), and assert exact values:

```ts
it.each([
  ['Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src https://api.ourplayers.adveis.dev; manifest-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"],
  ['X-Content-Type-Options', 'nosniff'],
  ['Referrer-Policy', 'no-referrer'],
  ['X-Frame-Options', 'DENY'],
  ['Strict-Transport-Security', 'max-age=31536000'],
  ['Permissions-Policy', 'camera=(), microphone=(), geolocation=()'],
])('every page sends %s', (name, value) => { expect(headers['/*']?.[name]).toBe(value); });
```

- [ ] **Step 2: Run it and watch it fail** — `pnpm test web-headers` → FAIL with ENOENT on `_headers`.
- [ ] **Step 3: Write `apps/mobile/public/_headers`** with the `/*` rule and those six headers, plus a `#` comment: why (S16 W1), and `shortcut: connect-src names the production API, a different WEB_API_URL needs this line changed`.
- [ ] **Step 4: Run the test** → PASS.
- [ ] **Step 5: Check the built site under the headers.** `EXPO_PUBLIC_API_URL=https://api.ourplayers.adveis.dev pnpm build:web`; `ls apps/mobile/dist/_headers` exists; in `apps/mobile`, `pnpm exec wrangler dev --port 8788` (background); `curl -sI http://localhost:8788/player/nhl-8478402` shows the CSP and the other five headers; load `http://localhost:8788/` and `/player/nhl-8478402` in headless Chromium (Playwright with `/usr/bin/chromium`, a throwaway script in the scratchpad), collect console messages. Expected: the app renders (tab bar visible) and **no** console message contains `Content Security Policy`. (The API calls fail on CORS from `localhost`, which shows they were attempted, not blocked by CSP.) Stop `wrangler dev`.
- [ ] **Step 6: Commit** — `fix(web): security headers for the site (CSP, nosniff, frame-ancestors, HSTS)`

### Task 5: API image base and refresh (I1)

**Files:**
- Modify: `Dockerfile`, `deploy/deploy.sh:39`

- [ ] **Step 1: Dockerfile.** Both stages `FROM node:24-trixie-slim`. In the runtime stage, before `USER node`: `RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack` with a why comment (the API runs tsx from node_modules; npm's bundled packages were all of the image's Node CVEs).
- [ ] **Step 2: deploy.sh** builds with `"$tool" build --pull -t "$image" .` (docker: always pull; podman: `--pull` alone means always) so each deploy takes the latest base; why comment.
- [ ] **Step 3: Check the image.** `podman build --pull -t our-players-api:scan .`; `podman run --rm our-players-api:scan tsx -e "console.log('tsx ok')"` prints `tsx ok`; `podman run --rm --entrypoint node our-players-api:scan -e "fetch('http://127.0.0.1:1').catch(()=>console.log('fetch ok'))"` prints `fetch ok`; `podman run --rm --entrypoint sh our-players-api:scan -c 'command -v npm || echo no-npm'` prints `no-npm`; `podman save -o <scratchpad>/api-scan.tar our-players-api:scan && trivy image --quiet --input <scratchpad>/api-scan.tar --scanners vuln --severity CRITICAL,HIGH` → no CRITICAL, no `node-pkg` rows.
- [ ] **Step 4: Commit** — `fix(deploy): API image on Debian 13 without npm, pull the base on every deploy`

### Task 6: pnpm policy, the weekly audit, node-forge (P1, D1, T3)

**Files:**
- Modify: `pnpm-workspace.yaml`, `pnpm-lock.yaml`
- Create: `.github/workflows/audit.yml`

- [ ] **Step 1: `pnpm-workspace.yaml`.** Add `minimumReleaseAge: 1440` (comment: pnpm 12's default, explicit so a pnpm change can't drop it); `overrides: { "node-forge": ">=1.4.1" }` (comment: GHSA-86w9-cpqp-85rv, in @expo/cli); and

```yaml
audit:
  level: high
  ignore:
    # Accepted in S16 (D1): build/dev tools only, no path from a user; fixes need a major bump inside Expo/drizzle-kit. Re-check on each Expo SDK upgrade.
    - GHSA-mrhx-c7xc-m3w5 # zod 3 in @expo/cli
    - GHSA-w5hq-g745-h8pq # uuid 7 in @expo/config-plugins > xcode
    - GHSA-67mh-4wv8-2f99 # esbuild 0.18 in drizzle-kit (dev server only)
    - GHSA-gcqx-w48m-w2h4 # deepmerge in @expo/config, no patched version
```
Then `pnpm install`.
- [ ] **Step 2: Check.** `pnpm why node-forge` shows ≥ 1.4.1; `pnpm audit` exits 0 and lists nothing above the ignore list; `pnpm build:web` still succeeds (node-forge is in @expo/cli).
- [ ] **Step 3: `.github/workflows/audit.yml`.** Name `Audit`; `on: schedule: - cron: '17 6 * * 1'` and `workflow_dispatch`; `permissions: contents: read`; one job `audit` on `ubuntu-latest`: checkout (same SHA pin, `persist-credentials: false`), setup-node (same SHA pin, `node-version-file: .tool-versions`), `corepack enable`, `pnpm audit`. Top comment: why (Dependabot can't read the pnpm 12 lockfile, S16 P1; a red run emails the owner). `zizmor .github/workflows` shows no new finding above info.
- [ ] **Step 4: Commit** — `fix(deps): weekly pnpm audit, patched node-forge, explicit minimumReleaseAge`

### Task 7: Android permissions (AN1)

**Files:**
- Modify: `apps/mobile/app.json`

- [ ] **Step 1:** Under `expo.android`: `"permissions": ["android.permission.INTERNET"]` and `"blockedPermissions": ["android.permission.SYSTEM_ALERT_WINDOW", "android.permission.VIBRATE", "android.permission.READ_EXTERNAL_STORAGE", "android.permission.WRITE_EXTERNAL_STORAGE"]`.
- [ ] **Step 2: Check.** In `apps/mobile`: `npx expo config --type introspect --json` → the manifest's `uses-permission` names are exactly `INTERNET` (blocked ones absent or marked `tools:node="remove"`). Paste the line.
- [ ] **Step 3: Commit** — `fix(android): request only INTERNET`

### Task 8: SECURITY-CHECKS.md and the docs

**Files:**
- Create: `docs/SECURITY-CHECKS.md`
- Modify: `docs/DEPLOY.md` (§2.3 sshd lines; §7 a pointer to SECURITY-CHECKS.md), `docs/DECISIONS.md` (D-064), `docs/PROGRESS.md` (parking lot: X1), `CLAUDE.md` (Repo map/Commands: one line pointing to `docs/SECURITY-CHECKS.md`), `docs/superpowers/specs/2026-10-30-s16-security-audit.md` (a **Commit** column filled from `git log`)

- [ ] **Step 1: `docs/SECURITY-CHECKS.md`.** Sections: *When* (before S11b and before S15; after adding or upgrading a dependency; monthly: `pnpm audit`, `trivy image`, host updates and image pulls; the weekly Audit workflow); *Scanners* (the exact commands from the audit report's Step 1 table, with the podman fallback and "never run deploy.sh for a scan"); *Claude Security* (when a codebase scan is worth its cost; scan changes on PRs touching `apps/server/src/api`, `deploy/`, `.github/workflows/`); *Manual checklist* (every item of the report's Step 3 as a command plus the expected result, ssh commands marked read-only); *Accepted findings* (D1, I1 remainder, X2, X3 with reasons, so a re-run knows what is expected); *Monthly host routine* (`apt list --upgradable`, reboot-required, `docker compose pull db caddy && docker compose up -d --wait`). No secret values, `<server-ip>` placeholder as in DEPLOY.md.
- [ ] **Step 2: DEPLOY.md §2.3:** the keys-only file also sets `PermitRootLogin prohibit-password` and `X11Forwarding no`, and the check greps `permitrootlogin` and `x11forwarding` too.
- [ ] **Step 3: D-064** — "Security audit (S16): fixes and accepted risks": one paragraph listing what was fixed (by ID), what was accepted and why (D1, I1 remainder, X2, X3), Dependabot's blind spot and the weekly audit, `ask` for gh writes; alternatives (deny patterns, a dependency-submission action).
- [ ] **Step 4: PROGRESS.md parking lot:** `- (2026-10-31, S16 X1) Turn on 2FA for the Expo account when it is created in S11a.`
- [ ] **Step 5: Spec Commit column** from `git log --oneline` (findings fixed by owner steps say "owner step" until done).
- [ ] **Step 6: Check.** `pnpm verify` green. Every command in SECURITY-CHECKS.md exists in the repo or in the tools list (`pnpm audit`, `trivy`, `gitleaks`, `zizmor`, `podman`/`docker`, `nmap`, `curl`, `gh`).
- [ ] **Step 7: Commit** — `docs: SECURITY-CHECKS.md, D-064, deploy hardening notes`

### Task 9: Re-run the scanners (criterion 6)

No code. Run each step-1 scanner again on the branch head and append a **Re-run** table to the audit report: `pnpm audit` (exit 0), `trivy fs` (no node-forge), `gitleaks git --redact`, `zizmor .github/workflows` (no unpinned-uses, artipacked, secrets-outside-env), `trivy image` on a fresh podman build (no CRITICAL, no node-pkg). Commit — `docs(s16): scanner re-run after fixes`.

## Owner steps after the final review (not tasks; in this order, one at a time)

1. Console: create GitHub environment `production` (deployment branches: `main`), set `CLOUDFLARE_API_TOKEN` (roll it in Cloudflare first, since a secret can't be read back) and `CLOUDFLARE_ACCOUNT_ID` on it; delete the two repo-level secrets after the first green deploy from the environment (briefing's Next). (C2)
2. Console via `gh api` with OK: fork-PR approval → all external contributors (G1); dismiss CodeQL alert 1 as "used in tests" (Q1).
3. Host with OK: sshd `PermitRootLogin prohibit-password`, `X11Forwarding no`, checked from a second session (S1); `docker compose pull db caddy && docker compose up -d --wait` (I2).
4. Deploy the API from this branch (`deploy/deploy.sh root@<server-ip>`), then repeat the live API checks (headers, TLS, CORS, odd input, rate limit, log privacy) and paste them.
5. Your `~/.claude/settings.json`: ponytail marketplace `ref` → the same SHA (T1).
6. Briefing's Next (after merge): the web live re-check (`curl -sI`, Observatory, headless load), "Require actions pinned to a full-length SHA" in repo settings (C1), redeploy the API from `main`, delete the repo-level Cloudflare secrets.

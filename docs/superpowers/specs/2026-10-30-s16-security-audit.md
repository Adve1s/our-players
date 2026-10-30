# S16 — Security audit + fixes: audit report and design

Session S16 (`docs/SESSIONS.md` §S16, D-062). Branch `s16-security-audit`, audited at start commit `b2e66ca` (2026-10-30/31). This document is the audit report: what ran, the evidence, and every finding with a proposed decision. The owner's decisions go in the **Decision** column; the plan builds only the "fix now" rows.

## Contract (verbatim from SESSIONS.md §S16)

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

Baseline before anything ran: `pnpm typecheck && pnpm lint && pnpm test --maxWorkers=2` green, 72 files, 1471 tests.

## Headline

Nothing Critical or High is reachable by an outside attacker. The API, the jobs, the adapters, the app and the host held up: input validation, CORS, the rate limit, TLS, ports, log privacy and file permissions all check out. The real risks found are **around** the code, not in it:
- **Claude Code's own allow rules** (3 verified MEDIUM findings): wildcard rules let a prompt-injected agent run `git fetch --upload-pack=…` or `gh` commands that post local files or call any GitHub API, with no prompt. The untrusted text is a PR comment on this public repo.
- **Supply chain in CI:** actions pinned by tag, not commit; `pnpm dlx wrangler@…` installs wrangler's dependencies unlocked in the job that holds `CLOUDFLARE_API_TOKEN`; and **Dependabot can't read our pnpm 12 lockfile**, so it has never alerted on a transitive dependency.
- **Missing hardening headers** on the web app (Observatory grade C) and the API (no HSTS).

Scanner severities (2 "high" in `pnpm audit`, 56 "high" + 1 "critical" in the image) are in build tools or OS packages nothing reaches; each has a verdict below.

## Findings and proposed decisions

**Decisions:** the owner agreed to every proposed decision as written, including the `wrangler` devDependency (C4), on 2026-10-31. Commits and parking-lot lines are added as the fixes land (criterion 4).

Severity follows Claude Security's scale: Critical = severe impact, nothing in the way; High = severe impact behind one real hurdle; Medium = bounded impact, or serious behind several conditions; Low = limited impact or demanding exploitation; Info = no direct risk, hygiene.

| ID | Sev | Where | Found by | Finding | Proposed decision |
| --- | --- | --- | --- | --- | --- |
| A1 | Medium | `.claude/settings.json:27-29`, `.claude/skills/handoff/SKILL.md:6` | claude-security F1 | `gh pr create/edit/comment *` allow `--repo`/`-R` and `--body-file <any path>`: an injected PR comment can make the agent post `~/.ssh/id_ed25519` to an attacker's PR, no prompt. `Read(.env)` deny doesn't cover files gh opens. | **Fix now:** move the three `gh pr` write rules and both `gh api …/comments` rules from `allow` to `ask` in project settings and drop them from the handoff skill's `allowed-tools` (≈3 prompts per `/handoff`, you're present then). |
| A2 | Medium | `.claude/settings.json:21-22` | claude-security F2 | `git fetch *` / `git pull --ff-only *` allow `--upload-pack=<cmd>` → shell command, no prompt. | **Fix now:** exact forms only: `git fetch`, `git fetch origin`, `git pull --ff-only`; anything else asks. |
| A3 | Medium | `.claude/settings.json:33-34` | claude-security F3 | `gh api repos/*/pulls/*/comments *`: each `*` matches anything, so any endpoint/method/`@file` body matches (merge, force-move `main`, upload a key). | **Fix now:** with A1 (to `ask`). |
| P1 | Medium | GitHub dependency graph | gh api (manual) | Dependabot sees 48 packages, only `package.json` ranges; it doesn't parse the pnpm 12 lockfile (two YAML documents). No alert ever fires for a transitive dependency. | **Fix now:** weekly scheduled workflow `audit.yml` running `pnpm audit --audit-level high` (actions SHA-pinned, read-only token); accepted advisories listed with reasons in `pnpm-workspace.yaml` `auditConfig.ignoreGhsas`, so a new High/Critical turns the run red and GitHub emails you. |
| C1 | Medium | `ci.yml:19-20`, `deploy-web.yml:27-28` | zizmor (high ×4) | `actions/checkout@v7`, `actions/setup-node@v7` by tag; the deploy job holds `CLOUDFLARE_API_TOKEN`. | **Fix now:** pin to commit SHAs with `# v7.x` comments; then turn on "Require actions to be pinned to a full-length commit SHA" (console, you). |
| C4 | Medium | `deploy-web.yml:43` | manual (supply chain) | `pnpm dlx wrangler@4.151.3` pins wrangler but resolves its whole dependency tree fresh on every deploy, with the Cloudflare token in the environment. (No advisories for 4.151.3 today.) | **Fix now (needs your OK — new devDependency):** `wrangler` exact `4.151.3` as a devDependency of `apps/mobile` so the lockfile pins every transitive version; the workflow runs `pnpm exec wrangler deploy`. Docs (DEPLOY.md §10) switch from `pnpm dlx wrangler@…` to `pnpm exec wrangler`. |
| C2 | Low | `deploy-web.yml:45-46` | zizmor (medium ×2) | Secrets are repo-wide, not in an environment. The `if: main` guard is in the workflow file, which a branch can edit. | **Fix now:** GitHub environment `production` with deployment branches = `main` only, secrets moved into it (console, you), `environment: production` on the deploy job. |
| C3 | Low | `ci.yml:19`, `deploy-web.yml:27` | zizmor (artipacked) | `actions/checkout` leaves the token in `.git/config` for later steps (build tools, wrangler). | **Fix now:** `persist-credentials: false`. |
| W1 | Low | `ourplayers.adveis.dev` | Observatory C 50/100 (9/12), curl | No CSP, `X-Content-Type-Options`, `Referrer-Policy`, frame protection or HSTS on the web app. | **Fix now:** `apps/mobile/public/_headers` (copied into `dist/`): CSP `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src https://api.ourplayers.adveis.dev; manifest-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, `Strict-Transport-Security: max-age=31536000`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`. Checked before merge with `wrangler dev` + headless Chromium (Today and a player page load, no CSP errors); live re-check after merge. |
| H1 | Low | API responses | curl | No `Strict-Transport-Security`, no `X-Content-Type-Options` (404 bodies echo the path; JSON, so not exploitable today). | **Fix now:** Hono's built-in `secureHeaders` middleware (no new dependency), red/green test in the API tests; live re-check after deploy. |
| D1 | Low | `pnpm-lock.yaml` | pnpm audit, trivy fs | node-forge 1.4.0 (high), zod 3.25.76 (high), uuid 7.0.3, esbuild 0.18.20, deepmerge 4.3.1: all inside `@expo/cli`/`@expo/config`/`drizzle-kit`, build/dev tools. Server `--prod` audit clean; none in the web bundle; our zod is 4.6.7. | **Fix now:** node-forge via a `pnpm.overrides` entry `>=1.4.1` (patch release out since 2026-10-27). **Accept** the rest: fixes need a major bump inside Expo/drizzle-kit; no attacker-reachable path; listed in `auditConfig.ignoreGhsas` with this reason; re-check on each Expo SDK upgrade. |
| I1 | Low | `Dockerfile` | trivy image | Debian 12 base: 1 critical (zlib minizip, CVE-2023-45853) + 56 high, none with a Debian fix; 17 Node-package CVEs all in the base image's bundled npm, which the API never runs. Runs as `node`, no shell entry from outside. | **Fix now:** runtime stage on `node:24-trixie-slim` (0 critical / 43 high) and delete npm/corepack from it (the API runs `tsx` from `node_modules`); `deploy.sh` builds with `--pull` so each deploy gets the latest base. **Accept** the remaining unfixed OS CVEs (local-only bugs in util-linux, ncurses, perl; nothing in the API calls them); re-scan monthly. |
| I2 | Low | host | ssh | `postgres:17` and `caddy:2` pulled 2026-10-21 and never refreshed (unattended-upgrades doesn't touch containers). | **Fix now (host, with your OK):** `docker compose pull db caddy && docker compose up -d --wait` once; **monthly** in SECURITY-CHECKS.md. |
| S1 | Low | host `sshd` | ssh | `PermitRootLogin yes` (password login is off, so keys only in practice) and `X11Forwarding yes`. | **Fix now (host, with your OK):** `PermitRootLogin prohibit-password`, `X11Forwarding no` in `/etc/ssh/sshd_config.d/00-keys-only.conf`; checked with a second session as in DEPLOY.md §2.3; documented there. |
| AN1 | Low | `apps/mobile/app.json` | expo config introspect | Expo adds `SYSTEM_ALERT_WINDOW`, `VIBRATE`, `READ/WRITE_EXTERNAL_STORAGE` besides `INTERNET`; they become part of the first Play upload and the Data safety answers. | **Fix now:** `"android": { "permissions": ["INTERNET"], "blockedPermissions": [the four] }`; checked with `expo config --type introspect`. |
| T1 | Low | `.claude/settings.json` `extraKnownMarketplaces.ponytail.ref` | manual | Third-party plugin pinned to tag `v5.3.1` (movable). Your user settings list the same marketplace with no ref at all. | **Fix now:** project ref → commit `6f1c2bfff0c8…` (what v5.3.1 points to today). User settings: same edit in `~/.claude/settings.json` with your OK (outside the repo). |
| T2 | Low | `.claude/settings.json` deny | manual | `Read(.env)`, `Read(.env.*)`: unclear that they cover nested `deploy/.env`, `apps/mobile/.env`. | **Fix now:** add `Read(**/.env)` and `Read(**/.env.*)`; checked with a dummy `.env.deny-check` file. |
| G1 | Low | GitHub → Settings → Actions | gh api | Fork PRs need approval only from first-time contributors. | **Fix now (console, you):** "Require approval for all external contributors". |
| T3 | Info | `pnpm-workspace.yaml` | manual | `minimumReleaseAge` relies on pnpm 12's default (1 day). | **Fix now:** set `minimumReleaseAge: 1440` explicitly, so the guard survives a pnpm change. |
| Q1 | Info | `apps/server/test/jobs-nba.test.ts:245` | CodeQL | `js/incomplete-url-substring-sanitization` on a test assertion. | **Fix now:** dismiss as "Used in tests" (`gh api … -X PATCH`, with your OK). |
| X1 | Info | Expo account | you | Not created yet (no `eas.json`, `expo whoami`: not logged in). | **Park → S11a:** turn on 2FA when the account is created. PROGRESS.md parking-lot line. |
| X2 | Info | host | ssh | 2 packages upgradable, no reboot pending; unattended-upgrades never reboots for a kernel. | **Accept:** monthly `apt list --upgradable` + reboot check in SECURITY-CHECKS.md. |
| X3 | Info | various | trivy fs, zizmor, manual | Dockerfile has no `HEALTHCHECK` (compose has one); CI has no concurrency group; workflow jobs unnamed; 404 echoes the request path; Caddy's error log keeps request headers (0 IPs or query strings in 48 h); `allowBackup` true (only prefs, restored to the same user); Dependabot security updates off (moot with P1). | **Accept,** reasons as stated. |

Not a finding (checked, fine): TLS 1.0/1.1 refused, 1.2/1.3 only, HTTP → 308 to HTTPS; CORS exact-match only; rate limit 120/min then 429 with `Retry-After`; malformed or oversized input → clean 400 without stack traces or SQL; ports 22/80/443 only from outside; Postgres and the API unpublished; `.env` 600; one authorized key; container runs as `node`; no source maps or secrets in the web bundle; gitleaks clean over all 317 commits; main branch protected (required checks, admins included, no force push); Actions token read-only by default.

## Evidence

### Step 1 — scanners (start commit `b2e66ca`)

| Command | Result |
| --- | --- |
| `pnpm audit` | 5: high node-forge@1.4.0 (GHSA-86w9-cpqp-85rv), high zod@3.25.76 (GHSA-mrhx-c7xc-m3w5), moderate uuid@7.0.3 (GHSA-w5hq-g745-h8pq), moderate esbuild@0.18.20 (GHSA-67mh-4wv8-2f99, via drizzle-kit), low deepmerge@4.3.1 (GHSA-gcqx-w48m-w2h4). All paths through `apps/mobile>expo…>@expo/cli\|@expo/config` or `apps/server>drizzle-kit`. `pnpm --filter @our-players/server audit --prod`: no known vulnerabilities. |
| `trivy fs --scanners vuln,secret,misconfig --skip-dirs '**/node_modules,apps/mobile/dist,apps/server/.data' --skip-files '**/.env' .` | `pnpm-lock.yaml`: deepmerge (LOW), node-forge (HIGH), uuid (MEDIUM). `Dockerfile`: DS-0026 LOW no HEALTHCHECK. Secrets: none. |
| `gitleaks git --redact` | 317 commits scanned, no leaks found. |
| `zizmor .github/workflows` (online, `--persona=auditor`) | 12: 4 high unpinned-uses, 2 medium secrets-outside-env, 4 low (artipacked ×2, concurrency-limits ×2), 2 info anonymous-definition. |
| `podman build -t our-players-api:scan .` + `trivy image --input <saved tar>` (Docker unusable on the laptop; same engine `deploy.sh` falls back to) | Debian 12.15: CRITICAL 1, HIGH 56, MEDIUM 87, LOW 83, none fixable. Node packages: HIGH 6, MEDIUM 10, LOW 1, all under `/usr/local/lib/node_modules/npm`. Node v24.22.2 (latest 24.x). Comparison `node:24-trixie-slim`: OS HIGH 43, CRITICAL 0. |
| `gh api …/dependabot/alerts` · `…/code-scanning/alerts` · `…/dependency-graph/sbom` | Dependabot: 0 alerts in any state; SBOM 48 packages (package.json ranges, e.g. `zod@^4.6.7`). CodeQL: last analyses on `b2e66ca` (javascript-typescript 1 result, actions 0); 1 open alert (Q1). |

### Step 2 — Claude Security codebase scan

`/claude-security` → scan codebase, whole repository, effort `high`, focus attack-surface; 410 tracked files, 15 components, 101 researchers (all returned), 132 agents in total, ~1.07M subagent tokens, ~19 min (resumed once after a usage-limit stop). **3 findings: 0 Critical, 0 High, 3 Medium, 0 Low; verification status `verified`, each 3/3.** Coverage: every top-level directory accounted for; skipped on purpose: `docs` (no code), `apps/server/test` and `packages/shared/test` (background; the secrets pass still read the fixtures), `apps/server/.data` (untracked). 143 of 145 in-component files read to a conclusion, 2 declared not reached (generated drizzle snapshots, background). The memory-safety lens was skipped for the TypeScript components. Report: `CLAUDE-SECURITY-20261030-175413/` (gitignored, not committed).

### Step 3 — manual checklist

**API, live** (`https://api.ourplayers.adveis.dev`):
```text
$ curl -sS -D - -o /dev/null https://api.ourplayers.adveis.dev/v1/meta
HTTP/2 200 · alt-svc · content-type: application/json · vary: Origin · via: 1.1 Caddy      ← no HSTS, no nosniff (H1)
$ curl -o /dev/null -w '%{http_code} -> %{redirect_url}' http://api.ourplayers.adveis.dev/v1/meta
308 -> https://api.ourplayers.adveis.dev/v1/meta
$ curl --tlsvX --tls-max X https://api.ourplayers.adveis.dev/health    (X = 1.0 1.1 1.2 1.3)
TLS 1.0: 000 · TLS 1.1: 000 · TLS 1.2: 200 · TLS 1.3: 200   (Let's Encrypt YE1, valid to 2027-01-23)
CORS (-H Origin: …): ourplayers.adveis.dev → allow-origin set; evil.example, null, ourplayers.adveis.dev.evil.example → none;
  OPTIONS preflight from evil.example → 204, allow-methods GET, no allow-origin
Odd input: /v1/days/2026-13-45 → 400 "Invalid ISO date"; countries=<3000×X> → 400; fav=<250 ids> → 400 "<=200 items";
  search q=';-- → 200 {"players":[]}; q=<5000×a> → 400 "<=50 characters"; /v1/players/nhl-%00 → 400;
  /v1/games/../../etc/passwd → 404 "no route GET /etc/passwd"; POST /v1/meta → 404; leagues twice → 400; 40 KB header → refused by Caddy
Rate limit (DEPLOY.md §7):   120 200 · 5 429 · HTTP/2 429 · retry-after: 43 · {"error":{"code":"RATE_LIMITED",…}}
DNS: api.ourplayers.adveis.dev → 172.104.146.58 only (no AAAA, so the rate limit's IPv4-only key still holds)
```

**Web app, live** (`https://ourplayers.adveis.dev`):
```text
$ curl -sS -D - -o /dev/null https://ourplayers.adveis.dev/
HTTP/2 200 · content-type: text/html · cache-control: public, max-age=0, must-revalidate · server: cloudflare   ← no security headers (W1)
Mozilla Observatory API: grade C, 50/100, 9/12 tests passed (the API host can't be graded: JSON only)
Bundle (3 JS files, 1.8 MB): *.js.map → 200 text/html (SPA fallback, no source maps); no sourceMappingURL; no EXPO_PUBLIC_ names left;
  only baked URL https://api.ourplayers.adveis.dev; no node-forge/uuid/deepmerge code; index.html: no inline <script>, one inline <style>
```

**Host** (`ssh root@172.104.146.58`, read-only batch approved 2026-10-31; nmap from the laptop):
```text
$ nmap -Pn -sT -p- --min-rate 300 172.104.146.58
22/tcp open ssh · 80/tcp open http · 443/tcp open https   (65532 filtered)
$ sudo nmap -Pn -sU -p 443,3001,5432 172.104.146.58     (run by the owner)
443/udp open|filtered · 3001/udp open|filtered · 5432/udp open|filtered   (UDP can't tell open from dropped; `ss` below shows only :443/udp listening, Caddy's HTTP/3)
sshd -T: permitrootlogin yes · passwordauthentication no · kbdinteractiveauthentication no · pubkeyauthentication yes ·
  x11forwarding yes · allowtcpforwarding yes · maxauthtries 6                                           ← S1
ufw: active, default deny incoming; allow 22/tcp, 80/tcp, 443 (v4+v6)
listening (non-loopback): sshd :22; docker-proxy :80, :443 tcp, :443 udp. docker ps: api 3001/tcp and db 5432/tcp unpublished
unattended-upgrades: enabled, active; Update-Package-Lists 1, Unattended-Upgrade 1. Upgradable: 2. No reboot needed. Up 4 days. Ubuntu 24.04.5, 6.8.0-147
perms: 755 /opt/our-players · 600 .env · 700 /root/.ssh · 600 authorized_keys (1 key)
images: api 5a60fa9 (4 days) · caddy:2 and postgres:17 created 2026-10-21                                        ← I2
logs: journal 45.5M, containers 3.2M; Caddy lines with client IP (48 h): 0; API lines with a query string (48 h): 0
```

**Android config** (`npx expo config --type introspect`, nothing written):
```text
uses-permission: INTERNET, SYSTEM_ALERT_WINDOW, VIBRATE, READ_EXTERNAL_STORAGE, WRITE_EXTERNAL_STORAGE      ← AN1
application: android:allowBackup="true"; no usesCleartextTraffic (release default: cleartext off)
MainActivity exported: MAIN launcher + VIEW scheme "ourplayers" (deep links). Route params go through publicIdSchema-shaped
  paths; the scan read mobile-screens/mobile-data-layer for injection and found nothing.
```

**Accounts and tokens:**
```text
GitHub (gh api): default workflow token read, cannot approve PRs; actions allowed=all, sha_pinning_required=false;
  fork PR approval first_time_contributors (G1); secret scanning + push protection on; main protected: checks verify (22)/(24),
  strict, enforce_admins, reviews required, no force push/deletion; no environments; secrets CLOUDFLARE_ACCOUNT_ID,
  CLOUDFLARE_API_TOKEN; 0 deploy keys, 0 webhooks, collaborators: Adve1s only
2FA — you confirm (2026-10-31): GitHub ✓, Cloudflare ✓, Linode ✓, Google Play ✓, Expo: no account yet (X1)
Cloudflare token scope — you confirm (2026-10-31): Edit Cloudflare Workers template, your account, zone adveis.dev only ✓
```

**Supply chain and tooling:**
```text
pnpm config get minimumReleaseAge → undefined (pnpm 12 default applies) (T3); allowBuilds: esbuild only
wrangler@4.151.3: gh api /advisories?affects=wrangler@4.151.3 → none; published 2026-10-20; latest 4.156.0 (C4)
ponytail marketplace: project ref v5.3.1 → 6f1c2bfff0c8 (tag); user settings: no ref (T1)
Project deny: Read(.env), Read(.env.*), Read(!.env.example), Edit(**/test/fixtures/**), git push --force variants, gh repo delete
Claude Code allow rules: see A1–A3
```

## How the fixes are verified

- Code: H1 red/green (API test asserts `strict-transport-security` and `x-content-type-options` on a `/v1` response, a 404 and `/health`); W1 a test that `public/_headers` is copied into the export, and the CSP's `connect-src` names the production API host; the rest is config, checked by the commands above.
- Re-run every scanner after the fixes (criterion 6): zizmor (no unpinned-uses/artipacked/secrets-outside-env), trivy image (no CRITICAL, no npm node-pkg CVEs), `pnpm audit` (node-forge gone; the rest ignored with reasons), gitleaks.
- Deploy the API from this branch (`deploy/deploy.sh`, with your OK), repeat the live API checks; web live checks go to the briefing's Next (deploy on merge).
- `docs/SECURITY-CHECKS.md`: the scanner commands, the manual checklist with expected results, and when to re-run (before S11b and S15, after adding a dependency, monthly: `pnpm audit`, `trivy image`, host updates and image pulls).

## Calls I made (check these)

- Severities are mine where a scanner's label overstates reachability (D1, I1: scanner "high"/"critical" → Low).
- A1/A3 as `ask` rather than a list of deny patterns: deny patterns over free text (`@`, `-F`) would also block legitimate PR bodies, and `ask` is the only form that can't be pattern-matched around.
- `Referrer-Policy: no-referrer` on the web app: the app never needs to send one.

# Security checks

How to re-run the S16 security audit by hand: the scanners, the manual checklist with the result to expect, and the findings we accepted on purpose. The audit itself, with every finding and its decision: `docs/superpowers/specs/2026-10-30-s16-security-audit.md` (D-062, D-064).

**Placeholder.** Replace this one everywhere, including the `<` `>`:
- `<server-ip>`: the Linode's public IPv4 address (Linode console → the Linode → Network).

**Where commands run.** Each block says **On your computer** (from the repo root unless it says otherwise) or **On the host**. Host commands in this file only **read**: they change nothing, so they are safe to run at any time. Never paste a secret value (a token, a password, a `.env` line) into a session or a doc: name the file, line and kind instead.

## 1. When

| When | What |
| --- | --- |
| Every Monday, automatically | The **Audit** workflow (`.github/workflows/audit.yml`) runs `pnpm audit` (fails on high) and the API's runtime dependencies alone (fails on moderate). A red run emails you: read the advisory, then fix (an update or an `overrides` entry in `pnpm-workspace.yaml`) or accept it (an `audit.ignore` entry with the reason). |
| After adding or upgrading a dependency | Section 2: `pnpm audit`. After an Expo SDK upgrade also re-check the accepted D1 and D3 advisories (section 5): the upgrade may fix them, then delete their `ignore` lines. |
| Monthly | Section 2: `pnpm audit` and `trivy image`. Section 6: host updates and image pulls. |
| Before S11b (closed test) and before S15 (public launch) | Everything: sections 2, 3 and 4. Before S15 also a Claude Security codebase scan (section 3). |
| After the first Android build (S11a/S11b) | Section 4.4, "The built app". |
| Once, after S16 is merged | GitHub → the repo → Actions → **Audit** → Run workflow (branch `main`). Success: the run is green. This proves the workflow works before its first Monday. |

## 2. Scanners

All **on your computer**, from the repo root. `trivy`, `gitleaks` and `zizmor` are installed tools, not repo dependencies.

**Dependencies:**
```bash
pnpm audit
pnpm --filter @our-players/server audit --prod --audit-level moderate
```
Success: the first ends with `All found vulnerabilities were already reviewed and decided to be ignored` and `6 ignored: 1 low | 4 moderate | 1 high` (the accepted D1 and D3 advisories, section 5), or with no vulnerabilities; the second prints `No known vulnerabilities found`. A new line of severity high or critical, or any advisory in the second, is a new finding.

**Repo files** (lockfile, Dockerfile, secrets):
```bash
trivy fs --scanners vuln,secret,misconfig --skip-dirs '**/node_modules,apps/mobile/dist,apps/server/.data' --skip-files '**/.env' .
```
Success: `pnpm-lock.yaml` shows only the accepted D1/D3 packages (section 5): deepmerge and uuid (D1), and minimatch or glob (D3) once trivy's database lists them, `Dockerfile` only `DS-0026` (no `HEALTHCHECK`, accepted X3), and no secrets.

**Secrets in the git history:**
```bash
gitleaks git --redact
```
Success: `no leaks found`. `--redact` keeps a found secret out of your terminal; if it finds one, rotate that secret first (`docs/DEPLOY.md` §6), then tell Claude the file, line and kind.

**Workflows:**
```bash
zizmor --persona=auditor .github/workflows
```
Success: `0 medium, 0 high`. The remaining low and informational findings (`concurrency-limits`, `anonymous-definition`) are accepted (X3).

**The API image.** Build it locally and scan it. **Never run `deploy/deploy.sh` for a scan**: it ships the image to the host and restarts the API. With Docker:
```bash
docker build --pull -t our-players-api:scan .
trivy image --scanners vuln --severity CRITICAL,HIGH our-players-api:scan
docker rmi our-players-api:scan
```
If Docker isn't usable (as on the Arch laptop), with podman, the same engine `deploy.sh` falls back to:
```bash
podman build --pull -t our-players-api:scan .
podman save -o /tmp/api-scan.tar our-players-api:scan
trivy image --scanners vuln --severity CRITICAL,HIGH --input /tmp/api-scan.tar
rm /tmp/api-scan.tar && podman rmi our-players-api:scan
```
Success: the `Report Summary` shows `debian` with 0 CRITICAL and only HIGH rows whose `Fixed Version` is empty (accepted I1 remainder, section 5; 43 on 2026-10-31), and 0 for every `node-pkg` target. A CRITICAL, a row with a fixed version, or any `node-pkg` finding is new: a row with a fixed version usually means the host runs an old base, so redeploy (`deploy.sh` builds with `--pull`).

**GitHub's own alerts:**
```bash
gh api 'repos/{owner}/{repo}/dependabot/alerts?state=open' --jq length
gh api 'repos/{owner}/{repo}/code-scanning/alerts?state=open' --jq '[.[] | {number, rule: .rule.id, path: .most_recent_instance.location.path}]'
```
Success: `0` and `[]`. Dependabot only sees `package.json` ranges (it can't read the pnpm 12 lockfile, P1), so `0` here says little: `pnpm audit` is the real check.

## 3. Claude Security

The `claude-security` plugin (`/claude-security`) reasons about logic and cross-file flaws the scanners can't see. It costs real usage, so:
- **Scan changes** on a pull request that touches `apps/server/src/api/`, `deploy/`, `.github/workflows/` or `.claude/settings.json`: `/claude-security` → scan changes → this branch. Cheap, minutes.
- **Scan the codebase** (whole repository, effort `high`) before S15, and after a big change to the API, the deploy or the CI. In S16 it took ~19 minutes and ~1.07M subagent tokens; plan it for a day with usage to spare.

Success: no Critical or High finding. Every finding gets a severity and a decision as in the S16 report. The report folder `CLAUDE-SECURITY-<timestamp>/` ignores itself in git: never commit it.

## 4. Manual checklist

### 4.1 API, live

**On your computer:**
```bash
curl -sS -D - -o /dev/null https://api.ourplayers.adveis.dev/v1/meta | grep -i '^HTTP\|^strict-transport-security\|^x-content-type-options'
curl -sS -o /dev/null -w '%{http_code} -> %{redirect_url}\n' http://api.ourplayers.adveis.dev/v1/meta
```
Success: `HTTP/2 200`, `strict-transport-security: max-age=…` and `x-content-type-options: nosniff` (H1); then `308 -> https://api.ourplayers.adveis.dev/v1/meta`.

**TLS versions and certificate:**
```bash
for v in 1.0 1.1 1.2 1.3; do printf 'TLS %s: ' $v; curl -sS -o /dev/null -w '%{http_code}\n' --tlsv$v --tls-max $v https://api.ourplayers.adveis.dev/health 2>/dev/null || echo; done
curl -vsS -o /dev/null https://api.ourplayers.adveis.dev/health 2>&1 | grep -i 'expire date\|issuer'
```
Success: `TLS 1.0: 000`, `TLS 1.1: 000` (refused), `TLS 1.2: 200`, `TLS 1.3: 200`; the certificate is from Let's Encrypt and expires in the future (Caddy renews it about a month before).

**CORS:**
```bash
for o in https://ourplayers.adveis.dev https://evil.example null https://ourplayers.adveis.dev.evil.example; do printf '%s: ' "$o"; curl -sS -o /dev/null -D - -H "Origin: $o" https://api.ourplayers.adveis.dev/v1/meta | grep -i '^access-control-allow-origin' || echo none; done
curl -sS -o /dev/null -D - -X OPTIONS -H 'Origin: https://evil.example' -H 'Access-Control-Request-Method: GET' https://api.ourplayers.adveis.dev/v1/meta | grep -i '^HTTP\|^access-control'
```
Success: only `https://ourplayers.adveis.dev` gets `access-control-allow-origin: https://ourplayers.adveis.dev`; the other three print `none`. The preflight gives `HTTP/2 204` and `access-control-allow-methods: GET` with no `access-control-allow-origin`.

**Odd input** (each line prints the start of the body, then the status):
```bash
api=https://api.ourplayers.adveis.dev
d=$(date -u -d yesterday +%F)
for p in "/v1/days/2026-13-45" "/v1/days/$d?countries=$(printf 'X%.0s' $(seq 3000))" "/v1/days/$d?fav=$(seq -s, -f 'nhl-%g' 1 250)" "/v1/players/search?q=%27%3B--" "/v1/players/search?q=$(printf 'a%.0s' $(seq 5000))" "/v1/players/nhl-%00" "/v1/games/../../etc/passwd" "/v1/days/$d?leagues=nhl&leagues=nhl"; do curl -sS -w ' %{http_code}\n' "$api$p" | cut -c1-120; done
curl -sS -w ' %{http_code}\n' -X POST "$api/v1/meta"
curl -sS -o /dev/null -w '%{http_code}\n' -H "X-Big: $(printf 'a%.0s' $(seq 40000))" "$api/v1/meta"
```
Success, in order (the status is the last word of each line): `400` (invalid date); `400`; `400` (`<=200 items`); `{"players":[]} 200` (the quote is just text); `400` (`<=50 characters`); `400`; `404` `no route GET /etc/passwd`; `400` (repeated parameter); `404` for the POST; the 40 KB header refused (`000` with a curl error such as `Error in the HTTP2 framing layer`, or `431`). No body shows a stack trace, SQL or a file path of the server.

**Rate limit:** the "Rate limit" check in `docs/DEPLOY.md` §7. Success: `120 200` then `5 429`, `retry-after: …` and `RATE_LIMITED`. Only these 125 requests: never flood the host.

**DNS:**
```bash
getent ahosts api.ourplayers.adveis.dev | awk '{print $1}' | sort -u
```
Success: only `<server-ip>`. An IPv6 address here means someone added an `AAAA` record: the rate limit keys on IPv4 addresses, so tell Claude before keeping it.

### 4.2 Web app, live

**On your computer:**
```bash
curl -sS -D - -o /dev/null https://ourplayers.adveis.dev/ | grep -i '^HTTP\|^content-security-policy\|^x-content-type-options\|^referrer-policy\|^x-frame-options\|^strict-transport-security\|^permissions-policy'
curl -sS -X POST 'https://observatory-api.mdn.mozilla.net/api/v2/scan?host=ourplayers.adveis.dev'; echo
curl -sS -o /dev/null -w '%{http_code} %{content_type}\n' https://ourplayers.adveis.dev/_expo/static/js/web/entry.js.map
```
Success: `HTTP/2 200` and all six headers from `apps/mobile/public/_headers` (W1); Mozilla Observatory `"grade":"A"` or `"A+"` (it was C, 50/100, before S16; `details_url` in the answer opens the full report); the `.map` URL answers `200 text/html` (the SPA fallback page, not a source map). Then open the site in a browser with the developer console open: Today and a player page load with no `Content-Security-Policy` errors. If the API URL ever changes, the CSP's `connect-src` in `_headers` must change with it (`deploy-web.yml` refuses to deploy until it does). An `eval` violation means zod's `jitless` config no longer loads first: check that `apps/mobile/package.json` `main` is still `index.ts`.

**The bundle** (build it as CI does, then look inside). **On your computer:**
```bash
EXPO_PUBLIC_API_URL=https://api.ourplayers.adveis.dev pnpm build:web
find apps/mobile/dist -name '*.map' | wc -l
grep -rl sourceMappingURL apps/mobile/dist | wc -l
grep -rhoE 'EXPO_PUBLIC_[A-Z_]+' apps/mobile/dist | sort -u
grep -rhoE 'https://[a-z.]*adveis\.dev' apps/mobile/dist | sort -u
grep -o '<script[^>]*>' apps/mobile/dist/index.html
```
Success: `0`, `0`, nothing, only `https://api.ourplayers.adveis.dev`, and every `<script` has a `src=` (no inline script, which the CSP would block).

### 4.3 Host

**Ports, from outside. On your computer:**
```bash
nmap -Pn -sT -p- --min-rate 300 <server-ip>
curl -sS -m 5 http://<server-ip>:3001/health; echo "exit=$?"
```
Success: only `22/tcp open ssh`, `80/tcp open http`, `443/tcp open https` (the rest filtered); the curl fails with `exit=7` or `exit=28` (the API isn't published). A full port scan takes a few minutes; only scan this host, nothing we don't own.

**On the host** (read-only: `ssh root@<server-ip>`, then run these one by one):
```bash
sshd -T | grep -E '^(permitrootlogin|passwordauthentication|kbdinteractiveauthentication|pubkeyauthentication|x11forwarding)'
ufw status verbose
ss -tulpn | grep -v '127\.0\.0\.\|\[::1\]'
cd /opt/our-players && docker compose ps --format '{{.Service}}: {{.Ports}}'
systemctl is-active unattended-upgrades && apt-config dump APT::Periodic
stat -c '%a %n' /opt/our-players /opt/our-players/.env /root/.ssh /root/.ssh/authorized_keys
wc -l < /root/.ssh/authorized_keys
docker images --format '{{.Repository}}:{{.Tag}} {{.CreatedSince}}'
docker compose logs --since 48h caddy | grep -v '"logger":"admin.api"' | grep -cE 'remote_ip|client_ip'
docker compose logs --since 48h api | grep -c '"path":"[^"]*?'
journalctl --disk-usage && du -sh /var/lib/docker/containers
```
Success, line by line:
- `permitrootlogin without-password` (that's how `sshd -T` prints `prohibit-password`), `passwordauthentication no`, `kbdinteractiveauthentication no`, `pubkeyauthentication yes`, `x11forwarding no` (S1; set up in `docs/DEPLOY.md` §2.3).
- `Status: active`, `Default: deny (incoming)`, and `ALLOW IN` only for `22/tcp`, `80/tcp`, `443` (and their `(v6)` twins).
- The `ss` header line (`Netid State …`, expected), then on public addresses only `sshd` on `:22` and `docker-proxy` on `:80`, `:443` (TCP) and `:443` (UDP, HTTP/3). The filter drops every loopback address, including systemd-resolved on `127.0.0.53:53` and `127.0.0.54:53`.
- `caddy` lists `80` and `443` published; `api` (`3001/tcp`) and `db` (`5432/tcp`) have no `0.0.0.0:` or `[::]:` mapping.
- `active`, and `APT::Periodic::Update-Package-Lists "1"` and `APT::Periodic::Unattended-Upgrade "1"`.
- `755 /opt/our-players`, `600 /opt/our-players/.env`, `700 /root/.ssh`, `600 /root/.ssh/authorized_keys`; `1` key (yours; more means someone else can log in).
- The API's newest image is your last deploy; `caddy:2` and `postgres:17` were created within the last month (section 6 pulls them).
- `0` and `0`: no client IPs in Caddy's logs, no query strings (preferences) in the API's. The first command skips Caddy's `admin.api` lines: each deploy's `caddy reload` logs one with `"remote_ip":"127.0.0.1"` (Caddy reloading itself, not a visitor).
- The journal and container logs stay small (S16: 45.5M and 3.2M); Docker rotates container logs at 5 × 10 MB.

### 4.4 Android

**The config, before a build. On your computer:**
```bash
cd apps/mobile
pnpm exec expo config --type introspect --json 2>/dev/null | grep -o '"uses-permission":\[[^]]*\]'
```
Success: `android.permission.INTERNET` with nothing else, and `SYSTEM_ALERT_WINDOW`, `VIBRATE`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE` each with `"tools:node":"remove"` (AN1: removed from the build). A new permission without `remove` came with a new library: check that it's needed, and that the Play Console Data safety answers still fit.

**The built app (S11a/S11b, after the first Android build).** The final manifest is what Play sees. For an APK (`aapt` comes with the Android SDK build-tools):
```bash
aapt dump permissions <path-to.apk>
```
For an AAB (`bundletool` from github.com/google/bundletool):
```bash
bundletool dump manifest --bundle=<path-to.aab> | grep uses-permission
```
Success: `android.permission.INTERNET` and `io.github.adve1s.ourplayers.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` (added by androidx.core: a signature-level permission the app defines for itself, not one the user grants), nothing else. (Expo or a library may add a permission the introspect step didn't show; if one appears, tell Claude before uploading.)

### 4.5 Accounts and tokens

**GitHub. On your computer:**
```bash
gh api 'repos/{owner}/{repo}/actions/permissions'
gh api 'repos/{owner}/{repo}/actions/permissions/workflow'
gh api 'repos/{owner}/{repo}/actions/permissions/fork-pr-contributor-approval'
gh api 'repos/{owner}/{repo}' --jq '.security_and_analysis | {secret_scanning: .secret_scanning.status, push_protection: .secret_scanning_push_protection.status}'
gh api 'repos/{owner}/{repo}/branches/main/protection' --jq '{checks: .required_status_checks.contexts, strict: .required_status_checks.strict, admins: .enforce_admins.enabled, reviews: (.required_pull_request_reviews != null), force_push: .allow_force_pushes.enabled, deletion: .allow_deletions.enabled}'
gh api 'repos/{owner}/{repo}/environments' --jq '.environments[] | {name, branches: .deployment_branch_policy}'
gh secret list
gh secret list --env production
gh api 'repos/{owner}/{repo}/keys' --jq length
gh api 'repos/{owner}/{repo}/hooks' --jq length
gh api 'repos/{owner}/{repo}/collaborators' --jq '[.[].login]'
```
Success, line by line:
- `"sha_pinning_required":true` (C1: every action pinned to a commit SHA).
- `"default_workflow_permissions":"read"`, `"can_approve_pull_request_reviews":false`.
- `"approval_policy":"all_external_contributors"` (G1).
- Secret scanning and push protection `enabled`.
- Checks `verify (22)` and `verify (24)`, `strict`, `admins`, `reviews` all `true`; `force_push` and `deletion` `false`.
- One environment, `production`, limited to custom branches (`main` only: check it under Settings → Environments → production) (C2).
- `gh secret list` shows no Cloudflare secret; `--env production` shows `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` (C2).
- `0` deploy keys, `0` webhooks, collaborators only you.

**You confirm** (consoles, no command): two-factor authentication is on for GitHub, Cloudflare, Linode, Google Play and, once it exists (S11a), Expo (X1). The Cloudflare API token (My Profile → API Tokens) is still the **Edit Cloudflare Workers** template limited to your account and the zone `adveis.dev` only; roll it as in `docs/DEPLOY.md` §6 if in doubt.

### 4.6 Supply chain and tooling

**On your computer:**
```bash
pnpm config get minimumReleaseAge
gh api '/advisories?affects=wrangler@4.151.3' --jq length
git ls-remote https://github.com/DietrichGebert/ponytail refs/tags/v5.3.1
node -e 'const p=require("./.claude/settings.json").permissions; console.log(p.allow.filter(r=>/gh |git (fetch|pull)/.test(r)))'
grep -n '"ponytail"' -A6 ~/.claude/settings.json
```
Success, line by line:
- `1440` (T3: pnpm installs nothing published less than a day ago). In `pnpm-workspace.yaml`, `allowBuilds` still lets only `esbuild` run install scripts.
- `0` advisories for wrangler (use the version in `apps/mobile/package.json` if it changed; C4).
- `6f1c2bfff0c837d268929a7c4e490918eb4fab29	refs/tags/v5.3.1`. A different SHA means the ponytail tag moved: **stop, and review what changed in the plugin before the next session.** (Claude Code clones a marketplace with `git clone --branch <ref>`, so it can only follow a tag, not a commit; T1.)
- Only `git fetch`, `git fetch origin`, `git pull --ff-only` and read-only `gh` rules (`view`, `diff`, `checks`, `list`). Every `gh` command that can write (`gh pr create/edit/comment/review/ready/reopen`, `gh api`, `gh issue`, `gh gist`, `gh release`, `gh secret`, `gh variable`, `gh workflow`, `gh run rerun/cancel/delete`, `gh repo`, `gh label`, `gh cache`, `gh discussion`, `gh ssh-key`, `gh gpg-key`, `gh extension`, `gh skill`, `gh auth`, `gh codespace`, `gh project`, `gh agent-task`, `gh alias`, `gh config`, `gh pr update-branch/revert/lock/unlock/checkout`) sits under `ask` (A1–A3; widened by the owner on 2026-10-31). A new wildcard `allow` rule for a command that can run another program, post a file or call an API is a finding.
- Your own `~/.claude/settings.json` ponytail entry has `"ref": "v5.3.1"` under `"source"`, like the project's.

The project's deny rules (`.claude/settings.json`) still include `Read(.env)`, `Read(.env.*)`, `Read(**/.env)` and `Read(**/.env.*)` (T2).

## 5. Accepted findings

These show up in a re-run on purpose. Anything else is new.

| ID | What a re-run shows | Why it's accepted |
| --- | --- | --- |
| D1 | `pnpm audit`: 4 ignored, zod 3 (`GHSA-mrhx-c7xc-m3w5`), uuid 7 (`GHSA-w5hq-g745-h8pq`), esbuild 0.18 (`GHSA-67mh-4wv8-2f99`), deepmerge (`GHSA-gcqx-w48m-w2h4`); `trivy fs` lists deepmerge and uuid in `pnpm-lock.yaml`. | All inside `@expo/cli`/`@expo/config`/`drizzle-kit`: build and dev tools on your computer and in CI. None reaches the server (`--prod` audit is clean) or the web bundle; the fixes need a major bump inside Expo or drizzle-kit. Listed with reasons in `pnpm-workspace.yaml` `audit.ignore`. Re-check on each Expo SDK upgrade. |
| D3 | `pnpm audit`: 2 more ignored, both moderate: minimatch 10 (`GHSA-g3hv-75wg-m249`), glob 13 (`GHSA-3g3m-2fjr-6pw4`). | Inside Expo's build tooling (`@expo/config-plugins`, `@expo/metro-config`, `@expo/config`), on your computer and in CI only; no path via wrangler or the server. The fixes need a major bump inside Expo. Listed with reasons in `audit.ignore`. Re-check on each Expo SDK upgrade. |
| I1 remainder | `trivy image`: about 40 HIGH Debian 13 CVEs, none with a fix. | Local-only bugs in OS libraries (util-linux, ncurses, perl…) the API never calls; the container runs as `node` with no way in except HTTP through Caddy. `deploy.sh --pull` picks up Debian fixes on the next deploy. Re-scan monthly. |
| X2 | Host: a few packages upgradable. | Unattended-upgrades applies security updates daily but never reboots for a new kernel: section 6 does that monthly. |
| X3 | Dockerfile without `HEALTHCHECK`; zizmor `concurrency-limits` and `anonymous-definition`; a 404 echoes the request path; Caddy's error log keeps request headers; `android:allowBackup="true"`; Dependabot security updates off. | `compose.yaml` has the health check; overlapping CI runs are harmless; workflow names are cosmetic; the 404 body is JSON, so the echo can't run as script; the error log had no IPs or query strings (section 4.3); the backup holds only preferences and restores to the same Google account; Dependabot can't read the lockfile anyway (P1, the weekly Audit covers it). |

## 6. Monthly host routine

**On the host** (`ssh root@<server-ip>`). These change the host, unlike section 4.3:
```bash
apt list --upgradable
apt-get update && apt-get upgrade -y
test -f /var/run/reboot-required && echo "reboot needed" || echo "no reboot needed"
```
If it prints `reboot needed`, run `reboot`, wait a minute and `ssh root@<server-ip>` again (the containers start on their own). Then refresh Caddy's and Postgres's images (unattended-upgrades never touches containers):
```bash
cd /opt/our-players
docker compose pull db caddy
docker compose up -d --wait --force-recreate db caddy
docker compose images db caddy
docker compose ps
curl -fsS "https://$(grep '^API_HOST=' .env | cut -d= -f2)/health"; echo
```
Success: `docker compose images` shows `caddy` `2` and `postgres` `17` (never `<none>`, which means the container still runs the old image), `db`, `api`, `caddy` `Up` (`api` and `db` `(healthy)`) and `{"ok":true,…}`. `--force-recreate` because a plain `up -d` left Caddy on the old image in S16; the API is down for about 20 seconds while Postgres restarts. `postgres:17` only moves within 17.x, so the data volume stays compatible. Then prune old images if the disk passes ~80% (`docs/DEPLOY.md` §4), and run `trivy image` from section 2 on your computer.

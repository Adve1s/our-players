# Deploying the backend

How the API, the ingestion scheduler and Postgres run on the Linode host, and how to set them up from zero, deploy, roll back, rebuild the data and rotate secrets. Design: `docs/superpowers/specs/2026-10-25-s10b-deploy.md` (D-054).

The API lives at `https://api.players.adveis.dev`: the domain `adveis.dev` is registered at Cloudflare, which also hosts its DNS.

**Placeholders.** Replace these two everywhere, including the `<` `>`:
- `<server-ip>`: the Linode's public IPv4 address (Linode console → the Linode → Network).
- `<cf-subdomain>`: your Cloudflare `workers.dev` subdomain (Cloudflare dashboard → Workers & Pages → the subdomain on the right).

**Where commands run.** Each block says **On your computer** (from the repo root) or **On the host**. Host commands run as `root` and start with `cd /opt/our-players`, because `docker compose` reads `compose.yaml` and `.env` from the current directory.

## 1. What runs where

```
internet ──443/80──▶ caddy (TLS, Let's Encrypt) ──▶ api:3001 (Hono + scheduler, tsx) ──▶ db:5432 (postgres:17)
                     only these ports published      not published                       not published, volume pgdata
```

- **Host:** Linode Nanode 1 GB, Frankfurt, Ubuntu 24.04, Docker Engine with the compose plugin.
- **`/opt/our-players` on the host:** `compose.yaml` and `Caddyfile` (copied from the repo's `deploy/` by `deploy/deploy.sh`) and `.env` (secrets; it exists only on the host and is never committed).
- **Compose project `our-players`:** services `db`, `api`, `caddy`; volumes `our-players_pgdata` (the database), `our-players_caddy_data` (TLS certificates), `our-players_caddy_config`.
- **The API image** `localhost/our-players-api:<git-short-sha>` is built on your computer and streamed to the host over ssh (no registry). Old images stay on the host for rollbacks.
- **Migrations** run on every API start (and before every job), so a deploy that brings a migration applies it by itself.
- **Logs:** Docker keeps up to 5 × 10 MB per service. The API's request log (path, status, ms; no query string, no IP) is the access log. Caddy writes no access log; its error log has query strings and client IPs filtered out.
- **On the host, every script runs inside the API container:** `docker compose run --rm api tsx scripts/<script>.ts …`. In production the server refuses to start without `CORS_ORIGINS` and `DATABASE_URL`, and `docker compose run` passes both.
- **Long manual jobs** (a `backfill` of more than one day, `season-stats`): run `docker compose stop api` first and `docker compose up -d --wait` after. The job lock is per process, so the scheduler inside the running API could start the same job alongside yours. Short jobs can run with the API up.

`.env` keys (`deploy/.env.example` lists them):

| Key | Value | Notes |
| --- | --- | --- |
| `API_HOST` | `api.players.adveis.dev` | Caddy gets the certificate for this name. |
| `POSTGRES_PASSWORD` | `openssl rand -hex 24` | **Hex only:** compose puts it into `DATABASE_URL` unescaped, so `@`, `/` or `:` would break the URL. |
| `CORS_ORIGINS` | `https://our-players.<cf-subdomain>.workers.dev` | Browser origins allowed to read `/v1` (the web build, S14b). Comma-separated. |
| `API_TAG` | git short SHA | `deploy.sh` writes it. |
| `SCHEDULER_ENABLED` | `1` | `0` switches the scheduler off (used in the staleness check). |
| `CONTACT_URL` | empty | Optional contact URL in the upstream User-Agent; empty means the GitHub repo. |

## 2. First-time setup (from zero)

### 2.1 Consoles

1. **Domain:** `adveis.dev`, registered at Cloudflare (Domains → Registrations), auto-renew on.
2. **SSH key** (skip if `ls ~/.ssh/id_ed25519.pub` already prints a file). **On your computer:**
   ```bash
   ssh-keygen -t ed25519
   cat ~/.ssh/id_ed25519.pub
   ```
   Press Enter for the default file; a passphrase is recommended. The second command prints the public key to paste into Linode.
3. **Linode:** create a Linode: Nanode 1 GB, region Frankfurt, image Ubuntu 24.04 LTS, a strong root password (saved in your password manager), and your SSH public key under "SSH Keys". Note its IPv4 address: that's `<server-ip>`.
4. **Cloudflare DNS:** adveis.dev → DNS → Records → Add record: type `A`, name `api.players`, IPv4 address `<server-ip>`, proxy status **DNS only** (grey cloud). Caddy gets its own certificate, and behind Cloudflare's proxy every visitor would share Cloudflare's addresses in the rate limit. Optionally an `AAAA` record with the Linode's IPv6 address, also DNS only. Check **on your computer**:
   ```bash
   getent hosts api.players.adveis.dev
   ```
   Success: it prints `<server-ip>` (or the IPv6 address). If it prints nothing, wait a few minutes for DNS.

### 2.2 Log in and update

**On your computer:**
```bash
ssh root@<server-ip>
```
The first time it asks to trust the host key: type `yes`. Success: a `root@…:~#` prompt. Everything in 2.2–2.7 runs in that session.

**On the host:**
```bash
apt-get update && apt-get upgrade -y
apt-get install -y tmux
test -f /var/run/reboot-required && echo "reboot needed" || echo "no reboot needed"
```
If a dialog asks about a changed configuration file, keep the installed version (the default). If the last line prints `reboot needed`, run `reboot`, wait a minute and `ssh root@<server-ip>` again.

### 2.3 SSH with keys only

Why: the root password stays usable from the Linode web console (Lish) for emergencies, but nobody can guess it over SSH. **On the host:**
```bash
printf 'PasswordAuthentication no\nKbdInteractiveAuthentication no\n' > /etc/ssh/sshd_config.d/00-keys-only.conf
sshd -t && systemctl reload ssh
sshd -T | grep -E '^(passwordauthentication|kbdinteractiveauthentication)'
```
Success: the last command prints `passwordauthentication no` and `kbdinteractiveauthentication no`. Keep this session open and check from a **second terminal on your computer**:
```bash
ssh root@<server-ip> echo key login works
```
Success: it prints `key login works` without asking for a password. (If it fails, fix it from the still-open session: `rm /etc/ssh/sshd_config.d/00-keys-only.conf && systemctl reload ssh`.) Then prove a password is refused, from the same second terminal:
```bash
ssh -o PubkeyAuthentication=no -o PreferredAuthentications=password root@<server-ip>
```
Success: `root@<server-ip>: Permission denied (publickey).` with no password prompt. Paste it.

### 2.4 Swap (1 GB)

Why: 1 GB of RAM is tight for Postgres + Node; swap keeps a memory spike from killing a container. **On the host:**
```bash
fallocate -l 1G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
free -h
```
Success: the `Swap:` row of `free -h` shows at least `1.0Gi` total (Linode may already add a small swap disk; the two add up).

### 2.5 Firewall

**On the host:**
```bash
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443
ufw --force enable
ufw status
```
Success: `Status: active` and `ALLOW` rows for `22/tcp`, `80/tcp` and `443` (plus their `(v6)` twins). 443 is open for TCP and UDP (HTTP/3). Note: Docker opens published container ports past `ufw`. That's why only Caddy publishes ports; `db` and `api` are reachable only inside the compose network.

### 2.6 Docker Engine and the compose plugin

From Docker's apt repository (Docker's install guide for Ubuntu). **On the host:**
```bash
apt-get install -y ca-certificates curl
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
tee /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
docker run --rm hello-world
docker compose version
```
Success: `Hello from Docker!` and `Docker Compose version v2.…` (or later).

### 2.7 The app directory and `.env`

**On the host:**
```bash
mkdir -p /opt/our-players
```
**On your computer** (repo root):
```bash
scp deploy/.env.example root@<server-ip>:/opt/our-players/.env
```
**On the host:**
```bash
cd /opt/our-players
chmod 600 .env
sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$(openssl rand -hex 24)/" .env
sed -i 's/^API_HOST=.*/API_HOST=api.players.adveis.dev/' .env
sed -i 's|^CORS_ORIGINS=.*|CORS_ORIGINS=https://our-players.<cf-subdomain>.workers.dev|' .env
grep -v '^POSTGRES_PASSWORD=' .env
grep -cE '^POSTGRES_PASSWORD=[0-9a-f]{48}$' .env
```
Success: the first `grep` shows your `API_HOST` and `CORS_ORIGINS` (no `<` `>` left except in `API_TAG`, which the next step sets); the second prints `1` (a 48-character hex password is in place). Don't paste the password anywhere.

### 2.8 Ship the image (without starting anything)

`compose` needs every required key, `API_TAG` included, even to start only the database, so the image is shipped first. **On your computer**, from a clean checkout (no uncommitted or untracked files):
```bash
deploy/deploy.sh root@<server-ip> --ship-only
```
It builds the image (with `docker`, or `podman` if Docker isn't usable), streams it to the host, copies `compose.yaml` and `Caddyfile`, and sets `API_TAG`. The first run takes several minutes. It opens several SSH connections: if your key has a passphrase, run `ssh-add` once first so you type it only once. Success: it ends with `API_TAG=<sha>` and `shipped <sha> (--ship-only: nothing restarted)`. A warning that the branch isn't `main` is fine for the very first deploy.

### 2.9 The probe (both upstream APIs reachable from the host)

**On the host:**
```bash
cd /opt/our-players
docker compose run --rm --no-deps api tsx scripts/probe.ts
```
Success: one line per endpoint, ending with `N/N ok` (all of them ok). Paste the output into the session (criterion 1). `--no-deps` keeps the database stopped; the probe doesn't need it.

### 2.10 Fill the database

Run section 5, "Rebuild from scratch", steps 1–5 (it ends by starting everything). The volume is empty the first time, so skip its step 0.

### 2.11 After the first start

**On your computer:**
```bash
curl -fsS https://api.players.adveis.dev/health; echo
curl -sS -m 5 http://<server-ip>:3001/health; echo "exit=$?"
```
Success: the first prints `{"ok":true,…}`. The second must fail (`exit=7` or `exit=28`): port 3001 isn't reachable from outside. If the first fails with a certificate error, Caddy may still be getting its certificate: wait a minute and retry, and check `docker compose logs caddy | grep -i certif` on the host.

Then run the post-deploy checks in section 7 (health, meta, the access-log line, Caddy without client IPs, search, the rate limit) and set up monitoring (section 8).

## 3. Deploy

Deploys go from a clean, up-to-date `main`. **On your computer:**
```bash
git switch main
git pull
deploy/deploy.sh root@<server-ip>
```
It builds and ships the image as in 2.8, then on the host runs `docker compose up -d --wait` (replaces the API container; the database and its data stay), `caddy reload` (applies a changed `Caddyfile`), `docker compose ps` and a `curl` of `https://$API_HOST/health`. Success: `docker compose ps` lists `db`, `api` and `caddy` as `Up` (`api` and `db` `(healthy)`), then `{"ok":true,…}` and `deployed <sha>`.

The API is unavailable for roughly 10–40 s while the new container starts and migrates; a running job tick gets up to 2 minutes to finish first. The scheduler catches up on anything it missed.

If it fails: on the host, `cd /opt/our-players && docker compose ps && docker compose logs --tail 100 api`, then roll back (section 4) if the new version doesn't start.

## 4. Rollback

The previous images stay on the host. **On the host:**
```bash
cd /opt/our-players
grep '^API_TAG=' .env
docker images localhost/our-players-api
```
The first line is the version running now; the list shows every shipped tag, newest first. Pick the one before it (`git log --oneline` on your computer shows which commit each tag is) and put it in place of `<previous-tag>`:
```bash
sed -i 's/^API_TAG=.*/API_TAG=<previous-tag>/' .env
docker compose up -d --wait
curl -fsS "https://$(grep '^API_HOST=' .env | cut -d= -f2)/health"; echo
```
Success: `{"ok":true,…}`.

**Migrations only move forward.** The old version starts on the newer schema. That works when the newer migrations only added things (new tables, new nullable columns), which is true of all of them so far (look at the SQL in `apps/server/drizzle/` between the two commits). If a migration renamed or dropped something, roll forward with a fix instead, or do the rebuild (section 5) on the old version.

**Pruning old images** (each is ~300 MB; the disk is 25 GB). Keep the running tag and the one before it:
```bash
docker images localhost/our-players-api
docker rmi localhost/our-players-api:<old-tag>
docker image prune -f
df -h /
```
`docker rmi` refuses to remove the image a container uses, so the running one is safe.

## 5. Rebuild from scratch

Rebuilds the whole database from the upstream APIs (D-021: nothing in it is lost for good). Used for the first fill and when the database is lost or broken. It runs with the API stopped, so no scheduler competes with the jobs (the job lock is per process).

**Preseason note:** `backfill` and `season-stats` fetch only the current season. A rebuild done before the regular season starts (roughly September to mid-October) stores no season stats for the season that just ended, so player pages show none until games are played. Late October onward this doesn't apply.

**Season starts (2026-27),** from `docs/sources/nhl.md` and checked against the schedule: NHL regular season from **2026-09-29**, NBA from **2026-10-20**. Update these for later seasons (the first regular-season date of each league).

Run it inside `tmux`, so a dropped SSH connection doesn't stop it. **On the host:**
```bash
tmux new -s rebuild -c /opt/our-players
```
(Detach with `Ctrl-b` then `d`; reattach with `tmux attach -t rebuild`.)

**Step 0 (recovery only, never the first time): delete the database.**
> **Warning:** this deletes every stored game, stat line and job run. Make sure this is the host you mean.
```bash
docker compose down
docker volume rm our-players_pgdata
```
(Don't use `docker compose down -v`: it would also delete Caddy's certificates, and Let's Encrypt limits how often they can be issued again.)

**Step 1: start the database alone.**
```bash
docker compose up -d --wait db
```
Success: `Container our-players-db-1 Healthy`.

**Steps 2–4: the jobs.** Run them one at a time. Each prints progress lines and ends with a `"msg":"finished"` line and `requests by host: …`. Success is `"status":"succeeded"` in the finished line. If one ends `"status":"partial"`, its `error` names the games that failed: copy that line into the session and carry on (the scheduler and a later run of the same command retry them; jobs are idempotent).

Step 2, rosters (all current players, so the backfill finds them):
```bash
docker compose run --rm api tsx scripts/job.ts roster --league nhl
docker compose run --rm api tsx scripts/job.ts roster --league nba
```
Step 3, every game of the season so far, up to yesterday (UTC):
```bash
docker compose run --rm api tsx scripts/job.ts backfill --league nhl --from 2026-09-29 --to "$(date -u -d yesterday +%F)"
docker compose run --rm api tsx scripts/job.ts backfill --league nba --from 2026-10-20 --to "$(date -u -d yesterday +%F)"
```
Step 4, season stats:
```bash
docker compose run --rm api tsx scripts/job.ts season-stats --league nhl
docker compose run --rm api tsx scripts/job.ts season-stats --league nba
```
Jobs make at most one request per second per upstream host; a late-October rebuild is some hundreds of requests, well under an hour. If you run step 3 between about 00:00 and 08:00 UTC, last night's games may still be on: the scheduler picks them up after step 5.

**Step 5: start everything.**
```bash
docker compose up -d --wait
docker compose ps
```
Success: `db`, `api`, `caddy` `Up`; `api` and `db` `(healthy)`. On startup the scheduler runs a catch-up tick (schedule, results, rosters, season stats).

**Step 6: totals.** Request count and duration of the rebuild (every job run before the scheduler's first `schedule` run):
```bash
docker compose exec -T db psql -U our_players <<'SQL'
select count(*) as runs,
       count(*) filter (where status <> 'succeeded') as not_succeeded,
       sum((counts->>'requests')::int) as requests,
       min(started_at) as first_start,
       max(finished_at) as last_finish,
       max(finished_at) - min(started_at) as duration
from job_runs
where started_at < coalesce((select min(started_at) from job_runs where job = 'schedule'), 'infinity');
SQL
```
Paste the output into the session; it goes in the table below. `duration` is wall time from the first job's start to the last one's end, including your pauses between commands.

**Recorded rebuilds**

| Date | Runs | Requests | Duration | Notes |
| --- | --- | --- | --- | --- |
| _(filled in after the first rebuild)_ | | | | |

## 6. Rotating secrets

No API keys exist: both upstream APIs are keyless. The secrets are the database password, your SSH key and your Cloudflare login (it controls the DNS).

### Database password

The new password must be **hex only** (`openssl rand -hex 24`), because compose puts it into `DATABASE_URL` unescaped. **On the host:**
```bash
cd /opt/our-players
new=$(openssl rand -hex 24)
docker compose exec -T db psql -U our_players -c "ALTER USER our_players PASSWORD '$new'"
sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$new/" .env
unset new
docker compose up -d --wait api
curl -fsS "https://$(grep '^API_HOST=' .env | cut -d= -f2)/health"; echo
```
Success: `ALTER ROLE`, then `{"ok":true,…}`. Order matters: Postgres first, then `.env`, then the API restarts with the new `DATABASE_URL`. (`POSTGRES_PASSWORD` only sets the password when the volume is first created, so changing `.env` alone does nothing to the database.) If compose also recreates `db` because its environment changed, that's fine: the data is in the volume.

### SSH key

**On your computer:**
```bash
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_new
ssh-copy-id -i ~/.ssh/id_ed25519_new.pub root@<server-ip>
ssh -i ~/.ssh/id_ed25519_new root@<server-ip> echo new key works
```
Success: `new key works`. Then **on the host** remove the old key's line (it ends with the old key's comment, e.g. `you@yourcomputer`) from `/root/.ssh/authorized_keys` with `nano /root/.ssh/authorized_keys`, and on your computer move the new key into place (`mv ~/.ssh/id_ed25519_new ~/.ssh/id_ed25519` and the same for `.pub`). Also replace the key in Linode's "SSH Keys" profile, so a rebuilt Linode gets the new one.

### Cloudflare

Change the password under Manage account → Authentication, and keep two-factor authentication on. S14b's `CLOUDFLARE_API_TOKEN`: My Profile → API Tokens → roll it, then update the repo secret (`gh secret set CLOUDFLARE_API_TOKEN`).

## 7. Checks

All **on the host** after `cd /opt/our-players`, unless marked otherwise.

**Status and logs**
```bash
docker compose ps
docker compose logs --tail 100 api
```
`ps`: three services `Up`, `api` and `db` `(healthy)`. Follow the API log live with `docker compose logs -f api` (`Ctrl-c` to stop).

**Health** (criterion 2):
```bash
curl -sS -w ' %{http_code}\n' https://api.players.adveis.dev/health
curl -sS -w ' %{http_code}\n' https://api.players.adveis.dev/health/data
curl -sS -w ' %{http_code}\n' https://api.players.adveis.dev/v1/meta
```
`/health`: `{"ok":true,"lastSuccess":{…}} 200` (the database answers). `/health/data`: `{"ok":true} 200`, or 503 with the reasons (section 8). `/v1/meta`: each league's `latestGameDate` is the last game night and `dataUpdatedAt` is recent.

**Job runs** (criterion 2, after a few hours: the scheduler's runs appear here):
```bash
docker compose exec -T db psql -U our_players <<'SQL'
select id, job, args->>'league' as league, status, started_at, finished_at, counts->>'requests' as requests
from job_runs order by id desc limit 20;
SQL
```

**Access log without query strings** (criterion 6):
```bash
curl -sS -o /dev/null -w '%{http_code}\n' "https://api.players.adveis.dev/v1/days/$(date -u -d yesterday +%F)?countries=LVA"
docker compose logs api | grep '/v1/days' | tail -1
```
Success: a line like `{"level":"info","msg":"request","method":"GET","path":"/v1/days/2026-10-26","status":200,"ms":12}`: the path without `?countries=LVA`. Paste it.

**No client IPs in Caddy's logs:**
```bash
docker compose logs caddy | grep -E '([0-9]{1,3}\.){3}[0-9]{1,3}' | grep -v '127\.0\.0\.1'
```
Success: no line about a client request (e.g. no TLS handshake error with a visitor's address). Caddy's own admin endpoint (`127.0.0.1:2019`) is filtered out above. A certificate line naming a Let's Encrypt server is fine; a `request` with `remote_ip` or `client_ip` isn't, so tell Claude.

**Search on Postgres** (the ICU collation):
```bash
curl -sS 'https://api.players.adveis.dev/v1/players/search?q=kris' | head -c 300; echo
```
Success: `{"players":[{"id":…,"firstName":"Kris",…`.

**Rate limit** (criterion 10). **On your computer** (it waits for the next full minute, because the limit counts per clock minute):
```bash
sleep $((60 - 10#$(date +%S))); for i in $(seq 125); do curl -s -o /dev/null -w '%{http_code}\n' https://api.players.adveis.dev/v1/meta; done | uniq -c
curl -sS -i https://api.players.adveis.dev/v1/meta | grep -i '^HTTP\|^retry-after\|^{'
```
Success: `120 200` then `5 429`, and the second command shows `HTTP/2 429`, `retry-after: …` and `{"error":{"code":"RATE_LIMITED",…}}` (if the minute has rolled over by then it shows 200; run both again). If you see more than 120 × `200`, the loop crossed a minute boundary: run it again. Paste the output.

**Forced staleness: `/health/data` alerts** (criterion 7). Simulates a dead scheduler; nothing is lost. Do it during the European day, when last night's games started 5–20 hours ago, with the monitors from section 8 set up.
1. Stop the scheduler:
   ```bash
   sed -i 's/^SCHEDULER_ENABLED=.*/SCHEDULER_ENABLED=0/' .env
   docker compose up -d --wait api
   docker compose logs api | grep 'scheduler off'
   ```
   Success: `scheduler off (set SCHEDULER_ENABLED=1)`.
2. Make one of last night's games look as if its box score never arrived:
   ```bash
   docker compose exec -T db psql -U our_players <<'SQL'
   update games set boxscore_fetched_at = null
   where public_id = (select public_id from games where status = 'FINAL' and boxscore_fetched_at is not null
                      and start_time_utc between now() - interval '20 hours' and now() - interval '5 hours'
                      order by start_time_utc desc limit 1)
   returning public_id, start_time_utc;
   SQL
   ```
   Success: one row and `UPDATE 1`. (`UPDATE 0` means no game started 5–20 h ago; try later in the day after a game night.)
3. Check:
   ```bash
   curl -sS -w ' %{http_code}\n' https://api.players.adveis.dev/health/data
   curl -sS -w ' %{http_code}\n' https://api.players.adveis.dev/health
   ```
   Success: `{"error":{"code":"STALE","message":"<that game>: started over 4 h ago, no box score yet"}} 503`, while `/health` stays `200`. Within ~5–10 minutes UptimeRobot emails that the data monitor is down. Paste both lines and confirm the email.
4. Restore:
   ```bash
   sed -i 's/^SCHEDULER_ENABLED=.*/SCHEDULER_ENABLED=1/' .env
   docker compose up -d --wait api
   sleep 60
   curl -sS -w ' %{http_code}\n' https://api.players.adveis.dev/health/data
   ```
   Success: `{"ok":true} 200`: the startup catch-up fetched the box score again. UptimeRobot then emails that the monitor is up. Still 503? Wait a few minutes and run the curl again: the startup tick runs NHL's jobs before NBA's, and daily jobs may be due first.

**Lines within 15 minutes** (criterion 9). The morning after a game night the scheduler handled live (not a backfilled night: `backfill` sets `final_at` to its own run time, so the numbers would mean nothing). `current_date - 1` is last night's US game date when you run it in the European morning:
```bash
docker compose exec -T db psql -U our_players <<'SQL'
with r as (select started_at, args->>'league' as league from job_runs where job = 'results')
select g.public_id, g.final_at, g.boxscore_fetched_at,
       g.boxscore_fetched_at - (select max(r.started_at) from r
         where r.league = g.league::text
           and r.started_at < (select max(r2.started_at) from r r2 where r2.league = g.league::text and r2.started_at <= g.final_at)
       ) as delay
from games g where g.game_date = current_date - 1 and g.status = 'FINAL' order by delay desc;
SQL
```
`delay` is the box score's arrival minus the start of the last `results` run that still saw the game not final, an upper bound on "minutes after the final". Success: every `delay` is at most `00:15:00`. Paste the output.

**Disk and log sizes:**
```bash
df -h /
docker system df
du -sh /var/lib/docker/containers
free -h
```
The disk shouldn't pass ~80% (prune old images, section 4). Container logs stay under 50 MB per service (rotated).

**Latency on the host's Postgres** (reads only, safe with the API up). Pick a game day of this season with many games (both leagues playing):
```bash
docker compose run --rm api tsx scripts/latency.ts --date <YYYY-MM-DD>
docker compose run --rm api tsx scripts/latency.ts --date <YYYY-MM-DD> --countries LVA,USA,CAN
```
Paste both outputs. For comparison, locally on PGlite (2,881 games, 91,339 lines, 2025-12-23): LVA p95 128.8 ms, LVA,USA,CAN p95 424.7 ms.

## 8. Monitoring

UptimeRobot, free plan (5-minute checks, email alerts). Create two **HTTP(s)** monitors, both alerting your email:

| Monitor | URL | Down means |
| --- | --- | --- |
| Our Players data | `https://api.players.adveis.dev/health/data` | The API answers but data is stale: lines are late, `results` keeps failing, or no schedule ran for 50 h. |
| Our Players host | `https://api.players.adveis.dev/health` | The host, Docker, Caddy, the API or the database is down (or DNS/TLS is broken). |

The first thing to look at:
- **Both down:** `ssh root@<server-ip>`, then `cd /opt/our-players && docker compose ps && docker compose logs --tail 100 api caddy`. If SSH doesn't answer, look at the Linode in the Linode console (running? CPU/memory graphs) and use its web console (Lish).
- **Only data down:** `curl -sS https://api.players.adveis.dev/health/data` names the reasons:
  - `<game-id>: started over 4 h ago, no box score yet`: box scores aren't arriving. Is the scheduler running (`docker compose logs api | grep scheduler`)? Are `results` runs failing (the job-runs query in section 7, and `docker compose logs --tail 200 api | grep '"level":"error"'`)? A game stuck upstream alerts for at most 48 h.
  - `<league>: last 3 results runs failed or partial`: the upstream API is down or changed; the runs' `error` column says which. If it changed shape, the adapter needs a fix (a session with Claude).
  - `schedule: no successful run in 50 h`: the daily `schedule` job failed twice; same places to look.

## 9. Production API URL

`https://api.players.adveis.dev`. It's S14b's `WEB_API_URL` repo variable and the API URL of S11b's Android build profile.

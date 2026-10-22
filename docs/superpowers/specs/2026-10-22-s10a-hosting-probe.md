# S10a — Hosting choice + upstream probe — design

Spec: `docs/SESSIONS.md` §S10a. Goal: pick the host and prove both upstream APIs answer from it, before paying monthly. Also carries the small Today fix from PROGRESS.md "Current state" (owner, 2026-10-21).

## Contract (quoted from §S10a)

**Out of scope:** Dockerfile, deploy, alerting, rate limit (S10b).

**Acceptance criteria**
1. The memo compares the options on the points above; your pick is recorded in the design doc.
2. Probe output from the chosen provider shows both APIs reachable with normal latency (pasted by you); the throwaway server is deleted (you confirm).
3. `pnpm verify` green.

## Hosting memo (prices checked 2026-10-22, excl. VAT)

Every option runs exactly one always-on instance: the scheduler and its job lock live in the API process, so a host that sleeps or scales to zero can't run it.

| Option | Monthly | Effort | Scheduler | Query strings in access logs |
|---|---|---|---|---|
| **Linode Nanode 1 GB** (1 vCPU, 25 GB, 1 TB, Frankfurt), hourly billing | **$5** | Medium: we run Docker Compose (API + Postgres + Caddy), OS updates, swap | In the API container, always on | We own the proxy: Caddy's access log is configured to leave the query out (S10b proves it with a log line) |
| DigitalOcean droplet 1 GB, per-second billing | $6 | Same as Linode | Same | Same |
| Hetzner CX23 (4 GB) | €5.99 | Same | Same | Same |
| OVH VPS-1 (2 vCPU, 4 GB, 40 GB, unlimited traffic) | €4.49 (€3.81 with 12 months) | Same | Same | Same |
| Render: Starter + Postgres | ~$13–15 | Low: git deploy, managed DB | A paid always-on web service (free tier sleeps after 15 min) | HTTP request logs Pro-only; query-string handling undocumented |
| Railway: $5 plan + metered usage | ~$8–12 (estimate) | Low | Always-on service | HTTP logs on all plans; query-string handling undocumented |
| Fly.io: machine + Managed Postgres | ~$3.69 + $38 | Low–medium | Always-on machine | Fly's proxy; not checked further (cost rules it out) |

Availability on 2026-10-22: DigitalOcean locked the account at sign-up (fraud check after a failed PayPal attempt), never tested. Hetzner: no new cloud servers ("Limited availability of cloud instances" since 2026-06-26). OVH: no European stock (only Canada, Singapore, Sydney); a candidate for later apps.

Also set aside: AWS (Lightsail $7; EC2 ~$12–14 once the $0.005/h IPv4 is added), Contabo (reputation), Netcup (no cheaper with a contract), Hostinger (renewal prices), a serverless rewrite on Workers/Lambda (2–3 sessions of rework to save ~$5/month).

**Pick (owner): Linode / Akamai Cloud, Nanode 1 GB, Frankfurt, $5/month + 21% Latvian VAT, Ubuntu 24.04, Docker Compose (API + Postgres + Caddy) in S10b.** Why: the cheapest always-on option that was actually available and tested; a plain VPS, so we own the reverse proxy and can guarantee no query strings in access logs (VISION §11); room for the owner's later small apps on the same box; billed hourly; moving later is easy (rebuild per D-021, or `pg_dump`).

**Notes for S10b:** 1 GB plus swap is enough; build images off the box. HTTPS needs a hostname: the owner leans to a free deSEC `*.dedyn.io` name now and an own domain (e.g. `players.adveis.com`) once a second project exists, switching gradually (Caddy answers both names, so old app versions keep working). Decide in S10b.

## Probe results (criterion 2)

Owner ran `pnpm probe` on 2026-10-22. Baseline from home: 14/14 ok, 39–1206 ms (ESPN athlete slowest). From a Linode Nanode in Frankfurt, inside `node:24` (the hostname is the container ID):

```
probe from 0fad4c71973d at 2026-10-22T18:25:10.561Z as OurPlayers/0.1.0 (+https://github.com/Adve1s/our-players)
ok   200   186 ms    41.7 kB  nhl score              api-web.nhle.com
ok   200    16 ms    97.4 kB  nhl schedule           api-web.nhle.com
ok   200   112 ms    12.4 kB  nhl schedule-calendar  api-web.nhle.com
ok   200   362 ms    13.1 kB  nhl boxscore           api-web.nhle.com
ok   200   249 ms    11.1 kB  nhl roster             api-web.nhle.com
ok   200   275 ms    18.4 kB  nhl player-landing     api-web.nhle.com
ok   200   229 ms   312.3 kB  nhl skater-summary     api.nhle.com
ok   200   170 ms    24.9 kB  nhl goalie-summary     api.nhle.com
ok   200    60 ms    35.2 kB  espn scoreboard        site.api.espn.com
ok   200   130 ms   429.5 kB  espn summary           site.api.espn.com
ok   200    48 ms   131.7 kB  espn teams             site.api.espn.com
ok   200   130 ms    92.1 kB  espn roster            site.api.espn.com
ok   200   409 ms     4.8 kB  espn athlete           sports.core.api.espn.com
ok   200   340 ms   631.6 kB  espn byathlete         site.web.api.espn.com
14/14 ok
```

The throwaway Linode was deleted afterwards (owner confirmed). How it was run, for S10b's re-run: tar the working tree over ssh to `~/op` on the server, `apt-get install -y docker.io`, then
`docker run --rm -e COREPACK_ENABLE_DOWNLOAD_PROMPT=0 -v ~/op:/op -w /op node:24 bash -c 'corepack enable && pnpm install --filter @our-players/server... && pnpm probe'`.

## Repo work 1: `pnpm probe` as a deliverable

The spike (`apps/server/scripts/probe.ts`) splits like `recap`:

- **`apps/server/src/probe.ts`** (logic): the target list (one request per upstream endpoint the jobs use, URLs from `nhlUrls`/`espnUrls`, IDs from recorded fixtures, today's date and season from an injected clock) and a function that runs them one by one through `createPoliteClient` with `maxRetries: 0` (the probe shows the first answer each host gives) and an injected fetch that it wraps for timing. Each target yields a printed line: `ok` with status, ms, kB, name, host; `FAIL` on an error status, a network error (status `---`) or a body that isn't JSON. It returns the lines plus the failure count.
- **`apps/server/scripts/probe.ts`** (edges): hostname, package version, User-Agent from config, real `fetch`, prints, `process.exitCode = 1` on any failure.
- **Test** `apps/server/test/probe.test.ts` with a fake fetch, no network: all-ok run → 14 ok lines, 0 failures; one target answering 503, one throwing, one returning HTML → each a `FAIL` line naming that target, failure count 3; every target's URL is fetched once, in order, with the User-Agent.

## Repo work 2: Today keeps the last shown day when a step fails

Today a day stepped to with ‹/› that can't load behaves differently per platform: offline on web the fetch pauses, the old day stays under the plain offline banner and ‹/› stay grey, so the tap looks ignored; on Android the fetch fails, TanStack drops the placeholder and the full-screen "Try again" replaces everything, stepper included.

**Behaviour (agreed with the owner):**

- **A step to another date fails** (‹/›, Latest, or the latest day moving overnight): the day that was on screen stays, stepper included, and a banner names the day that didn't open — `You're offline — couldn't open {dayLabel}.` (paused) or `Couldn't load {dayLabel}.` with a Try again button (error; Try again refetches meta and the requested day, the existing `retry`). The stepper's label shows the kept day.
- **The same date with new preferences fails** (a Settings change, then Today): the kept day stays with the existing wording, `You're offline — showing saved data.` / `Couldn't refresh — showing saved data.`
- **The latest day itself fails:** handled as any other step. Latest stays marked as current (the screen is asking for the latest), so Try again is the retry.
- **Nothing shown yet** (cold start): the full-screen error, unchanged.
- **‹/›** are grey only while the new day is loading; once the step has failed (paused or error) they step from the kept day, whose neighbours are right for it.
- Back online, a paused step resumes on its own and the new day replaces the kept one.

**Where:**
- `apps/mobile/src/app/(tabs)/index.tsx`: remember the last day loaded for its own key in a ref; when the requested day has no data and failed (error, or paused while pending), show that day instead of the `!day.data` branch. Stepper prev/next null only while the placeholder is fetching.
- `apps/mobile/src/lib/day-message.ts`: `refreshBanner` also takes the requested date and the shown day's date and returns `{ text, retry }` (or null): the two new texts when the shown day isn't the requested one, the existing texts otherwise; `retry` true only for `Couldn't load {dayLabel}.`. The screen's `Banner` gains an optional Try again (`AccentButton`).
- **Tests** (red/green, `apps/mobile/test/today-queries.test.ts`, real observers over a fake fetch): a step from 2026-03-16 to 2026-03-17 that errors → `Couldn't load …` with retry; the same step offline (`onlineManager.setOnline(false)`) → `You're offline — couldn't open …`; the same date with new prefs, error and offline → the "showing saved data" texts; a step that is still loading → null; plus one test pinning the TanStack behaviour the ref exists for (an errored new key has no placeholder data).
- **Screenshots:** two new states — `today-step-failed` (the next day's `/v1/days` request aborted, then ›) and `today-step-offline` (context offline, then ›).

**Calls made in design (Claude's):** the probe function takes the polite client's `minIntervalMs` so the test passes 0 (the real run keeps 1 s per host); the season keeps the spike's rule (July or later starts the new season). The ref updates only from data that isn't placeholder; a paused placeholder counts as a failed step. When meta and the step both fail, the step's text wins (it names the day asked for). A step that gets a 404 reads "Couldn't load …" like any error. The existing `refreshBanner` tests move to the new signature with the same assertions.

**Builder's calls:** the banner's exact layout; the ref's name; how `refreshBanner`'s arguments are shaped.

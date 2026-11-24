# Our Players

A nationality-first sports tracker: it shows how athletes from the countries you follow (default: Latvia) did in NHL and NBA games last night — a morning recap. A hobby project; Claude writes most of the code.

- **Web app:** https://ourplayers.adveis.dev (works as a home-screen app on iPhone too)
- **Android:** in Google Play's closed testing as `dev.adveis.ourplayers`, by invitation only
- **Privacy policy:** https://ourplayers.adveis.dev/privacy

Data comes from the public NHL and ESPN web APIs. Not affiliated with or endorsed by the NHL, the NBA, their teams or ESPN.

## How it works

```
NHL / ESPN APIs ──(scheduled jobs, ≤1 request/s)──▶ Postgres ◀── Hono API (/v1) ◀── Expo app (Android + web)
```

- **Jobs** fetch schedules, results, rosters and season stats on a timer. Users never trigger an upstream call: the API only reads our database.
- **The API** is Hono on Node, behind Caddy on one small Linode in Frankfurt (`docs/DEPLOY.md`).
- **The app** is one Expo (React Native) codebase for Android and the web. Preferences stay on the device; there are no accounts or ads, and no analytics or tracking services, only a server request log with no IP addresses or query strings (`docs/store/data-safety.md`).

## Repo layout

| Path | What |
| --- | --- |
| `apps/server` | API, ingestion jobs, CLI scripts, Drizzle schema and migrations, one adapter per upstream source |
| `apps/mobile` | Expo Router app (Android + web), its web build and the store graphics scripts |
| `packages/shared` | Domain types, the API contract (zod) and pure logic, such as the player selection rule |
| `deploy/` | Docker Compose stack, Caddyfile and `deploy.sh` |
| `docs/` | Product, plan, progress, decisions, deploy and security runbooks, Play Store documents |

## Quick start

```sh
mise install        # Node from .tool-versions
corepack enable     # pnpm from package.json's packageManager
pnpm install
pnpm dev:server     # API on :3001 with a local PGlite database
pnpm dev:mobile     # Expo: w = web, QR = Android via Expo Go
pnpm verify         # typecheck + lint + tests
```

If `pnpm` then fails with "No version is set for shim: pnpm", run `corepack enable && mise reshim`. The local database starts empty: fill a day with `pnpm job backfill --league nhl --from <date> --to <date>` (stop the dev server first; the database allows one process at a time).

## Run the app

Start the API first (`pnpm dev:server`), then `pnpm dev:mobile`.

- **Web** (`w` in Expo): works as is. The app calls `http://localhost:3001`, and the API allows the Expo web origin `http://localhost:8081` by default. Serving the web app from another origin needs `CORS_ORIGINS` on the server (e.g. `CORS_ORIGINS=http://localhost:8091`).
- **Phone** (Expo Go, same Wi-Fi): the phone can't reach `localhost` on your computer. Find the computer's LAN address with `ip -4 -brief addr show scope global`, copy `apps/mobile/.env.example` to `apps/mobile/.env` and set `EXPO_PUBLIC_API_URL=http://<LAN-IP>:3001`, then restart `pnpm dev:mobile`.

## Screenshots

`pnpm screenshots` builds the web app, runs it against a seeded in-memory API (recorded fixtures, never your dev database) and captures the key screens in light and dark into `apps/mobile/.screenshots/` (git-ignored). It uses ports :3101 and :8091, so it runs next to the dev servers, and refuses to start if either is taken. CI doesn't run it.

`pnpm screenshots --store` writes the Play listing's four phone screenshots instead, to `docs/store/graphics/screenshots/`: it empties that tracked folder first, so `git diff` shows what changed and `git checkout` undoes a failed run.

It needs a Chromium: either `pnpm --filter @our-players/mobile exec playwright install chromium` once (without `--with-deps`, which fails on Arch), or a system one via `PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium pnpm screenshots`.

## Shipping

- **API:** `deploy/deploy.sh root@<server-ip>` from a clean `main` (`docs/DEPLOY.md`).
- **Web app:** a push to `main` that touches the app or its shared code deploys it to Cloudflare (`.github/workflows/deploy-web.yml`).
- **Android:** EAS builds, uploaded to Google Play by hand (`docs/store/release.md`).
- **Security:** a weekly dependency audit in CI, and a manual checklist before each store milestone (`docs/SECURITY-CHECKS.md`).

## Docs

- [Vision](docs/VISION.md): the product
- [Sessions](docs/SESSIONS.md): the build plan, one session at a time
- [Progress](docs/PROGRESS.md): where things stand
- [Decisions](docs/DECISIONS.md): why things are the way they are
- [Deploy](docs/DEPLOY.md) and [Security checks](docs/SECURITY-CHECKS.md): running the backend
- [Store](docs/store/): the Play listing, forms, testers and release guide
- [Workflow](docs/WORKFLOW.md): how the human and Claude work together

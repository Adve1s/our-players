# Our Players

A nationality-first sports tracker: it shows how athletes from the countries you follow (default: Latvia) did in NHL and NBA games — a morning recap. A hobby project; Claude writes most of the code.

## Quick start

```sh
mise install        # Node from .tool-versions
corepack enable     # pnpm from package.json's packageManager
pnpm install
pnpm dev:server     # API on :3001
pnpm dev:mobile     # Expo: w = web, QR = Android via Expo Go
pnpm verify         # typecheck + lint + tests
```

If `pnpm` then fails with "No version is set for shim: pnpm", run `corepack enable && mise reshim`.

## Run the app

Start the API first (`pnpm dev:server`, on :3001), then `pnpm dev:mobile`.

- **Web** (`w` in Expo): works as is. The app calls `http://localhost:3001`, and the API allows the Expo web origin `http://localhost:8081` by default. Only if you serve the web app from another origin do you set `CORS_ORIGINS` on the server (e.g. `CORS_ORIGINS=http://localhost:8091`).
- **Phone** (Expo Go, same Wi-Fi as the computer): the phone can't reach `localhost` on your computer, so point the app at the computer's LAN address. Find it with `ip -4 -brief addr show scope global` (the Wi-Fi line, e.g. `192.168.1.112`), then copy `apps/mobile/.env.example` to `apps/mobile/.env` and set `EXPO_PUBLIC_API_URL=http://<LAN-IP>:3001`. Expo reads `.env` at start: restart `pnpm dev:mobile` after changing it. CORS doesn't apply to the phone.

## Screenshots

`pnpm screenshots` builds the web app, runs it against a seeded in-memory API (the API tests' recorded fixtures, never your dev DB) and captures Today, Search and Settings at phone size (412×915), light and dark, into `apps/mobile/.screenshots/` (gitignored). It uses its own ports, :3101 (API) and :8091 (web), so it runs next to `pnpm dev:server` and `pnpm dev:mobile`; it refuses to start if either port is taken.

It needs a Chromium, one of:

- Playwright's own, installed once: `pnpm --filter @our-players/mobile exec playwright install chromium` (without `--with-deps`, which fails on Arch).
- A system Chromium: `PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium pnpm screenshots`.

CI doesn't run it.

## Docs

- [Vision](docs/VISION.md) — the product
- [Sessions](docs/SESSIONS.md) — the build plan, one session at a time
- [Progress](docs/PROGRESS.md) — where things stand
- [Decisions](docs/DECISIONS.md) — why things are the way they are
- [Workflow](docs/WORKFLOW.md) — how the human and Claude work together

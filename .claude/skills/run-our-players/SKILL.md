---
name: run-our-players
description: Start, run, smoke-test and drive the Our Players read API (apps/server, Hono on :3001 over PGlite). Use when asked to run or start the server, curl or hit a /v1 endpoint, check CORS, try a route change against real or fixture data, or stop the dev server and release the PGlite lock. The mobile app (apps/mobile) is not covered until S08.
---

The API is a Node server with a `curl`-able HTTP surface. Agents drive it two ways: `driver.ts` (the real app in memory over fixture data, offline) and `smoke.sh` (the real server on the dev DB, started, checked and stopped). Paths are relative to the repo root.

## Prerequisites

Node 22 or 24, pnpm via corepack, then `pnpm install`. No system packages, no Docker: the dev DB is PGlite on disk (`apps/server/.data/pglite`, gitignored), and tests use PGlite in memory.

## Run (agent path) — pick by what you need

**1. Try a route on known data (offline, deterministic): `driver.ts`.** It seeds an in-memory DB by running the real jobs over the recorded fixtures (the API tests' `seedApiDb()`), builds `createApp` with CORS for `http://localhost:8081`, and prints status, CORS/cache headers and pretty JSON for each path. About 15 s per run, mostly seeding. It never touches the dev DB or the network, so it works while the dev server runs and in cloud sessions.

```bash
node_modules/.bin/tsx .claude/skills/run-our-players/driver.ts --origin http://localhost:8081 "/v1/players/search?q=merzlikins" /v1/countries
node_modules/.bin/tsx .claude/skills/run-our-players/driver.ts "/v1/players/search?q=" /v1/players/nba-3059318
```

Flags: `--origin URL` sends an `Origin` header; `--now ISO` sets the clock (default `2026-10-18T12:00:00Z`, the players/countries tests' clock; the day tests use `2026-03-24T06:00:00Z`); `DRIVER_LOGS=1` prints the request log lines to stderr. Fixture IDs worth knowing are exported at the top of `apps/server/test/api-seed.ts` (Merzļikins `nhl-8478007`, Porziņģis `nba-3102531`, Embiid `nba-3059318`, Girgensons `nhl-8476878`).

**2. Check the real server on the owner's data: `smoke.sh`.** It starts `tsx src/main.ts` in the background (log in `$TMPDIR/our-players-api.log`, default `/tmp`), waits for `/health`, checks status codes for every v1 route plus CORS (allowed origin gets `access-control-allow-origin`, `https://evil.example` doesn't), then stops it with SIGTERM and waits for the PGlite lock to go. Exit 0 = all `ok`.

```bash
.claude/skills/run-our-players/smoke.sh
```

```
API up on http://localhost:3001 (log: /tmp/our-players-api.log)
ok   200 /health
ok   200 /v1/meta
...
ok   CORS (access-control-allow-origin: http://localhost:8081)
stopped, lock released
```

To keep the server up for your own `curl`s, pass `--keep`, then stop it with the lock file's pid:

```bash
.claude/skills/run-our-players/smoke.sh --keep
curl -s "localhost:3001/v1/players/search?q=porz"
curl -si -H "Origin: http://localhost:8081" localhost:3001/v1/meta | grep -i access-control
kill -TERM "$(cat apps/server/.data/pglite.lock)"
```

The dev DB holds whatever the owner's jobs loaded (`/v1/meta` shows each league's `latestGameDate`). The smoke checks only statuses, so it doesn't depend on exact contents.

## Run (human path)

`pnpm dev:server` runs `tsx watch` (restarts on edits). Stop it with Ctrl-C. From a script, send SIGINT to its whole process group (`kill -INT -- -<pgid>`, where pgid is the group of the pid in `apps/server/.data/pglite.lock`). That releases the lock as well.

## Test

```bash
pnpm test api-players api-cors api-client   # 3 files, 63 tests, ~12 s
pnpm verify                                 # typecheck + biome + all tests, ~2 min
```

## Gotchas

- **The dev DB is one process at a time.** A running server holds `apps/server/.data/pglite.lock`, and `pnpm recap`, `pnpm job`, `pnpm latency`, `pnpm db:*` and a second server all fail while it's up. `smoke.sh` refuses to start when the lock's pid is alive. `driver.ts` is unaffected (in-memory DB).
- **Don't drive `pnpm dev:server` from scripts.** tsx watch SIGKILLs its child 5 s after a signal, so a slow shutdown leaves the lock behind (it is taken over at the next start). `smoke.sh` runs plain `tsx src/main.ts`, which gets SIGTERM and closes the DB.
- **`$!` is not the server.** After `setsid … &` or `pnpm … &`, `$!` is a wrapper that may already have exited (`kill: (-N) - No such process`). Use the pid in `apps/server/.data/pglite.lock`: it is the process that holds the DB.
- **`curl` sees no CORS headers without an `Origin` header,** and `/health` never has them. Only origins in `CORS_ORIGINS` get them (default `http://localhost:8081`, comma-separated bare origins; a path or trailing slash makes the server refuse to start).
- **The request log has paths only, never queries** (preferences are private). Grep the log for `"path":"/v1/players/search"`; you won't find `q=` in it.
- **Merzļikins is not in the owner's dev DB** (`/v1/players/nhl-8478007` → 404 there). He exists only in the fixture seed, so use `driver.ts` for him.
- **Loading new data calls the NHL/ESPN APIs** (`pnpm job …`, stop the server first). Cloud sessions can't reach them; use `driver.ts`.

## Troubleshooting

- **`PGlite …/apps/server/.data/pglite is in use by process N (is pnpm dev:server running?)`**: a server is running. Run `kill -TERM "$(cat apps/server/.data/pglite.lock)"`, then retry.
- **`dev DB is held by pid N (pnpm dev:server?) - stop it first`** (from `smoke.sh`): same cause, same fix.

# Our Players

A nationality-first sports tracker: a morning recap of how athletes from the countries you follow (default: Latvia) did in last night's NHL and NBA games.

A hobby project, built in Claude Code sessions. The product spec is [`docs/VISION.md`](docs/VISION.md); the current state and the next step are in [`docs/PROGRESS.md`](docs/PROGRESS.md).

## Layout

- `apps/server` — Node + TypeScript: Hono read API, ingestion jobs, CLI
- `apps/mobile` — Expo (React Native) app for Android and web
- `packages/shared` — domain types, API contract and pure logic, used as TypeScript source by both apps

## Quick start

Prerequisites: Node through [mise](https://mise.jdx.dev) (the version is pinned in `.tool-versions`) and corepack, which provides the pnpm version pinned in `package.json`.

```bash
mise install          # Node from .tool-versions
corepack enable       # pnpm from packageManager
pnpm install
pnpm verify           # typecheck + lint + tests
pnpm dev:server       # API on http://localhost:3001 (try /health)
pnpm dev:mobile       # Expo dev server: press w for web, scan the QR code with Expo Go
```

All commands are listed in [`CLAUDE.md`](CLAUDE.md#commands-repo-root).

## Docs

- [`docs/VISION.md`](docs/VISION.md) — product spec
- [`docs/SESSIONS.md`](docs/SESSIONS.md) — the build, session by session
- [`docs/PROGRESS.md`](docs/PROGRESS.md) — current state, parking lot, session log
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — why things are the way they are
- [`docs/WORKFLOW.md`](docs/WORKFLOW.md) — how the human and Claude work together

Data comes from the unofficial public NHL and ESPN APIs. Not affiliated with the NHL, the NBA or ESPN.

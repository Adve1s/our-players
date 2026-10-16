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

## Docs

- [Vision](docs/VISION.md) — the product
- [Sessions](docs/SESSIONS.md) — the build plan, one session at a time
- [Progress](docs/PROGRESS.md) — where things stand
- [Decisions](docs/DECISIONS.md) — why things are the way they are
- [Workflow](docs/WORKFLOW.md) — how the human and Claude work together

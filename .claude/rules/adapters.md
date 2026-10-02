---
paths:
  - "apps/server/src/sources/**"
---

# Adapter rules

- Layout per source: `client.ts` (URL builders + fetching through the injected polite client), `schemas.ts` (raw zod schemas: only fields we use, unknown fields allowed), `map-*.ts` (pure functions raw → normalized model), `index.ts` (the adapter's public surface).
- Mappers are pure and synchronous: no fetching, no DB, no clock reads (pass "now" in when needed).
- Units: TOI and minutes → integer seconds; percentages → numbers from 0 to 1; dates → the `YYYY-MM-DD` game day plus UTC ISO timestamps.
- Statuses, seasons and positions map through explicit tables with a test per row. An unknown value throws with source, endpoint and value, so upstream changes surface immediately.
- ESPN box scores: map stats by `labels`, never by array position; parse "8-15" shooting splits into made/attempted.
- Country names and codes go through `packages/shared/src/countries.ts`; never inline a name → code mapping.
- Every endpoint we use has a recorded fixture and a mapper test asserting specific, hand-read values. New fixtures come only from `pnpm fixtures:record`.
- When you learn something about an upstream API, update `docs/sources/<source>.md`.

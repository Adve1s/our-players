---
paths:
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "**/test/**"
---

# Test rules

- Test names state behavior; one behavior per test; `it.each` tables for many similar cases.
- Assert specific values. No whole-object snapshots of upstream or API payloads.
- Never mock the unit under test. Fake only the edges: HTTP (fixture-backed fetcher), the clock (injected), the database (in-memory PGlite via `createTestDb()`).
- No network, ever: the test setup fails any real fetch.
- Fixtures are read-only. To change one, re-record it with `pnpm fixtures:record` and say why in the commit message.
- A test written in a red phase is a contract. If it later looks wrong, stop and ask instead of editing it.

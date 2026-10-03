# Decisions

Lightweight decision records. Append new ones at the end (`/handoff` does this); never rewrite history — supersede instead ("Superseded by D-0xx").

Format: **ID — Title** (date, status) · Decision · Why · Alternatives considered.

---

**D-001 — Monorepo with pnpm workspaces** (2026-10-02, accepted)
`apps/mobile`, `apps/server`, `packages/shared`. Why: one TypeScript contract shared by app and server; one place for Claude to see everything. Alternatives: separate repos (contract drift, more ceremony).

**D-002 — Scheduled ingestion into our own DB; user-agnostic read API** (2026-10-02, accepted)
Jobs fetch by game/league on a schedule; users never trigger upstream calls; the app sends preferences and gets filtered results. Why: politeness to unofficial APIs, resilience to upstream outages, no accounts needed. Alternatives: on-demand proxying (rate-limit and blocking risk, slow).

**D-003 — One adapter per upstream source, mapping to a normalized model** (2026-10-02, accepted)
Why: both sources are unofficial and will change; a breakage should mean fixing one adapter.

**D-004 — PostgreSQL everywhere: PGlite for local dev and tests, real Postgres in production** (2026-10-02, accepted — changes the brief's "SQLite in dev")
Why: "SQLite in dev, Postgres in prod" means two dialects. Drizzle needs separate schema definitions per dialect (`sqliteTable` vs `pgTable`); Prisma pins one provider per schema with provider-specific migrations. Behavior also differs where this app cares (case-insensitive search, JSON columns, dates, booleans), so tests on SQLite wouldn't prove production behavior. PGlite is Postgres compiled to WASM that runs in-process: no install, no Docker, real Postgres semantics, and Drizzle supports it (`drizzle-orm/pglite`). Alternatives: SQLite everywhere including production (viable for one small server, but the brief wants Postgres when deployed); Docker Postgres locally (heavier setup).

**D-005 — Drizzle ORM + drizzle-kit migrations** (2026-10-02, accepted)
Why: TypeScript-first, SQL-shaped (easy to learn and review), supports PGlite and node-postgres with the same `pg-core` schema. Alternatives: Prisma (heavier toolchain, less SQL-visible), Kysely (query builder only; we'd hand-write more).

**D-006 — Hono for the HTTP API** (2026-10-02, accepted)
Why: small API surface similar to ASP.NET minimal APIs; `app.request()` makes API tests trivial without a running server; first-class zod validation. Alternatives: Fastify (equally fine, more concepts), Express (dated typing story).

**D-007 — Vitest for all tests; mobile UI verified with screenshots** (2026-10-02, accepted)
Why: one fast runner for shared + server; UI logic that matters lives in pure modules; screens are checked by a Playwright screenshot script on the web build plus manual phone checks, which gives Claude a visual way to verify its UI work. Alternatives: jest-expo component tests (slower, low value for this app in v1).

**D-008 — Biome for formatting and linting** (2026-10-02, accepted)
Why: one fast tool and one config for the whole monorepo; fast enough to run on every edit via a hook. Alternatives: ESLint + Prettier (two tools, more config).

**D-009 — Nationality = sporting nationality: one alpha-3 code per player; birth country by default; overrides by player ID in a JSON file** (2026-10-02, accepted)
Nationality means the national team a player represents. Each player has one code (or none) with its source, `birth` or `override`. Overrides live in `apps/server/data/nationality-overrides.json`, keyed by public player ID; the first two are Embiid (born CMR → USA) and Towns (born USA → DOM). Why: a player represents one national team, so one value matches the definition and keeps the schema and selection rule simple; the NHL already returns alpha-3; overrides are rare, human-curated and benefit from git review. Alternatives: a set of nationalities (citizenships — not what the app means), name-based matching for players not yet in a league (dropped until needed; Berrouet can be added by ID if he reaches the NBA), overrides in a DB table (needs an admin UI), alpha-2 codes (conversion needed for the NHL).

**D-010 — Stable public IDs derived from source IDs** (2026-10-02, accepted)
`nhl-<id>`, `nba-<espn id>`, same for games. Why: favorites are stored on devices without accounts; IDs must survive DB rebuilds and re-ingestion. If a source is ever swapped, old public IDs stay primary and new source IDs map through `player_external_ids`.

**D-011 — Game day = the league's schedule date; default view = latest started game day** (2026-10-02, accepted)
Why: in Latvia, "last night's games" happen on the previous US date and finish after midnight local time; using the viewer's local date would split one night of games across two days.

**D-012 — Stat lines: common columns + typed JSONB per `kind`** (2026-10-02, accepted)
Why: adding a sport or position means adding a `kind` and a zod schema rather than migrating wide nullable tables. Alternatives: one table per kind (more joins and migrations), one wide table (many nulls).

**D-013 — No league/team logos or player photos in v1** (2026-10-02, accepted)
Why: intellectual-property risk for a Play Store listing; text and team colors carry the information.

**D-014 — Start the Play closed test before slice 5** (2026-10-02, accepted — reorders the brief's slices)
Deploy the backend and ship the Android build to closed testing right after the main page works (slice 4), then build slice 5 while the 14-day clock runs. Why: the 14 days are the longest fixed wait in the project; testers can receive updates during the test.

**D-015 — Agent workflow: builder + reviewer subagent at every handoff + fresh-session slice review posted to the PR; test-writer only for red phases** (2026-10-02, accepted)
See `docs/WORKFLOW.md`. The per-session review always runs (the owner chose quality over usage on the Pro plan). Why: independent review catches what the builder rationalizes; a separate test author matters most where tests encode the spec (selection rule) or an external contract (adapters).

**D-016 — One branch and one pull request per slice; CI on every PR; protected `main`; merge commits** (2026-10-02, accepted)
Claude creates `slice-<n>-<slug>` from the latest `main`, opens a draft PR at the slice's first handoff, and pushes after every session; GitHub Actions runs `pnpm verify`; the slice review is posted to the PR; the owner merges with a merge commit. Why: a slice is the natural review unit, and the PR keeps its diff, CI results, session briefings and review in one place; merge commits keep the session-by-session history on `main`, including the red test commits. Alternatives: local branches only (no CI, no PR view), squash merges (lose the red/green history).

**D-017 — App identity: "Our Players", Android package `io.github.adve1s.ourplayers`** (2026-10-02, accepted)
Why: the package ID is permanent once uploaded to Google Play; the reverse of `adve1s.github.io` gives a unique ID without buying a domain. It meets Android's rules: at least two segments, each starting with a letter, only letters, digits and underscores. Alternatives: a purchased domain.

**D-018 — Opus 5.5 for every session; effort per session; ~200K-token session budget** (2026-10-02, accepted)
Opus 5.5 is the Pro default in Claude Code. Effort stays at its medium default except where the SESSIONS.md Overview says high (intricate logic and all reviews); the reviewer subagent and `/slice-review` pin `effort: high`. Sessions stop at a green checkpoint around 200K tokens of context even though the window is 1M. Why: the owner prefers the strongest included model; effort is the cheaper dial for hard sessions; context quality and usage degrade long before a 1M window fills. Alternatives: Sonnet by default (cheaper, weaker on hard sessions), `opusplan` (kept as a fallback if usage limits bite), Fable (bills usage credits on Pro).

**D-019 — Cloud sessions for the sessions marked "either"; their work reaches the slice branch through a session PR** (2026-10-02, superseded by D-020)
Backend sessions and reviews can run as cloud sessions, which the owner's $100 cloud credit pays for until 2026-11-05. A cloud session can push only its own branch, so `/handoff` opens a PR from it into the slice branch; a cloud `/slice-review` posts to the PR without committing. The code must run on Node 22 (the cloud default) as well as the pinned Node 24. Why: uses the credit instead of plan limits; the per-slice PR flow stays intact. Alternatives: local only (simpler, leaves the credit unused), one PR per session into `main` (loses the slice as the review unit).

**D-020 — Cloud sessions push straight to the slice branch** (2026-10-03, accepted — supersedes D-019)
Sessions marked "either" can still run in the cloud. A cloud session switches to the slice branch named in its prompt (or creates it from `origin/main` for a slice's first session) and works exactly like a local one: `/handoff` pushes the slice branch and creates or updates the slice's draft PR, and a cloud `/slice-review` commits its review file. Why: D-019 assumed a cloud session can push only its own branch; the current cloud docs say the GitHub proxy "doesn't limit which branches a push can update". The session-PR indirection added a merge step per session and broke a slice's first session in the cloud (no slice branch or slice PR existed yet). Branch protection on `main` (WORKFLOW.md setup step 4) is what keeps cloud pushes off `main`. Code must still run on Node 22, the cloud default. Alternatives: keep session PRs into the slice branch (extra merge per session, no benefit for a solo reviewer).

**D-021 — Production recovery is a rebuild, not a backup restore** (2026-10-03, accepted — changes VISION §11 "Postgres with daily backups")
Every row in the database can be fetched again from upstream, and the nationality overrides live in git. So recovery means: provision Postgres, then run migrations, the `roster` job, the season-to-date `backfill` and `season-stats`. `docs/DEPLOY.md` documents this rebuild, with its request count and duration, and S10 performs it once on the host. A provider's free automatic snapshots are welcome but not required. Why: backups only protect data we can't recreate, and here there is none; one tested rebuild beats an untested restore. Alternatives: daily `pg_dump` with restore drills (more moving parts for no data we'd lose).

**D-022 — Toolchain pins: Node in `.tool-versions`, pnpm in `packageManager`, TypeScript 6** (2026-10-03, accepted)
`.tool-versions` holds `nodejs 24.21.0` (exact); mise reads it natively (no `mise trust` needed), and CI's Node 24 leg reads it through `actions/setup-node`'s `node-version-file`. The Node 22 leg uses `'22'` to match the cloud runtime. pnpm 12.8.1 is pinned only in `packageManager`, read by corepack and `pnpm/action-setup`. TypeScript `~6.0.3` everywhere, the version Expo SDK 57's template pins; `@types/node` stays on `^22` so code can't use Node-24-only APIs by accident. Why: each version lives in exactly one file. Alternatives: `mise.toml` (needs `mise trust`, and setup-node can't read it), `.node-version` (mise needs an opt-in setting), pinning pnpm in mise too (two places), TypeScript 7 (newer than Expo's tested version), major-only Node pin (local and CI can drift apart).

**D-023 — Expo app from the SDK 57 default template, pruned; pnpm install settings** (2026-10-03, accepted)
The example screens and unused packages are removed. `react-native-reanimated`, `react-native-worklets` and `react-native-gesture-handler` stay at the SDK's versions, because expo-router's drawer requires them as peers and pnpm would otherwise auto-install their latest, incompatible versions. `pnpm-workspace.yaml` adds an override pinning `@react-native/metro-config` to react-native's version (worklets accepts any version), and `allowBuilds: esbuild` (pnpm 12 fails installs on unapproved build scripts). Routes live in `apps/mobile/app/`, not the template's `src/app/`. `packages/shared` is consumed as TypeScript source through `exports: "./src/index.ts"`, with no build step. Why: `expo install --check`, `expo-doctor` and `pnpm peers check` are all clean, and the dependency list holds only what the app uses or its peers require. Alternatives: keep the whole template (about 10 unused native modules), `autoInstallPeers: false` (permanent peer warnings, plus `vite` added by hand).

**D-024 — Players listed in a box score who didn't play get a "DNP" row** (2026-10-03, accepted)
A shown player whom the box score lists without playing time is shown as did-not-play: NBA `didNotPlay: true` (with ESPN's `reason`), and NHL players with `toi` `"00:00"`, in practice the dressed backup goalie (`saveShotsAgainst` `"0/0"`, no decision). The stat line is stored with `played = false`. Only ESPN's `didNotPlay` (or an empty `stats` array) means DNP; its `reason` also appears on players who played. Why: the owner wants to see that a followed player was in the lineup but didn't play; a `0/0 · 00:00` goalie line reads like a played game. Alternatives: hide them (loses the "he dressed" information), show the zero line (misleading).

**D-025 — Nationality stays birth country + override; source nationality fields noted for later** (2026-10-03, accepted)
S01 found the NHL stats API's `skater/bios` and `goalie/bios` return `nationalityCode`, and ESPN's core athlete has `citizenship` (Towns: "Dominican Republic"; Embiid: "Cameroon", though he represents the USA). v1 keeps VISION §7 unchanged: birth country, replaced by an override from `nationality-overrides.json`. Why: one rule for both leagues that is already specified and tested in S02a; `citizenship` isn't sporting nationality; the fields can be adopted in a later update. Alternatives: use NHL `nationalityCode` now (two rules per league, needs an extra endpoint in the roster job).

**D-026 — Fixtures are pretty-printed re-serializations; endpoint URLs live with their source** (2026-10-03, accepted)
The recorder writes `JSON.stringify(parsed, null, 2)` and a `.meta.json` whose `bytes` is the raw response size. URL builders sit in `apps/server/src/sources/<source>/endpoints.ts`, shared by the recorder now and the adapters' fetch layer later. Why: readable diffs when a fixture is re-recorded (the owner's choice), and one place per source that knows its URLs. Alternatives: raw bytes (faithful but minified one-line diffs), URLs inside the recorder (adapters would duplicate them).

**D-027 — A host on an excessive Retry-After fails fast; one upstream client per process** (2026-10-03, accepted — slice 0 review F1, F2)
When a server's `Retry-After` exceeds `maxRetryAfterMs` (120 s), the client fails that request and holds the host; while the hold is longer than 120 s, every new request to that host rejects at once with `UpstreamError` "<host> on hold until <time>", sending nothing. Requests in the last 120 s of a hold wait for it. `upstreamClient(config)` returns one shared polite client per process, because the per-host rate limit lives in the instance; jobs receive it by injection. Why: a silent wait of up to an hour would stall a job and its lock with no `job_runs` failure, and separate clients would each send 1 request/s to the same host (Architecture rule 3). Alternatives: wait out the hold (the S01 behavior), module-level host state inside `polite-client.ts` (breaks per-test isolation), a scheduler-owned client only (easy to bypass from a script).

# S02a — Domain model, selection rule, nationality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The normalized domain model and zod stat schemas in `packages/shared`, `isShown` and `resolveNationality` written test-first from VISION §3/§7, and a zod-validated loader for `apps/server/data/nationality-overrides.json`.

**Architecture:** Pure modules in `packages/shared/src/` (enums, countries, ids, model, stats, selection, nationality), re-exported from `index.ts`. The only side effect, reading the overrides file, lives in `apps/server/src/nationality/overrides.ts`, which splits into a pure `parseNationalityOverrides` and a thin `loadNationalityOverrides`.

**Tech Stack:** TypeScript strict (`noUncheckedIndexedAccess`), zod 4 (new), Vitest 5, Biome.

**Spec:** `docs/superpowers/specs/2026-10-17-s02a-domain-model.md` — it holds every type, schema, signature, error-message format and test list; this plan doesn't repeat them. Read it before each task.

## Global Constraints

- **Out of scope:** the database and repositories (S02b), adapters, jobs, API, app.
- **Acceptance criteria**
  1. Selection-rule tests: one per behavior in VISION §3 (test names state the behavior), plus a check over generated inputs that `isShown` matches the set formula.
  2. Nationality tests: an override replaces the birth country (source `override`); without one, the birth country is used (source `birth`); an unknown birth country gives `null`; an invalid overrides file (bad JSON, unknown country code, duplicate player) fails with a message naming the file and the entry; the committed overrides file loads cleanly.
  3. The stat payload schemas accept a valid payload of each kind and reject invalid ones with a clear error.
  4. `pnpm verify` green.
- Nationality rule: override, else birth country, else `null` (VISION §7 unchanged; the NHL `nationalityCode` proposal is not adopted).
- One new runtime dependency, approved: `zod` `^4.6.7` in `packages/shared` and `apps/server`. Nothing else (no fast-check, no country-code package).
- `apps/mobile` is not edited, and nothing imports from `apps/server` outside it.
- No `any`; `unknown` + zod. Named exports; kebab-case files; comments explain why.
- Tests never touch the network; the overrides file and fixtures are never edited.
- Red/green: the Task 2 tests are not changed afterwards. If one looks wrong, stop and report it (owner decides).
- Small Conventional Commits; `pnpm verify` green before each commit, except Task 2's red-phase `test:` commit (only the new tests may fail, only on "not implemented"). Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Look up zod 4 APIs with context7 (`/colinhacks/zod`) before writing code against them.

## Review Focus

1. **Empty overrides list** (`{"overrides": []}`) → loads as an empty map, no error. Test in Task 5.
2. **Lowercase or alpha-2 country code in an override** (`"usa"`, `"US"`) → rejected as an unknown country code naming the entry. Test in Task 5.
3. **Fractional, NaN or Infinity numbers in a stat payload** (`toiSeconds: 12.5`, `points: NaN`) → rejected. Test in Task 4.
4. **Missing overrides file** → error naming the file path. Test in Task 5.
5. **Empty preference sets** (L = ∅ hides even favorites; any set may be empty) → follows the formula. Task 2's generator draws empty sets for each of L, C, F and H.

---

### Task 1: zod, domain types and stubs

**Files:**
- Modify: `packages/shared/package.json`, `apps/server/package.json` (add `"zod": "^4.6.7"` to `dependencies`), `pnpm-lock.yaml`, `packages/shared/src/index.ts`
- Create: `packages/shared/src/enums.ts`, `countries.ts`, `ids.ts`, `model.ts`, `selection.ts`, `nationality.ts`
- Test: `packages/shared/test/countries.test.ts`

**Interfaces:**
- Produces (exact shapes in the spec's "Types and schemas", "Selection rule" and "Nationality" sections): `leagueSchema`/`League`, `sportSchema`/`Sport`, `LEAGUE_SPORT`, `gameStatusSchema`/`GameStatus`, `seasonTypeSchema`/`SeasonType`, `endedInSchema`/`EndedIn`, `statKindSchema`/`StatKind`, `sourceSchema`/`Source`, `positionGroupSchema`/`PositionGroup`, `nationalitySourceSchema`/`NationalitySource`; `COUNTRY_CODES`, `countryCodeSchema`, `CountryCode`; `publicIdSchema`, `PublicId`; `Team`, `Player`, `PeriodScore`, `Game`, `StatLine`, `SeasonStats`; `Prefs`, `SelectablePlayer`, `isShown`; `ResolvedNationality`, `resolveNationality`. All re-exported from `packages/shared/src/index.ts`.
- `model.ts` needs the stat payload types, which Task 4 defines. For now declare `HockeySkaterStats`, `HockeyGoalieStats` and `BasketballPlayerStats` in `model.ts` as plain object types with the spec's fields (optional fields `?:`, `savePct: number | null`, `decision: 'W' | 'L' | 'OTL' | null`). Task 4 replaces them with `z.infer` types from `stats.ts`.

- [ ] **Step 1: Install zod** — `pnpm --filter @our-players/shared --filter @our-players/server add zod@^4.6.7`. Check: `pnpm why zod` shows `zod@4.6.7` under both packages, with Expo's `zod@3.25.76` unchanged.
- [ ] **Step 2: Write `countries.test.ts`**: `accepts LVA, USA, CMR, DOM, GBR`; `rejects XXX, usa, US, LAV with the message "unknown ISO 3166-1 alpha-3 country code"`; `COUNTRY_CODES has 249 unique codes`. Run `pnpm test countries`: FAIL (module not found).
- [ ] **Step 3: Write `countries.ts`** — generate the list once from `/usr/share/iso-codes/json/iso_3166-1.json` (`alpha_3`, sorted; iso-codes 4.20.1), paste it as a literal `as const` array, and add a one-line comment naming the source and version. No runtime file read. Then write `enums.ts`, `ids.ts` and `model.ts` per the spec.
- [ ] **Step 4: Write the stubs** in `selection.ts` and `nationality.ts`: the exact signatures from the spec, bodies `throw new Error('not implemented')`. Prefix unused parameters with `_` only if Biome requires it.
- [ ] **Step 5: Verify** — `pnpm test countries` PASS. `pnpm verify` green. Mobile still bundles shared with zod: `pnpm --filter @our-players/mobile exec expo export -p web --output-dir "$(mktemp -d)"` exits 0. Report its last lines.
- [ ] **Step 6: Commit** — `feat(shared): domain types, country codes, selection and nationality stubs`.

### Task 2 (*test-writer*): selection rule and nationality spec — red

**Files:**
- Create: `packages/shared/test/selection.test.ts`, `packages/shared/test/nationality.test.ts`

**Interfaces:**
- Consumes: `isShown(player: SelectablePlayer, prefs: Prefs): boolean`, `resolveNationality(player: { publicId: PublicId; birthCountry: CountryCode | null }, overrides: ReadonlyMap<PublicId, { readonly nationality: CountryCode }>): ResolvedNationality`, and the types `Prefs`, `SelectablePlayer`, `ResolvedNationality`, `CountryCode`, `League`, `PublicId`, all from `../src/index`.

The test-writer works from **VISION §3 and §7 only** (plus the signatures above). Expected values come from the spec text, never from running code.

- [ ] **Step 1: Write `selection.test.ts`**: the 10 selection cases in the spec's "Test cases → Red phase", one `it` per behavior, named by the behavior. Case 9 builds Embiid's nationality with `resolveNationality({ publicId: 'nba-3059318', birthCountry: 'CMR' }, new Map([['nba-3059318', { nationality: 'USA' }]]))` and passes it to `isShown`. Case 10: a seeded PRNG written in the test file (e.g. mulberry32, fixed seed), ≥ 300 iterations. Each draws a player list with unique IDs over leagues {NHL, NBA}, nationalities {LVA, USA, CMR, null}, and prefs where each of L, C, F and H may be empty. F and H draw from the players' IDs plus IDs that match no player, and may overlap. The expected shown set is computed with set operations from VISION §3's formula, never by calling `isShown`. Assert that `players.filter(p => isShown(p, prefs))` has the same IDs.
- [ ] **Step 2: Write `nationality.test.ts`**: the 7 nationality cases in the spec, asserting both `nationality` and `source`.
- [ ] **Step 3: Run** `pnpm test selection nationality`. Expected: every test fails with `Error: not implemented`, and nothing fails on imports, syntax or types. `pnpm typecheck` and `pnpm lint` pass.
- [ ] **Step 4: Commit** only the two test files: `test: selection rule and nationality spec`.

### Task 3: implement `isShown` and `resolveNationality` — green

**Files:**
- Modify: `packages/shared/src/selection.ts`, `packages/shared/src/nationality.ts`

**Interfaces:**
- Consumes: Task 1's signatures; Task 2's tests (read-only).

- [ ] **Step 1: Implement `isShown`**: one expression of VISION §3's formula, with the formula as the comment.
- [ ] **Step 2: Implement `resolveNationality`**: the override from the map, else `birthCountry` with source `birth`, else `{ nationality: null, source: null }`.
- [ ] **Step 3: Verify** — `pnpm test selection nationality` all pass; `git diff HEAD --stat -- packages/shared/test/selection.test.ts packages/shared/test/nationality.test.ts` is empty (HEAD is the red commit, so the tests are unchanged); `pnpm verify` green.
- [ ] **Step 4: Commit** — `feat(shared): selection rule and nationality resolution`.

### Task 4: stat payload schemas (red/green)

**Files:**
- Create: `packages/shared/src/stats.ts`, `packages/shared/test/stats.test.ts`
- Modify: `packages/shared/src/model.ts` (use the `z.infer` types), `packages/shared/src/index.ts`

**Interfaces:**
- Produces: `hockeySkaterStatsSchema`, `hockeyGoalieStatsSchema`, `basketballPlayerStatsSchema`, `statPayloadSchemas` (`satisfies Record<StatKind, z.ZodType>`), types `HockeySkaterStats`, `HockeyGoalieStats`, `BasketballPlayerStats` (`z.infer`), and `parseStatPayload<K extends StatKind>(kind: K, value: unknown): z.infer<(typeof statPayloadSchemas)[K]>`. It throws `Error` with the message `invalid ${kind} stats:\n${z.prettifyError(error)}`.

- [ ] **Step 1: Write `stats.test.ts`**:
  - `it.each` over the three kinds: a valid payload parses and round-trips. Skater `{ goals: 1, assists: 1, points: 2, plusMinus: 2, shots: 4, toiSeconds: 1112 }` plus one with every optional field. Goalie `{ saves: 28, shotsAgainst: 30, goalsAgainst: 2, savePct: 0.933, toiSeconds: 3600, decision: 'W' }`. Basketball (VISION §4.1): `{ minutes: 31, points: 22, rebounds: 8, assists: 3, fgMade: 8, fgAttempted: 15, threeMade: 3, threeAttempted: 7, ftMade: 3, ftAttempted: 3, turnovers: 2, steals: 1, blocks: 0, offRebounds: 2, defRebounds: 6, fouls: 3, plusMinus: -4 }`.
  - Goalie `savePct: null` and `decision: null` are accepted.
  - Rejected per kind, with `toThrow` matching both the kind and the field name: a string where a number belongs (`goals: '1'` / `saves: '28'` / `points: '22'`), a negative count, an unknown key, a missing required field.
  - Goalie: `savePct: 1.5` and `decision: 'O'` are rejected.
  - Review Focus 3: `toiSeconds: 12.5`, `points: NaN` and `minutes: Infinity` are rejected.
  - Run `pnpm test stats`: FAIL (module not found).
- [ ] **Step 2: Implement `stats.ts`** per the spec's schema block; point `model.ts`'s payload types at it.
- [ ] **Step 3: Verify** — `pnpm test stats` PASS; `pnpm verify` green.
- [ ] **Step 4: Commit** — `feat(shared): stat payload schemas`.

### Task 5: nationality overrides loader (red/green)

**Files:**
- Create: `apps/server/src/nationality/overrides.ts`, `apps/server/test/nationality-overrides.test.ts`

**Interfaces:**
- Consumes: `publicIdSchema`, `countryCodeSchema`, `PublicId` from `@our-players/shared`.
- Produces: `NationalityOverride`, `DEFAULT_OVERRIDES_PATH` (absolute path to `apps/server/data/nationality-overrides.json`, from `import.meta.url`), `parseNationalityOverrides(json: string, file: string): ReadonlyMap<PublicId, NationalityOverride>`, `loadNationalityOverrides(file?: string): Promise<ReadonlyMap<PublicId, NationalityOverride>>`. Message formats are in the spec's "Validation order and messages".

- [ ] **Step 1: Write the tests.** Inputs are JSON strings built in the test; file name `'overrides.json'`. The committed file is only read, never written. Each error assertion is `toThrow` with a regex that names the parts listed:
  - `the committed overrides file loads cleanly`: `loadNationalityOverrides()` gives 2 entries; `nba-3059318` → `USA`, name `Joel Embiid`; `nba-3136195` → `DOM`.
  - `bad JSON` → `overrides.json: invalid JSON`.
  - `unknown country code` (`"DOX"`) as the second entry → `overrides.json`, `overrides[1]`, the player ID, `unknown ISO 3166-1 alpha-3 country code`, `nationality`.
  - `duplicate player` → `overrides.json: overrides[1] (nba-3059318): duplicate player, first at overrides[0]`.
  - Malformed public ID (`"embiid"`, `"NBA-3059318"`) and a missing `name` → error names `overrides[0]` and the field.
  - No `overrides` key / an unknown top-level key → error names the file.
  - Review Focus 1: `{"overrides": []}` → empty map.
  - Review Focus 2: `"usa"` and `"US"` → unknown country code, naming the entry.
  - Review Focus 4: `loadNationalityOverrides('/nonexistent/overrides.json')` rejects with a message containing that path.
  - Run `pnpm test nationality-overrides`: FAIL (module not found).
- [ ] **Step 2: Implement `overrides.ts`** per the spec: `JSON.parse` in try/catch; the top level is checked with `fileSchema`; entries are parsed one by one with `safeParse`; duplicates are tracked in a `Map` of player → first index. `loadNationalityOverrides` reads with `node:fs/promises` and passes the path it was given as `file`. A read error is rethrown as `Error(\`${file}: ${cause.message}\`, { cause })`.
- [ ] **Step 3: Verify** — `pnpm test nationality-overrides` PASS; `pnpm verify` green.
- [ ] **Step 4: Commit** — `feat(server): nationality overrides loader`.

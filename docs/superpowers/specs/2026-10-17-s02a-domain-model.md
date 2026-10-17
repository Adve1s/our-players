# S02a — Domain model, selection rule, nationality: design

Session S02a, branch `s02a-domain-model`. Spec: `docs/SESSIONS.md` §S02a. The normalized model in `packages/shared`, plus `isShown` and nationality resolution written test-first. Pure code only.

## Contract (verbatim from SESSIONS.md §S02a)

**Out of scope:** the database and repositories (S02b), adapters, jobs, API, app.

**Acceptance criteria**
1. Selection-rule tests: one per behavior in VISION §3 (test names state the behavior), plus a check over generated inputs that `isShown` matches the set formula.
2. Nationality tests: an override replaces the birth country (source `override`); without one, the birth country is used (source `birth`); an unknown birth country gives `null`; an invalid overrides file (bad JSON, unknown country code, duplicate player) fails with a message naming the file and the entry; the committed overrides file loads cleanly.
3. The stat payload schemas accept a valid payload of each kind and reject invalid ones with a clear error.
4. `pnpm verify` green.

## Decided with the owner (2026-10-17)
- **Nationality rule stays as VISION §7 says:** the override if one exists, else the birth country, else `null`. The NHL stats `bios` `nationalityCode` proposal (`docs/sources/nhl.md`) is **not adopted**. It goes to the PROGRESS parking lot as a later upgrade; adding it later stays backward-compatible (an optional resolver input plus a third source value). VISION §7, CLAUDE.md rule 6 and DECISIONS stay unchanged. `/handoff` records the decision.

## New dependency
- **`zod` ^4 (4.6.7)** as a runtime dependency of `packages/shared` and `apps/server`. Why: CLAUDE.md names zod for every schema (stat payloads now, adapters and the API contract later). Only Expo's CLI has it today, as a transitive zod 3, so neither package can import it yet. No other dependency: no property-testing library (the generated-inputs check uses a small seeded generator in the test file).
- zod 4.6.7 came out on 2026-10-12, so pnpm's 1-day release-age rule allows it. pnpm hoists zod 4 to the root and nests Expo's zod 3.25.76 under `@expo/cli` (checked after install), so each package resolves the version it declares. Task 1 checks that the lockfile resolves `zod@4` for both packages and that `pnpm dev:mobile` (web) still renders the placeholder, because the app imports `packages/shared`, which now imports zod.

## Files
```
packages/shared/src/
  enums.ts         league, sport, status, season type, ended-in, stat kind, source, position group, nationality source
  countries.ts     ISO 3166-1 alpha-3 list + countryCodeSchema (S03 adds the ESPN alias scaffold here)
  ids.ts           publicIdSchema
  model.ts         Team, Player, Game, PeriodScore, StatLine, SeasonStats (types only)
  stats.ts         stat payload schemas per kind + parseStatPayload
  selection.ts     Prefs, SelectablePlayer, isShown
  nationality.ts   ResolvedNationality, resolveNationality
  index.ts         re-exports
apps/server/src/nationality/overrides.ts   override schema, parseNationalityOverrides, loadNationalityOverrides
```

## Types and schemas

```ts
// enums.ts — every enum is a z.enum with its type inferred, e.g.
export const leagueSchema = z.enum(['NHL', 'NBA']);
export type League = z.infer<typeof leagueSchema>;
// sport: hockey | basketball            LEAGUE_SPORT: { NHL: 'hockey', NBA: 'basketball' }
// gameStatus: SCHEDULED | LIVE | FINAL | POSTPONED | CANCELLED
// seasonType: PRE | REG | POST          endedIn: REG | OT | SO
// statKind: hockey_skater | hockey_goalie | basketball_player
// source: nhl | espn                    nationalitySource: birth | override
// positionGroup: forward | defense | goalie | guard | center

// countries.ts — the 249 officially assigned codes, copied from Debian iso-codes 4.20.1
// (/usr/share/iso-codes/json/iso_3166-1.json); no runtime file read.
export const COUNTRY_CODES = ['ABW', 'AFG', /* … */ 'ZWE'] as const;
export const countryCodeSchema = z.enum(COUNTRY_CODES, { error: 'unknown ISO 3166-1 alpha-3 country code' });
export type CountryCode = z.infer<typeof countryCodeSchema>;   // literal union: a typo like 'LAV' fails typecheck

// ids.ts — D-010
export const publicIdSchema = z.string().regex(/^(nhl|nba)-[1-9]\d*$/, 'expected a public ID like nhl-8478402');
export type PublicId = string;

// model.ts — what adapters (S03/S05) return and repositories (S02b) store; references by public ID
// or by (source, externalId). Ingestion bookkeeping (final_at, boxscore_fetched_at, corrected_at)
// and nationality (computed on store, by resolveNationality) are not part of it.
export type Team = { league: League; source: Source; externalId: string; abbrev: string; name: string };
export type Player = {
  publicId: PublicId; league: League; source: Source; externalId: string;
  firstName: string; lastName: string;
  position: string; positionGroup: PositionGroup;     // position as the source gives it ('C', 'L', 'PG')
  currentTeamExternalId: string | null;
  jersey: string | null; birthDate: string | null;    // 'YYYY-MM-DD'
  birthCity: string | null; birthCountry: CountryCode | null;
};
export type PeriodScore = { period: string; away: number; home: number };  // '1'…'3', 'OT', 'SO', 'Q1'…'Q4'
export type Game = {
  publicId: PublicId; league: League; source: Source; externalId: string;
  season: string; seasonType: SeasonType;             // '2026-27'
  gameDate: string; startTimeUtc: string;             // schedule date 'YYYY-MM-DD'; ISO UTC
  status: GameStatus;
  homeTeamExternalId: string; awayTeamExternalId: string;
  homeScore: number | null; awayScore: number | null;
  periodScores: PeriodScore[] | null; endedIn: EndedIn | null;
};
type StatLineBase = {
  gamePublicId: PublicId; playerPublicId: PublicId; teamExternalId: string;
  dnpReason: string | null; starter: boolean | null;
};
// PR #6 review: played decides whether stats exist, so a played line without stats doesn't compile.
type KindLine<K extends StatKind, S> = { kind: K } & ({ played: true; stats: S } | { played: false; stats: null });
export type StatLine = StatLineBase & (
  | KindLine<'hockey_skater', HockeySkaterStats>
  | KindLine<'hockey_goalie', HockeyGoalieStats>
  | KindLine<'basketball_player', BasketballPlayerStats>);
export type SeasonStats = {
  playerPublicId: PublicId; season: string; seasonType: SeasonType; kind: StatKind;
  basis: 'totals' | 'per_game';
  stats: Readonly<Record<string, number>>;  // shortcut: untyped per source, typed schemas when S03/S05 map them
};

// stats.ts — VISION §8; strict objects (an unknown key is a typo, not data)
const count = z.int().nonnegative();
export const hockeySkaterStatsSchema = z.strictObject({
  goals: count, assists: count, points: count, plusMinus: z.int(), shots: count, toiSeconds: count,
  pim: count.optional(), hits: count.optional(), blocks: count.optional(), powerPlayGoals: count.optional(),
});
export const hockeyGoalieStatsSchema = z.strictObject({
  saves: count, shotsAgainst: count, goalsAgainst: count,
  savePct: z.number().min(0).max(1).nullable(),   // null when no shots faced
  toiSeconds: count, decision: z.enum(['W', 'L', 'OTL']).nullable(),
});
export const basketballPlayerStatsSchema = z.strictObject({
  minutes: count, points: count, rebounds: count, assists: count,
  fgMade: count, fgAttempted: count, threeMade: count, threeAttempted: count, ftMade: count, ftAttempted: count,
  turnovers: count, steals: count, blocks: count, offRebounds: count, defRebounds: count, fouls: count,
  plusMinus: z.int(),
});
export const statPayloadSchemas = { hockey_skater: …, hockey_goalie: …, basketball_player: … } satisfies Record<StatKind, z.ZodType>;
// Throws Error(`invalid ${kind} stats:\n${z.prettifyError(error)}`), so the message names the kind, field and problem.
export function parseStatPayload<K extends StatKind>(kind: K, value: unknown): z.infer<(typeof statPayloadSchemas)[K]>;
```

## Selection rule — `selection.ts`

```ts
export type Prefs = {
  leagues: ReadonlySet<League>;       // L
  countries: ReadonlySet<CountryCode>; // C
  favorites: ReadonlySet<PublicId>;    // F
  hidden: ReadonlySet<PublicId>;       // H
};
export type SelectablePlayer = { publicId: PublicId; league: League; nationality: CountryCode | null };
// shown(p) ⇔ league(p) ∈ L ∧ p ∉ H ∧ (p ∈ F ∨ nat(p) ∈ C)
export function isShown(player: SelectablePlayer, prefs: Prefs): boolean;
```
Sets, not arrays: the formula is about membership, and callers (the API's query parsing in S06, the app) build them once per request. Unknown IDs in F or H need no special code: they match no player.

## Nationality — `nationality.ts` (shared) and `overrides.ts` (server)

```ts
// packages/shared/src/nationality.ts
export type ResolvedNationality =
  | { nationality: CountryCode; source: NationalitySource }
  | { nationality: null; source: null };
export function resolveNationality(
  player: { publicId: PublicId; birthCountry: CountryCode | null },
  overrides: ReadonlyMap<PublicId, { readonly nationality: CountryCode }>,
): ResolvedNationality;
```
The resolver takes the birth country already as a code: turning source text into a code (NHL alpha-3 validation, ESPN names → `null` plus a warning) is the adapters' job (S03/S05). So "unknown birth country" reaches the resolver as `null`. An override equal to the birth country still reports source `override`. The resolver lives in `shared` with the other pure logic. The override map's value type is structural, so the loader's map passes straight in.

```ts
// apps/server/src/nationality/overrides.ts
const overrideSchema = z.strictObject({
  player: publicIdSchema, name: z.string().min(1), nationality: countryCodeSchema,
  note: z.string().min(1), addedAt: z.iso.date(),
});
const fileSchema = z.strictObject({ overrides: z.array(z.unknown()) });  // entries parsed one by one to name them
export type NationalityOverride = z.infer<typeof overrideSchema>;
export const DEFAULT_OVERRIDES_PATH: string;  // apps/server/data/nationality-overrides.json, resolved from import.meta.url
export function parseNationalityOverrides(json: string, file: string): ReadonlyMap<PublicId, NationalityOverride>;
export function loadNationalityOverrides(file = DEFAULT_OVERRIDES_PATH): Promise<ReadonlyMap<PublicId, NationalityOverride>>;
```
Validation order and messages (`<file>` is the path as given):
- Bad JSON: `<file>: invalid JSON: <SyntaxError message>`.
- Wrong top level (no `overrides` array, extra keys): `<file>: <prettified zod error>`.
- Each entry `i` is parsed on its own. Failure: `<file>: overrides[i] (<player or "?">): <prettified zod error>`; the zod message names the field (`unknown ISO 3166-1 alpha-3 country code → at nationality`).
- Duplicate player: `<file>: overrides[j] (<player>): duplicate player, first at overrides[i]`.
- Errors are thrown on the first bad entry; the file is small and reviewed in git.

The name-mismatch and missing-player warnings need the DB, so they are S02b's.

## Test cases

**Red phase (test-writer, from VISION §3 and §7 only)**: `packages/shared/test/selection.test.ts`, `packages/shared/test/nationality.test.ts`.

Selection rule:
1. shows a player from a followed country in a selected league
2. does not show a player from a country that isn't followed
3. hidden beats favorite (in F and H, nationality in C or not → not shown)
4. the league filter applies to favorites too (favorited NBA player, L = {NHL} → not shown)
5. the league filter applies to followed countries (LVA player, NBA deselected → not shown)
6. unknown nationality is shown only if favorited (null, not favorite → no; null, favorite → yes)
7. nothing followed shows nothing (C = ∅, F = ∅, for players of every nationality incl. null)
8. unknown IDs in favorites or hidden are ignored (the same players are shown with and without them)
9. overrides decide nationality: Embiid (`nba-3059318`, born CMR, override USA) is shown for USA and not for CMR (resolver + `isShown` together)
10. generated inputs: a seeded generator builds a few hundred random player lists and prefs over a small universe (2 leagues, 3 countries + null, IDs that partly overlap F and H, unknown IDs included). For each, the set of players `isShown` keeps equals `filter(league ∈ L)((F-players ∪ players with nat ∈ C) − H-players)`, computed with set operations.

Nationality resolution:
1. an override replaces the birth country, source `override` (Embiid: CMR → USA)
2. an override can replace a birth country of USA (Towns `nba-3136195`: USA → DOM)
3. without an override the birth country is used, source `birth` (Porziņģis `nba-3102531`: LVA)
4. an unknown birth country gives null (birth country null, no override → `{ nationality: null, source: null }`)
5. an override applies even when the birth country is unknown
6. an override for another player doesn't change this player's result
7. an override equal to the birth country reports source `override`

**Green phase (implementer, task 4)**: `packages/shared/test/stats.test.ts`, `apps/server/test/nationality-overrides.test.ts`.

Stat payloads: a realistic valid payload of each kind parses (values from VISION §4.1 examples, e.g. goalie 28/30 .933 W); each kind rejects a string where a number belongs, a negative count and an unknown key; goalie rejects `savePct` 1.5 and decision `'O'`; a missing required field is rejected; the error names the kind and the field.

Overrides loader: the committed file loads (2 entries: Embiid USA, Towns DOM, keyed by public ID); bad JSON → message names the file; unknown country code → names file, `overrides[i]`, the player and `nationality`; duplicate player → names file, the second index, the player and the first index; a malformed public ID and a missing field are rejected naming the entry; no `overrides` array → names the file.

## Task order (from the session prompt)
1. Add zod; domain enums, `countries.ts`, `ids.ts`, `model.ts`; stubs for `isShown` and `resolveNationality` with real signatures, bodies `throw new Error('not implemented')`.
2. Test-writer writes the red tests above from VISION §3 and §7 only; run them, confirm every failure is "not implemented"; commit `test: selection rule and nationality spec`.
3. Implement `isShown` and `resolveNationality` until green without touching those tests.
4. Stat payload schemas + `parseStatPayload`, then the overrides loader, both red/green with tests.

## My calls (owner to check)
- `countries.ts` alpha-3 validation moves from S03 into S02a (overrides validation needs it); S03 keeps only the ESPN alias scaffold.
- A `null` nationality has source `null`, not `birth`.
- `Prefs` uses `ReadonlySet`s; preferences as the app stores them (`version: 1`) are S08's.
- Stat schemas are strict and check types and ranges only: no cross-field checks (made ≤ attempted, points = goals + assists). Goalie `savePct` may be `null`.
- Override `note` is required. Entries are strict objects.
- `SeasonStats.stats` is an untyped number record until the adapters define the per-source fields (`shortcut:` comment).

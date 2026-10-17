# S03 — NHL adapter: design

Session S03, branch `s03-nhl-adapter`. Spec: `docs/SESSIONS.md` §S03. NHL raw JSON → the normalized model in `packages/shared/src/model.ts`, through pure mappers tested against every recorded fixture of an endpoint S03 maps, plus thin fetchers over the polite client and `pnpm inspect`.

## Contract (verbatim from SESSIONS.md §S03)

**Out of scope:** DB writes and jobs (S04a/S04b), ESPN (S05).

**Acceptance criteria**
1. Every NHL fixture has at least one mapper test asserting specific values read from the raw JSON (no whole-object snapshots).
2. Covered: skater line, goalie line with decision, OT and shootout games, preseason season type, scheduled vs final, period scores, TOI parsing, season-ID normalization.
3. A malformed payload (mutated inside the test, never in the file) throws an error naming source and endpoint.
4. Tests can't reach the network: the test setup fails any real fetch.
5. `pnpm inspect nhl boxscore <id>` works.
6. `pnpm verify` green.

**Owner rulings (brainstorming, 2026-10-17)**
- AC1 covers every fixture of an endpoint S03 maps. The stats-REST **bios** fixtures (`skater-bios`, `goalie-bios`, `-lva`) are exempt: no S03 mapper reads them; they wait for the parked D-030 `nationalityCode` upgrade.
- (my call, override if you disagree) `right-rail/2025020760` counts for AC1 as the expected values of the score mapper's period-score test; no right-rail mapper.
- A box-score line with TOI `00:00` (a dressed backup goalie, or any skater) is a **DNP line**: `played: false`, `stats: null`, `dnpReason: null`. The recap shows "DNP".

No new dependencies.

## Module layout

```
apps/server/src/sources/nhl/
  schemas.ts       raw zod schemas, one per endpoint (z.object: unknown keys stripped, used keys strict)
  common.ts        parsePayload(schema, endpoint, raw), seasonFromId, toiSeconds, positionGroup, toTeam
  games.ts         mapScore, mapSchedule (+ status / season-type / ended-in tables)
  boxscore.ts      mapBoxscore
  players.ts       mapRoster, mapPlayerLanding
  season-stats.ts  mapSkaterSummary, mapGoalieSummary
  urls.ts          URL builders (the ones jobs use)
  fetch.ts         fetchers: client.get → JSON.parse → mapper
apps/server/scripts/inspect.ts   pnpm inspect
apps/server/scripts/endpoints.ts its NHL entries that match urls.ts reuse them (recording-only variants stay)
packages/shared/src/countries.ts + ESPN_COUNTRY_ALIASES scaffold
vitest.config.ts                 + setupFiles: a setup that makes globalThis.fetch throw (check PGlite doesn't fetch its wasm in Node; if it does, block only http(s) URLs)
```

**Pure mappers** take `unknown` (parsed JSON) and return model objects; all zod parsing happens inside them, so tests feed fixture JSON straight in and AC3 is tested at the mapper. **Fetchers** take an injected `PoliteClient` and are the only side-effecting code.

## Errors
- Schema failure: `nhl <endpoint>: invalid payload` + `z.prettifyError` output. `<endpoint>` is the fixture directory name (`score`, `schedule`, `boxscore`, `roster`, `player-landing`, `skater-summary`, `goalie-summary`).
- Mapping failure (a value the tables don't know): `nhl <endpoint>: <what> <value>` naming the game/player, e.g. `nhl score: game 2025020760: unknown gameState "XYZ"`.
- Fetch layer: a body that isn't JSON → `nhl <endpoint>: response is not JSON (<url>)`; a summary whose `data.length` < `total` → `nhl <endpoint>: truncated, <n> of <total> rows`. HTTP errors are the polite client's `HttpError`, unchanged.

## Raw schemas (fields we use only)
- **score** `{ games[] }`; **schedule** `{ gameWeek[]: { date, games[] } }`. A game: `id` int, `season` int, `gameType` int, `gameDate` string (score only), `startTimeUTC` string, `gameState` string, `gameScheduleState` string, `awayTeam`/`homeTeam` `{ id, abbrev, score?, name?.default | commonName?.default }`, `periodDescriptor?` `{ number, periodType, maxRegulationPeriods }`, `gameOutcome?` `{ lastPeriodType }`, `goals?[]` `{ periodDescriptor.number, teamAbbrev }` (score only).
- **boxscore** `id`, `awayTeam`/`homeTeam` `{ id, abbrev, commonName.default }`, `playerByGameStats.{awayTeam,homeTeam}`: `forwards[]`/`defense[]` `{ playerId, sweaterNumber, position, name.default, goals, assists, points, plusMinus, sog, toi, pim, hits, blockedShots, powerPlayGoals }`; `goalies[]` `{ playerId, sweaterNumber, position, name.default, saves, shotsAgainst, goalsAgainst, savePctg?, toi, decision?, starter? }`.
- **roster** `forwards[]`/`defensemen[]`/`goalies[]` `{ id, firstName.default, lastName.default, sweaterNumber?, positionCode, birthDate?, birthCity?.default, birthCountry? }`.
- **player-landing** `playerId, firstName.default, lastName.default, position, sweaterNumber?, currentTeamId?, birthDate?, birthCity?.default, birthCountry?`.
- **skater-summary** `{ total, data[]: { playerId, seasonId, gamesPlayed, goals, assists, points, plusMinus, shots, penaltyMinutes, ppGoals, timeOnIcePerGame } }`; **goalie-summary** `{ total, data[]: { playerId, seasonId, gamesPlayed, gamesStarted, wins, losses, otLosses, saves, shotsAgainst, goalsAgainst, savePct (nullable), goalsAgainstAverage, shutouts, timeOnIce } }`.

## Mappers

| Mapper | Output |
|---|---|
| `mapScore(raw)` | `{ games: Game[]; teams: Team[] }` — `gameDate` from the game, period scores from `goals[]` |
| `mapSchedule(raw)` | `{ games: Game[]; teams: Team[] }` — `gameDate` from `gameWeek[].date`, `periodScores` null (schedule has no goals) |
| `mapBoxscore(raw)` | `{ lines: StatLine[]; teams: Team[]; players: Player[] }` — players are stubs |
| `mapRoster(raw, teamExternalId)` | `{ players: Player[]; warnings: string[] }` |
| `mapPlayerLanding(raw)` | `{ player: Player; warnings: string[] }` |
| `mapSkaterSummary(raw, seasonType)` / `mapGoalieSummary(raw, seasonType)` | `{ seasonStats: SeasonStats[]; total: number }` — the response has no game type, so the caller passes the one its URL asked for |

Shared rules:
- IDs: `publicId` `nhl-<id>` for games and players; `externalId` and team references are the NHL numeric team ID as a string (`"29"`). Teams: `{ league: 'NHL', source: 'nhl', externalId, abbrev, name }` with `name` = the team's common name (`name.default` in score, `commonName.default` elsewhere — both "Blue Jackets"), deduped by `externalId`.
- Season: `season` `20252026` → `"2025-26"` via `seasonLabel`; anything not 8 digits with the second year = first + 1 throws.
- Position group: `C`/`L`/`R` → forward, `D` → defense, `G` → goalie; else throws. `position` is the code as given.
- Birth country: valid alpha-3 (`countryCodeSchema`) → kept; anything else → `null` plus a warning `nhl <endpoint>: player <id>: unknown birthCountry "<v>"` (never a guess). Missing → `null`, no warning.
- Jersey: `sweaterNumber` as a string, or null.

**Box score lines**: one per player in each side's `forwards`, `defense` (kind `hockey_skater`) and `goalies` (`hockey_goalie`); `teamExternalId` = that side's team; `starter` = `starter ?? null` (absent in preseason; skaters null).
- TOI `"MM:SS"` → seconds (minutes may exceed 59: `"65:00"` → 3900). A malformed TOI throws. TOI 0 → DNP line (owner ruling).
- Skater stats: `goals, assists, points, plusMinus, shots ← sog, toiSeconds, pim, hits, blocks ← blockedShots, powerPlayGoals`.
- Goalie stats: `saves, shotsAgainst, goalsAgainst, toiSeconds, savePct` = null when `shotsAgainst` is 0, else `savePctg` (missing then throws), `decision` W → W, L → L, O → OTL, absent → null, other throws.
- Stubs: `firstName`/`lastName` split from `name.default` at the first space (`"E. Merzlikins"` → `"E."`, `"Merzlikins"`; no space → `""`, whole), `position`, group, jersey, `currentTeamExternalId` = the team he played for, birth fields null. S04a writes stubs only for unknown players and enriches them from landing.

**Season stats** (`kind` hockey_skater / hockey_goalie, `basis` `totals`, `season` from `seasonId`, values as given, no rounding — rule 5):
- skater `stats`: `gamesPlayed, goals, assists, points, plusMinus, shots, pim ← penaltyMinutes, powerPlayGoals ← ppGoals, toiPerGameSeconds ← timeOnIcePerGame`.
- goalie `stats`: `gamesPlayed, gamesStarted, wins, losses, otLosses, saves, shotsAgainst, goalsAgainst, savePct, goalsAgainstAverage, shutouts, toiSeconds ← timeOnIce`; a null source value omits its key.

## Mapping tables

**Status** (VISION §8; `gameScheduleState` first):

| `gameScheduleState` | `gameState` | status |
|---|---|---|
| `OK` | `FUT`, `PRE` | SCHEDULED |
| `OK` | `LIVE`, `CRIT` | LIVE |
| `OK` | `FINAL`, `OFF` | FINAL (preseason finals stay `FINAL`, regular ones become `OFF`) |
| `PPD` | any | POSTPONED |
| `CNCL` | any | CANCELLED |
| other | other | throws |

Observed in fixtures: `OK` with `FUT`, `FINAL`, `OFF` only; `PRE`/`LIVE`/`CRIT`/`PPD`/`CNCL` are from VISION and the community docs (unverified).

**Season type**: `gameType` 1 → PRE, 2 → REG, 3 → POST. Any other game type (4 = All-Star, international events) is **skipped** — not a league game we track (my call).

**Ended in**: FINAL → `gameOutcome.lastPeriodType` `REG`/`OT`/`SO` as is (FINAL without `gameOutcome`, or another value, throws); not FINAL → null.

**Scores**: `score` when present, else null (FUT games have none).

**Period scores** (score only; null when the game has no `periodDescriptor`, i.e. not started): periods 1..`periodDescriptor.number`, each `{ period, away, home }` counting `goals[]` by `periodDescriptor.number` and `teamAbbrev`. Label: n ≤ `maxRegulationPeriods` → `"n"`; the last period when its type is `SO` → `"SO"`; first overtime → `"OT"`; later overtimes → `"2OT"`, `"3OT"` (playoffs). A shootout counts 1 for the winner, as right-rail does. right-rail is not fetched: `score` gives the same numbers with no extra request per game.

## Fetchers (`fetch.ts`)
`fetchScore(client, date)`, `fetchSchedule(client, date)`, `fetchBoxscore(client, gameId)`, `fetchRoster(client, teamAbbrev, teamExternalId)`, `fetchPlayerLanding(client, playerId)`, `fetchSkaterSummary(client, season, seasonType)` and `fetchGoalieSummary(…)` (`season` `"2025-26"` → `seasonId=20252026`; adds `and gameTypeId=<1|2|3>` and `limit=-1`, which returned every row in one request in live probes on 2026-10-17: 940/940 skaters, 98/98 goalies for 2025-26 REG, none with a null in a field we use; throws when rows < `total`). Tested with a fake client serving fixture text: the URL requested and the mapped result. Four summary fixtures are cut at 50 rows, so (my call) the success path uses `skater-summary-lva` (5 of 5) and, for goalies, a copy of `goalie-summary-reg` whose `total` the test sets to its row count; the untouched `-reg` fixtures prove the truncation error. No new fixtures.

## pnpm inspect
`pnpm inspect nhl <endpoint> <fixture-id>` reads `apps/server/test/fixtures/nhl/<endpoint>/<id>.json`, runs the mapper and prints the result as JSON. Endpoints: `score`, `schedule`, `boxscore`, `roster` (passes the fixture id as `teamExternalId`, since a roster response doesn't name its team), `player-landing`, `skater-summary-reg`, `goalie-summary-reg` (season type REG). Unknown source/endpoint/fixture → usage message, exit 1. `espn-nba` → "arrives in S05".

## Countries
`ESPN_COUNTRY_ALIASES: Readonly<Record<string, CountryCode>>` = `{ USA: 'USA', England: 'GBR', Scotland: 'GBR', Wales: 'GBR' }`, with `shortcut: aliases only; S05 adds the full ESPN name table and the lookup`. Alpha-3 validation already exists (`countryCodeSchema`).

## Test cases (test-writer; values read from the raw JSON)
Test files `apps/server/test/nhl-*.test.ts`, fixtures loaded from `test/fixtures/nhl/`.

| Fixture | Assertions |
|---|---|
| `score/2026-01-17` | SO game `2025020760` CBJ@PIT: FINAL, REG season type, season `2025-26`, endedIn SO, 4–3, team externalIds 29/5; period scores equal right-rail's `linescore.byPeriod` (`1` 1–2, `2` 2–0, `3` 0–1, `OT` 0–0, `SO` 1–0) — `right-rail/2025020760` is the oracle |
| `score/2026-03-16` | OT game `2025021064` BOS@NJD 3–4: endedIn OT, periods `1`..`3`, `OT` (NJD 1) |
| `score/2026-03-24` | ANA@VAN `2025021134`: `gameDate` `2026-03-24`, `startTimeUtc` `2026-03-25T02:00:00Z`; REG ending; game count |
| `score/2026-03-14`, `score/2026-03-23` | game count, every game FINAL; one endedIn REG game's scores |
| `score/2026-10-16-states` | FUT `2026020119`: SCHEDULED, scores null, endedIn null, periodScores null, season `2026-27` |
| `schedule/2026-09-25` | preseason `2026010049` BOS@WSH: PRE, `FINAL` → FINAL, endedIn OT, 2–3, gameDate from `gameWeek[].date`, periodScores null; a regular-season `OFF` game → REG FINAL; team name from `commonName` |
| `schedule/2026-03-24` | game count; `2025021134` listed under `2026-03-24` |
| `boxscore/2025021127` | Girgensons `8476878` skater line (all ten stats, `toi` `12:49` → 769); a goalie decision `L` |
| `boxscore/2025020760` | Merzlikins `8478007` goalie: 30/33/3, savePct 0.909091, toi 3900, W, starter true; Šilovs `8481668` decision O → OTL; Greaves `8482982` DNP line; stub name split; teams 29/5 |
| `boxscore/2025021064` | Markstrom W, Korpisalo OTL; a defense line has group via kind `hockey_skater` |
| `boxscore/2026010059` | preseason: starter null on goalies; Black `8484900` DNP (savePctg 0, toi 00:00); Schmid `8481033` OTL with savePct 0.909091 |
| `roster/FLA` | Vilmanis `8483771`: L, forward, jersey `"95"`, LVA, currentTeam = given id; player count |
| `roster/PIT` | Šilovs `8481668` goalie, LVA |
| `roster/CBJ` | count; no LVA; a defenseman's group |
| `player-landing/8476878` | Girgensons: names, C, forward, `"28"`, team `"14"`, 1994-01-05, Riga, LVA |
| `player-landing/8478007` | Merzlikins: G, goalie, team `"10"` |
| `skater-summary-reg/20252026` | Kolesar `8478434` gamesPlayed 82; `total` 940; kind/basis/season |
| `skater-summary/20252026` | Tsyplakov `8484958` (traded, `NYI,NJD`) one row, gamesPlayed 49 |
| `skater-summary-lva/20252026` | Girgensons gamesPlayed 81, `toiPerGameSeconds` 870.037 |
| `goalie-summary-reg/20252026` | Kochetkov `8481611`: 9 GP, 8 GS, 6-2-0, 170/189, savePct 0.89947, shutouts 1, toi 29409 |
| `goalie-summary/20252026` | one goalie row's values; a null `savePct` omits the key if a row has one |

Plus: malformed payloads per mapper (mutated copy: e.g. a goalie's `toi` removed, `gameState` `"XYZ"`, `season` `20252027`, `toi` `"abc"`) throw `/^nhl <endpoint>/`; an invalid `birthCountry` gives null + warning; a `gameType` 4 game is skipped. Fetchers, the fetch block and inspect are tested by the implementer (task 3/4).

# NHL source notes

Unofficial, keyless, undocumented. Verified against fixtures recorded 2026-10-16/17 (S01). Community docs: https://github.com/Zmalski/NHL-API-Reference. Fixture paths are relative to `apps/server/test/fixtures/`; URL builders live in `apps/server/scripts/endpoints.ts`.

## Endpoints

| Name | URL | Fixtures |
|---|---|---|
| score | `https://api-web.nhle.com/v1/score/{YYYY-MM-DD}` | `nhl/score/2026-01-17.json`, `nhl/score/2026-03-14.json`, `nhl/score/2026-03-16.json`, `nhl/score/2026-03-23.json`, `nhl/score/2026-03-24.json`, `nhl/score/2026-10-16-states.json` |
| schedule | `https://api-web.nhle.com/v1/schedule/{YYYY-MM-DD}` (7-day `gameWeek`) | `nhl/schedule/2026-03-24.json`, `nhl/schedule/2026-09-25.json` |
| schedule-calendar | `https://api-web.nhle.com/v1/schedule-calendar/{YYYY-MM-DD}` (`teams[]`: the 32 current-season teams, `id`, `abbrev`, `commonName.default`, `seasonId` per team) | `nhl/schedule-calendar/2026-10-18.json` |
| boxscore | `https://api-web.nhle.com/v1/gamecenter/{gameId}/boxscore` | `nhl/boxscore/2025020760.json` (SO), `nhl/boxscore/2025021064.json` (OT), `nhl/boxscore/2025021127.json` (REG), `nhl/boxscore/2026010059.json` (preseason, SO) |
| right-rail | `https://api-web.nhle.com/v1/gamecenter/{gameId}/right-rail` | `nhl/right-rail/2025020760.json` |
| roster | `https://api-web.nhle.com/v1/roster/{teamAbbrev}/current` | `nhl/roster/CBJ.json` (no Latvian), `nhl/roster/FLA.json`, `nhl/roster/PIT.json` |
| player-landing | `https://api-web.nhle.com/v1/player/{playerId}/landing` | `nhl/player-landing/8476878.json` (Girgensons), `nhl/player-landing/8478007.json` (Merzļikins) |
| skater/goalie summary | `https://api.nhle.com/stats/rest/en/{skater\|goalie}/summary?cayenneExp=seasonId=20252026` | `nhl/skater-summary/20252026.json`, `nhl/goalie-summary/20252026.json`, `nhl/skater-summary-lva/20252026.json`, `nhl/skater-summary-reg/20252026.json`, `nhl/goalie-summary-reg/20252026.json`, `nhl/skater-summary-reg-all/20252026.json`, `nhl/goalie-summary-reg-all/20252026.json` |
| skater/goalie bios | `https://api.nhle.com/stats/rest/en/{skater\|goalie}/bios?cayenneExp=seasonId=20252026` | `nhl/skater-bios/20252026.json`, `nhl/goalie-bios/20252026.json`, `nhl/skater-bios-lva/20252026.json`, `nhl/goalie-bios-lva/20252026.json` |

The `-lva` variants add `and nationalityCode="LVA"` to `cayenneExp` (URL-encoded); the `-reg` variants add `and gameTypeId=2`; the `-reg-all` variants are the adapter's own URL (`nhlUrls.summary`: `limit=-1`, `gameTypeId=2`), recorded 2026-10-18 with every row (940 of 940, 98 of 98) because the 50-row `-reg` pages trip the truncation guard. Stats REST returns `{data[], total}` with 50 rows by default (`nhl/skater-summary/20252026.json`: `total` 977, 50 rows); `limit=-1` returns every row in one request (live probes 2026-10-17, 2025-26 `gameTypeId=2`: skater summary 940 of 940, goalie summary 98 of 98), so the adapter requests `limit=-1` and throws when rows < `total`; `start` paging is not tested.

## Field paths for VISION §8

| Need | Path | Example (fixture) |
|---|---|---|
| Game ID | `score.games[].id`, `boxscore.id` | `2025021134` (`nhl/score/2026-03-24.json`) |
| Season | `games[].season` | `20252026` → store `"2025-26"` |
| Season type | `games[].gameType`: 1 = PRE, 2 = REG (3 = POST, not recorded) | `1` in `nhl/boxscore/2026010059.json` |
| Game date | `score.games[].gameDate`; schedule: `gameWeek[].date` (schedule games have no `gameDate`) | `"2026-03-24"` |
| Start time | `games[].startTimeUTC` | `"2026-03-25T02:00:00Z"` |
| Status | `games[].gameState`, `games[].gameScheduleState` | `"OFF"` / `"OK"` |
| Teams | `awayTeam` / `homeTeam` `.id`, `.abbrev` | `{"id":10,"abbrev":"TOR"}` |
| Scores | `awayTeam.score`, `homeTeam.score` | CBJ 4, PIT 3 (`nhl/boxscore/2025020760.json`) |
| Ended in | `gameOutcome.lastPeriodType` (`REG`/`OT`/`SO`), `gameOutcome.otPeriods` | `{"lastPeriodType":"OT","otPeriods":1}` (`nhl/boxscore/2025021064.json`) |
| Period scores | `right-rail.linescore.byPeriod[]` (see Q4) | |
| Skater line | `boxscore.playerByGameStats.{awayTeam,homeTeam}.{forwards,defense}[]`: `goals`, `assists`, `points`, `plusMinus`, `sog`, `toi`, `pim`, `hits`, `blockedShots`, `powerPlayGoals` | Girgensons `{"goals":0,"assists":0,"points":0,"plusMinus":1,"sog":1,"toi":"12:49","pim":0,"hits":1,"blockedShots":0,"powerPlayGoals":0}` (`nhl/boxscore/2025021127.json`) |
| Goalie line | `...goalies[]`: `saves`, `shotsAgainst`, `goalsAgainst`, `savePctg`, `toi`, `decision`, `starter` | Merzļikins `saves` 30, `shotsAgainst` 33, `goalsAgainst` 3, `savePctg` 0.909091, `toi` `"65:00"`, `decision` `"W"` (`nhl/boxscore/2025020760.json`) |
| Player in box score | `playerId`, `sweaterNumber`, `position`, `name.default` | `8476878`, `28`, `"C"`, `"Z. Girgensons"` |
| Roster player | `roster.{forwards,defensemen,goalies}[]`: `id`, `firstName.default`, `lastName.default`, `sweaterNumber`, `positionCode`, `birthDate`, `birthCity.default`, `birthCountry` | Vilmanis `8483771`, `95`, `"L"`, `"LVA"` (`nhl/roster/FLA.json`) |
| Landing | `playerId`, `isActive`, `currentTeamAbbrev`, `position`, `sweaterNumber`, `birthDate`, `birthCity.default`, `birthCountry`, `featuredStats`, `last5Games[]`, `seasonTotals[]` | Girgensons `"TBL"`, `"C"`, `28`, `"1994-01-05"`, `"Riga"`, `"LVA"` (`nhl/player-landing/8476878.json`) |
| Season stats (totals) | `featuredStats.regularSeason.subSeason` (landing) or stats REST `summary` `data[]` with `gameTypeId` in `cayenneExp` (see Q5) | landing (current season, `featuredStats.season`): `gamesPlayed` 7, `goals` 1, `points` 2; summary-lva (2025-26, no `gameTypeId`): Girgensons `gamesPlayed` 81 = 74 regular season + 7 playoffs (landing `seasonTotals` 20252026 `gameTypeId` 2 / 3) |

## Answers to VISION §9

### Q1 Game-day convention
Same as ESPN: a game is listed under the US schedule date, not its UTC date. `score/{date}` `games[].gameDate` is the schedule date. Example: ANA@VAN `2025021134` is in `nhl/score/2026-03-24.json` with `gameDate` `"2026-03-24"` and `startTimeUTC` `"2026-03-25T02:00:00Z"`; `nhl/schedule/2026-03-24.json` lists it under `gameWeek[].date` `"2026-03-24"`. Store `gameDate` from the field, never from `startTimeUTC`.

### Q2 Game states
`games[].gameState` / `gameScheduleState` across all recorded `score`, `schedule` and `boxscore` fixtures:

| State | Where | Example |
|---|---|---|
| `OFF` / `OK` | finished regular-season games (all `score` dates, `schedule/2026-03-24`, three boxscores) | `nhl/score/2026-03-24.json`: 15 games `OFF` |
| `FINAL` / `OK` | finished **preseason** games (`gameType` 1), even weeks later | `nhl/schedule/2026-09-25.json`: 18 preseason `FINAL`, 16 regular `OFF`; `nhl/boxscore/2026010059.json` `"FINAL"` |
| `FUT` / `OK` | future games, `period` null | `nhl/score/2026-10-16-states.json`: `2026020119` `FUT`, `startTimeUTC` `"2026-10-17T01:00:00Z"` |
| `PRE`, `LIVE`, `CRIT`, `OVER` | not observed (no game in progress at recording time); `OVER` (after the final horn, before `FINAL`/`OFF`) comes from community docs, the adapter maps it to `LIVE` | |
| postponed / cancelled (`gameScheduleState` other than `OK`) | not observed | |

So both `FINAL` and `OFF` must map to FINAL.

### Q3 Rosters
`roster/{team}/current` carries `birthCountry` (alpha-3) on every player: Šilovs `8481668` `"LVA"` in `nhl/roster/PIT.json`; no per-player call needed for birth country. There is **no status, injury or assignment field** (player keys: `birthCity`, `birthCountry`, `birthDate`, `firstName`, `headshot`, `height*`, `id`, `lastName`, `positionCode`, `shootsCatches`, `sweaterNumber`, `weight*`). Vilmanis `8483771` is listed on `nhl/roster/FLA.json` (`forwards[]`); the data cannot tell whether he is in the AHL or injured. `nhl/roster/CBJ.json` has no `"LVA"` player (Merzļikins moved; landing `currentTeamAbbrev` `"TOR"`). The roster has no season field: it is always the current one.

### Q4 Period scores
Not in the boxscore (top-level keys of `nhl/boxscore/2025020760.json` have no `linescore`). Use `gamecenter/{id}/right-rail`: `linescore.byPeriod[]` `{periodDescriptor:{number,periodType}, away, home}`, `linescore.totals` `{"away":4,"home":3}`, `linescore.shootout` `{"awayConversions":2,"awayAttempts":4,"homeConversions":1,"homeAttempts":4,...}` (`nhl/right-rail/2025020760.json`; the SO "period" is `{"number":5,"periodType":"SO"}` with `away` 1, `home` 0). `score` also has per-goal `games[].goals[].periodDescriptor.periodType` (`"SO"` for the deciding shootout goal of `2025020760` in `nhl/score/2026-01-17.json`) — period scores could be summed from it, but right-rail is direct.

### Q5 Bulk season stats
NHL has bulk: stats REST `skater/summary` and `goalie/summary` (`total` 977 / 100 for 2025-26, 50 rows per page). One row per player, but **without `gameTypeId` the row sums regular season + playoffs**: unfiltered `nhl/skater-summary/20252026.json` has Keegan Kolesar `8478434` at `gamesPlayed` 103 (> 82), and Girgensons' 81 in `skater-summary-lva` is his 74 regular-season + 7 playoff games (landing `seasonTotals`). Adapters must add `and gameTypeId=2` (regular season) or `and gameTypeId=3` (playoffs): `nhl/skater-summary-reg/20252026.json` (`seasonId=20252026 and gameTypeId=2`, `total` 940) has max `gamesPlayed` 82, Kolesar 82; `nhl/goalie-summary-reg/20252026.json` (`total` 98) max 58. Separately, a player traded mid-season gets one row summed across teams: Maksim Tsyplakov `teamAbbrevs` `"NYI,NJD"`, `gamesPlayed` 49 (both summary fixtures). (The NBA question is answered in `espn-nba.md`.) Per-player alternative: landing `featuredStats.regularSeason.subSeason`.

### Q6 DNP
Not an NHL field. Goalies who didn't play appear with `toi` `"00:00"` and no `decision`; in regular-season boxscores `savePctg` is absent, in preseason it is `0` (`nhl/boxscore/2026010059.json`, goalie `8481544`). Scratched skaters: not verified whether they appear.

### Q7 Formats
| Field | Format | Example (fixture) |
|---|---|---|
| `toi` (boxscore, landing `last5Games`) | `"MM:SS"` string, minutes can exceed 59 | `"12:49"`, goalie `"65:00"` (`nhl/boxscore/2025020760.json`) |
| `timeOnIcePerGame` (stats REST) | seconds, float | `870.037` (`nhl/skater-summary-lva/20252026.json`) |
| shots | `sog` in boxscore; `shots` in landing/stats REST | `1` (`nhl/boxscore/2025021127.json`) |
| `savePctg` | 0–1 float | `0.909091` |
| `saveShotsAgainst` | `"saves/shots"` string | `"30/33"` |
| `decision` | `"W"`, `"L"`, `"O"` (OT/SO loss → OTL); absent if no decision | `"O"` Šilovs, `"L"` in `nhl/boxscore/2025021127.json` |
| `starter` | boolean; **absent in the preseason boxscore** | `true` |

### Q8 Response sizes
`bytes` = upstream body (from `.meta.json`); disk = pretty-printed fixture.

| Fixture | Upstream bytes | On disk |
|---|---:|---:|
| `nhl/skater-summary-reg-all/20252026.json` | 430505 | 631564 |
| `nhl/goalie-summary-reg-all/20252026.json` | 38937 | 57920 |
| `nhl/score/2026-03-24.json` | 117608 | 190465 |
| `nhl/score/2026-01-17.json` | 109630 | 178646 |
| `nhl/schedule/2026-03-24.json` | 109455 | 191685 |
| `nhl/score/2026-03-14.json` | 92065 | 149048 |
| `nhl/schedule/2026-09-25.json` | 59426 | 105011 |
| `nhl/score/2026-03-16.json` | 43517 | 69903 |
| `nhl/skater-bios/20252026.json` | 24374 | 34087 |
| `nhl/skater-summary/20252026.json` | 22888 | 33615 |
| `nhl/goalie-bios/20252026.json` | 22870 | 32583 |
| `nhl/goalie-summary/20252026.json` | 19928 | 29629 |
| `nhl/player-landing/8476878.json` | 19767 | 30505 |
| `nhl/player-landing/8478007.json` | 18456 | 28367 |
| `nhl/boxscore/2025021127.json` | 13411 | 24378 |
| `nhl/boxscore/2025021064.json` | 13407 | 24344 |
| `nhl/boxscore/2025020760.json` | 13361 | 24306 |
| `nhl/boxscore/2026010059.json` | 12427 | 23016 |
| `nhl/roster/PIT.json` | 10575 | 15573 |
| `nhl/roster/FLA.json` | 10125 | 14910 |
| `nhl/roster/CBJ.json` | 9842 | 14499 |
| `nhl/score/2026-10-16-states.json` | 9369 | 15084 |
| `nhl/score/2026-03-23.json` | 6964 | 10461 |
| `nhl/right-rail/2025020760.json` | 6140 | 9557 |
| `nhl/skater-bios-lva/20252026.json` | 2941 | 4118 |
| `nhl/skater-summary-lva/20252026.json` | 2317 | 3411 |
| `nhl/goalie-bios-lva/20252026.json` | 1382 | 1977 |

Max 430505 bytes (632 KB on disk): no NHL fixture needs pruning. Pruning rule (proposal, shared with `espn-nba.md`): see there.

## Nationality

| Field | Where | Notes |
|---|---|---|
| `nationalityCode` | stats REST bios `data[]` | alpha-3; filterable in `cayenneExp` |
| `birthCountryCode` | stats REST bios `data[]` | alpha-3 |
| `birthCountry` | roster players, landing | alpha-3; no nationality field on these endpoints |
| `seasonTotals[]` national-team rows | landing | `leagueAbbrev` in the landing fixtures: `"OG"`, `"OGQ"`, `"Olympics"`, `"WC"`, `"WC-A"`, `"WJ18-A"`, `"WJC-A"`, `teamName.default` e.g. `"Latvia"` (`nhl/player-landing/8476878.json`, `8478007.json`; all `leagueAbbrev` values there: AHL EJHL EmJHL NHL NL OG OGQ Olympics Swiss Swiss-Jr. Swiss-U17 USHL WC WC-A WJ18-A WJC-A) |

Where `nationalityCode` ≠ `birthCountryCode` (page 1 of `nhl/skater-bios/20252026.json`; none on goalie page 1):

| Player | ID | `nationalityCode` | `birthCountryCode` |
|---|---|---|---|
| Drake Batherson | `8480208` | `CAN` | `USA` |
| Harrison Brunicke | `8484839` | `CAN` | `ZAF` |
| Nathan Walker | `8477573` | `AUS` | `GBR` |

In each case `nationalityCode` appears to be the national team the player represents (not from fixtures; owner to confirm). For every Latvian row (`nhl/skater-bios-lva/20252026.json` 6 rows, `nhl/goalie-bios-lva/20252026.json` 3 rows) both are `"LVA"`. `nationalityCode="LVA"` finds 5 skaters + 2 goalies for 2025-26.

**Proposal for S02a (not adopted)** — VISION §7 default and CLAUDE.md rule 6:
> Nationality means sporting nationality — the national team a player represents. One ISO 3166-1 alpha-3 code per player (or null): the override if one exists; else the source's nationality field where one exists (NHL stats bios `nationalityCode`); else the birth country. `nationality_source` ∈ `override`, `source`, `birth`.

(NBA keeps birth country + overrides: ESPN has no reliable nationality field, see `espn-nba.md`.)

## Quirks
- **Bios repeat a player per game type** unless filtered: Girgensons `8476878` has two rows in `nhl/skater-bios-lva/20252026.json` (`gamesPlayed` 7 and 74), Šilovs two in `nhl/goalie-bios-lva/20252026.json` (39 and 3); rows carry no `gameTypeId`. Add `and gameTypeId=2` or dedupe by `playerId`. Summary rows are one per player but, without `gameTypeId`, sum regular season + playoffs (Girgensons `gamesPlayed` 81 = 74 + 7; see Q5); add `and gameTypeId=2` there too.
- **Bios `currentTeamAbbrev` is today's team**, not the season's: Blueger `"TOR"`, Abols `null`; the 2025-26 team is in summary `teamAbbrevs` (`"VAN"`, `"PHI"`).
- Names come without diacritics in `default`: `"A. Silovs"`, with `cs`/`sk` variants `"A. Šilovs"` (`nhl/boxscore/2025020760.json`); landing `lastName.default` `"Merzlikins"`.
- Goalie `toi` in a shootout game differs between goalies (`"65:00"` vs `"64:26"` in `nhl/boxscore/2025020760.json`).
- Preseason games stay `FINAL`, never `OFF`; preseason boxscores lack `starter` and set `savePctg` 0 for unused goalies.
- The regular season 2026-27 started 2026-09-29 (`gameType` 2 games from that date in `nhl/schedule/2026-09-25.json`).
- A `FUT` game's boxscore shape is not recorded. A live S01 run on 2026-03-16 gave Arturs Silovs (PIT) 25 saves on 27 shots and the win.

# NHL — api-web.nhle.com and api.nhle.com/stats

Official but undocumented, keyless. Verified live on 2026-10-03 (S01) through the polite client. Community reference: https://github.com/Zmalski/NHL-API-Reference.

Every example value below is quoted from a fixture in `apps/server/test/fixtures/nhl/` (path given as `<endpoint>/<id>`). Fixtures are re-serialized with 2-space indentation, so they aren't byte-identical to the response; `bytes` in each `.meta.json` is the raw size.

## Endpoints used

| Fixture endpoint | URL | Used for |
|---|---|---|
| `score` | `https://api-web.nhle.com/v1/score/{YYYY-MM-DD}` | One game day: games, states, scores, `goals[]` |
| `schedule` | `https://api-web.nhle.com/v1/schedule/{YYYY-MM-DD}` | 7 days from that date (`gameWeek[]`); season dates |
| `boxscore` | `https://api-web.nhle.com/v1/gamecenter/{gameId}/boxscore` | Per-player game stats |
| `gamecenter-right-rail` | `https://api-web.nhle.com/v1/gamecenter/{gameId}/right-rail` | Line score by period, shootout summary |
| `gamecenter-landing` | `https://api-web.nhle.com/v1/gamecenter/{gameId}/landing` | Scoring summary per period (an alternative to `right-rail`) |
| `roster` | `https://api-web.nhle.com/v1/roster/{TEAM}/current` (or `/{seasonId}`) | Players, positions, birth data |
| `player-landing` | `https://api-web.nhle.com/v1/player/{playerId}/landing` | Bio, current team, career `seasonTotals` |
| `skater-summary` / `goalie-summary` | `https://api.nhle.com/stats/rest/en/{skater\|goalie}/summary?…&start=0&limit=100&cayenneExp=seasonId=20252026 and gameTypeId=2` | Bulk season totals |
| (spike only) bios | `https://api.nhle.com/stats/rest/en/{skater\|goalie}/bios?cayenneExp=seasonId=… and birthCountryCode="LVA"` | Every Latvian in a season, 2 requests |

## Field paths for what VISION needs

| Need | Path | Example |
|---|---|---|
| Game ID | `score.games[].id`, `boxscore.id` | `2025021015` |
| Game type | `.gameType` (1 PRE, 2 REG, 3 POST) | `score/2026-09-24`: `1`; `boxscore/2025021015`: `2` |
| Season | `.season` | `20252026` → store `"2025-26"` |
| Game day | `.gameDate` | `"2026-03-10"` |
| Start (UTC) | `.startTimeUTC` | `"2026-03-11T02:00:00Z"` |
| State | `.gameState`, `.gameScheduleState` | `"OFF"`, `"OK"` |
| Teams and score | `.awayTeam.abbrev`, `.awayTeam.score`, `.homeTeam.…` | `"CBJ"`, `5` |
| Ended in | `.gameOutcome.lastPeriodType` | `"REG"` / `"OT"` / `"SO"` |
| Period scores | `right-rail.linescore.byPeriod[].{periodDescriptor.number, periodDescriptor.periodType, away, home}` | see Q4 |
| Skater line | `boxscore.playerByGameStats.{awayTeam,homeTeam}.{forwards,defense}[]` | `{"playerId":8476878,"goals":0,"assists":0,"points":0,"plusMinus":-1,"sog":1,"toi":"12:32","pim":0,"hits":…,"blockedShots":…,"powerPlayGoals":…}` |
| Goalie line | `….goalies[]` | `{"playerId":8478007,"saves":16,"shotsAgainst":18,"goalsAgainst":2,"savePctg":0.888889,"saveShotsAgainst":"16/18","toi":"59:29","decision":"W","starter":true}` |
| Player ID / name | roster `.id`, `.firstName.default`, `.lastName.default` | `8476878`, `"Zemgus"`, `"Girgensons"` |
| Position | roster `.positionCode`; landing `.position` | `"C"`, `"G"`; roster groups `forwards`/`defensemen`/`goalies` |
| Birth country | roster `.birthCountry`; landing `.birthCountry`; bios `.birthCountryCode` | `"LVA"` (already alpha-3) |
| Birth city / date | roster `.birthCity.default`, `.birthDate` | `"Riga"`, `"1994-01-05"` |
| Jersey | roster `.sweaterNumber` | `28` |
| Current team | landing `.currentTeamAbbrev`, `.isActive` | Merzļikins: `"TOR"`, `true` |
| Season totals | `skater-summary.data[]`: `goals, assists, points, plusMinus, shots, timeOnIcePerGame` (seconds, float), `teamAbbrevs`; `goalie-summary.data[]`: `wins, losses, otLosses, savePct, goalsAgainstAverage` | `"timeOnIcePerGame":1379.1219`; `"savePct":0.91233` |

## The eight questions (VISION §9)

**1. Game day convention — same as ESPN: the US calendar date.**
`score/2026-03-10`: NSH @ SEA, `id` `2025021024`, `"gameDate":"2026-03-10"`, `"startTimeUTC":"2026-03-11T02:00:00Z"` (7 pm Pacific). The game is listed under the US date even though it starts on the next UTC day. ESPN does the same for GSW–CHI that night (see `espn-nba.md` Q1). Note: `/score/{date}` returns the requested day only. `/schedule/{date}` returns 7 days starting at that date (`gameWeek[].date` `2026-03-10` … `2026-03-16`).

**2. Game states observed.**
Across every fixture (`score`, `schedule`, `boxscore`): `gameState` ∈ {`OFF`, `FINAL`, `FUT`}, and `gameScheduleState` is always `OK`.
- `OFF`: 75 regular-season finals (e.g. `boxscore/2025021015`).
- `FINAL`: all 11 preseason games on `score/2026-09-24` (and so `boxscore/2026010043`, one of them). Preseason games seem to stay `FINAL` instead of moving to `OFF`, so the mapping has to treat both as final.
- `FUT`: `score/2026-10-04`.
- Not observed yet (documented in the community reference): `PRE`, `LIVE`, `CRIT` and the postponed/cancelled `gameScheduleState` values (`PPD`, `CNCL`, `SUSP`). S04a should record a live score day and confirm them.
- VISION §8's mapping holds; add: `FINAL` is used for preseason finals.

**3. Rosters carry birth country. Injured players: probably. AHL assignees: no.**
`roster/TBL`, `roster/PIT`: every entry has `birthCountry` (`"LVA"` for Girgensons, Šilovs), `birthCity`, `birthDate`, `positionCode`, `sweaterNumber`, `firstName/lastName.default`. A per-player call isn't needed for nationality. There's no status or injury field (keys: `birthCity, birthCountry, birthDate, birthStateProvince, firstName, headshot, heightIn…, id, lastName, positionCode, shootsCatches, sweaterNumber, weightIn…`).
- Counts on 2026-10-03: TBL 25, PIT 26, CBJ 23. That's more than the 23-man active limit, which suggests injured-reserve players are listed. It isn't verifiable from the data, because no field says so.
- AHL players aren't on `/current` (it's the NHL roster). A player who is sent down disappears from it, which is what VISION §6.1's off-roster rule expects.
- **Season rosters** (`/roster/CBJ/20252026`) work and include players who have since moved: Merzļikins is on CBJ 2025-26, but his `player-landing` now says `TOR`. It's 20 players, though: a snapshot, not everyone who played for the team that season.
- **Bulk alternative:** `stats/rest/en/skater/bios` filters server-side by `birthCountryCode="LVA"` and returns `nationalityCode` too. Two requests list every Latvian who played in a season (the spike uses this).

**4. Period scores: in `right-rail`, not in the box score.**
`boxscore` has no line score (top-level keys: `awayTeam, clock, …, periodDescriptor, playerByGameStats, …`). `right-rail/2025021018` (PIT @ CAR, shootout) has `linescore.byPeriod`: `[{"periodDescriptor":{"number":1,"periodType":"REG"},"away":1,"home":1}, …, {"number":4,"periodType":"OT","away":0,"home":0}, {"number":5,"periodType":"SO","away":0,"home":1}]`, plus `linescore.shootout` (`homeConversions: 2, homeAttempts: 3`) and `totals` `{away: 4, home: 5}`. The SO "period" counts 1 for the shootout winner. `gamecenter-landing.summary.scoring[]` (goals per period) and `score.games[].goals[]` would also let us derive period scores. Proposal for S03: fetch `right-rail` (6 KB) once per final game, next to the box score.

**5. (NBA question; see `espn-nba.md`.)** For the NHL, bulk season stats exist: `skater-summary` has `total: 940` (10 pages of 100) and `goalie-summary` has `total: 98` (1 page). That's 11 requests per season type.

**6. (NBA question.)** NHL equivalent: a dressed backup goalie who didn't play shows up with `toi: "00:00"`, `saveShotsAgainst: "0/0"`, `starter: false`, and no `decision` or `savePctg` (`boxscore/2025021018`, Šilovs). Per D-024 these are shown as "DNP" (stored with `played = false`). Scratched players are not listed in the box score (expected from the structure; not cross-checked against a scratch list).

**7. Field names and formats.**
- TOI: string `"MM:SS"`, minutes can pass 60: `"12:32"`, `"65:00"` (Andersen, `boxscore/2025021018`); `"00:00"` for a backup who didn't play.
- Shots: skater `sog` (number). Goalie `shotsAgainst`, `saves`, `goalsAgainst` (numbers); also the string `saveShotsAgainst` `"16/18"` and per-strength strings (`evenStrengthShotsAgainst` `"10/12"`).
- Save percentage: `savePctg`, a number from 0 to 1 (`0.888889`). Regular season: **absent** when the goalie faced no shots. Preseason: `0` (`boxscore/2026010043`, Hildeby). Treat absent and 0-shots as null.
- Decision: `decision` ∈ `"W"`, `"L"`, `"O"` (OT/SO loss: Kuemper in `boxscore/2025021012`, Skinner in `boxscore/2025021018`). It's **absent** for goalies without one; in a preseason split, only one of the two goalies gets it. Map `"O"` → `OTL`.
- `starter`: boolean in regular season, **`null`** in preseason.
- Names are ASCII in the API: `"Merzlikins"`, `"Silovs"` (no diacritics).
- Box-score names are abbreviated (`"E. Merzlikins"`); full names come from roster/landing.

**8. Response sizes: none near 1 MB, no pruning needed.**

| Endpoint | Raw bytes (meta) |
|---|---|
| `schedule` | 105 323 |
| `score` | 17 171 – 90 611 |
| `skater-summary` (100 rows) | 46 408 |
| `goalie-summary` | 38 937 |
| `gamecenter-landing` | 19 631 |
| `player-landing` | 18 333 – 18 886 |
| `boxscore` | 12 688 – 13 413 |
| `roster` | 8 557 – 10 877 |
| `right-rail` | 6 359 |

## Quirks
- Every name field is a localized object: `{ "default": "Riga" }`, sometimes with extra languages (`"cs"`, `"fi"` …). Read `.default`.
- `seasonTotals` in `player-landing` includes national-team entries (`leagueAbbrev` `"WC"`, `"WC-A"`, `"Olympics"`, `"OG"`, `"OGQ"`, `"WJC-A"`, with `teamName.default` `"Latvia"`). That's the signal VISION §7 mentions for suggesting overrides later.
- The 2026-27 regular season started 2026-09-29 (`score/2026-09-30`: game IDs `2026020006…`, `gameType` 2). The preseason ran from mid-September (`schedule.preSeasonStartDate` was `"2025-09-20"` for 2025-26).
- Game IDs encode season and type: `2025021015` = season 2025, type 02 (regular), game 1015; `2026010043` = 2026 preseason.
- `teamAbbrevs` in the stats API is a comma-joined string for players traded mid-season.

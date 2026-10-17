# Recording log (S01 Task 3)

Working notes for Task 5: which fixture was recorded and why, swaps from the design's candidates, and probe findings. Recorded 2026-10-16 ~23:57–00:05 UTC (evening of 2026-10-16 US Eastern). 39 fixtures, 39 requests (every run printed `requests: 1`). Task 5 folds this into `nhl.md` / `espn-nba.md` and deletes it.

All paths below are relative to `apps/server/test/fixtures/`.

## Swaps from the design

- **Shared game day.** No candidate date has both a Latvian NHL skater and a Porziņģis game:
  - 2026-03-16: NHL games CGY@DET, BOS@NJD, LAK@NYR, UTA@DAL, PIT@COL — no team of a Latvian skater (2025-26 teams from `nhl/skater-summary-lva`: Blueger VAN, Balinskis FLA, Girgensons TBL, Abols PHI, Vilmanis FLA). ESPN has Porziņģis (GS@WSH, `401810839`).
  - 2026-03-24: NHL has MIN@TBL (Girgensons), SEA@FLA, CBJ@PHI, ANA@VAN. ESPN has no GS game. The design's "2026-03-24 @DAL" for `401810899` is the UTC date: `espn-nba/summary/401810899.json` `header.competitions[0].date` = `"2026-03-24T01:30Z"`, and ESPN lists it under `scoreboard?dates=20260323`.
  - 2026-03-14: no GS game on ESPN (recorded both leagues to check).
  - 2026-03-23: NHL has only OTT@NYR (no Latvian).
  - **Chosen:** NHL shared day **2026-03-24** (`score` + `schedule`, Latvian boxscore MIN@TBL); NBA Porziņģis games 2026-03-16 (`401810839`) and 2026-03-23 (`401810899`, OT). A true both-leagues day is left to an October 2026 date (the spike's demo date).
- **2026-04-13 ESPN scoreboard** has no events (`events: []`), so it can't answer Q1. Kept as the empty-day fixture. Q1 is answered from 2026-03-23 / 03-24 / 03-16 instead (see below).
- **Merzļikins `player-landing`**: he is not on the CBJ `current` roster. His ID `8478007` came from `nhl/goalie-bios-lva` (and the `2025020760` boxscore); `currentTeamAbbrev` = `"TOR"` in both bios and landing.
- **Preseason NBA summary** `401898399` (SAC @ GS, 2026-10-10): Porziņģis did not play (injured, see DNP below). No other Latvian NBA player found; not chased further.
- **Extra endpoints** (added to `scripts/endpoints.ts`): `skater-bios-lva`, `goalie-bios-lva`, `skater-summary-lva` (the last one because bios rows only carry the *current* team, so the 2025-26 team needed the summary's `teamAbbrevs`), and ESPN `byathlete` (Q5 probe; it is bulk, so it is kept).

## Fixtures

| Fixture | Upstream bytes | Why |
|---|---:|---|
| `nhl/score/2026-03-16.json` | 43517 | Design's first shared-day candidate; first call, proved the recorder. No Latvian skater. |
| `nhl/skater-bios/20252026.json` | 24374 | Page 1 bios: field names; no Latvians on page 1 → filter needed. |
| `nhl/goalie-bios/20252026.json` | 22870 | Page 1 goalie bios (Šilovs appears twice). |
| `nhl/skater-summary/20252026.json` | 22888 | Page 1 skater season stats. |
| `nhl/goalie-summary/20252026.json` | 19928 | Page 1 goalie season stats. |
| `nhl/skater-bios-lva/20252026.json` | 2941 | Latvian skaters via `nationalityCode="LVA"` (the spike's NHL query). |
| `nhl/goalie-bios-lva/20252026.json` | 1382 | Latvian goalies, same filter. |
| `nhl/skater-summary-lva/20252026.json` | 2317 | Latvians' 2025-26 `teamAbbrevs` (bios lack the season team). |
| `nhl/score/2026-03-24.json` | 117608 | Fallback shared day: Latvian skaters (TBL, FLA, VAN, PHI); late game ANA@VAN (Q1); two SO finals. |
| `nhl/schedule/2026-03-24.json` | 109455 | Schedule for the shared day. |
| `nhl/boxscore/2025021127.json` | 13411 | MIN@TBL 2026-03-24, Girgensons skater line. |
| `nhl/score/2026-01-17.json` | 109630 | Find CBJ@PIT: `2025020760`, 4–3, `gameOutcome.lastPeriodType` `"SO"`. |
| `nhl/boxscore/2025020760.json` | 13361 | Latvian goalie duel + shootout: Merzļikins W 30/33, Šilovs O 23/26. |
| `nhl/boxscore/2025021064.json` | 13407 | OT: BOS@NJD 2026-03-16, first OT final in recorded `score` (`gameOutcome` `{"lastPeriodType":"OT","otPeriods":1}`). |
| `nhl/right-rail/2025020760.json` | 6140 | Boxscore has no period scores → right-rail `linescore` for the SO game. |
| `nhl/schedule/2026-09-25.json` | 59426 | Late-September week: preseason games (`gameType` 1) and the opening regular-season games. |
| `nhl/boxscore/2026010059.json` | 12427 | Preseason TBL@FLA 2026-09-26: Girgensons, Vilmanis (1 G), Balinskis. |
| `nhl/roster/CBJ.json` | 9842 | `current` (2026-27) roster; no Latvian now. |
| `nhl/roster/PIT.json` | 10575 | `current` roster; Šilovs (`birthCountry` `"LVA"`). |
| `nhl/player-landing/8476878.json` | 19767 | Girgensons (skater). |
| `nhl/player-landing/8478007.json` | 18456 | Merzļikins (goalie). |
| `espn-nba/scoreboard/2026-03-24.json` | 59453 | Shared-day candidate; showed no GS game. |
| `espn-nba/scoreboard/2026-03-16.json` | 114861 | Porziņģis game `401810839`; late game SAS@LAC `2026-03-17T02:00Z` (Q1). |
| `espn-nba/scoreboard/2026-04-13.json` | 5489 | Design's Q1 date; empty (`events: []`). |
| `espn-nba/scoreboard/2026-03-14.json` | 100204 | Third fallback; no GS game. |
| `nhl/score/2026-03-14.json` | 92065 | Third fallback, NHL side (has SO and OT finals). |
| `espn-nba/summary/401810839.json` | 396535 | Porziņģis 30 pts @WSH; also has `didNotPlay` athletes (DNP fixture, no extra game needed). |
| `espn-nba/summary/401810899.json` | 432654 | OT: GS@DAL, linescores have 5 entries. |
| `espn-nba/scoreboard/2026-03-23.json` | 140527 | The real date of `401810899`; Q1 evidence (listed under 03-23, tips 03-24T01:30Z). |
| `nhl/score/2026-03-23.json` | 6964 | Checked as shared day; only OTT@NYR. |
| `espn-nba/athlete/3102531.json` | 4945 | Porziņģis; team `$ref` → seasons/2027/teams/9 (GS). |
| `espn-nba/athlete/3059318.json` | 5887 | Embiid (citizenship case). |
| `espn-nba/athlete/3136195.json` | 5994 | Towns (US-born, other citizenship). |
| `espn-nba/roster/9.json` | 104800 | Porziņģis' current team (GS); has `birthPlace`. |
| `espn-nba/overview/3102531.json` | 192541 | Per-athlete season stats (Q5 baseline). |
| `espn-nba/byathlete/2026.json` | 665097 | Q5 probe: bulk season stats, kept. |
| `espn-nba/scoreboard/2026-10-10.json` | 114251 | October preseason scoreboard (`season.slug` `"preseason"`). |
| `espn-nba/summary/401898399.json` | 438999 | Preseason SAC@GS; Porziņģis absent from box score, listed in `injuries`. |
| `nhl/score/2026-10-16-states.json` | 9369 | Step 6: US "today" (`TZ=America/New_York date +%F` → 2026-10-16) for live states. |

## Findings for Task 5

### Nationality
- **NHL bios** carry both `data[].nationalityCode` and `data[].birthCountryCode` (alpha-3). No Latvian where they differ (all 6 skater rows and 3 goalie rows: `"LVA"`/`"LVA"`). Disagreements on page 1 of `nhl/skater-bios/20252026.json`: Drake Batherson `8480208` nationality `CAN`, birth `USA`; Harrison Brunicke `8484839` `CAN` / `ZAF`; Nathan Walker `8477573` `AUS` / `GBR`. Goalie page 1: none.
- The `nationalityCode="LVA"` filter works (`cayenneExp` URL-encoded): skaters `total` 6 rows (5 players), goalies `total` 3 rows (2 players).
- **Bios repeat a player once per game type** when `gameTypeId` isn't filtered: Girgensons `8476878` has two rows (`gamesPlayed` 74 and 7); Šilovs `8481668` two rows (39 and 3). Rows carry no `gameTypeId` field. `skater-summary` returns one row per player with the totals summed (Girgensons `gamesPlayed` 81). Spike and adapters should add `and gameTypeId=2` (or dedupe by `playerId`).
- Bios `currentTeamAbbrev` is the *current* team (Merzļikins `"TOR"`, Blueger `"TOR"`, Abols `null`), not the season's team. The season team is `skater-summary` `data[].teamAbbrevs` (Blueger `"VAN"`, Abols `"PHI"`). The spike's "bios rows carry the team abbreviation" therefore holds only for current-season dates.
- **NHL roster** (`roster/<team>/current`): `forwards|defensemen|goalies[].birthCountry` (alpha-3, e.g. Šilovs `"LVA"`); no nationality field. `player-landing` likewise has `birthCountry` only (`"LVA"`).
- **ESPN athlete** (`sports.core` athlete): `birthPlace` `{city, state?, country}` and `citizenship` (string, often absent). Porziņģis: `birthPlace.country` `"Latvia"`, no `citizenship`. Embiid: `"Cameroon"` / `citizenship` `"Cameroon"`. Towns: `birthPlace` `{"city":"Edison","state":"NJ","country":"USA"}`, `citizenship` `"Dominican Republic"`. No `citizenshipCountry` or flag field.
- **ESPN roster** (`teams/9/roster`): every `athletes[].birthPlace` present (21/21), with `country` names (`"Latvia"`, `"USA"`, `"Nigeria"`, `"Dominican Republic"`, `"Netherlands"`, `"Brazil"`, `"Australia"`). `athletes[].citizenship` only on some (Butler `"USA"`, Toohey `"Australia"`). Roster `season` = `{"year":2027,"displayName":"2026-27","type":1,"name":"Preseason"}`.
- Owner to check: whether ESPN `citizenship` matches sporting nationality for Embiid (the recorded value is `"Cameroon"`).

### Rosters (Q3)
- NHL `current` rosters have no status/injury field. Vilmanis/FLA: FLA roster not recorded (no extra requests per ruling); he is in `nhl/skater-bios-lva` with `currentTeamAbbrev` `"FLA"` and in the preseason boxscore `2026010059`. AHL/injured representation not observed.
- ESPN roster lists injured players: Porziņģis `athletes[].status.name` `"Active"`, `athletes[].injuries` `[{"status":"Out","date":"2026-10-15T16:17Z"}]`.

### States (Q2)
- NHL `gameState`/`gameScheduleState`: `OFF`/`OK` (finished regular season, in `score` and `schedule`), `FINAL`/`OK` (finished preseason games in `schedule/2026-09-25` and boxscore `2026010059`), `FUT`/`OK` (`score/2026-10-16-states`, both games, `period` null). Not observed: `LIVE`, `CRIT`, `PRE`, postponed schedule states.
- ESPN `status.type.name`/`state`: `STATUS_FINAL`/`post`; `STATUS_SCHEDULED`/`pre` (only in `overview` `nextGame` and summary `401898399`). Not observed: in-progress, postponed.

### Game day (Q1)
- NHL `score/2026-03-24`: ANA@VAN `2025021134` `startTimeUTC` `"2026-03-25T02:00:00Z"`, listed under 03-24 (`gameDate` = the schedule date).
- ESPN `scoreboard?dates=20260323`: GS@DAL `401810899` `events[].date` `"2026-03-24T01:30Z"`, listed under 03-23; also BKN@POR `"2026-03-24T02:00Z"`, MIL@LAC `"2026-03-24T02:30Z"`. `scoreboard/2026-03-16` SAS@LAC `"2026-03-17T02:00Z"`. ESPN `day` is null at the top level.

### Period scores (Q4)
- NHL boxscore has **no** linescore (top-level keys: no `linescore`/`summary`). `right-rail` `linescore.byPeriod[]` `{periodDescriptor, away, home}`, `linescore.totals` `{"away":4,"home":3}`, `linescore.shootout` `{"awayConversions":2,"awayAttempts":4,"homeConversions":1,"homeAttempts":4,...}`. `score` has per-goal `games[].goals[]` with `periodDescriptor.periodType` (`"SO"` for the deciding shootout goal).
- ESPN: `header.competitions[0].competitors[].linescores[].displayValue` (summary) and `events[].competitions[0].competitors[].linescores[].value` (scoreboard); OT adds a 5th entry (`401810899` DAL `["31","42","25","28","5"]`).

### Box score formats (Q7)
- NHL skater: `toi` `"12:49"`, `sog` 1, `plusMinus` 1, `faceoffWinningPctg` 1. Goalie: `decision` `"W"`/`"O"`, `savePctg` 0.909091, `saveShotsAgainst` `"30/33"`, `toi` `"65:00"`, `starter`. Goalies who didn't play: `toi` `"00:00"`, no `decision`/`savePctg` keys. Shootout goalie `toi` differs (`"64:26"` vs `"65:00"`).
- NHL OT: `gameOutcome` `{"lastPeriodType":"OT","otPeriods":1}`, `periodDescriptor` `{"number":4,"periodType":"OT"}`.

### DNP (Q6)
- ESPN summary `boxscore.players[].statistics[0].athletes[]`: `didNotPlay` `true`, `stats` `[]`, `reason` e.g. `"COACH'S DECISION"`, `"RIGHT FOOT"`, `"NOT WITH TEAM"` (`401810839`). Labels: `["MIN","PTS","FG","3PT","FT","REB","AST","TO","STL","BLK","OREB","DREB","PF","+/-"]`; Porziņģis `["26","30","8-13","1-5","13-14","5","4","3","2","3","1","4","2","+7"]`.
- Injured-out players can be **absent** from the box score entirely: in preseason `401898399` Porziņģis isn't in `boxscore.players` but is in `injuries[]` (GS: `"Kristaps Porzingis"`, `status` `"Out"`). Absent ≠ DNP row.

### Bulk NBA stats (Q5)
- `byathlete?season=2026&seasontype=2&limit=50&page=1`: `pagination` `{"count":578,"limit":50,"pages":12}`, `categories` `general`/`offensive`/`defensive`, `athletes[].categories[].totals`. Bulk: ~12 requests per season at 50/page (limit may go higher, not tested).
- `overview`: `statistics.labels` `["GP","MIN","FG%","3P%","FT%","REB","AST","BLK","STL","PF","TO","PTS"]`, `statistics.splits[]` "Regular Season" `["32","24.0",...,"16.7"]` and "Career".

### Sizes (Q8)
- No upstream body over 1 MB. Largest: `espn-nba/byathlete/2026.json` 665097 bytes (1308185 on disk pretty-printed — the only file over 1 MB on disk), ESPN summaries ~400–440 KB, `overview` 192541. NHL max 117608 (`score/2026-03-24`).

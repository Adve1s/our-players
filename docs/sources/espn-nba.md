# ESPN NBA source notes

Unofficial, keyless. Verified against fixtures recorded 2026-10-16/17 (S01). Community docs: https://github.com/pseudo-r/Public-ESPN-API. Fixture paths are relative to `apps/server/test/fixtures/`; URL builders live in `apps/server/src/sources/espn-nba/client.ts` (`espnUrls`); `apps/server/scripts/endpoints.ts` reuses them for recording. ESPN labels a season by its end year (`2026` = 2025-26).

## Endpoints

| Name | URL | Fixtures |
|---|---|---|
| scoreboard | `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=YYYYMMDD` | `espn-nba/scoreboard/2026-03-14.json`, `espn-nba/scoreboard/2026-03-16.json`, `espn-nba/scoreboard/2026-03-23.json`, `espn-nba/scoreboard/2026-03-24.json`, `espn-nba/scoreboard/2026-04-13.json` (empty), `espn-nba/scoreboard/2026-10-10.json` (preseason) |
| summary | `.../nba/summary?event={eventId}` | `espn-nba/summary/401810839.json`, `espn-nba/summary/401810899.json` (OT), `espn-nba/summary/401898399.json` (preseason) |
| teams | `.../nba/teams` | `espn-nba/teams/2026-10-18.json` (30 teams; recorded in S05) |
| roster | `.../nba/teams/{teamId}/roster` | `espn-nba/roster/9.json` (GS) |
| athlete | `https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/athletes/{id}` | `espn-nba/athlete/3102531.json` (Porziņģis), `espn-nba/athlete/3059318.json` (Embiid), `espn-nba/athlete/3136195.json` (Towns) |
| overview | `https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/{id}/overview` | `espn-nba/overview/3102531.json` |
| byathlete | `https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/statistics/byathlete?season=2026&seasontype=2&limit=50&page=1` | `espn-nba/byathlete/2026.json` |

`dates=YYYYMMDD` works (VISION asked to verify it). A day without games returns `events: []` (`espn-nba/scoreboard/2026-04-13.json`).

## Field paths for VISION §8

| Need | Path | Example (fixture) |
|---|---|---|
| Event ID | `events[].id` (string) | `"401810899"` (`espn-nba/scoreboard/2026-03-23.json`) |
| Season / type | `events[].season` `{year, type, slug}`: type 1 = PRE, 2 = REG (3 = POST, not recorded) | `{"year":2026,"type":2,"slug":"regular-season"}`; preseason `{"year":2027,"type":1,"slug":"preseason"}` (`espn-nba/scoreboard/2026-10-10.json`) |
| Game date | none per event; it is the `dates=` value requested (see Q1). Top-level `day` is `null` | |
| Start time (UTC) | `events[].date` (scoreboard), `header.competitions[0].date` (summary); minute precision, `Z` | `"2026-03-24T01:30Z"` |
| Status | `events[].status.type.{name,state,completed}`; summary `header.competitions[0].status.type`, `detail` | `"STATUS_FINAL"`, `"post"`, `true`, `"Final/OT"` (`espn-nba/summary/401810899.json`) |
| Teams | `competitions[0].competitors[].{homeAway, team.id, team.abbreviation}` | `"home"`, `"6"`, `"DAL"` |
| Scores | `competitors[].score` (**string**) | `"131"` / `"137"` |
| Period scores | `competitors[].linescores[]` (see Q4) | |
| Ended in | count of `linescores` > 4, or `status.type.detail` `"Final/OT"` | 5 entries for `401810899` |
| Box score | `boxscore.players[]` (one per team): `team.abbreviation`, `statistics[0].labels`, `statistics[0].athletes[]` | |
| Player line | `athletes[].{athlete.id, athlete.jersey, athlete.position.abbreviation, starter, didNotPlay, reason, active, ejected, stats[]}` | Porziņģis `"3102531"`, `"7"`, `"C"`, `starter` false, `stats` `["26","30","8-13","1-5","13-14","5","4","3","2","3","1","4","2","+7"]` (`espn-nba/summary/401810839.json`) |
| Stat labels | `statistics[0].labels` = `["MIN","PTS","FG","3PT","FT","REB","AST","TO","STL","BLK","OREB","DREB","PF","+/-"]`; map by label. `FG`/`3PT`/`FT` are `"made-attempted"`, `+/-` is signed (`"+7"`) | |
| Roster player | `athletes[].{id, displayName, jersey, position.abbreviation, dateOfBirth, birthPlace.{city,state?,country}, citizenship?, status.name, injuries[]}`; `team.{id,abbreviation}` | Porziņģis `"7"`, `"C"`, `{"city":"Liepaja","country":"Latvia"}` (`espn-nba/roster/9.json`) |
| Athlete | `id`, `displayName`, `jersey`, `position.abbreviation`, `dateOfBirth`, `birthPlace`, `citizenship?`, `active`, `team.$ref` | team `$ref` `.../seasons/2027/teams/9` (`espn-nba/athlete/3102531.json`) |
| Season stats (per game) | overview `statistics.labels` / `names`, `statistics.splits[].{displayName, stats[]}` | see Q5 |

## Answers to VISION §9

### Q1 Game-day convention
Same as NHL: a game is listed under the US schedule date. `scoreboard?dates=20260323` (`espn-nba/scoreboard/2026-03-23.json`) lists GS@DAL `401810899` with `events[].date` `"2026-03-24T01:30Z"`, plus BKN@POR `"2026-03-24T02:00Z"` and MIL@LAC `"2026-03-24T02:30Z"`; it is not in `espn-nba/scoreboard/2026-03-24.json`, which in turn lists DEN@PHX `"2026-03-25T03:00Z"`. Also SA@LAC `401810845` `"2026-03-17T02:00Z"` under `dates=20260316`. The design's "2026-03-24" for `401810899` is the UTC date. The overview game log also carries a UTC timestamp, not a schedule date: `gameLog.events["401810997"].gameDate` `"2026-04-06T02:00:00.000+00:00"` (`espn-nba/overview/3102531.json`; the US evening of 2026-04-05). Since no event field carries the local date, the adapter takes `gameDate` from the `dates=` it requested. (The design's 2026-04-13 scoreboard is empty and answers nothing.)

### Q2 Status names
| `status.type.name` / `state` | Where | Example |
|---|---|---|
| `STATUS_FINAL` / `post` | every recorded game (all scoreboards, all summaries, incl. preseason) | 80 occurrences across the scoreboard, summary and overview fixtures |
| `STATUS_SCHEDULED` | only future games nested in other payloads: summary `seasonseries[0].events[].statusType.name` (4 in `espn-nba/summary/401898399.json`), overview `nextGame.league.events[0].fullStatus.type.name` (`espn-nba/overview/3102531.json`) | |
| `STATUS_IN_PROGRESS`, `STATUS_HALFTIME`, `STATUS_END_PERIOD` | not observed (no live game at recording time) | |
| `STATUS_POSTPONED`, `STATUS_CANCELED` | not observed | |

### Q3 Rosters
`teams/{id}/roster` has `athletes[].birthPlace` for all 21 of 21 GS players (`espn-nba/roster/9.json`), so no per-athlete call is needed for birth country. Countries: `"USA"` 15, `"Latvia"`, `"Nigeria"`, `"Dominican Republic"`, `"Netherlands"`, `"Brazil"`, `"Australia"` 1 each. Injured players are listed: Porziņģis `status.name` `"Active"`, `injuries` `[{"status":"Out","date":"2026-10-15T16:17Z"}]` (also Butler, Moody `"Out"`; Green, Horford `"Day-To-Day"`). All 21 have `status.name` `"Active"`; G League assignment: not observed (no field distinguishes it). Roster `season` = `{"year":2027,"displayName":"2026-27","type":1,"name":"Preseason"}`: current roster only.

### Q4 Period scores
`competitors[].linescores[]`: scoreboard `events[].competitions[0].competitors[].linescores[].value` (number), summary `header.competitions[0].competitors[].linescores[].displayValue` (string). One entry per quarter, OT adds entries: `401810899` DAL `["31","42","25","28","5"]`, GS `["34","29","35","28","11"]` (`espn-nba/summary/401810899.json`).

### Q5 Bulk season stats
Bulk exists: `statistics/byathlete?season=2026&seasontype=2&limit=50&page=N` (`espn-nba/byathlete/2026.json`). `pagination` `{"count":578,"limit":50,"page":1,"pages":12,...}` → 12 requests per season at 50/page. `limit=1000` works (2026-10-26: all 334 rows in one 4.3 MB response), but we keep 50 so the fixture stays small. During the season the order shifts between page requests (likely ties on the sort stat, or stats updating mid-paging), so one pass can repeat one athlete and miss another (2026-10-26: 314 of 334); `fetchSeasonStats` pages again, up to 3 passes, keeping every row seen. `categories[]` `general`/`offensive`/`defensive`, each with `names` and per-athlete `athletes[].categories[].totals` (strings) / `values` (numbers), e.g. Dončić `"3945274"` offensive `avgPoints` 33.484375, `points` 2143. Labels repeat (`MIN`, `PTS` appear twice: average and total) — map by `names`, not `labels`. Gives both averages and totals.
Per athlete: `overview` `statistics.labels` `["GP","MIN","FG%","3P%","FT%","REB","AST","BLK","STL","PF","TO","PTS"]`, `splits[]` `"Regular Season"` `["32","24.0","44.6","33.8","84.2","5.2","2.5","1.2","0.6","2.9","1.3","16.7"]` and `"Career"` (`espn-nba/overview/3102531.json`) — per-game averages only.

**Request budget (S05):** the season-stats job fetches page 1, then pages 2…`pagination.pages`, for each started season type of the current season. That is ~12 pages per season type at `limit=50`, capped at 20 (`BYATHLETE_MAX_PAGES`: more pages throws before page 2), and at most 3 season types: ≤ 60 requests a pass. A pass that falls short of `pagination.count` pages again, up to 3 passes (S10b): ≤ 180 requests a day worst case, ~12–25 normally. Rows are keyed by player across pages and passes; fewer unique rows than `pagination.count` after 3 passes throws (truncated). `seasontype=1` (preseason) is unverified until the S05 live run.

### Q6 DNP
`boxscore.players[].statistics[0].athletes[]`: `didNotPlay` `true`, `stats` `[]`, `active` false, `reason` e.g. `"NOT WITH TEAM"`, `"RIGHT FOOT"`, `"RIGHT WRIST SPRAIN"`, `"COACH'S DECISION"` (`espn-nba/summary/401810839.json`, 4 DNP rows). **`reason` is also `"COACH'S DECISION"` on every player who played** (22/22 in `401810839`, 21/21 in `401810899`, 29/29 in `401898399`) — read it only when `didNotPlay` is true.
A player can also be **absent** from the box score: Porziņģis is not in `boxscore.players` of preseason `espn-nba/summary/401898399.json` (no DNP row). Summary `injuries[]` is the injury list at fetch time, not at game time: all three summaries list Porziņģis `"Out"` dated `"2026-10-15T16:17Z"` (`returnDate` `"2026-11-09"`), including `401810839` where he scored 30. So `injuries[]` can't explain an absence after the fact; absent is not a DNP row.

### Q7 Formats
| Field | Format | Example |
|---|---|---|
| `MIN` | whole minutes, string | `"26"` |
| `FG`, `3PT`, `FT` | `"made-attempted"` | `"8-13"` |
| `+/-` | signed string | `"+7"` |
| other stats | integer strings | `"30"` |
| `score` | string | `"137"` |
| `dateOfBirth` | ISO with a time (`"1995-08-02T07:00Z"`); take the date part | `espn-nba/athlete/3102531.json` |

### Q8 Response sizes
| Fixture | Upstream bytes | On disk |
|---|---:|---:|
| `espn-nba/byathlete/2026.json` | 665097 | 1308185 |
| `espn-nba/summary/401898399.json` | 438999 | 755295 |
| `espn-nba/summary/401810899.json` | 432654 | 748693 |
| `espn-nba/summary/401810839.json` | 396535 | 687281 |
| `espn-nba/overview/3102531.json` | 192541 | 353718 |
| `espn-nba/scoreboard/2026-03-23.json` | 140527 | 337137 |
| `espn-nba/scoreboard/2026-03-16.json` | 114861 | 274261 |
| `espn-nba/scoreboard/2026-10-10.json` | 114251 | 263940 |
| `espn-nba/roster/9.json` | 104800 | 180356 |
| `espn-nba/scoreboard/2026-03-14.json` | 100204 | 238460 |
| `espn-nba/scoreboard/2026-03-24.json` | 59453 | 139847 |
| `espn-nba/athlete/3136195.json` | 5994 | 7932 |
| `espn-nba/athlete/3059318.json` | 5887 | 7819 |
| `espn-nba/scoreboard/2026-04-13.json` | 5489 | 8082 |
| `espn-nba/athlete/3102531.json` | 4945 | 6651 |

No upstream body is over 1 MB; only `byathlete` is over 1 MB on disk (pretty-printed). NHL sizes are in `nhl.md` (max 430505). Largest parts: summary `plays` ~248 KB of `401810839`; byathlete `athletes[].athlete.{teams,teamLogos,links}` ~577 KB of 665 KB.

**Pruning rule (proposal, nothing pruned):** a fixture whose pretty-printed file is near or over 1 MB may be pruned only by the recorder (`pnpm fixtures:record`, a per-endpoint list of JSON paths to drop), never by hand, and only of paths no adapter reads; the dropped paths are written to the `.meta.json`. Candidates: byathlete `athletes[].athlete.{teams,teamLogos,links}`; summary `plays`, `winprobability`, `news` if summaries grow.

## Nationality

| Field | Where | Notes |
|---|---|---|
| `birthPlace.country` | roster, athlete | country **name**; US-born players `"USA"`; present 21/21 on the GS roster |
| `citizenship` | roster, athlete | string, often absent (Porziņģis: no key; roster: only Butler `"USA"`, Toohey `"Australia"`) |

No `citizenshipCountry`, flag or alpha-3 field.

| Player | ID | `birthPlace.country` | `citizenship` | Represents (not from fixtures; owner to confirm) |
|---|---|---|---|---|
| Kristaps Porziņģis | `3102531` | `"Latvia"` | absent | LVA |
| Joel Embiid | `3059318` | `"Cameroon"` | `"Cameroon"` | USA (2024 Olympics) |
| Karl-Anthony Towns | `3136195` | `"USA"` (Edison, NJ) | `"Dominican Republic"` | DOM |

`citizenship` matches Towns but not Embiid (citizenship ≠ sporting nationality), and is missing for most players, so it can't be the default; both still need overrides.

**Proposal for S02a (not adopted)** — VISION §7 / CLAUDE.md rule 6: see `nhl.md` (override, else source nationality field, else birth country). For ESPN there is no source nationality field: default stays `birthPlace.country` mapped to alpha-3, with overrides for Embiid and Towns. `citizenship` may be a *hint* for a future override-suggestion job, never a value.

## Quirks
- Team abbreviations are ESPN's, not NBA.com's: `"GS"`, `"SA"`, `"NY"`, `"NO"`, `"UTAH"`, `"WSH"`.
- IDs and scores are strings; stats are strings, `+/-` signed.
- Names come without diacritics (`"Kristaps Porzingis"`, birth city `"Liepaja"`).
- Roster positions are coarse (`C`/`F`/`G`).
- Box-score rows that broke the mapper (S10b, from last season's backfill and the first live nights; 52 of 1,316 games in 2025-26):
  - A DNP row whose `athlete` has only `shortName` and `links` (no `id`, `displayName`, `position`): 33 games, e.g. `"Olbrich"` in `espn-nba/summary/401810126.json`. Skipped: no ID to tie a line to.
  - A played row (`didNotPlay` false) with `MIN` `"--"` and every count `0`: 15 games, e.g. Pacome Dadiet in `espn-nba/summary/401909095.json`. Read as 0 minutes.
  - Live, for up to ~50 minutes after the final (2026-10-26): `MIN` `"-"` on a player who later shows `"0"` with every count `0` and `+/-` `"-2"` or `"0"` (Jaden Akins 4683730 in 401909863, Leaky Black 4395650 in 401909867). Read as 0 minutes when every count is 0; `+/-` may move.
  - `position` `{"id":"0","abbreviation":"NA","displayName":"Not Available"}`, on the box score and the athlete endpoint alike (Michael Ajayi, `espn-nba/summary/401909843.json`, `espn-nba/athlete/5176517.json`). Stored as position and position group null.
  - `summary` answering 404 for a scheduled game: 4 games in 2025-26 (e.g. 401869402), not handled; the game alerts in `/health/data` for up to 48 h.
- Team rosters are *current* rosters only: finding a date's players by roster (`birthPlace.country === "Latvia"`) can miss players traded since. A live S01 run on 2026-03-16 gave Kristaps Porzingis (GS) MIN 26 PTS 30 REB 5 AST 4 FG 8-13 3PT 1-5 FT 13-14, matching `espn-nba/summary/401810839.json`.

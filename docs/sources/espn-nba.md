# NBA — ESPN (site.api / core.api / site.web.api)

Unofficial, keyless. Verified live on 2026-10-03 (S01) through the polite client. Community reference: https://github.com/pseudo-r/Public-ESPN-API.

Every example value below is quoted from a fixture in `apps/server/test/fixtures/espn-nba/` (path given as `<endpoint>/<id>`).

## Endpoints used

| Fixture endpoint | URL | Used for |
|---|---|---|
| `scoreboard` | `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=YYYYMMDD` | One game day: events, status, scores |
| `summary` | `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event={eventId}` | Box score, line score, header |
| `roster` | `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/{teamId}/roster` | Players with birthplace and injuries |
| `athlete` | `https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/athletes/{id}` | Bio, birthplace, citizenship |
| `overview` | `https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/{id}/overview` | One athlete's per-game averages |
| `stats-byathlete` | `https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/statistics/byathlete?season=2026&seasontype=2&limit=50&page=1&…` | **Bulk** season stats, all athletes |
| (spike only) teams | `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams` | The 30 team IDs |

`dates=YYYYMMDD` works as VISION assumed (`scoreboard/2026-03-10`: 11 events, all on that US date).

## Field paths for what VISION needs

| Need | Path | Example |
|---|---|---|
| Event ID | `scoreboard.events[].id` | `"401810798"` |
| Start (UTC) | `events[].date` | `"2026-03-11T02:00Z"` |
| Season | `events[].season.{year,type}`; `summary.header.season` | `{year: 2026, type: 2}` → `"2025-26"` REG; type 1 = PRE (`summary/401812697`) |
| Status | `events[].status.type.{name,state,shortDetail}`, `status.period` | `"STATUS_FINAL"`, `"post"`, `"Final/OT"`, `5` |
| Teams and score | `summary.header.competitions[0].competitors[].{homeAway, team.abbreviation, team.id, score, winner}` | `"home"`, `"GS"`, `"124"` (string) |
| Period scores | `….competitors[].linescores[].displayValue` | GS `["30","21","32","35","6"]` |
| Stat line | `summary.boxscore.players[].statistics[0].{labels, names}` + `athletes[].stats[]` | labels `["MIN","PTS","FG","3PT","FT","REB","AST","TO","STL","BLK","OREB","DREB","PF","+/-"]` |
| Starter / DNP | `athletes[].{starter, didNotPlay, reason}` | see Q6 |
| Athlete ID / name | `athletes[].athlete.{id, displayName}`; athlete `.firstName`, `.lastName` | `"3102531"`, `"Kristaps Porzingis"` |
| Position | athlete `.position.abbreviation`; box score `athlete.position.abbreviation` | `"C"` |
| Birth country | roster `athletes[].birthPlace.country`; athlete `.birthPlace.country` | `"Latvia"`, `"Cameroon"`, `"USA"` (a name, not a code) |
| Birth city / date | `.birthPlace.city`, `.dateOfBirth` | `"Liepaja"`, `"1995-08-02T07:00Z"` |
| Jersey | athlete `.jersey` | `"7"` |
| Current team | athlete `.team.$ref` (core API link) | `…/seasons/2027/teams/9…` (GSW) |
| Season averages | `overview.statistics.{names, splits[].{displayName, stats}}`; or bulk, see Q5 | `"Regular Season"`: `avgPoints` `"16.7"`, `gamesPlayed` `"32"` |

## The eight questions (VISION §9)

**1. Game day convention: the US calendar date, same as the NHL.**
`scoreboard/2026-03-10` (requested as `dates=20260310`) lists CHI @ GS, `id` `401810798`, `"date":"2026-03-11T02:00Z"` (7 pm Pacific), and LAL–MIN at `"2026-03-11T03:00Z"`. Late West Coast games stay on the US date even though they start on the next UTC day. The NHL does the same (`nhl.md` Q1).

**2. Status names observed.**
`status.type.name` across all 4 scoreboards: `STATUS_FINAL` (`state` `"post"`, `shortDetail` `"Final"` or `"Final/OT"`) and `STATUS_SCHEDULED` (`"pre"`, `"10/4 - 7:00 PM EDT"`, `scoreboard/2026-10-04`). Not observed yet: `STATUS_IN_PROGRESS`, `STATUS_HALFTIME`, `STATUS_END_PERIOD`, `STATUS_POSTPONED`, `STATUS_CANCELED`. S04a should record a live day. Overtime isn't a separate status: read `status.period` > 4 or the `"Final/OT"` detail.

**3. Rosters carry birthplace and injuries. Past seasons: no. G League: unknown.**
`roster/9` (GSW, 21 athletes in preseason) has `birthPlace.{city, state?, country}` on every athlete. Countries seen: `Australia, Brazil, Dominican Republic, Latvia, Netherlands, Nigeria, USA`. So **no per-athlete call is needed** for nationality. Injured players are listed with `injuries[].status`: Jimmy Butler III `"Out"`, Porziņģis `"Day-To-Day"`. Every athlete has `status.name` `"Active"`. Nothing marks two-way / G League assignees, so one snapshot can't show whether they're listed.
`?season=2025` on a roster (BOS, live probe) returns `"athletes": []`: **ESPN has no past-season rosters**, so a player's team on a past date comes only from box scores.

**4. Period scores: `summary.header.competitions[0].competitors[].linescores[]`.**
`summary/401810798`: GS `["30","21","32","35","6"]` (`displayValue`, strings), CHI `["26","31","32","29","12"]`. The fifth entry is OT. The scoreboard's `competitors[].linescores[]` has the same values.

**5. Bulk season stats: yes — `statistics/byathlete`.**
`stats-byathlete/2026-2`: `pagination.count` 582 athletes, `limit` 50, `pages` 12. `requestedSeason.displayName` is `"2025-26"`. Each athlete has `categories[].totals[]` aligned with the top-level `categories[].names[]`: `general` (`gamesPlayed`, `avgMinutes`, …), `offensive` (`avgPoints`, `avgFieldGoalsMade`, `fieldGoalPct`, … plus season totals `points`, `fieldGoalsMade`, …), `defensive` (`avgSteals`, `avgBlocks`, `steals`, `blocks`). **The labels repeat** (`MIN`, `REB`, `PTS` each appear twice, once as an average and once as a total), so map by `names`, not labels.
Budget: 12 requests per season type per day for the whole league (≈ 4.4 MB), against one `overview` call per athlete (≈ 500 rostered athletes, ~170 KB each). Recommendation for S05: use `byathlete`, stored per VISION as given (it has both per-game averages and totals). Whether a larger `limit` is accepted wasn't tested.
`overview/3102531` remains useful for a single player: `statistics.splits` `"Regular Season"` (`gamesPlayed` `"32"`, `avgPoints` `"16.7"`) and `"Career"`. In the 2026-27 preseason, its "Regular Season" still means 2025-26.

**6. DNP: `didNotPlay: true`, a free-text `reason`, and an empty `stats` array.**
`summary/401810643` (SA @ GS, 2026-02-11): Porziņģis `{"didNotPlay":true,"reason":"LEFT ACHILLES TENDON","stats":[],"starter":false,"active":false}`. Coach's decisions: `"COACH'S DECISION"` (Olynyk, Biyombo). Preseason adds `"DID NOT DRESS"` (TOR, `summary/401812697`). Watch out for:
- **`reason` is also set on players who played.** In `summary/401810798`, Porziņģis has `didNotPlay: false`, `reason: "COACH'S DECISION"` and a full `stats` array. Only `didNotPlay` (or an empty `stats`) means DNP.
- **`active` is `false` for players who played** (same example). Don't use it.
- **Long-term injured players aren't in the box score at all.** GS on 2026-02-11 lists 11 athletes; Butler (out since January) is missing. They appear only in the top-level `summary.injuries[]`, and that list shows the injury status **at fetch time, not game time** (Moody is listed `"Out"` but played that night).

**7. Formats (ESPN side).**
`MIN` is a whole-minute string (`"20"`; basketball-reference shows 20:13). Shooting splits are `"made-attempted"` strings (`"5-13"`, `"2-6"`, `"5-5"`). `+/-` is signed (`"+4"`). Every stat is a string, and so are the scores (`"124"`). See `nhl.md` Q7 for the NHL fields.

**8. Response sizes: all under 1 MB, no pruning now.**

| Endpoint | Raw bytes (meta) | On disk (pretty-printed) |
|---|---|---|
| `summary` | 398 319 – 432 141 | up to 744 419 |
| `stats-byathlete` (one page) | 366 180 | 699 088 |
| `scoreboard` | 15 257 – 192 705 | |
| `overview` | 171 599 | |
| `roster` | 104 843 | |
| `athlete` | 4 945 – 5 994 | |

Where a summary's bytes go (`summary/401810798`, JSON length per top-level key): `plays` 282 860, `winprobability` 39 608, `boxscore` 24 255, `news` 15 821, `header` 13 929, `standings` 13 404, `leaders` 11 965, `article` 7 199.
**Pruning proposal (not applied):** if fixtures grow past ~1 MB, record summaries without `plays`, `winprobability`, `news`, `article`, `videos`, `odds`, `pickcenter`, `againstTheSpread`, `standings`. The adapters only need `header` and `boxscore`, and those two keys are under 10 % of a summary (≈ 38 KB of 432 KB). It would need a recorder option (e.g. `--drop-keys`) so the pruning is still done by the tool, not by hand.

## Nationality notes
- `athlete.birthPlace.country` names seen: `"Latvia"`, `"Cameroon"`, `"USA"` (US-born players show `"USA"` plus a `state`).
- The core athlete has a **`citizenship`** field: Towns `"Dominican Republic"`, Embiid `"Cameroon"`, Porziņģis `null`. It isn't sporting nationality (Embiid represents the USA), so it doesn't replace overrides. It could flag players whose birth country and citizenship differ, as override candidates for human review.

## Quirks
- Names have no diacritics: `"Kristaps Porzingis"`, `"Liepaja"`.
- ESPN labels a season by its end year: `season.year` `2026` = 2025-26; the current roster says `{"year":2027,"displayName":"2026-27","type":1,"name":"Preseason"}`.
- Team abbreviations differ from common usage: `"GS"`, `"SA"`, `"NY"`, `"NO"`, `"UTAH"`.
- The scoreboard's `competitors[]` order isn't away-then-home. Always read `homeAway`.

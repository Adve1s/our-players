# Our Players — Vision & v1 Spec

Status: v1 spec · Last updated: 2026-10-03

This is the source of truth for **what** we build and **why**. How it gets built, session by session, is in `docs/SESSIONS.md`; decisions and their rationale are in `docs/DECISIONS.md`. If code and this document disagree, raise it — don't silently pick one.

---

## 1. Problem and motivation

Fans who follow their country's athletes abroad need several league apps, each organized around teams. Our Players is organized around **people and nationality**: one place to see how "our guys" did, across leagues.

Origin: a Latvian fan who wants to see, every morning, how Latvians did in the NHL and NBA.

## 2. Users and the core moment

- **Primary user:** a fan in Europe following players from one or a few countries in North American leagues.
- **The morning recap.** NHL and NBA games start roughly 19:00–22:30 US Eastern, which is about 02:00–05:30 in Riga; the last games end around 07:30–08:30 Riga time. Over breakfast the user opens the app and immediately sees how every followed player did last night — no tapping, no setup.
- **Secondary moments:** checking a player's season and recent form; checking which games are on tonight.

v1 is successful when:
- Opening the app in the morning shows last night's games with followed players' stat lines, in under 2 s on a mid-range Android phone with a warm cache.
- A game's lines are available within ~15 minutes of it going final.
- The default experience (Latvia; NHL + NBA) needs zero setup.

## 3. Core concept: the selection rule

Notation: **L** = selected leagues, **C** = followed countries, **F** = favorited players, **H** = hidden players, **nat(p)** = the sporting nationality of player *p*, or none if unknown (§7).

```
shown(p)  ⇔  league(p) ∈ L  ∧  p ∉ H  ∧  ( p ∈ F  ∨  nat(p) ∈ C )
```

In words: (players from followed countries ∪ favorited players) − hidden players, filtered by selected leagues.

Behavior details — each one is a test case:
1. **Hidden beats favorite.** The UI keeps F and H disjoint (favoriting a hidden player unhides him and vice versa), but the rule still applies H last.
2. **The league filter applies to favorites too.** A favorited NBA player is not shown when NBA is deselected.
3. **Unknown nationality:** shown only if favorited.
4. **Nothing followed** (C = ∅ and F = ∅): nothing is shown; the Main page explains how to follow countries or players.
5. **Unknown IDs** in F or H (a player removed upstream) are ignored.
6. **Overrides decide nationality:** a player with an override counts for the override's country, never for his birth country (§7). Embiid (born in Cameroon) appears for USA, not CMR.

The rule is implemented once, as a pure function in `packages/shared/src/selection.ts`. Every filtered endpoint uses it.

## 4. v1 screens

### 4.1 Main — the game day
- **Header:** game-day stepper `◀  Fri, Oct 10  ▶` plus a "Latest" shortcut. An optional calendar picker is fine if it works on both Android and web.
- **Default game day:** the latest US game day on which at least one game in the selected leagues has started (provided by the server). In the Riga morning this is last night's games.
- **Order:** games that include shown players come first (by start time); all other games sit in a collapsed "Other games (n)" section.
- **Game card:** away @ home team abbreviations and score; status:
  - scheduled → start time in the device's local time
  - live → "Live" (no live updates in v1; data refreshes on pull)
  - final → "Final", "Final/OT", "Final/SO"
  - postponed / cancelled → label
- **Stat cards** under each game, one per shown player who appeared in it, ordered by team (away first); within a team, skaters and basketball players by points (descending), then goalies:

| Kind | Card content | Example |
|---|---|---|
| Hockey skater | G · A · +/- · SOG · TOI | `1 G · 1 A · +2 · 4 SOG · 18:32` |
| Hockey goalie | SV/SA · SV% · GA · decision | `28/30 · .933 · 2 GA · W` |
| Basketball | PTS · REB · AST · MIN, then shooting | `22 PTS · 8 REB · 3 AST · 31 MIN` / `FG 8-15 · 3PT 3-7 · FT 3-3` |

- **Did-not-play rows:** if the box score lists a shown player as not playing, show "DNP — reason" (or "DNP" when the source gives no reason). That covers NBA DNPs and NHL players who dressed but got no ice time, such as a backup goalie with `toi` `"00:00"` (D-024). If a shown player's *current* team played a final game that day and he has no line, show "Not in lineup". A player on no current roster (sent to the AHL or G League, released, retired) has no current team, so he gets no such row. (This uses the current team, so it can be wrong for older dates after a trade — acceptable in v1.)
- **States:** loading skeleton; empty ("No games on this day", or "None of your players played on Fri, Oct 10" with a jump to the previous game day); error with retry; offline shows the last cached data with a banner.
- **Pull to refresh.** Tapping a game opens the Game page; tapping a player opens the Player page (both slice 5).

### 4.2 Settings
- **Leagues:** NHL and NBA toggles, both on by default; at least one must stay on.
- **Countries:** searchable list of countries that have players in our database, with player counts; multi-select; Latvia preselected on first launch.
- **Favorites** and **Hidden** lists with remove/undo (slice 5).
- **About:** data source credits, "Not affiliated with the NHL or NBA", app version, privacy policy link.
- Preferences live on the device as one object with `version: 1`, so later migrations (e.g., to accounts) are mechanical.

### 4.3 Player search, favorites, hidden (slice 5)
- Search by name across leagues, case- and diacritic-insensitive: "porzingis" finds Porziņģis, "merzlikins" finds Merzļikins.
- Result row: name, team, league, nationality codes, position; actions ★ favorite and hide.

### 4.4 Player page (slice 5)
- **Bio:** name, team, league, position, jersey number, age, birthplace, nationality (marked "override" when it differs from the birth country).
- **Season stats** (current season; regular season, plus playoffs when present):
  - hockey skater: GP, G, A, PTS, +/-, SOG, TOI/GP
  - hockey goalie: GP, W, L, OTL, GAA, SV%, SO
  - basketball (per game): GP, MIN, PTS, REB, AST, FG%, 3P%, FT%
- **Recent game log:** last 10 stored games, same line format as the cards.
- Favorite / hide actions.

### 4.5 Game page (slice 5)
- Score, status, local start time, and a period table (hockey: 1, 2, 3, OT, SO; basketball: Q1–Q4, OT).
- Shown players' lines (and did-not-play rows). The full box score comes later.

### 4.6 UI principles
- English UI in v1; dark and light themes follow the system.
- **Text-only branding:** no league or team logos and no player photos in v1 (IP risk on the Play Store, §11). Team colors are fine.
- Flag emoji don't render on Windows browsers — always show the country code next to a flag.
- Everything must work on Android phones and on the web (iPhone home-screen web app and desktop browsers). No native-only API without a web fallback.

## 5. Not in v1 — and how the design leaves room

| Later feature | What v1 already does so it fits |
|---|---|
| Live updates | `games.status` has `LIVE`; ingestion is per game, so a live-polling job is additive; responses carry `updatedAt` for ETag/polling later |
| Team follow / team pages | `teams` is a first-class table; preferences can gain a `teams` list; the selection rule stays the single place to extend |
| More leagues and countries | `leagues` table, one adapter per source, stat lines typed by `kind` per sport |
| Push notifications | Would need server-side preferences per device; preferences are already a versioned object that can be uploaded later |
| Accounts with sync | Preferences are a versioned object keyed by stable public IDs, ready to move into `users` / `user_prefs` tables |
| Dedicated PC web experience | Same API; only layouts change |

## 6. Architecture

```
            ┌───────────── scheduled jobs (inside the server process) ─────────────┐
NHL API ───▶│  nhl adapter ─────┐                                                   │
            │                   ├──▶ normalized model ──▶ ingestion (upserts) ──▶ PostgreSQL
ESPN API ──▶│  espn-nba adapter ┘                                                   │       │
            └───────────────────────────────────────────────────────────────────────┘       │
                                                                                            ▼
Android app / web app ──── HTTPS GET /v1/... (preferences in the query) ────▶ read API ──── reads
```

- **Fetch on a schedule, by game — never by user.** About 15 games a night per league; fetch everything. Users never cause upstream calls.
- **Own database** is the only thing the API reads, so upstream outages don't break the app; it serves the last stored data.
- **One adapter per source** maps upstream JSON into the normalized model in `packages/shared`. Both sources are unofficial; when one changes, only its adapter changes.
- **User-agnostic backend.** No accounts in v1. The app sends its preferences (leagues, country codes, favorite/hidden player IDs) as query parameters; the server filters with the selection rule and returns results. Nothing about the user is stored.

### 6.1 Jobs

| Job | When (UTC) | What it does |
|---|---|---|
| `schedule` | daily 09:00, and at startup if no future games are stored | Upcoming games for the next 7 days, per league |
| `results` | every 10 min | Only does work if some game has started and isn't final yet: fetch that game day's scoreboard; for each game that became final, fetch its box score once and store every player's stat line. Corrections: re-fetch each final box score once, at least 6 h after it went final |
| `roster` | daily 10:00 | All teams' rosters: players, teams, positions, birth countries; recompute nationalities with the overrides (§7). A player missing from every roster of his league gets no current team and `active = false`, but only when all of that league's rosters were fetched successfully; otherwise no `active` flag changes and the run records the partial failure. He becomes active again when he reappears |
| `season-stats` | daily 11:00 | Official season stats for rostered players (bulk endpoints where they exist) |
| `backfill` | manual (CLI) | Schedule + results for a date range — dev data, and the season-to-date at launch |

09:00 UTC is 05:00 US Eastern and noon in Riga — after every game of the night is final.

Rules: jobs are idempotent; overlapping runs of the same job are prevented; every run writes a `job_runs` row (status, counts, error). A box score may contain a player we haven't seen (call-up between roster syncs): store a stub player and enrich him immediately — never drop a stat line.

Request budget (rough): ~100 scoreboard polls, ~60 box scores, ~65 roster calls, ~10 NHL stats pages and a few hundred NBA athlete-stats calls a day — 15 minutes or so of upstream traffic at 1 request/s, spread over the day.

### 6.2 Time and dates
- Timestamps are stored in UTC.
- **Game day** (`gameDate`) is the league's schedule date — the US calendar date the game is played on. Both sources list games by this date; S01 verifies they agree (check a late West Coast game).
- The app shows start times in the device's local time and labels dates as game days.

## 7. Nationality

In this app, **nationality means sporting nationality: the national team a player represents** — or, for a player who hasn't represented one yet, the team he would be expected to represent. It is not citizenship: a player can hold several passports but represents one national team.

- **One value per player:** an ISO 3166-1 alpha-3 code, or unknown (`null`), stored with its source: `birth` or `override`.
- **Default: birth country.** v1 uses no source nationality field (the NHL stats API's `nationalityCode` and ESPN's `citizenship` exist; D-025), and for most players the birth country is right. The NHL gives an alpha-3 code directly. ESPN gives a country name ("Cameroon"; US-born players show "USA"), mapped to alpha-3 with an alias table (ESPN spellings; England, Scotland, Wales → GBR). An unknown name maps to `null` with a warning — never a guess.
- **Overrides** correct the default for players who represent a country other than their birth country. They live in `apps/server/data/nationality-overrides.json`, keyed by public player ID and reviewed in git; the roster job applies them, and an override replaces the birth-country default. Each entry also records the player's name, so the job can warn when an override's player isn't in the database (not in the league yet, or a typo) or the stored name doesn't match.

Initial overrides:

| Player | Public ID | Born | Represents |
|---|---|---|---|
| Joel Embiid | `nba-3059318` | Yaoundé, Cameroon (CMR) | USA |
| Karl-Anthony Towns | `nba-3136195` | Edison, NJ, USA | Dominican Republic (DOM) |

```json
{
  "overrides": [
    {
      "player": "nba-3059318",
      "name": "Joel Embiid",
      "nationality": "USA",
      "note": "Born in Yaoundé, Cameroon; represents the USA (2024 Olympics).",
      "addedAt": "2026-10-02"
    }
  ]
}
```

- **Later, not in v1:** Benjamin "Benji" Berrouet (born in the USA, plays for Latvia) gets an override by ID if he reaches the NBA. NHL `seasonTotals` national-team entries (World Championships, Olympics) are a strong signal; a job could *suggest* overrides for human review.

## 8. Data model (conceptual)

Postgres everywhere (PGlite locally and in tests). Drizzle schema in `apps/server/src/db/schema.ts`; migrations are generated, never hand-edited.

| Entity | Key fields | Notes |
|---|---|---|
| `leagues` | `code` (NHL, NBA), `sport` (hockey, basketball), `name` | Seeded |
| `teams` | `id`, `league`, `source`, `external_id`, `abbrev`, `name` | Unique (`source`, `external_id`) |
| `players` | `id`, `public_id`, `league`, names, `search_name`, `position`, `position_group`, `current_team_id`, `jersey`, `birth_date`, `birth_city`, `birth_country`, `nationality`, `nationality_source`, `active`, `updated_at` | `public_id` = `<league>-<source id>`; `search_name` = lowercase, diacritics removed; `nationality` (alpha-3 or null) and `nationality_source` (`birth`/`override`) per §7, recomputed by the roster job |
| `player_external_ids` | `player_id`, `source`, `external_id` | Lets a later backup source map onto the same player |
| `games` | `id`, `public_id`, `league`, `season` ("2026-27"), `season_type` (PRE/REG/POST), `game_date`, `start_time_utc`, `status`, `home_team_id`, `away_team_id`, scores, `period_scores` (jsonb), `ended_in` (REG/OT/SO), `final_at`, `boxscore_fetched_at`, `corrected_at`, `source`, `external_id` | `status` ∈ SCHEDULED, LIVE, FINAL, POSTPONED, CANCELLED |
| `stat_lines` | `game_id`, `player_id`, `team_id`, `kind`, `played`, `dnp_reason`, `starter`, `stats` (jsonb), `updated_at` | PK (`game_id`, `player_id`); `kind` ∈ `hockey_skater`, `hockey_goalie`, `basketball_player`; `stats` validated by a zod schema per kind |
| `season_stats` | `player_id`, `season`, `season_type`, `kind`, `basis` (`totals`/`per_game`), `stats` (jsonb), `fetched_at` | NHL gives totals; ESPN's bulk `statistics/byathlete` gives per-game averages and totals (`docs/sources/espn-nba.md` Q5) — stored as given |
| `job_runs` | `id`, `job`, `args`, `started_at`, `finished_at`, `status`, `counts`, `error` | Observability |

**Stat payloads** (zod schemas in `packages/shared`):
- `hockey_skater`: goals, assists, points, plusMinus, shots, toiSeconds (+ optional pim, hits, blocks, powerPlayGoals)
- `hockey_goalie`: saves, shotsAgainst, goalsAgainst, savePct (0–1), toiSeconds, decision (W/L/OTL or null)
- `basketball_player`: minutes, points, rebounds, assists, fgMade, fgAttempted, threeMade, threeAttempted, ftMade, ftAttempted, turnovers, steals, blocks, offRebounds, defRebounds, fouls, plusMinus

Why common columns plus typed JSON: new sports and positions add a `kind` and a schema instead of a migration of wide nullable tables; queries v1 needs (by game, by player) stay on indexed columns.

**Status mapping** (initial — S01 verifies against real data):
- NHL `gameState`: FUT, PRE → SCHEDULED; LIVE, CRIT → LIVE; FINAL, OFF → FINAL (OFF = official); postponed/cancelled from the schedule state.
- ESPN `status.type.name`: STATUS_SCHEDULED → SCHEDULED; STATUS_IN_PROGRESS, STATUS_HALFTIME, STATUS_END_PERIOD → LIVE; STATUS_FINAL → FINAL; STATUS_POSTPONED → POSTPONED; STATUS_CANCELED → CANCELLED.

## 9. Data sources (tested live 2026-10-02)

S01 verified the endpoints, field paths and quirks in `docs/sources/nhl.md` and `docs/sources/espn-nba.md`; where they differ from this section, they win.

**NHL — official but undocumented, keyless.** Base `https://api-web.nhle.com/v1`.
- Player `/player/{id}/landing`: `birthCountry` (alpha-3), position, current team, `featuredStats`, `last5Games`, `seasonTotals` (career, including national-team entries).
- Games: `/score/{date}`, `/schedule/{date}`, `/gamecenter/{gameId}/boxscore`; period scores from `/gamecenter/{gameId}/right-rail`.
- Rosters: `/roster/{teamAbbrev}/current`.
- Bulk season stats: `https://api.nhle.com/stats/rest/en/skater/summary?cayenneExp=seasonId=20262027` (paginated; goalie equivalent).
- Community docs: https://github.com/Zmalski/NHL-API-Reference

**NBA — ESPN, unofficial, keyless.**
- Scoreboard: `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=YYYYMMDD`.
- Summary + box score: `.../nba/summary?event={eventId}`; `boxscore.players[].statistics[]` has `labels` [MIN, PTS, FG, 3PT, FT, REB, AST, TO, STL, BLK, OREB, DREB, PF, +/-], per-athlete `stats` arrays, `didNotPlay` and `starter` flags. Map by **label**, never by position in the array.
- Athlete: `https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/athletes/{id}` (`birthPlace.country` is a name).
- Season stats: bulk `https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/statistics/byathlete` (per-game averages and totals, ~12 pages a season); per athlete `.../athletes/{id}/overview` (splits "Regular Season" and "Career", per-game averages).
- Example: Kristaps Porziņģis = 3102531. Community docs: https://github.com/pseudo-r/Public-ESPN-API
- ESPN also covers the NHL (`/sports/hockey/nhl/...`) — a possible backup source later.

**Rejected:** NBA.com (blocks datacenter requests); BallDontLie (key required, stats paywalled).

**Questions S01 must answer** (recorded in `docs/sources/*.md`):
1. Do NHL `/score/{date}` and ESPN `dates=` use the same game-day convention? (Check a late West Coast game.)
2. Which game states and status names actually occur?
3. Do the roster endpoints include birth country (NHL roster; ESPN team roster), or is a per-player call needed? Do they list injured players, and players assigned to the AHL or G League?
4. Where do period scores live (NHL boxscore vs other gamecenter endpoints; ESPN linescores)?
5. Is there a bulk NBA season-stats endpoint, or is it one overview call per athlete?
6. How does ESPN represent DNP and its reason?
7. Field names and formats: NHL TOI ("MM:SS"), shots, goalie save percentage, decision.
8. Response sizes (do fixtures need pruning of unused top-level keys?).

**Etiquette:** at most ~1 request/s per host, an honest User-Agent naming the project and a contact URL, retries with exponential backoff and jitter (respect `Retry-After`), timeouts, no parallel bursts. Raw responses are recorded as fixtures for adapter tests. Unofficial APIs may block cloud IPs: re-test from the real host before choosing hosting (S10).

## 10. Read API (v1 contract sketch)

All responses are JSON validated by zod schemas in `packages/shared/src/contract/`. Preferences travel as query parameters: `leagues=NHL,NBA&countries=LVA&fav=nhl-8478402&hide=nba-1234` (comma-separated; at most 200 IDs per list; invalid input → 400).

| Endpoint | Returns |
|---|---|
| `GET /v1/meta` | leagues with current season and `latestGameDate`; `dataUpdatedAt` |
| `GET /v1/days/{gameDate}?<prefs>` | that game day's games (ordered per §4.1) with shown players' lines and did-not-play rows; `prevGameDate`, `nextGameDate` |
| `GET /v1/games/{gameId}?<prefs>` | one game with period scores, shown lines, did-not-play rows |
| `GET /v1/players/search?q=&leagues=` | up to 20 player summaries |
| `GET /v1/players?ids=` | player summaries for a list of IDs (favorites and hidden lists) |
| `GET /v1/players/{playerId}` | bio, nationality with its source, season stats, last 10 game lines |
| `GET /v1/countries?leagues=` | countries (by sporting nationality) that have active players, with counts per league |
| `GET /health` | Liveness for the host's health check: 200 when the DB answers, plus the last successful run per job. Never fails because upstream data is stale |
| `GET /health/data` | Freshness for the uptime monitor: 503 when, during the season, results have gone stale |

Errors: `{ "error": { "code": "BAD_REQUEST", "message": "..." } }`. Day and game responses send `Cache-Control: public, max-age=60, stale-while-revalidate=300`. Request logs omit query strings, so preferences are never logged — this covers the host's router and reverse-proxy access logs too, not only ours. CORS allows the web app's origin. A per-IP rate limit protects the small host (429 in the error format).

## 11. Platforms, distribution and policies

- **App identity:** name **Our Players**; Android package ID **`io.github.adve1s.ourplayers`** — the reverse of `adve1s.github.io`, the usual way to get a unique ID without owning a domain. It's set in `app.json` from S00 and becomes permanent once the first build is uploaded to Google Play.
- **One Expo codebase** (Expo Router) for Android and web. No iOS App Store.
- **Android / Google Play:** EAS Build produces an AAB; Play App Signing. The developer account is personal, so before production the app needs a **closed test with at least 12 testers opted in continuously for 14 days**; recruit 15 or more as a buffer, because a dropout can break the streak. Then apply for production access (questions about the test, the app and its readiness). Start the closed test as soon as the main page works against a deployed backend, so the 14 days run while slice 5 is built. Create the Play Console account and recruit testers early (during S08): identity verification can take days, and Google also checks that testers actually used the app.
- **Play listing prep:** privacy policy URL (GitHub Pages works for a public repo); Data safety form answered honestly (preferences are sent to our server to filter results and are neither stored nor logged — by our code or by the host's proxies; no accounts, ads or analytics); content rating questionnaire; store listing text, 512 px icon, 1024×500 feature graphic, phone screenshots.
- **IP:** no league or team logos and no player photos; no "NHL"/"NBA" in the app name or icon (descriptive mentions in the listing only); a "not affiliated" note in the app and listing. Keep the project free and non-commercial, and credit the data sources.
- **Web:** static export of the Expo web build on a static host, with a web manifest and icons so "Add to Home Screen" works on iPhone. The API allows the web origin via CORS. Favorites live per browser until accounts exist.
- **Hosting (decided in S10):** must be always-on (the scheduler can't live on a host that sleeps); confirm both upstream APIs answer from the host before committing to it; Postgres. Every row can be fetched again, so recovery is a rebuild (migrations, `roster`, the season-to-date `backfill`, then `season-stats`), not a backup restore (D-021).

## 12. Quality bar

- **Tests:** the selection rule exhaustively (§3 cases); every adapter mapper against recorded fixtures (each stat kind, each status, DNP, OT/SO); ingestion idempotency; API responses parse with the shared contract schemas; key screens screenshot-checked on web.
- **Performance:** `/v1/days/{date}` under 150 ms p95 server-side with a full season stored.
- **Resilience:** an upstream failure never breaks the app — the API serves stored data and `/health` and `dataUpdatedAt` reveal staleness. During the season, `/health/data` fails when results go stale and an external uptime monitor emails the owner; `/health` stays green, so the host never restarts the API over an upstream outage.
- **Observability:** `job_runs` table, structured JSON logs without user preferences.

## 13. Glossary

| Term | Meaning |
|---|---|
| Game day | The league's schedule date of a game (US calendar day) |
| Stat line | One player's box-score numbers for one game, typed by `kind` |
| Shown player | A player who passes the selection rule for the current preferences |
| Nationality | Sporting nationality: the national team a player represents. The birth country unless an override says otherwise |
| Public ID | Stable, source-derived ID used by the app (`nhl-8478402`) |
| Adapter | Code that fetches one upstream source and maps it to the normalized model |
| Fixture | A recorded raw upstream response used in tests |
| Slice | A build stage that ends with something usable (see SESSIONS.md) |
| Session | One Claude Code working session covering one reviewable piece of a slice |

## 14. Open questions (defaults in parentheses)

1. Show preseason games? (Yes, labeled "Preseason".)
2. Show games without followed players at all? (Yes, collapsed under "Other games".)
3. NBA season stats via one call per athlete or a bulk endpoint? (Decided in S01.)
4. More nationality overrides? (Add as found, by player ID.)

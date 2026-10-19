import {
  type GameLogEntry,
  type League,
  lineSchema,
  type PlayerResponse,
  type PlayerSummary,
  type PlayersResponse,
  type PublicId,
  seasonStatsEntrySchema,
} from '@our-players/shared';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { Db } from '../db/client';
import { currentSeason } from '../db/games';
import { games, players, seasonStats, statLines, teams } from '../db/schema';

const SEARCH_LIMIT = 20;

const summaryFields = {
  publicId: players.publicId,
  league: players.league,
  firstName: players.firstName,
  lastName: players.lastName,
  position: players.position,
  nationality: players.nationality,
  active: players.active,
  teamAbbrev: teams.abbrev,
  teamName: teams.name,
};

// Players with their current team; a free agent has none.
function summaryQuery<F extends typeof summaryFields>(db: Db, fields: F) {
  return db.select(fields).from(players).leftJoin(teams, eq(players.currentTeamId, teams.id));
}

type SummaryRow = Awaited<ReturnType<typeof summaryQuery>>[number];

function toSummary(row: SummaryRow): PlayerSummary {
  return {
    id: row.publicId,
    league: row.league,
    firstName: row.firstName,
    lastName: row.lastName,
    position: row.position,
    team:
      row.teamAbbrev === null || row.teamName === null
        ? null
        : { abbrev: row.teamAbbrev, name: row.teamName },
    nationality: row.nationality,
    active: row.active,
  };
}

// strpos, not LIKE: a % or _ in the term is just a character.
// shortcut: a full scan of players, add a pg_trgm index if search shows in the p95.
export async function searchPlayers(
  db: Db,
  term: string,
  leagues: ReadonlySet<League>,
): Promise<PlayersResponse> {
  const rows = await summaryQuery(db, summaryFields)
    .where(
      and(sql`strpos(${players.searchName}, ${term}) > 0`, inArray(players.league, [...leagues])),
    )
    .orderBy(
      desc(players.active),
      // A word start: the first name, the last name, or a part after a hyphen.
      desc(
        sql`strpos(' ' || translate(${players.searchName}, '-', ' '), ' ' || translate(${term}, '-', ' ')) > 0`,
      ),
      // The database collation may be C (PGlite's is), which sorts Ā and Č after Z.
      asc(sql`${players.lastName} collate "und-x-icu"`),
      asc(sql`${players.firstName} collate "und-x-icu"`),
      asc(players.publicId),
    )
    .limit(SEARCH_LIMIT);
  return { players: rows.map(toSummary) };
}

// Not filtered by league: favorites and hidden lists show every league.
export async function playersByIds(db: Db, ids: readonly PublicId[]): Promise<PlayersResponse> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return { players: [] };
  const rows = await summaryQuery(db, summaryFields).where(inArray(players.publicId, unique));
  const byId = new Map(rows.map((r) => [r.publicId, r]));
  return { players: unique.flatMap((id) => byId.get(id) ?? []).map(toSummary) };
}

const GAME_LOG_LIMIT = 10;
const homeTeam = alias(teams, 'home_team');
const awayTeam = alias(teams, 'away_team');

// null: no player with that ID.
export async function loadPlayer(
  db: Db,
  publicId: PublicId,
  now: Date,
): Promise<PlayerResponse | null> {
  const [row] = await summaryQuery(db, {
    ...summaryFields,
    id: players.id,
    positionGroup: players.positionGroup,
    jersey: players.jersey,
    birthDate: players.birthDate,
    birthCity: players.birthCity,
    birthCountry: players.birthCountry,
    nationalitySource: players.nationalitySource,
  }).where(eq(players.publicId, publicId));
  if (!row) return null;

  // VISION §4.4: the regular season, plus the playoffs when present; the preseason is left out.
  // Owner (PR #14): until the regular season starts, last season's stats.
  const season = await currentSeason(db, row.league, now, { skipPreseason: true });
  const stats =
    season === null
      ? []
      : await db
          .select({
            kind: seasonStats.kind,
            season: seasonStats.season,
            seasonType: seasonStats.seasonType,
            basis: seasonStats.basis,
            stats: seasonStats.stats,
          })
          .from(seasonStats)
          .where(
            and(
              eq(seasonStats.playerId, row.id),
              eq(seasonStats.season, season),
              inArray(seasonStats.seasonType, ['REG', 'POST']),
            ),
          )
          .orderBy(asc(seasonStats.seasonType), asc(seasonStats.kind));

  const log = await db
    .select({
      teamId: statLines.teamId,
      kind: statLines.kind,
      played: statLines.played,
      dnpReason: statLines.dnpReason,
      stats: statLines.stats,
      gameId: games.publicId,
      league: games.league,
      seasonType: games.seasonType,
      gameDate: games.gameDate,
      startTimeUtc: games.startTimeUtc,
      status: games.status,
      endedIn: games.endedIn,
      awayTeamId: games.awayTeamId,
      awayAbbrev: awayTeam.abbrev,
      awayScore: games.awayScore,
      homeAbbrev: homeTeam.abbrev,
      homeScore: games.homeScore,
    })
    .from(statLines)
    .innerJoin(games, eq(games.id, statLines.gameId))
    .innerJoin(homeTeam, eq(homeTeam.id, games.homeTeamId))
    .innerJoin(awayTeam, eq(awayTeam.id, games.awayTeamId))
    .where(eq(statLines.playerId, row.id))
    .orderBy(desc(games.startTimeUtc))
    .limit(GAME_LOG_LIMIT);

  const gameLog = log.map((l): GameLogEntry => {
    const game = {
      id: l.gameId,
      league: l.league,
      seasonType: l.seasonType,
      gameDate: l.gameDate,
      startTimeUtc: l.startTimeUtc.toISOString(),
      status: l.status,
      endedIn: l.endedIn,
      away: { abbrev: l.awayAbbrev, score: l.awayScore },
      home: { abbrev: l.homeAbbrev, score: l.homeScore },
    };
    const side = l.teamId === l.awayTeamId ? 'away' : 'home';
    return l.played
      ? { type: 'line', game, side, line: lineSchema.parse({ kind: l.kind, stats: l.stats }) }
      : { type: 'dnp', game, side, reason: l.dnpReason };
  });

  return {
    ...toSummary(row),
    positionGroup: row.positionGroup,
    jersey: row.jersey,
    birthDate: row.birthDate,
    birthCity: row.birthCity,
    birthCountry: row.birthCountry,
    nationalitySource: row.nationalitySource,
    // A stored row the contract rejects is a drifting mapper: fail loudly (500), not a partial page.
    seasonStats: stats.map((s) => seasonStatsEntrySchema.parse(s)),
    gameLog,
  };
}

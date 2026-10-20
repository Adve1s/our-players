import {
  type CountryCode,
  finalLabel,
  leagueSchema,
  lineText,
  parseStatPayload,
  upcomingText,
} from '@our-players/shared';
import { eq, inArray, or } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { Db } from './db/client';
import { games, players, statLines, teams } from './db/schema';
import type { DayGame, DayLine, DayPlayer, DayRow, gameDayRows } from './game-day-rows';

const homeTeam = alias(teams, 'home_team');
const awayTeam = alias(teams, 'away_team');

// 42P01 undefined_table; drizzle wraps the driver's error in `cause`.
const neverMigrated = (e: unknown) =>
  e instanceof Error && (e.cause as { code?: unknown } | undefined)?.code === '42P01';

// The day's games, their lines, and the players involved: those with a line plus those whose current team plays.
export async function loadRecap(
  db: Db,
  date: string,
): Promise<{ games: DayGame[]; lines: DayLine[]; players: DayPlayer[] }> {
  const gameRows = await db
    .select({
      id: games.id,
      publicId: games.publicId,
      league: games.league,
      status: games.status,
      seasonType: games.seasonType,
      gameDate: games.gameDate,
      startTimeUtc: games.startTimeUtc,
      awayId: awayTeam.id,
      awayAbbrev: awayTeam.abbrev,
      homeId: homeTeam.id,
      homeAbbrev: homeTeam.abbrev,
      awayScore: games.awayScore,
      homeScore: games.homeScore,
      endedIn: games.endedIn,
      periodScores: games.periodScores,
      boxscoreFetchedAt: games.boxscoreFetchedAt,
    })
    .from(games)
    .innerJoin(homeTeam, eq(homeTeam.id, games.homeTeamId))
    .innerJoin(awayTeam, eq(awayTeam.id, games.awayTeamId))
    .where(eq(games.gameDate, date))
    .catch((e: unknown) => {
      throw neverMigrated(e)
        ? new Error('the database has no tables yet: run `pnpm job` (any job migrates it) first', {
            cause: e,
          })
        : e;
    });
  if (gameRows.length === 0) return { games: [], lines: [], players: [] };
  const gameIds = gameRows.map((g) => g.id);
  const teamIds = gameRows.flatMap((g) => [g.awayId, g.homeId]);

  const lineRows = await db
    .select({
      gamePublicId: games.publicId,
      playerPublicId: players.publicId,
      teamExternalId: teams.externalId,
      teamId: statLines.teamId,
      kind: statLines.kind,
      played: statLines.played,
      dnpReason: statLines.dnpReason,
      starter: statLines.starter,
      stats: statLines.stats,
    })
    .from(statLines)
    .innerJoin(games, eq(games.id, statLines.gameId))
    .innerJoin(players, eq(players.id, statLines.playerId))
    .innerJoin(teams, eq(teams.id, statLines.teamId))
    .where(inArray(statLines.gameId, gameIds));

  const playerRows = await db
    .select({
      publicId: players.publicId,
      league: players.league,
      nationality: players.nationality,
      firstName: players.firstName,
      lastName: players.lastName,
      currentTeamId: players.currentTeamId,
    })
    .from(players)
    .where(
      or(
        inArray(players.currentTeamId, teamIds),
        inArray(
          players.id,
          db
            .select({ id: statLines.playerId })
            .from(statLines)
            .where(inArray(statLines.gameId, gameIds)),
        ),
      ),
    );

  return {
    games: gameRows.map((g) => ({
      publicId: g.publicId,
      league: g.league,
      status: g.status,
      seasonType: g.seasonType,
      gameDate: g.gameDate,
      startTimeUtc: g.startTimeUtc.toISOString(),
      away: { id: g.awayId, abbrev: g.awayAbbrev },
      home: { id: g.homeId, abbrev: g.homeAbbrev },
      awayScore: g.awayScore,
      homeScore: g.homeScore,
      endedIn: g.endedIn,
      periodScores: g.periodScores,
      boxScoreStored: g.boxscoreFetchedAt !== null,
    })),
    // TS can't tie a row's kind to its parsed stats through the spread, so the union is asserted.
    lines: lineRows.map(
      ({ stats, ...l }) =>
        (l.played
          ? { ...l, stats: parseStatPayload(l.kind, stats) }
          : { ...l, stats: null }) as DayLine,
    ),
    players: playerRows,
  };
}

const dnp = (reason: string | null) => (reason === null ? 'DNP' : `DNP — ${reason}`);

// Card text per VISION §4.1, shared with the app; the terminal joins basketball's two lines into one.
const card = (line: DayLine): string =>
  line.played ? lineText(line).join(' · ') : dnp(line.dnpReason);

function rowText(row: DayRow, game: DayGame): string {
  switch (row.kind) {
    case 'line':
      return card(row.line);
    case 'dnp':
      return dnp(row.reason);
    case 'not-in-lineup':
      return 'Not in lineup';
    case 'upcoming':
      return upcomingText(game.status);
  }
}

function statusLabel(game: DayGame): string {
  switch (game.status) {
    case 'FINAL':
      return finalLabel(game.endedIn);
    case 'LIVE':
      return 'Live';
    // The terminal has no viewer time zone to honor, so a start time reads in UTC.
    case 'SCHEDULED':
      return `${new Date(game.startTimeUtc).toISOString().slice(11, 16)} UTC`;
    case 'POSTPONED':
      return 'Postponed';
    case 'CANCELLED':
      return 'Cancelled';
  }
}

function header(game: DayGame): string {
  const { away, home, awayScore, homeScore } = game;
  const teamsText =
    awayScore === null || homeScore === null
      ? `${away.abbrev} @ ${home.abbrev}`
      : `${away.abbrev} ${awayScore} – ${homeScore} ${home.abbrev}`;
  return `${teamsText}  ${statusLabel(game)}`;
}

export function formatRecap(
  date: string,
  countries: readonly CountryCode[],
  groups: ReturnType<typeof gameDayRows>,
): string {
  if (groups.length === 0) return `No players from ${countries.join(', ')} on ${date}.`;
  const name = (row: DayRow) => `${row.player.firstName} ${row.player.lastName}`;
  const width = Math.max(...groups.flatMap((g) => g.rows.map((r) => name(r).length)));
  return leagueSchema.options
    .flatMap((league) => {
      const ofLeague = groups.filter((g) => g.game.league === league);
      if (ofLeague.length === 0) return [];
      return [
        `${league} ${date}`,
        ...ofLeague.flatMap((g) => [
          header(g.game),
          ...g.rows.map(
            (r) => `  ${name(r).padEnd(width)}  ${r.team.abbrev}  ${rowText(r, g.game)}`,
          ),
        ]),
      ];
    })
    .join('\n');
}

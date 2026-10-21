import type {
  DayGameResponse,
  DayResponse,
  GameResponse,
  PlayerRow,
  Prefs,
} from '@our-players/shared';
import { eq, inArray, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { games } from '../db/schema';
import {
  byStartTime,
  type DayGame,
  type DayLine,
  type DayRow,
  gameDayRows,
} from '../game-day-rows';
import { loadRecap } from '../recap';

type Recap = Awaited<ReturnType<typeof loadRecap>>;
type Line = Extract<PlayerRow, { type: 'line' }>['line'];

// gameDayRows only makes a line row from a played line; the switch lets TS pair each kind with its stats.
function contractLine(line: DayLine): Line {
  if (!line.played) throw new Error(`line ${line.gamePublicId}/${line.playerPublicId}: not played`);
  switch (line.kind) {
    case 'hockey_skater':
      return { kind: line.kind, stats: line.stats };
    case 'hockey_goalie':
      return { kind: line.kind, stats: line.stats };
    case 'basketball_player':
      return { kind: line.kind, stats: line.stats };
  }
}

function playerRow(game: DayGame, row: DayRow): PlayerRow {
  const side = row.team.id === game.away.id ? 'away' : 'home';
  const { publicId: id, firstName, lastName, nationality } = row.player;
  const player = { id, firstName, lastName, nationality };
  switch (row.kind) {
    case 'line':
      return { type: 'line', side, player, line: contractLine(row.line) };
    case 'dnp':
      return { type: 'dnp', side, player, reason: row.reason };
    case 'not-in-lineup':
      return { type: 'not-in-lineup', side, player };
    case 'upcoming':
      return { type: 'upcoming', side, player };
  }
}

// Games with shown rows first, then the rest by start time, so the app splits one list on rows.length.
export function dayGames(data: Recap, prefs: Prefs): DayGameResponse[] {
  const shown = gameDayRows(data, prefs);
  const shownIds = new Set(shown.map((s) => s.game.publicId));
  const rest = data.games
    .filter((g) => !shownIds.has(g.publicId))
    .sort(byStartTime)
    .map((game) => ({ game, rows: [] }));
  return [...shown, ...rest].map(({ game, rows }) => ({
    id: game.publicId,
    league: game.league,
    seasonType: game.seasonType,
    gameDate: game.gameDate,
    startTimeUtc: game.startTimeUtc,
    status: game.status,
    endedIn: game.endedIn,
    away: { abbrev: game.away.abbrev, score: game.awayScore },
    home: { abbrev: game.home.abbrev, score: game.homeScore },
    rows: rows.map((r) => playerRow(game, r)),
  }));
}

export async function loadDay(db: Db, date: string, prefs: Prefs): Promise<DayResponse> {
  const data = await loadRecap(db, date);
  const ofLeagues = { ...data, games: data.games.filter((g) => prefs.leagues.has(g.league)) };
  const [nav] = await db
    .select({
      prev: sql`max(${games.gameDate}) filter (where ${games.gameDate} < ${date})`.mapWith(
        games.gameDate,
      ),
      next: sql`min(${games.gameDate}) filter (where ${games.gameDate} > ${date})`.mapWith(
        games.gameDate,
      ),
    })
    .from(games)
    .where(inArray(games.league, [...prefs.leagues]));
  return {
    gameDate: date,
    prevGameDate: nav?.prev ?? null,
    nextGameDate: nav?.next ?? null,
    games: dayGames(ofLeagues, prefs),
  };
}

// null: no game with that ID.
export async function loadGame(db: Db, gameId: string, prefs: Prefs): Promise<GameResponse | null> {
  const [found] = await db
    .select({ gameDate: games.gameDate })
    .from(games)
    .where(eq(games.publicId, gameId));
  if (!found) return null;
  // The whole day, not one game: "played for another team that day" needs every line of the date.
  const data = await loadRecap(db, found.gameDate);
  const game = dayGames(data, prefs).find((g) => g.id === gameId);
  const stored = data.games.find((g) => g.publicId === gameId);
  if (!game || !stored) throw new Error(`game ${gameId}: not in its own day ${found.gameDate}`);
  return { ...game, periodScores: stored.periodScores };
}

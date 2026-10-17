import {
  type Game,
  LEAGUE_SPORT,
  type League,
  type PublicId,
  parseStatPayload,
  type Source,
  type StatLine,
} from '@our-players/shared';
import { and, eq, notInArray, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { Db } from './client';
import { playerIdLookup } from './players';
import { games, statLines, teams } from './schema';
import { teamLookup } from './teams';
import { conflictUpdate, lastByKey } from './upsert';

const SOURCE_LEAGUES: Record<Source, League> = { nhl: 'NHL', espn: 'NBA' };

export async function upsertGames(db: Db, list: readonly Game[]): Promise<number> {
  const batch = lastByKey(list, (g) => g.publicId);
  if (batch.length === 0) return 0;
  const team = await teamLookup(
    db,
    batch.flatMap((g) => [
      { source: g.source, externalId: g.homeTeamExternalId },
      { source: g.source, externalId: g.awayTeamExternalId },
    ]),
  );
  // Every game is checked before anything is written: one bad game rejects the batch.
  const rows = batch.map(({ homeTeamExternalId, awayTeamExternalId, startTimeUtc, ...g }) => {
    const fail = (problem: string): never => {
      throw new Error(`game ${g.publicId}: ${problem}`);
    };
    if (SOURCE_LEAGUES[g.source] !== g.league) {
      fail(`league ${g.league} does not fit source ${g.source}`);
    }
    if (homeTeamExternalId === awayTeamExternalId) fail('home and away are the same team');
    const teamId = (externalId: string) => {
      const { id, league } = team(g.source, externalId);
      if (league !== g.league) fail(`team ${g.source}/${externalId} is in league ${league}`);
      return id;
    };
    return {
      ...g,
      startTimeUtc: new Date(startTimeUtc),
      homeTeamId: teamId(homeTeamExternalId),
      awayTeamId: teamId(awayTeamExternalId),
    };
  });
  const { set, setWhere } = conflictUpdate(
    games,
    [
      'source',
      'externalId',
      'league',
      'season',
      'seasonType',
      'gameDate',
      'startTimeUtc',
      'status',
      'homeTeamId',
      'awayTeamId',
      'homeScore',
      'awayScore',
      'periodScores',
      'endedIn',
    ],
    'updatedAt',
  );
  const written = await db
    .insert(games)
    .values(rows)
    .onConflictDoUpdate({
      target: games.publicId,
      // finalAt, boxscoreFetchedAt and correctedAt are the jobs' bookkeeping, not the model's.
      set,
      // A stale feed (a FINAL game listed as LIVE, a schedule without period scores) skips the row whole.
      setWhere: and(
        setWhere,
        sql`not (${games.status} = 'FINAL' and excluded.status <> 'FINAL')`,
        sql`not (${games.periodScores} is not null and excluded.period_scores is null)`,
      ),
    })
    .returning({ id: games.id });
  return written.length;
}

const homeTeam = alias(teams, 'home_team');
const awayTeam = alias(teams, 'away_team');

// The lines are the game's complete set: stored lines of players not in it are deleted.
export async function upsertStatLines(
  db: Db,
  gamePublicId: PublicId,
  lines: readonly StatLine[],
): Promise<number> {
  // A box score always lists players; an empty one is broken upstream data and would delete every line.
  if (lines.length === 0) throw new Error(`stat lines ${gamePublicId}: empty batch`);
  const [game] = await db
    .select({
      id: games.id,
      league: games.league,
      source: games.source,
      homeTeamId: games.homeTeamId,
      homeExternalId: homeTeam.externalId,
      awayTeamId: games.awayTeamId,
      awayExternalId: awayTeam.externalId,
    })
    .from(games)
    .innerJoin(homeTeam, eq(homeTeam.id, games.homeTeamId))
    .innerJoin(awayTeam, eq(awayTeam.id, games.awayTeamId))
    .where(eq(games.publicId, gamePublicId));
  if (!game) throw new Error(`unknown game ${gamePublicId}`);
  const gameTeams = new Map([
    [game.homeExternalId, game.homeTeamId],
    [game.awayExternalId, game.awayTeamId],
  ]);
  const sport = LEAGUE_SPORT[game.league];

  // Checks a line and returns its team's row ID.
  const check = (line: StatLine): number => {
    const fail = (problem: string): never => {
      throw new Error(`stat line ${line.gamePublicId}/${line.playerPublicId}: ${problem}`);
    };
    if (line.gamePublicId !== gamePublicId) fail(`not a line of game ${gamePublicId}`);
    if (!line.kind.startsWith(`${sport}_`)) fail(`${line.kind} is not a ${sport} kind`);
    if (line.played) {
      try {
        parseStatPayload(line.kind, line.stats);
      } catch (e) {
        fail((e as Error).message);
      }
    } else if (line.stats !== null) {
      fail('a line not played must have stats null');
    }
    return (
      gameTeams.get(line.teamExternalId) ??
      fail(`team ${game.source}/${line.teamExternalId} is not the home or away team`)
    );
  };
  // Every line is checked before anything is written: one bad line rejects the batch.
  const checked = lines.map((line) => ({ line, teamId: check(line) }));
  const batch = lastByKey(checked, (c) => c.line.playerPublicId);
  const playerId = await playerIdLookup(
    db,
    batch.map((c) => c.line.playerPublicId),
  );
  const rows = batch.map(({ line, teamId }) => ({
    gameId: game.id,
    playerId: playerId(line.playerPublicId),
    teamId,
    kind: line.kind,
    played: line.played,
    dnpReason: line.dnpReason,
    starter: line.starter,
    stats: line.stats,
  }));

  return db.transaction(async (tx) => {
    const deleted = await tx
      .delete(statLines)
      .where(
        and(
          eq(statLines.gameId, game.id),
          notInArray(
            statLines.playerId,
            rows.map((r) => r.playerId),
          ),
        ),
      )
      .returning({ playerId: statLines.playerId });
    const written = await tx
      .insert(statLines)
      .values(rows)
      .onConflictDoUpdate({
        target: [statLines.gameId, statLines.playerId],
        ...conflictUpdate(
          statLines,
          ['teamId', 'kind', 'played', 'dnpReason', 'starter', 'stats'],
          'updatedAt',
        ),
      })
      .returning({ playerId: statLines.playerId });
    return deleted.length + written.length;
  });
}

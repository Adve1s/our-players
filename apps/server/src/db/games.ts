import {
  type Game,
  LEAGUE_SPORT,
  type PublicId,
  parseStatPayload,
  type StatLine,
} from '@our-players/shared';
import { and, eq, notInArray } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { Db } from './client';
import { playerIdLookup } from './players';
import { games, statLines, teams } from './schema';
import { teamIdLookup } from './teams';
import { conflictUpdate, lastByKey } from './upsert';

export async function upsertGames(db: Db, list: readonly Game[]): Promise<number> {
  const batch = lastByKey(list, (g) => g.publicId);
  if (batch.length === 0) return 0;
  const teamId = await teamIdLookup(
    db,
    batch.flatMap((g) => [
      { source: g.source, externalId: g.homeTeamExternalId },
      { source: g.source, externalId: g.awayTeamExternalId },
    ]),
  );
  const rows = batch.map(({ homeTeamExternalId, awayTeamExternalId, startTimeUtc, ...g }) => ({
    ...g,
    startTimeUtc: new Date(startTimeUtc),
    homeTeamId: teamId(g.source, homeTeamExternalId),
    awayTeamId: teamId(g.source, awayTeamExternalId),
  }));
  const written = await db
    .insert(games)
    .values(rows)
    .onConflictDoUpdate({
      target: games.publicId,
      // finalAt, boxscoreFetchedAt and correctedAt are the jobs' bookkeeping, not the model's.
      ...conflictUpdate(
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
    if (rows.length === 0) return deleted.length;
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

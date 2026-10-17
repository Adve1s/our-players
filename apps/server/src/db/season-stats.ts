import { LEAGUE_SPORT, type SeasonStats } from '@our-players/shared';
import type { Db } from './client';
import { playerLookup } from './players';
import { seasonStats } from './schema';
import { conflictUpdate, lastByKey } from './upsert';

export async function upsertSeasonStats(db: Db, list: readonly SeasonStats[]): Promise<number> {
  const batch = lastByKey(list, (r) => `${r.playerPublicId}/${r.season}/${r.seasonType}/${r.kind}`);
  if (batch.length === 0) return 0;
  const player = await playerLookup(
    db,
    batch.map((r) => r.playerPublicId),
  );
  // Every row is checked before anything is written: one bad row rejects the batch.
  const rows = batch.map(({ playerPublicId, ...r }) => {
    const { id, league } = player(playerPublicId);
    const sport = LEAGUE_SPORT[league];
    if (!r.kind.startsWith(`${sport}_`)) {
      throw new Error(
        `season stats ${playerPublicId}/${r.season}: ${r.kind} is not a ${sport} kind`,
      );
    }
    return { playerId: id, ...r };
  });
  const written = await db
    .insert(seasonStats)
    .values(rows)
    .onConflictDoUpdate({
      target: [seasonStats.playerId, seasonStats.season, seasonStats.seasonType, seasonStats.kind],
      ...conflictUpdate(seasonStats, ['basis', 'stats'], 'fetchedAt'),
    })
    .returning({ playerId: seasonStats.playerId });
  return written.length;
}

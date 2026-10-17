import type { SeasonStats } from '@our-players/shared';
import type { Db } from './client';
import { playerIdLookup } from './players';
import { seasonStats } from './schema';
import { conflictUpdate, lastByKey } from './upsert';

export async function upsertSeasonStats(db: Db, list: readonly SeasonStats[]): Promise<number> {
  const batch = lastByKey(list, (r) => `${r.playerPublicId}/${r.season}/${r.seasonType}/${r.kind}`);
  if (batch.length === 0) return 0;
  const playerId = await playerIdLookup(
    db,
    batch.map((r) => r.playerPublicId),
  );
  const rows = batch.map(({ playerPublicId, ...r }) => ({
    playerId: playerId(playerPublicId),
    ...r,
  }));
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

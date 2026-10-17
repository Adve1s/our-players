import type { SeasonStats } from '@our-players/shared';
import type { Db } from './client';

export async function upsertSeasonStats(_db: Db, _rows: readonly SeasonStats[]): Promise<number> {
  throw new Error('not implemented');
}

import type { PublicId } from '@our-players/shared';
import type { Db } from '../db/client';
import type { NationalityOverride } from './overrides';

export async function recomputeNationalities(
  _db: Db,
  _overrides: ReadonlyMap<PublicId, NationalityOverride>,
): Promise<{ updated: number; warnings: string[] }> {
  throw new Error('not implemented');
}

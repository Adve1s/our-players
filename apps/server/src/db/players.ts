import type { CountryCode, Player, PublicId } from '@our-players/shared';
import type { Db } from './client';

export function searchName(_name: string): string {
  throw new Error('not implemented');
}

export async function upsertPlayers(
  _db: Db,
  _players: readonly Player[],
  _overrides: ReadonlyMap<PublicId, { readonly nationality: CountryCode }>,
): Promise<number> {
  throw new Error('not implemented');
}

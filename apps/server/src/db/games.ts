import type { Game, PublicId, StatLine } from '@our-players/shared';
import type { Db } from './client';

export async function upsertGames(_db: Db, _games: readonly Game[]): Promise<number> {
  throw new Error('not implemented');
}

export async function upsertStatLines(
  _db: Db,
  _gamePublicId: PublicId,
  _lines: readonly StatLine[],
): Promise<number> {
  throw new Error('not implemented');
}

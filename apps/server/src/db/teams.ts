import type { Team } from '@our-players/shared';
import type { Db } from './client';

export async function upsertTeams(_db: Db, _teams: readonly Team[]): Promise<number> {
  throw new Error('not implemented');
}

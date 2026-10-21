import type { League, PlayerSummary, PublicId } from '@our-players/shared';

export const SEARCH_MIN = 2;
export const SEARCH_MAX = 50;

export function searchTerm(raw: string): string | null {
  throw new Error('not implemented');
}

export function playerMeta(p: PlayerSummary): string {
  throw new Error('not implemented');
}

export type ListRow = { player: PlayerSummary; removed: boolean };

export function listRows(
  players: readonly PlayerSummary[],
  leagues: readonly League[],
  removed: ReadonlySet<PublicId>,
): ListRow[] {
  throw new Error('not implemented');
}

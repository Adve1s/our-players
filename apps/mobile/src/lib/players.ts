import type { League, PlayerSummary, PublicId } from '@our-players/shared';

export const SEARCH_MIN = 2;
export const SEARCH_MAX = 50;

export function searchTerm(raw: string): string | null {
  const term = raw.trim().slice(0, SEARCH_MAX);
  return term.length < SEARCH_MIN ? null : term;
}

export function playerMeta(p: PlayerSummary): string {
  const parts = [p.league, p.team?.abbrev ?? 'No team', p.position];
  return (p.nationality ? [...parts, p.nationality] : parts).join(' · ');
}

export type ListRow = { player: PlayerSummary; removed: boolean };

export function listRows(
  players: readonly PlayerSummary[],
  leagues: readonly League[],
  removed: ReadonlySet<PublicId>,
): ListRow[] {
  // A fixed name order keeps a row in place after Remove/Undo.
  return players
    .filter((player) => leagues.includes(player.league))
    .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName))
    .map((player) => ({ player, removed: removed.has(player.id) }));
}

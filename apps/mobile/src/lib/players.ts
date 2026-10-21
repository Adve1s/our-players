import type { League, PlayerSummary, PublicId } from '@our-players/shared';
import type { QueryObserverResult } from '@tanstack/react-query';

export const SEARCH_MIN = 2;
export const SEARCH_MAX = 50;

export function searchTerm(raw: string): string | null {
  const term = raw.trim().slice(0, SEARCH_MAX);
  return term.length < SEARCH_MIN ? null : term;
}

export type SearchView = 'hint' | 'offline' | 'error' | 'loading' | 'empty' | 'results';
type SearchState = Pick<
  QueryObserverResult<{ players: PlayerSummary[] }>,
  'data' | 'isPending' | 'isError' | 'fetchStatus' | 'isPlaceholderData'
>;

export function searchView(term: string | null, r: SearchState): SearchView {
  if (term === null) return 'hint';
  // keepPreviousData makes a new term start as success, not pending, after any earlier search resolved.
  if (r.fetchStatus === 'paused' && (r.isPending || r.isPlaceholderData)) return 'offline';
  if (r.isError) return 'error';
  // An old empty result would claim the new term has no match.
  // Pick drops the union that ties data to isPending, hence the ?? 0.
  const count = r.data?.players.length ?? 0;
  if (r.isPending || (r.isPlaceholderData && count === 0)) return 'loading';
  return count === 0 ? 'empty' : 'results';
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

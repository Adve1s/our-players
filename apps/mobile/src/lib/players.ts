import type { League, PlayerSummary, PublicId } from '@our-players/shared';
import type { QueryObserverResult } from '@tanstack/react-query';
import type { Mark } from '../state/prefs';

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
  // A failed background refetch keeps its data; only show the error with nothing to show.
  if (r.isError && !r.data) return 'error';
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
  ids: readonly PublicId[],
  leagues: readonly League[],
  removed: ReadonlySet<PublicId>,
): ListRow[] {
  // keepPreviousData can hand over the previous key's players, some no longer in the list.
  // A fixed name order keeps a row in place after Remove/Undo.
  return players
    .filter((player) => ids.includes(player.id) && leagues.includes(player.league))
    .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName))
    .map((player) => ({ player, removed: removed.has(player.id) }));
}

export type ListView = 'empty' | 'offline' | 'error' | 'loading' | 'none-shown' | 'rows';

export function listView(
  ids: readonly PublicId[],
  r: SearchState,
  rows: readonly ListRow[],
): ListView {
  if (ids.length === 0) return 'empty';
  if (r.fetchStatus === 'paused' && (r.isPending || r.isPlaceholderData)) return 'offline';
  if (r.isError && !r.data) return 'error';
  if (r.isPending) return 'loading';
  // Stored IDs but no row: all in a deselected league, or gone from the server.
  return rows.length === 0 ? 'none-shown' : 'rows';
}

export function listIds(
  list: readonly PublicId[],
  removed: ReadonlyMap<PublicId, Mark>,
  mark: Mark,
): PublicId[] {
  // Removed IDs stay in the query, so Remove doesn't change its key and refetch.
  const gone = [...removed].filter(([, m]) => m === mark).map(([id]) => id);
  return [...new Set([...list, ...gone])].sort();
}

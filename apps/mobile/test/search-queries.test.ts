import type { PlayerSummary } from '@our-players/shared';
import { onlineManager, QueryClient, QueryObserver } from '@tanstack/react-query';
import { afterEach, describe, expect, it } from 'vitest';
import { searchQuery } from '../src/api/queries';
import { searchView } from '../src/lib/players';

// Real observers over a fake fetch, so the flags the screen reads are TanStack's own.
const porzingis: PlayerSummary = {
  id: 'nba-3102531',
  league: 'NBA',
  firstName: 'Kristaps',
  lastName: 'Porziņģis',
  position: 'C',
  team: { abbrev: 'BOS', name: 'Boston Celtics' },
  nationality: 'LVA',
  active: true,
};
const never = () => new Promise<{ players: PlayerSummary[] }>(() => {});

async function after(first: PlayerSummary[], { offline }: { offline: boolean }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const observer = new QueryObserver(qc, {
    ...searchQuery('porz', ['NBA']),
    queryFn: async () => ({ players: first }),
  });
  const unsubscribe = observer.subscribe(() => {});
  await observer.refetch();
  // Offline only after the first term resolved: the case where keepPreviousData hides isPending.
  onlineManager.setOnline(!offline);
  observer.setOptions({ ...searchQuery('porzi', ['NBA']), queryFn: never });
  const result = observer.getCurrentResult();
  unsubscribe();
  return result;
}

afterEach(() => onlineManager.setOnline(true));

describe('searchView', () => {
  it('hint without a term', () => {
    expect(
      searchView(null, {
        data: undefined,
        isPending: true,
        isError: false,
        fetchStatus: 'idle',
        isPlaceholderData: false,
      }),
    ).toBe('hint');
  });

  it('offline after an earlier search with results', async () => {
    expect(searchView('porzi', await after([porzingis], { offline: true }))).toBe('offline');
  });

  it('offline after an earlier search with no results', async () => {
    expect(searchView('porzi', await after([], { offline: true }))).toBe('offline');
  });

  it('keeps earlier results on screen while online and loading', async () => {
    expect(searchView('porzi', await after([porzingis], { offline: false }))).toBe('results');
  });

  it('loading, not "no match", while an earlier empty result is the placeholder', async () => {
    expect(searchView('porzi', await after([], { offline: false }))).toBe('loading');
  });

  it('keeps the results when a background refetch fails', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    let fail = false;
    const observer = new QueryObserver(qc, {
      ...searchQuery('porz', ['NBA']),
      queryFn: async () => {
        if (fail) throw new TypeError('Network request failed');
        return { players: [porzingis] };
      },
    });
    await observer.refetch();
    fail = true;
    await observer.refetch();
    expect(observer.getCurrentResult().isError).toBe(true);
    expect(searchView('porz', observer.getCurrentResult())).toBe('results');
  });

  it("drops the old results when the leagues change, so a deselected league's players go at once", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const observer = new QueryObserver(qc, {
      ...searchQuery('porz', ['NBA', 'NHL']),
      queryFn: async () => ({ players: [porzingis] }),
    });
    const unsubscribe = observer.subscribe(() => {});
    await observer.refetch();
    observer.setOptions({ ...searchQuery('porz', ['NHL']), queryFn: never });
    const result = observer.getCurrentResult();
    unsubscribe();
    expect(searchView('porz', result)).toBe('loading');
  });

  it('empty once the new term resolves with nothing', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const observer = new QueryObserver(qc, {
      ...searchQuery('zzzz', ['NBA']),
      queryFn: async () => ({ players: [] }),
    });
    await observer.refetch();
    expect(searchView('zzzz', observer.getCurrentResult())).toBe('empty');
  });
});

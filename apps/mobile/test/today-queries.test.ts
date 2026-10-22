import type { DayResponse } from '@our-players/shared';
import { onlineManager, QueryClient, QueryObserver } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { dayQuery } from '../src/api/queries';
import { refreshBanner } from '../src/lib/day-message';
import { dayLabel } from '../src/lib/format';
import { DEFAULT_PREFS } from '../src/state/prefs';

// Real observers over a fake fetch, so the flags the screen reads are TanStack's own.
const client = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });
const dayOf = (gameDate: string): DayResponse => ({
  gameDate,
  prevGameDate: null,
  nextGameDate: null,
  games: [],
});
const never = () => new Promise<DayResponse>(() => {});

async function settled<R>(observer: { refetch(): Promise<unknown>; getCurrentResult(): R }) {
  await observer.refetch();
  return observer.getCurrentResult();
}

const A = '2026-03-16';
const B = '2026-03-17';
const failing = async (): Promise<DayResponse> => {
  throw new Error('server down');
};
const freshMeta = (qc: QueryClient) =>
  settled(new QueryObserver(qc, { queryKey: ['meta'], queryFn: async () => ({}) }));

// Day A on screen, as Today has it before a step.
async function showingA(qc: QueryClient) {
  const observer = new QueryObserver(qc, {
    ...dayQuery(A, DEFAULT_PREFS),
    queryFn: async () => dayOf(A),
  });
  const unsubscribe = observer.subscribe(() => {});
  await settled(observer);
  return { observer, unsubscribe };
}

// onlineManager is global: always back online, so other tests see a normal network.
function offline<T>(run: () => T): T {
  try {
    onlineManager.setOnline(false);
    return run();
  } finally {
    onlineManager.setOnline(true);
  }
}

describe('dayQuery', () => {
  it('keeps the previous day on screen while the next day loads', async () => {
    const qc = client();
    const observer = new QueryObserver(qc, {
      ...dayQuery('2026-03-16', DEFAULT_PREFS),
      queryFn: async () => dayOf('2026-03-16'),
    });
    const unsubscribe = observer.subscribe(() => {});
    await settled(observer);
    observer.setOptions({ ...dayQuery('2026-03-17', DEFAULT_PREFS), queryFn: never });
    const result = observer.getCurrentResult();
    unsubscribe();
    expect(result.data?.gameDate).toBe('2026-03-16');
    expect(result.isPlaceholderData).toBe(true);
  });

  it('shows no day once there is no date to load', async () => {
    const qc = client();
    const observer = new QueryObserver(qc, {
      ...dayQuery('2026-03-16', DEFAULT_PREFS),
      queryFn: async () => dayOf('2026-03-16'),
    });
    const unsubscribe = observer.subscribe(() => {});
    await settled(observer);
    observer.setOptions(dayQuery(null, DEFAULT_PREFS));
    const result = observer.getCurrentResult();
    unsubscribe();
    expect(result.data).toBeUndefined();
  });

  it('a step whose fetch fails drops the previous day', async () => {
    const qc = client();
    const { observer, unsubscribe } = await showingA(qc);
    observer.setOptions({ ...dayQuery(B, DEFAULT_PREFS), queryFn: failing });
    const result = await settled(observer);
    unsubscribe();
    expect(result.data).toBeUndefined();
    expect(result.isLoadingError).toBe(true);
  });
});

describe('refreshBanner', () => {
  it('no banner when meta failed its first load and the day is fresh', async () => {
    const qc = client();
    const meta = await settled(
      new QueryObserver(qc, {
        queryKey: ['meta'],
        queryFn: async () => {
          throw new Error('meta down');
        },
      }),
    );
    const day = await settled(
      new QueryObserver(qc, { queryKey: ['day'], queryFn: async () => dayOf('2026-03-16') }),
    );
    expect(meta.isError).toBe(true);
    expect(refreshBanner(meta, day, A, A)).toBeNull();
  });

  it('a failed refetch of shown data says the data is saved', async () => {
    const qc = client();
    let up = true;
    const observer = new QueryObserver(qc, {
      queryKey: ['day'],
      queryFn: async () => {
        if (!up) throw new Error('server down');
        return dayOf('2026-03-16');
      },
    });
    const meta = await settled(
      new QueryObserver(qc, { queryKey: ['meta'], queryFn: async () => ({}) }),
    );
    await settled(observer);
    up = false;
    const day = await settled(observer);
    expect(refreshBanner(meta, day, A, A)).toEqual({
      text: "Couldn't refresh — showing saved data.",
      retry: false,
    });
  });

  it('a step to another day that errors names the day and offers a retry', async () => {
    const qc = client();
    const meta = await freshMeta(qc);
    const { observer, unsubscribe } = await showingA(qc);
    observer.setOptions({ ...dayQuery(B, DEFAULT_PREFS), queryFn: failing });
    const day = await settled(observer);
    unsubscribe();
    expect(refreshBanner(meta, day, B, A)).toEqual({
      text: `Couldn't load ${dayLabel(B)}.`,
      retry: true,
    });
  });

  it('a step to another day while offline names the day it could not open', async () => {
    const qc = client();
    const meta = await freshMeta(qc);
    const { observer, unsubscribe } = await showingA(qc);
    const day = offline(() => {
      observer.setOptions({ ...dayQuery(B, DEFAULT_PREFS), queryFn: async () => dayOf(B) });
      return observer.getCurrentResult();
    });
    unsubscribe();
    expect(refreshBanner(meta, day, B, A)).toEqual({
      text: `You're offline — couldn't open ${dayLabel(B)}.`,
      retry: false,
    });
  });

  it('a step paused offline opens the day once back online', async () => {
    const qc = client();
    // Mounting subscribes the client to onlineManager, as QueryClientProvider does in the app.
    qc.mount();
    const meta = await freshMeta(qc);
    const { observer, unsubscribe } = await showingA(qc);
    offline(() =>
      observer.setOptions({ ...dayQuery(B, DEFAULT_PREFS), queryFn: async () => dayOf(B) }),
    );
    await vi.waitFor(() => expect(observer.getCurrentResult().fetchStatus).toBe('idle'));
    const day = observer.getCurrentResult();
    unsubscribe();
    qc.unmount();
    expect(day.data?.gameDate).toBe(B);
    expect(refreshBanner(meta, day, B, B)).toBeNull();
  });

  it('new prefs for the same day that error keep the saved day and offer a retry', async () => {
    const qc = client();
    const meta = await freshMeta(qc);
    const { observer, unsubscribe } = await showingA(qc);
    observer.setOptions({
      ...dayQuery(A, { ...DEFAULT_PREFS, countries: ['EST'] }),
      queryFn: failing,
    });
    const day = await settled(observer);
    unsubscribe();
    expect(refreshBanner(meta, day, A, A)).toEqual({
      text: "Couldn't refresh — showing saved data.",
      retry: true,
    });
  });

  it('new prefs for the same day while offline keep the saved day', async () => {
    const qc = client();
    const meta = await freshMeta(qc);
    const { observer, unsubscribe } = await showingA(qc);
    const day = offline(() => {
      observer.setOptions({
        ...dayQuery(A, { ...DEFAULT_PREFS, countries: ['EST'] }),
        queryFn: async () => dayOf(A),
      });
      return observer.getCurrentResult();
    });
    unsubscribe();
    expect(refreshBanner(meta, day, A, A)).toEqual({
      text: "You're offline — showing saved data.",
      retry: false,
    });
  });

  it('no banner while a step is still loading', async () => {
    const qc = client();
    const meta = await freshMeta(qc);
    const { observer, unsubscribe } = await showingA(qc);
    observer.setOptions({ ...dayQuery(B, DEFAULT_PREFS), queryFn: never });
    const day = observer.getCurrentResult();
    unsubscribe();
    expect(refreshBanner(meta, day, B, A)).toBeNull();
  });

  it('a failed step outranks a failed meta refresh', async () => {
    const qc = client();
    let up = true;
    const metaObserver = new QueryObserver(qc, {
      queryKey: ['meta'],
      queryFn: async () => {
        if (!up) throw new Error('meta down');
        return {};
      },
    });
    await settled(metaObserver);
    up = false;
    const meta = await settled(metaObserver);
    const { observer, unsubscribe } = await showingA(qc);
    observer.setOptions({ ...dayQuery(B, DEFAULT_PREFS), queryFn: failing });
    const day = await settled(observer);
    unsubscribe();
    expect(meta.isRefetchError).toBe(true);
    expect(refreshBanner(meta, day, B, A)).toEqual({
      text: `Couldn't load ${dayLabel(B)}.`,
      retry: true,
    });
  });
});

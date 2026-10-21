import type { DayResponse } from '@our-players/shared';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { dayQuery } from '../src/api/queries';
import { refreshBanner } from '../src/lib/day-message';
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
    expect(refreshBanner(meta, day)).toBeNull();
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
    expect(refreshBanner(meta, day)).toBe("Couldn't refresh — showing saved data.");
  });
});

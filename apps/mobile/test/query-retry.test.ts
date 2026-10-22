import { ApiError } from '@our-players/shared';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { retryQuery } from '../src/api/queries';

// A real observer with the app's retry rule, counting the requests a failing query makes.
async function requests(error: Error) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: retryQuery, retryDelay: 0 } } });
  let calls = 0;
  const observer = new QueryObserver(qc, {
    queryKey: ['player', 'nhl-1'],
    queryFn: () => {
      calls += 1;
      throw error;
    },
  });
  await observer.refetch();
  return calls;
}

describe('retryQuery', () => {
  it('a 404 is not retried', async () => {
    expect(await requests(new ApiError(404, 'not_found', 'no such player'))).toBe(1);
  });

  it.each<[string, Error]>([
    ['a 500', new ApiError(500, 'internal', 'boom')],
    ['a network error', new TypeError('Network request failed')],
  ])('%s is retried once', async (_, error) => {
    expect(await requests(error)).toBe(2);
  });
});

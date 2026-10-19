import { afterEach, describe, expect, it, vi } from 'vitest';
import { errorMessage } from '../src/lib/errors';
import { withTimeout } from '../src/lib/timeout-fetch';

// A host that drops packets: the request never settles unless aborted.
const hangingFetch = (_url: string, init?: { signal?: AbortSignal }) =>
  new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
  });

afterEach(() => {
  vi.useRealTimers();
});

describe('withTimeout', () => {
  it("rejects a request that hasn't answered after the timeout as unreachable", async () => {
    vi.useFakeTimers();
    const res = withTimeout(hangingFetch, 10_000)('http://api/v1/countries');
    const settled = expect(res).rejects.toSatisfy(
      (e) => errorMessage(e) === "Can't reach the server. Check your connection and try again.",
    );
    await vi.advanceTimersByTimeAsync(10_000);
    await settled;
  });

  it('still waits just before the timeout', async () => {
    vi.useFakeTimers();
    let done = false;
    withTimeout(
      hangingFetch,
      10_000,
    )('http://api/v1/countries').catch(() => {
      done = true;
    });
    await vi.advanceTimersByTimeAsync(9_999);
    expect(done).toBe(false);
  });

  it('passes the URL through and returns the response', async () => {
    const ok = new Response('{}');
    const fetch = vi.fn(async (_url: string, _init?: { signal?: AbortSignal }) => ok);
    await expect(withTimeout(fetch, 10_000)('http://api/v1/meta')).resolves.toBe(ok);
    expect(fetch).toHaveBeenCalledWith('http://api/v1/meta', expect.anything());
  });
});

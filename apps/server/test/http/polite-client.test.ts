import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createPoliteClient,
  type PoliteClientOptions,
  UpstreamError,
} from '../../src/http/polite-client';

const UA = 'OurPlayers/0.0.0 (+https://github.com/Adve1s/our-players)';
const T0 = Date.UTC(2026, 9, 3, 12, 0, 0);

type Step =
  | { status: number; body?: string; headers?: Record<string, string> }
  | { error: Error }
  | 'hang'
  | 'hang-body';

interface Call {
  url: string;
  at: number;
  userAgent: string | null;
}

// A scripted fetch: each call consumes the next step and records when it happened.
function fakeFetch(steps: Step[]) {
  const calls: Call[] = [];
  const queue = [...steps];
  const fn = (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    calls.push({
      url: String(input),
      at: Date.now() - T0,
      userAgent: new Headers(init?.headers).get('user-agent'),
    });
    const step = queue.shift() ?? { status: 200, body: '{}' };
    if (step === 'hang') {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
      });
    }
    if (step === 'hang-body') {
      // Headers arrive, then the body stalls; like real fetch, the signal errors the stream.
      const body = new ReadableStream({
        start(controller) {
          init?.signal?.addEventListener('abort', () => controller.error(init.signal?.reason));
        },
      });
      return Promise.resolve(new Response(body, { status: 200 }));
    }
    if ('error' in step) return Promise.reject(step.error);
    return Promise.resolve(
      new Response(step.body ?? '{}', { status: step.status, headers: step.headers }),
    );
  };
  return { calls, fetch: fn as typeof fetch };
}

function client(steps: Step[], options: Partial<PoliteClientOptions> = {}) {
  const fake = fakeFetch(steps);
  const politeClient = createPoliteClient({
    userAgent: UA,
    fetch: fake.fetch,
    random: () => 1,
    log: () => {},
    ...options,
  });
  return { ...fake, client: politeClient };
}

// Settle a promise while fake timers run, without an unhandled rejection in between.
async function settle<T>(promise: Promise<T>): Promise<T | unknown> {
  const outcome = promise.then(
    (value) => value,
    (error: unknown) => error,
  );
  await vi.runAllTimersAsync();
  return outcome;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('polite client', () => {
  it('returns status, body and raw byte count of a 2xx response', async () => {
    const { client: c } = client([{ status: 200, body: '{"name":"Porziņģis"}' }]);
    const response = await settle(c.get('https://a.example/x'));
    expect(response).toMatchObject({
      url: 'https://a.example/x',
      status: 200,
      body: '{"name":"Porziņģis"}',
      bytes: new TextEncoder().encode('{"name":"Porziņģis"}').length,
    });
  });

  it('sends the User-Agent header', async () => {
    const { client: c, calls } = client([{ status: 200 }]);
    await settle(c.get('https://a.example/x'));
    expect(calls[0]?.userAgent).toBe(UA);
  });

  it('spaces requests to the same host at least 1 s apart', async () => {
    const { client: c, calls } = client([{ status: 200 }, { status: 200 }, { status: 200 }]);
    await settle(
      Promise.all([
        c.get('https://a.example/1'),
        c.get('https://a.example/2'),
        c.get('https://a.example/3'),
      ]),
    );
    expect(calls.map((call) => call.at)).toEqual([0, 1000, 2000]);
  });

  it('does not delay requests to a different host', async () => {
    const { client: c, calls } = client([{ status: 200 }, { status: 200 }]);
    await settle(Promise.all([c.get('https://a.example/1'), c.get('https://b.example/1')]));
    expect(calls.map((call) => call.at)).toEqual([0, 0]);
  });

  it('retries a 429 with backoff, then succeeds', async () => {
    const { client: c, calls } = client([{ status: 429 }, { status: 200, body: '{"ok":1}' }]);
    const response = await settle(c.get('https://a.example/x'));
    expect(response).toMatchObject({ status: 200, body: '{"ok":1}' });
    expect(calls.map((call) => call.at)).toEqual([0, 1000]);
  });

  it('retries a 503 with exponentially growing backoff', async () => {
    const { client: c, calls } = client([
      { status: 503 },
      { status: 503 },
      { status: 503 },
      { status: 200 },
    ]);
    await settle(c.get('https://a.example/x'));
    // random() = 1: delays of 1 s, 2 s, 4 s after each failure.
    expect(calls.map((call) => call.at)).toEqual([0, 1000, 3000, 7000]);
  });

  it('applies full jitter to the backoff, never below the 1 s spacing', async () => {
    const { client: c, calls } = client(
      [{ status: 503 }, { status: 503 }, { status: 503 }, { status: 200 }],
      { random: () => 0.5 },
    );
    await settle(c.get('https://a.example/x'));
    // Jittered delays 0.5 s (raised to the 1 s spacing), 1 s, 2 s.
    expect(calls.map((call) => call.at)).toEqual([0, 1000, 2000, 4000]);
  });

  it('honors Retry-After in seconds', async () => {
    const { client: c, calls } = client([
      { status: 429, headers: { 'Retry-After': '5' } },
      { status: 200 },
    ]);
    await settle(c.get('https://a.example/x'));
    expect(calls.map((call) => call.at)).toEqual([0, 5000]);
  });

  it('honors Retry-After as an HTTP date', async () => {
    const { client: c, calls } = client([
      { status: 503, headers: { 'Retry-After': new Date(T0 + 7000).toUTCString() } },
      { status: 200 },
    ]);
    await settle(c.get('https://a.example/x'));
    expect(calls.map((call) => call.at)).toEqual([0, 7000]);
  });

  it('fails loudly instead of waiting for an excessive Retry-After', async () => {
    const { client: c, calls } = client([
      { status: 429, headers: { 'Retry-After': '3600' } },
      { status: 200 },
    ]);
    const error = await settle(c.get('https://a.example/x'));
    expect(error).toBeInstanceOf(UpstreamError);
    expect(String(error)).toMatch(/Retry-After/);
    expect(calls).toHaveLength(1);
  });

  it('fails later requests to that host fast while an excessive Retry-After holds it', async () => {
    const { client: c, calls } = client([
      { status: 429, headers: { 'Retry-After': '3600' } },
      { status: 200 },
    ]);
    let failedAt: number | undefined;
    const [, second] = (await settle(
      Promise.allSettled([
        c.get('https://a.example/1'),
        c.get('https://a.example/2').catch((error: unknown) => {
          failedAt = Date.now() - T0;
          throw error;
        }),
      ]),
    )) as PromiseSettledResult<unknown>[];
    expect(second?.status).toBe('rejected');
    const reason = second?.status === 'rejected' ? second.reason : undefined;
    expect(reason).toBeInstanceOf(UpstreamError);
    expect(String(reason)).toMatch(/a\.example on hold until/);
    expect(failedAt).toBe(0);
    expect(calls).toHaveLength(1);
  });

  it('sends to that host again once the hold has passed', async () => {
    const { client: c, calls } = client([
      { status: 429, headers: { 'Retry-After': '3600' } },
      { status: 200 },
    ]);
    await settle(c.get('https://a.example/1'));
    // Inside the last minute of the hold: the request waits for it rather than failing or going early.
    vi.setSystemTime(T0 + 3_540_000);
    const response = await settle(c.get('https://a.example/2'));
    expect(response).toMatchObject({ status: 200 });
    expect(calls.map((call) => call.at)).toEqual([0, 3_600_000]);
  });

  it('gives up after maxRetries and names the URL and status', async () => {
    const { client: c, calls } = client(
      [{ status: 503 }, { status: 503 }, { status: 503 }, { status: 503 }, { status: 503 }],
      { maxRetries: 4 },
    );
    const error = await settle(c.get('https://a.example/x'));
    expect(error).toBeInstanceOf(UpstreamError);
    expect(error).toMatchObject({ status: 503, attempts: 5, url: 'https://a.example/x' });
    expect(String(error)).toMatch(/https:\/\/a\.example\/x/);
    expect(String(error)).toMatch(/503/);
    expect(calls).toHaveLength(5);
  });

  it('does not retry a 404', async () => {
    const { client: c, calls } = client([{ status: 404 }, { status: 200 }]);
    const error = await settle(c.get('https://a.example/missing'));
    expect(error).toBeInstanceOf(UpstreamError);
    expect(error).toMatchObject({ status: 404, attempts: 1 });
    expect(calls).toHaveLength(1);
  });

  it('retries a network error', async () => {
    const { client: c, calls } = client([
      { error: new TypeError('fetch failed') },
      { status: 200, body: '{"ok":1}' },
    ]);
    const response = await settle(c.get('https://a.example/x'));
    expect(response).toMatchObject({ status: 200 });
    expect(calls).toHaveLength(2);
  });

  it('aborts a request that exceeds the timeout, retries, and finally throws', async () => {
    const { client: c, calls } = client(['hang', 'hang'], { timeoutMs: 15000, maxRetries: 1 });
    const error = await settle(c.get('https://a.example/slow'));
    expect(error).toBeInstanceOf(UpstreamError);
    expect(String(error)).toMatch(/timed out/);
    // Second attempt starts 1 s (backoff) after the first one timed out at 15 s.
    expect(calls.map((call) => call.at)).toEqual([0, 16000]);
  });

  it('times out a response whose body stalls after the headers', async () => {
    const { client: c, calls } = client(['hang-body'], { timeoutMs: 15000, maxRetries: 0 });
    const error = await settle(c.get('https://a.example/slow-body'));
    expect(error).toBeInstanceOf(UpstreamError);
    expect(String(error)).toMatch(/timed out/);
    expect(calls).toHaveLength(1);
  });

  it('counts every attempt per host, retries included', async () => {
    const { client: c } = client([{ status: 503 }, { status: 200 }, { status: 200 }]);
    await settle(Promise.all([c.get('https://a.example/1'), c.get('https://b.example/1')]));
    // The b.example request consumed the second step; a.example retried once.
    expect(c.stats()).toEqual({
      requests: 3,
      byHost: { 'a.example': 2, 'b.example': 1 },
    });
  });
});

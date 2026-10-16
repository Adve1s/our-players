import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createPoliteClient,
  HttpError,
  type PoliteClientOptions,
  userAgent,
} from '../src/http/polite-client';

const UA = userAgent('0.1.0', 'https://github.com/Adve1s/our-players');
const NOW = Date.parse('2026-10-17T12:00:00Z');

type Reply = (init: RequestInit | undefined) => Response | Promise<Response>;
const ok =
  (body = 'ok'): Reply =>
  () =>
    new Response(body, { status: 200 });
const status =
  (code: number, headers: Record<string, string> = {}): Reply =>
  () =>
    new Response('nope', { status: code, headers });
// Resolves only when aborted, so the request can end only through the client's timeout.
const hang: Reply = (init) =>
  new Promise((_, reject) => {
    init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
  });

function setup(replies: Reply[], opts: Partial<PoliteClientOptions> = {}) {
  const times: number[] = [];
  const fetch = vi.fn<typeof globalThis.fetch>(async (_input, init) => {
    times.push(Date.now());
    const reply = replies.shift();
    if (!reply) throw new Error('unexpected fetch');
    return reply(init);
  });
  const client = createPoliteClient({ userAgent: UA, fetch, random: () => 0, ...opts });
  return { client, fetch, times };
}

// Lets every sleep, spacing wait and timeout fire; returns the settled outcome.
async function settle<T>(p: Promise<T>): Promise<T | unknown> {
  const caught = p.catch((e: unknown) => e);
  await vi.runAllTimersAsync();
  return caught;
}

const gaps = (times: number[]) => times.slice(1).map((t, i) => t - (times[i] ?? 0));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('createPoliteClient', () => {
  it('spaces two requests to the same host by ≥ 1000 ms', async () => {
    const { client, times } = setup([ok(), ok()]);
    await settle(client.get('https://api-web.nhle.com/v1/a'));
    await settle(client.get('https://api-web.nhle.com/v1/b'));
    expect(gaps(times)[0]).toBeGreaterThanOrEqual(1000);
  });

  it('spaces concurrent requests to the same host by ≥ 1000 ms', async () => {
    const { client, times } = setup([ok(), ok(), ok()]);
    await settle(
      Promise.all([
        client.get('https://api-web.nhle.com/v1/a'),
        client.get('https://api-web.nhle.com/v1/b'),
        client.get('https://api-web.nhle.com/v1/c'),
      ]),
    );
    expect(times).toHaveLength(3);
    for (const gap of gaps(times)) expect(gap).toBeGreaterThanOrEqual(1000);
  });

  it('does not delay requests to different hosts', async () => {
    const { client, times } = setup([ok(), ok()]);
    await settle(
      Promise.all([
        client.get('https://api-web.nhle.com/v1/a'),
        client.get('https://api.nhle.com/stats/b'),
      ]),
    );
    expect(times).toEqual([NOW, NOW]);
  });

  it('retries 429 with exponential backoff', async () => {
    const { client, times } = setup([status(429), status(429), status(429), ok('done')]);
    const res = await settle(client.get('https://api-web.nhle.com/v1/a'));
    expect(res).toMatchObject({ status: 200, text: 'done' });
    expect(times).toHaveLength(4);
    const [g0, g1, g2] = gaps(times);
    expect(g0).toBeGreaterThanOrEqual(1000);
    expect(g1).toBeGreaterThanOrEqual(2000);
    expect(g2).toBeGreaterThanOrEqual(4000);
  });

  it('retries 503', async () => {
    const { client, times } = setup([status(503), ok()]);
    const res = await settle(client.get('https://api-web.nhle.com/v1/a'));
    expect(res).toMatchObject({ status: 200 });
    expect(times).toHaveLength(2);
  });

  it('gives up after maxRetries and throws HttpError with the last status', async () => {
    const { client, times } = setup([status(503), status(503), status(503), status(500)]);
    const err = await settle(client.get('https://api-web.nhle.com/v1/a'));
    expect(err).toBeInstanceOf(HttpError);
    expect(err).toMatchObject({ status: 500, url: 'https://api-web.nhle.com/v1/a' });
    expect(times).toHaveLength(4);
  });

  it('honors Retry-After seconds', async () => {
    const { client, times } = setup([status(429, { 'Retry-After': '5' }), ok()]);
    await settle(client.get('https://api-web.nhle.com/v1/a'));
    expect(gaps(times)[0]).toBeGreaterThanOrEqual(5000);
  });

  it('honors Retry-After as an HTTP date', async () => {
    const at = new Date(NOW + 10_000).toUTCString();
    const { client, times } = setup([status(503, { 'Retry-After': at }), ok()]);
    await settle(client.get('https://api-web.nhle.com/v1/a'));
    expect(gaps(times)[0]).toBeGreaterThanOrEqual(10_000);
  });

  it.each([
    ['a past date', new Date(NOW - 60_000).toUTCString()],
    ['an unparsable value', 'soon'],
  ])('ignores %s in Retry-After', async (_label, value) => {
    // baseDelayMs 3000 makes the computed backoff distinguishable from the 1000 ms spacing.
    const { client, times } = setup([status(429, { 'Retry-After': value }), ok()], {
      baseDelayMs: 3000,
    });
    await settle(client.get('https://api-web.nhle.com/v1/a'));
    expect(gaps(times)[0]).toBe(3000);
  });

  it('throws without waiting when Retry-After exceeds 60 s', async () => {
    const { client, times } = setup([status(429, { 'Retry-After': '61' }), ok()]);
    const err = await settle(client.get('https://api-web.nhle.com/v1/a'));
    expect(err).toBeInstanceOf(HttpError);
    expect(err).toMatchObject({ status: 429 });
    expect(times).toEqual([NOW]);
    expect(Date.now()).toBe(NOW);
  });

  it('aborts a request after timeoutMs and retries', async () => {
    const { client, times } = setup([hang, ok('late')]);
    const res = await settle(client.get('https://api-web.nhle.com/v1/a'));
    expect(res).toMatchObject({ status: 200, text: 'late' });
    expect(gaps(times)[0]).toBeGreaterThanOrEqual(15_000);
  });

  it('throws HttpError with null status when every attempt times out', async () => {
    const { client, times } = setup([hang, hang], { maxRetries: 1 });
    const err = await settle(client.get('https://api-web.nhle.com/v1/a'));
    expect(err).toBeInstanceOf(HttpError);
    expect(err).toMatchObject({ status: null });
    expect(times).toHaveLength(2);
  });

  it('does not retry 404', async () => {
    const { client, times } = setup([status(404), ok()]);
    const err = await settle(client.get('https://api-web.nhle.com/v1/a'));
    expect(err).toBeInstanceOf(HttpError);
    expect(err).toMatchObject({ status: 404 });
    expect(times).toHaveLength(1);
  });

  it('sends the User-Agent header', async () => {
    const { client, fetch } = setup([ok()]);
    await settle(client.get('https://api-web.nhle.com/v1/a'));
    const headers = new Headers(fetch.mock.calls[0]?.[1]?.headers);
    expect(headers.get('User-Agent')).toBe(
      'OurPlayers/0.1.0 (+https://github.com/Adve1s/our-players)',
    );
  });

  it('returns url, status, text and its UTF-8 byte length', async () => {
    const { client } = setup([ok('Kārlis')]);
    const res = await settle(client.get('https://api-web.nhle.com/v1/a'));
    expect(res).toEqual({
      url: 'https://api-web.nhle.com/v1/a',
      status: 200,
      text: 'Kārlis',
      bytes: 7,
    });
  });

  it('counts every attempt in requestCount and requestsByHost', async () => {
    const { client } = setup([status(503), ok(), ok()]);
    await settle(client.get('https://api-web.nhle.com/v1/a'));
    await settle(client.get('https://api.nhle.com/stats/b'));
    expect(client.requestCount).toBe(3);
    expect(Object.fromEntries(client.requestsByHost)).toEqual({
      'api-web.nhle.com': 2,
      'api.nhle.com': 1,
    });
  });
});

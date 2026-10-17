export type PoliteClientOptions = {
  userAgent: string;
  fetch?: typeof globalThis.fetch;
  minIntervalMs?: number;
  timeoutMs?: number;
  maxRetries?: number;
  baseDelayMs?: number;
  maxRetryAfterMs?: number;
  random?: () => number;
};

export type PoliteResponse = { url: string; status: number; text: string; bytes: number };

export class HttpError extends Error {
  readonly url: string;
  /** null = network error or timeout */
  readonly status: number | null;
  constructor(url: string, status: number | null, message: string) {
    super(message);
    this.name = 'HttpError';
    this.url = url;
    this.status = status;
  }
}

export type PoliteClient = {
  get(url: string): Promise<PoliteResponse>;
  readonly requestCount: number;
  readonly requestsByHost: ReadonlyMap<string, number>;
};

export function userAgent(version: string, contactUrl: string): string {
  return `OurPlayers/${version} (+${contactUrl})`;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const isRetryable = (status: number) => status === 429 || status >= 500;

/** Milliseconds to wait, or undefined when the header is absent, unparsable or in the past. */
function retryAfterMs(value: string | null, now: number): number | undefined {
  if (value === null) return undefined;
  if (/^\d+$/.test(value.trim())) return Number(value.trim()) * 1000;
  const at = Date.parse(value);
  return Number.isNaN(at) || at <= now ? undefined : at - now;
}

export function createPoliteClient(o: PoliteClientOptions): PoliteClient {
  const {
    fetch = globalThis.fetch,
    minIntervalMs = 1000,
    timeoutMs = 15_000,
    maxRetries = 3,
    baseDelayMs = 1000,
    maxRetryAfterMs = 60_000,
    random = Math.random,
  } = o;
  const nextAllowed = new Map<string, number>();
  // A retry pause covers the whole host, including requests that already reserved a slot.
  const pausedUntil = new Map<string, number>();
  const requestsByHost = new Map<string, number>();
  let requestCount = 0;

  // Slots are reserved synchronously, so concurrent callers queue instead of bursting.
  async function waitTurn(host: string): Promise<void> {
    for (;;) {
      const now = Date.now();
      const at = Math.max(now, nextAllowed.get(host) ?? 0);
      nextAllowed.set(host, at + minIntervalMs);
      if (at > now) await sleep(at - now);
      const paused = (pausedUntil.get(host) ?? 0) - Date.now();
      if (paused <= 0) return;
      await sleep(paused);
    }
  }

  type Reply = { status: number; retryAfter: string | null; text: string };

  async function attempt(url: string): Promise<Reply | HttpError> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': o.userAgent },
        signal: controller.signal,
      });
      // The body is read under the same timeout so a stalled stream also aborts.
      return {
        status: res.status,
        retryAfter: res.headers.get('retry-after'),
        text: await res.text(),
      };
    } catch (e) {
      const reason = controller.signal.aborted
        ? `timed out after ${timeoutMs} ms`
        : e instanceof Error
          ? e.message
          : String(e);
      return new HttpError(url, null, `GET ${url} failed: ${reason}`);
    } finally {
      clearTimeout(timer);
    }
  }

  async function get(url: string): Promise<PoliteResponse> {
    const host = new URL(url).hostname;
    for (let n = 0; ; n++) {
      await waitTurn(host);
      requestCount++;
      requestsByHost.set(host, (requestsByHost.get(host) ?? 0) + 1);
      const res = await attempt(url);
      const status = res instanceof HttpError ? null : res.status;

      if (!(res instanceof HttpError)) {
        if (res.status >= 200 && res.status < 300) {
          return {
            url,
            status: res.status,
            text: res.text,
            bytes: Buffer.byteLength(res.text, 'utf8'),
          };
        }
        if (!isRetryable(res.status))
          throw new HttpError(url, res.status, `GET ${url} → ${res.status}`);
      }
      if (n >= maxRetries) {
        throw res instanceof HttpError
          ? res
          : new HttpError(url, status, `GET ${url} → ${status} after ${n + 1} attempts`);
      }

      let delay = baseDelayMs * 2 ** n + random() * baseDelayMs;
      const ra = res instanceof HttpError ? undefined : retryAfterMs(res.retryAfter, Date.now());
      if (ra !== undefined) {
        // A long Retry-After would stall the job; the next scheduled run retries instead.
        if (ra > maxRetryAfterMs) {
          throw new HttpError(
            url,
            status,
            `GET ${url} → ${status}, Retry-After ${ra} ms exceeds limit`,
          );
        }
        delay = ra;
      }
      const until = Date.now() + delay;
      pausedUntil.set(host, until);
      nextAllowed.set(host, Math.max(nextAllowed.get(host) ?? 0, until));
    }
  }

  return {
    get,
    get requestCount() {
      return requestCount;
    },
    requestsByHost,
  };
}

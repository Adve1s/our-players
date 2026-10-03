export interface PoliteClientOptions {
  userAgent: string;
  fetch?: typeof fetch;
  minIntervalMs?: number;
  timeoutMs?: number;
  maxRetries?: number;
  baseBackoffMs?: number;
  maxBackoffMs?: number;
  maxRetryAfterMs?: number;
  random?: () => number;
  log?: (message: string) => void;
}

export interface PoliteResponse {
  url: string;
  status: number;
  headers: Headers;
  body: string;
  bytes: number;
}

export interface PoliteClientStats {
  requests: number;
  byHost: Record<string, number>;
}

export interface PoliteClient {
  get(url: string): Promise<PoliteResponse>;
  stats(): PoliteClientStats;
}

export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly url: string,
    readonly attempts: number,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'UpstreamError';
  }
}

interface HostState {
  tail: Promise<unknown>;
  nextAllowedAt: number;
}

type Attempt =
  | { kind: 'response'; response: PoliteResponse }
  | { kind: 'status'; status: number; retryAfterMs: number | undefined }
  | { kind: 'failure'; reason: string };

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function sleep(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

function parseRetryAfter(value: string | null, now: number): number | undefined {
  if (value === null) return undefined;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed) * 1000;
  const date = Date.parse(trimmed);
  return Number.isNaN(date) ? undefined : Math.max(0, date - now);
}

export function createPoliteClient(options: PoliteClientOptions): PoliteClient {
  const {
    userAgent,
    fetch: fetchFn = globalThis.fetch,
    minIntervalMs = 1000,
    timeoutMs = 15_000,
    maxRetries = 4,
    baseBackoffMs = 1000,
    maxBackoffMs = 30_000,
    maxRetryAfterMs = 120_000,
    random = Math.random,
    log = (message: string) => console.warn(message),
  } = options;

  const hosts = new Map<string, HostState>();
  const byHost: Record<string, number> = {};
  let requests = 0;

  async function attempt(url: string): Promise<Attempt> {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(new Error(`timed out after ${timeoutMs} ms`)),
      timeoutMs,
    );
    try {
      const response = await fetchFn(url, {
        headers: { 'User-Agent': userAgent, Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) {
        // Drain the body so the connection can be reused.
        await response.arrayBuffer().catch(() => undefined);
        return {
          kind: 'status',
          status: response.status,
          retryAfterMs: parseRetryAfter(response.headers.get('retry-after'), Date.now()),
        };
      }
      const raw = await response.arrayBuffer();
      return {
        kind: 'response',
        response: {
          url,
          status: response.status,
          headers: response.headers,
          body: new TextDecoder().decode(raw),
          bytes: raw.byteLength,
        },
      };
    } catch (error) {
      if (controller.signal.aborted)
        return { kind: 'failure', reason: `timed out after ${timeoutMs} ms` };
      return { kind: 'failure', reason: error instanceof Error ? error.message : String(error) };
    } finally {
      clearTimeout(timer);
    }
  }

  async function run(url: string, host: string, state: HostState): Promise<PoliteResponse> {
    let retryAt = 0;
    for (let attemptNo = 1; ; attemptNo++) {
      // A hold longer than we'd ever wait comes from an excessive Retry-After: fail now rather
      // than stall a job silently until it lifts.
      if (state.nextAllowedAt - Date.now() > maxRetryAfterMs) {
        const until = new Date(state.nextAllowedAt).toISOString();
        throw new UpstreamError(`${url}: ${host} on hold until ${until}`, url, attemptNo - 1);
      }
      const startAt = Math.max(state.nextAllowedAt, retryAt);
      await sleep(startAt - Date.now());
      state.nextAllowedAt = Date.now() + minIntervalMs;
      requests++;
      byHost[host] = (byHost[host] ?? 0) + 1;

      const result = await attempt(url);
      if (result.kind === 'response') return result.response;

      const what = result.kind === 'status' ? `HTTP ${result.status}` : result.reason;
      const status = result.kind === 'status' ? result.status : undefined;
      const retryable = result.kind === 'failure' || isRetryableStatus(result.status);
      if (!retryable || attemptNo > maxRetries) {
        throw new UpstreamError(
          `${url}: ${what} after ${attemptNo} attempt(s)`,
          url,
          attemptNo,
          status,
        );
      }

      const retryAfterMs = result.kind === 'status' ? result.retryAfterMs : undefined;
      if (retryAfterMs !== undefined && retryAfterMs > maxRetryAfterMs) {
        // We give up on this URL, but the server asked the whole host to wait.
        state.nextAllowedAt = Date.now() + retryAfterMs;
        throw new UpstreamError(
          `${url}: ${what} with Retry-After ${retryAfterMs} ms, above the ${maxRetryAfterMs} ms limit`,
          url,
          attemptNo,
          status,
        );
      }
      // Full jitter spreads retries out; Retry-After, when given, is the server's word.
      const backoff = Math.min(maxBackoffMs, baseBackoffMs * 2 ** (attemptNo - 1));
      const delay = retryAfterMs ?? random() * backoff;
      retryAt = Date.now() + delay;
      log(`${url}: ${what}; retry ${attemptNo}/${maxRetries} in ${Math.round(delay)} ms`);
    }
  }

  return {
    get(url) {
      const host = new URL(url).host;
      let state = hosts.get(host);
      if (!state) {
        state = { tail: Promise.resolve(), nextAllowedAt: 0 };
        hosts.set(host, state);
      }
      const current = state;
      // One request per host at a time: each waits for the previous one to settle.
      const result = current.tail.then(() => run(url, host, current));
      current.tail = result.catch(() => undefined);
      return result;
    },
    stats() {
      return { requests, byHost: { ...byHost } };
    },
  };
}

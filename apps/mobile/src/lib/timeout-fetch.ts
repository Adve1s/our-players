import type { FetchLike } from '@our-players/shared';

type Fetch = (url: string, init: { signal: AbortSignal }) => ReturnType<FetchLike>;

// expo/fetch on Android uses React Native's OkHttp client, which has no connect/read timeout,
// so a dropped host spins for ~2 min.
// The timer is never cleared: it also bounds the body read, and a late abort is a no-op.
export const withTimeout =
  (fetch: Fetch, ms: number): FetchLike =>
  (url) => {
    const ctl = new AbortController();
    setTimeout(() => ctl.abort(), ms);
    return fetch(url, { signal: ctl.signal });
  };

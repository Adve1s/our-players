import { HttpError } from '../src/http/polite-client';
import type { JobClient } from '../src/jobs/runner';

// Serves recorded payloads by URL; an unknown URL is a 404, so a job asking for more than the test expects fails loudly.
export function fakeClient(routes: Record<string, unknown>): JobClient & { requests: string[] } {
  const requests: string[] = [];
  return {
    requests,
    get requestCount() {
      return requests.length;
    },
    async get(url) {
      requests.push(url);
      if (!Object.hasOwn(routes, url)) throw new HttpError(url, 404, `HTTP 404 ${url}`);
      const text = JSON.stringify(routes[url]);
      return { url, status: 200, text, bytes: Buffer.byteLength(text, 'utf8') };
    },
  };
}

import { getConnInfo } from '@hono/node-server/conninfo';
import type { ErrorResponse } from '@our-players/shared';
import type { Context, MiddlewareHandler } from 'hono';

// shortcut: one key per address, so an IPv6 client could rotate through its /64 for fresh budgets; the API has only an A record, key IPv6 by its /64 if an AAAA record is added.
function clientKey(c: Context): string {
  // The last X-Forwarded-For entry is the one Caddy added; port 3001 isn't published, so it can't be forged.
  const xff = c.req.header('X-Forwarded-For')?.split(',').at(-1)?.trim();
  if (xff) return xff;
  try {
    return getConnInfo(c).remote.address ?? 'unknown';
  } catch {
    // No Node socket (app.request in tests).
    return 'unknown';
  }
}

// Fixed windows: one counter map, swapped out when the window changes, so memory stays bounded by one window's IPs.
export function rateLimit(opts: {
  limit: number;
  windowMs: number;
  now: () => Date;
}): MiddlewareHandler {
  let window = -1;
  let counts = new Map<string, number>();
  return async (c, next) => {
    const now = opts.now().getTime();
    const current = Math.floor(now / opts.windowMs);
    if (current !== window) {
      window = current;
      counts = new Map();
    }
    const key = clientKey(c);
    const count = (counts.get(key) ?? 0) + 1;
    counts.set(key, count);
    if (count > opts.limit) {
      const retryAfter = Math.max(1, Math.ceil(((current + 1) * opts.windowMs - now) / 1000));
      c.header('Retry-After', String(retryAfter));
      return c.json(
        {
          error: { code: 'RATE_LIMITED', message: 'too many requests, try again in a minute' },
        } satisfies ErrorResponse,
        429,
      );
    }
    await next();
  };
}

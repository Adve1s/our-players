import {
  type DataHealthResponse,
  type ErrorResponse,
  gameDateSchema,
  idsQuerySchema,
  type Prefs,
  prefsQuerySchema,
  publicIdSchema,
  searchQuerySchema,
} from '@our-players/shared';
import { type Context, Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { secureHeaders } from 'hono/secure-headers';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { z } from 'zod';
import type { Db } from '../db/client';
import { searchName } from '../db/players';
import type { Logger } from '../jobs/runner';
import { loadCountries } from './countries';
import { loadDataHealth } from './data-health';
import { loadDay, loadGame } from './day';
import { loadHealth, loadMeta } from './meta';
import { loadPlayer, playersByIds, searchPlayers } from './players';
import { rateLimit } from './rate-limit';

// corsOrigins absent: no browser origin may read /v1. rateLimitPerMinute absent: no limit.
export type ApiDeps = {
  db: Db;
  now: () => Date;
  log: Logger;
  corsOrigins?: readonly string[];
  rateLimitPerMinute?: number;
};

export function badRequest(message: string): HTTPException {
  return new HTTPException(400, { message });
}

function parse<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) throw badRequest(z.prettifyError(result.error));
  return result.data;
}

// A repeated parameter we read is a client bug; taking one of the values would silently drop the other.
// Other parameters are ignored, repeated or not, so cache-busters still work.
function rejectRepeated(c: Context, names: readonly string[]): void {
  for (const name of names) {
    if ((c.req.queries(name)?.length ?? 0) > 1) throw badRequest(`${name}: given more than once`);
  }
}

export function parseQuery(c: Context): Prefs {
  rejectRepeated(c, Object.keys(prefsQuerySchema.in.shape));
  return parse(prefsQuerySchema, c.req.query());
}

const dateParam = z.object({ gameDate: gameDateSchema });
const gameParam = z.object({ gameId: publicIdSchema });
const playerParam = z.object({ playerId: publicIdSchema });
// Browsers and the app's OkHttp keep nothing (they'd hand the app a stale day); a shared cache (CDN) may keep 60 s (D-051).
const CACHE_CONTROL = 'public, max-age=0, s-maxage=60';

const errorBody = (c: Context, status: ContentfulStatusCode, code: string, message: string) =>
  c.json({ error: { code, message } } satisfies ErrorResponse, status);

export function createApp({ db, now, log, corsOrigins = [], rateLimitPerMinute }: ApiDeps): Hono {
  const app = new Hono();

  // Caddy adds no security headers, so the API sends them itself on every response (S16 H1).
  app.use(secureHeaders());

  // c.req.path has no query string, so preferences (countries, favorites) never reach the logs.
  app.use(async (c, next) => {
    const start = performance.now();
    await next();
    log.info('request', {
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      ms: Math.round(performance.now() - start),
    });
  });

  app.use('/v1/*', cors({ origin: [...corsOrigins], allowMethods: ['GET'] }));
  // After CORS, so a browser can read the 429.
  if (rateLimitPerMinute !== undefined) {
    app.use('/v1/*', rateLimit({ limit: rateLimitPerMinute, windowMs: 60_000, now }));
  }

  app.onError((err, c) => {
    // Only our own 400s echo their message; any other status takes the generic, logged 500.
    if (err instanceof HTTPException && err.status === 400) {
      return errorBody(c, 400, 'BAD_REQUEST', err.message);
    }
    log.error('request failed', { method: c.req.method, path: c.req.path, error: err.message });
    return errorBody(c, 500, 'INTERNAL', 'internal error');
  });

  app.notFound((c) => errorBody(c, 404, 'NOT_FOUND', `no route ${c.req.method} ${c.req.path}`));

  app.get('/health', async (c) => {
    try {
      return c.json(await loadHealth(db));
    } catch (e) {
      log.error('health check failed', { error: e instanceof Error ? e.message : String(e) });
      return errorBody(c, 503, 'UNAVAILABLE', 'database unavailable');
    }
  });

  // For an external uptime monitor: 503 while ingestion has stalled, naming what is stale.
  app.get('/health/data', async (c) => {
    let reasons: string[];
    try {
      reasons = await loadDataHealth(db, now());
    } catch (e) {
      log.error('data health check failed', { error: e instanceof Error ? e.message : String(e) });
      return errorBody(c, 503, 'UNAVAILABLE', 'database unavailable');
    }
    if (reasons.length > 0) return errorBody(c, 503, 'STALE', reasons.join('; '));
    return c.json({ ok: true } satisfies DataHealthResponse);
  });

  app.get('/v1/meta', async (c) => c.json(await loadMeta(db, now())));

  app.get('/v1/days/:gameDate', async (c) => {
    const { gameDate } = parse(dateParam, c.req.param());
    const body = await loadDay(db, gameDate, parseQuery(c));
    c.header('Cache-Control', CACHE_CONTROL);
    return c.json(body);
  });

  app.get('/v1/games/:gameId', async (c) => {
    const { gameId } = parse(gameParam, c.req.param());
    const body = await loadGame(db, gameId, parseQuery(c));
    if (!body) return errorBody(c, 404, 'NOT_FOUND', `no game ${gameId}`);
    c.header('Cache-Control', CACHE_CONTROL);
    return c.json(body);
  });

  // Before /v1/players/:playerId, so "search" is never read as a player ID.
  app.get('/v1/players/search', async (c) => {
    rejectRepeated(c, ['q']);
    const term = searchName(parse(searchQuerySchema, c.req.query()).q);
    // Only combining marks: an empty term would match everyone.
    if (term === '') throw badRequest('q: nothing to search for');
    return c.json(await searchPlayers(db, term, parseQuery(c).leagues));
  });

  app.get('/v1/players', async (c) => {
    rejectRepeated(c, ['ids']);
    const { ids } = parse(idsQuerySchema, c.req.query());
    return c.json(await playersByIds(db, ids));
  });

  app.get('/v1/players/:playerId', async (c) => {
    const { playerId } = parse(playerParam, c.req.param());
    const body = await loadPlayer(db, playerId, now());
    if (!body) return errorBody(c, 404, 'NOT_FOUND', `no player ${playerId}`);
    return c.json(body);
  });

  app.get('/v1/countries', async (c) => c.json(await loadCountries(db, parseQuery(c).leagues)));

  return app;
}

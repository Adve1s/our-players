import {
  type ErrorResponse,
  gameDateSchema,
  type Prefs,
  prefsQuerySchema,
  publicIdSchema,
} from '@our-players/shared';
import { type Context, Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { z } from 'zod';
import type { Db } from '../db/client';
import type { Logger } from '../jobs/runner';
import { loadDay, loadGame } from './day';
import { loadHealth, loadMeta } from './meta';

export type ApiDeps = { db: Db; now: () => Date; log: Logger };

export function badRequest(message: string): HTTPException {
  return new HTTPException(400, { message });
}

function parse<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) throw badRequest(z.prettifyError(result.error));
  return result.data;
}

// A repeated preference is a client bug; taking one of the values would silently drop the other.
// Other parameters are ignored, repeated or not, so cache-busters still work.
export function parseQuery(c: Context): Prefs {
  for (const name of Object.keys(prefsQuerySchema.in.shape)) {
    if ((c.req.queries(name)?.length ?? 0) > 1) throw badRequest(`${name}: given more than once`);
  }
  return parse(prefsQuerySchema, c.req.query());
}

const dateParam = z.object({ gameDate: gameDateSchema });
const gameParam = z.object({ gameId: publicIdSchema });
const CACHE_CONTROL = 'public, max-age=60, stale-while-revalidate=300';

const errorBody = (c: Context, status: ContentfulStatusCode, code: string, message: string) =>
  c.json({ error: { code, message } } satisfies ErrorResponse, status);

export function createApp({ db, now, log }: ApiDeps): Hono {
  const app = new Hono();

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

  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      return errorBody(c, err.status, err.status === 400 ? 'BAD_REQUEST' : 'INTERNAL', err.message);
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

  return app;
}

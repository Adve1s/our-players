import type { ErrorResponse } from '@our-players/shared';
import { type Context, Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { Db } from '../db/client';
import type { Logger } from '../jobs/runner';
import { loadHealth } from './meta';

export type ApiDeps = { db: Db; now: () => Date; log: Logger };

export function badRequest(message: string): HTTPException {
  return new HTTPException(400, { message });
}

const errorBody = (c: Context, status: ContentfulStatusCode, code: string, message: string) =>
  c.json({ error: { code, message } } satisfies ErrorResponse, status);

export function createApp({ db, log }: ApiDeps): Hono {
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

  return app;
}

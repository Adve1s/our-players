import type { z } from 'zod';
import {
  countriesResponseSchema,
  dayResponseSchema,
  errorResponseSchema,
  gameResponseSchema,
  metaResponseSchema,
  playerResponseSchema,
  playersResponseSchema,
} from './contract';
import type { League } from './enums';
import type { Prefs } from './selection';

// Structural, so both the global fetch and Hono's app.request fit.
export type FetchLike = (
  url: string,
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export class ApiError extends Error {
  override readonly name = 'ApiError';
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

// Sets go out sorted, so equal sets give the same URL (the app's cache key).
const sorted = (set: ReadonlySet<string>) => [...set].sort().join(',');

// All four keys always.
const prefsQuery = (p: Prefs) => ({
  leagues: sorted(p.leagues),
  countries: sorted(p.countries),
  fav: sorted(p.favorites),
  hide: sorted(p.hidden),
});

export function createApiClient(baseUrl: string, fetch: FetchLike) {
  async function get<S extends z.ZodType>(
    path: string,
    schema: S,
    query?: Record<string, string>,
  ): Promise<z.output<S>> {
    const qs = query ? `?${new URLSearchParams(query)}` : '';
    const res = await fetch(`${baseUrl}${path}${qs}`);
    if (res.ok) return schema.parse(await res.json());
    // A proxy's HTML error page is not JSON: fall back to the status alone.
    const body = await res.json().catch(() => null);
    const err = errorResponseSchema.safeParse(body);
    if (err.success) throw new ApiError(res.status, err.data.error.code, err.data.error.message);
    throw new ApiError(res.status, 'HTTP_ERROR', `HTTP ${res.status}`);
  }
  const seg = encodeURIComponent;

  return {
    meta: () => get('/v1/meta', metaResponseSchema),
    day: (gameDate: string, prefs: Prefs) =>
      get(`/v1/days/${seg(gameDate)}`, dayResponseSchema, prefsQuery(prefs)),
    game: (gameId: string, prefs: Prefs) =>
      get(`/v1/games/${seg(gameId)}`, gameResponseSchema, prefsQuery(prefs)),
    searchPlayers: (q: string, leagues: ReadonlySet<League>) =>
      get('/v1/players/search', playersResponseSchema, { q, leagues: sorted(leagues) }),
    players: (ids: readonly string[]) =>
      get('/v1/players', playersResponseSchema, { ids: ids.join(',') }),
    player: (id: string) => get(`/v1/players/${seg(id)}`, playerResponseSchema),
    countries: (leagues: ReadonlySet<League>) =>
      get('/v1/countries', countriesResponseSchema, { leagues: sorted(leagues) }),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

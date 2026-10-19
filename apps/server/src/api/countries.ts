import type { CountriesResponse, CountryCode, League } from '@our-players/shared';
import { and, count, eq, inArray, isNotNull } from 'drizzle-orm';
import type { Db } from '../db/client';
import { players } from '../db/schema';

export async function loadCountries(
  db: Db,
  leagues: ReadonlySet<League>,
): Promise<CountriesResponse> {
  const rows = await db
    .select({ code: players.nationality, league: players.league, n: count() })
    .from(players)
    .where(
      and(
        eq(players.active, true),
        isNotNull(players.nationality),
        inArray(players.league, [...leagues]),
      ),
    )
    .groupBy(players.nationality, players.league);
  const byCode = new Map<CountryCode, CountriesResponse['countries'][number]['counts']>();
  for (const { code, league, n } of rows) {
    if (code === null) continue;
    byCode.set(code, { ...byCode.get(code), [league]: n });
  }
  return {
    countries: [...byCode]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([code, counts]) => ({ code, counts })),
  };
}

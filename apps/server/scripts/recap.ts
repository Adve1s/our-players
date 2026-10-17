import { leagueSchema, type Prefs } from '@our-players/shared';
import { parseRecapArgs } from '../src/cli-args';
import { openDb } from '../src/db/client';
import { gameDayRows } from '../src/game-day-rows';
import { formatRecap, loadRecap } from '../src/recap';

const USAGE = 'usage: pnpm recap --date YYYY-MM-DD [--countries LVA[,EST…]]';

async function main(): Promise<void> {
  let parsed: ReturnType<typeof parseRecapArgs>;
  try {
    parsed = parseRecapArgs(process.argv.slice(2));
  } catch (e) {
    console.error(USAGE);
    throw e;
  }
  const { date, countries } = parsed;
  const prefs: Prefs = {
    leagues: new Set(leagueSchema.options),
    countries: new Set(countries),
    favorites: new Set(),
    hidden: new Set(),
  };
  // No migrate: the recap only reads.
  const handle = openDb();
  try {
    console.log(formatRecap(date, countries, gameDayRows(await loadRecap(handle.db, date), prefs)));
  } finally {
    await handle.close();
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
});

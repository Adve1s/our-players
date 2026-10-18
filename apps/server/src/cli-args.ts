import { parseArgs } from 'node:util';
import { type CountryCode, countryCodeSchema } from '@our-players/shared';
import { JOBS, type JobName } from './jobs';
import type { JobArgs } from './jobs/runner';

function realDate(flag: string, value: string): string {
  const ok =
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  if (!ok) throw new Error(`invalid date ${flag} ${value} (want a real YYYY-MM-DD)`);
  return value;
}

export function parseJobArgs(argv: string[]): { name: JobName; args: JobArgs } {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      league: { type: 'string', default: 'nhl' },
      date: { type: 'string' },
      from: { type: 'string' },
      to: { type: 'string' },
    },
  });
  const [name, ...extra] = positionals;
  if (name === undefined || !Object.hasOwn(JOBS, name))
    throw new Error(`unknown job "${name ?? ''}"; valid: ${Object.keys(JOBS).join(', ')}`);
  if (extra.length > 0) throw new Error(`unexpected argument "${extra.join(' ')}"`);
  const league = values.league.toLowerCase();
  if (league === 'nba') throw new Error('nba arrives in S05');
  if (league !== 'nhl') throw new Error(`unknown league "${values.league}"; valid: nhl`);

  const args: JobArgs = { league: 'NHL' };
  if (values.date !== undefined) args.date = realDate('--date', values.date);
  if (values.from !== undefined) args.from = realDate('--from', values.from);
  if (values.to !== undefined) args.to = realDate('--to', values.to);
  // A manual run is rare and deliberate, so it retries old corrections; only scheduler ticks keep the 24 h bound.
  if (name === 'results') args.catchUp = true;
  if (name === 'backfill') {
    if (args.from === undefined || args.to === undefined)
      throw new Error('backfill needs --from and --to');
    if (args.date !== undefined) throw new Error('backfill takes --from/--to, not --date');
    if (args.from > args.to) throw new Error('--from is after --to');
  } else if (args.from !== undefined || args.to !== undefined) {
    throw new Error('only backfill takes --from/--to');
  }
  return { name: name as JobName, args };
}

export function parseRecapArgs(argv: string[]): { date: string; countries: CountryCode[] } {
  const { values } = parseArgs({
    args: argv,
    options: { date: { type: 'string' }, countries: { type: 'string', default: 'LVA' } },
  });
  if (values.date === undefined) throw new Error('recap needs --date YYYY-MM-DD');
  const countries = values.countries.split(',').map((c) => {
    const parsed = countryCodeSchema.safeParse(c.trim().toUpperCase());
    if (!parsed.success) throw new Error(`unknown country code ${c}`);
    return parsed.data;
  });
  return { date: realDate('--date', values.date), countries };
}

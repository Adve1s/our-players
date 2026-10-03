// Throwaway spike (S01): pnpm spike --date YYYY-MM-DD prints Latvians' lines for that game day.
// Replaced by `pnpm recap` in S04a.
import { parseArgs } from 'node:util';
import { loadConfig } from '../../src/config';
import { upstreamClient } from '../../src/http/upstream';
import { nbaLines } from './nba';
import { nhlLines } from './nhl';

const { values } = parseArgs({ options: { date: { type: 'string' } } });
if (!values.date || !/^\d{4}-\d{2}-\d{2}$/.test(values.date)) {
  console.error('Usage: pnpm spike --date YYYY-MM-DD');
  process.exit(2);
}

const client = upstreamClient(loadConfig(process.env));
const started = performance.now();
// The two leagues live on different hosts, so they can run side by side within the per-host limit.
const [nhl, nba] = await Promise.all([
  nhlLines(client, values.date),
  nbaLines(client, values.date),
]);
console.log([`Latvians on ${values.date}`, ...nhl, ...nba].join('\n'));
const { requests, byHost } = client.stats();
console.log(
  `\nrequests: ${requests} (${Object.entries(byHost)
    .map(([host, count]) => `${host} ${count}`)
    .join(', ')})  runtime: ${((performance.now() - started) / 1000).toFixed(1)} s`,
);

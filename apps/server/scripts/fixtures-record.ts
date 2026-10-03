// pnpm fixtures:record <source> <endpoint> <id-or-date> [--as <name>] [--force]
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { loadConfig } from '../src/config';
import { fixtureSources, recordFixture } from '../src/fixtures/record';
import { upstreamClient } from '../src/http/upstream';

const FIXTURES_ROOT = fileURLToPath(new URL('../test/fixtures', import.meta.url));

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { as: { type: 'string' }, force: { type: 'boolean', default: false } },
});

const [source, endpoint, id] = positionals;
if (!source || !endpoint || !id || positionals.length > 3) {
  const known = Object.entries(fixtureSources)
    .map(([name, endpoints]) => `  ${name}: ${Object.keys(endpoints).join(', ')}`)
    .join('\n');
  console.error(
    `Usage: pnpm fixtures:record <source> <endpoint> <id-or-date> [--as <name>] [--force]\n${known}`,
  );
  process.exit(2);
}

const client = upstreamClient(loadConfig(process.env));
try {
  const { path, meta } = await recordFixture({
    source,
    endpoint,
    id,
    as: values.as,
    force: values.force,
    client,
    root: FIXTURES_ROOT,
    now: () => new Date(),
  });
  console.log(`${meta.status} ${meta.bytes} bytes ${meta.url}\n  → ${path}`);
  console.log(`requests: ${client.stats().requests}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { loadConfig } from '../src/config';
import { recordFixture } from '../src/fixtures/record-fixture';
import { createPoliteClient, userAgent } from '../src/http/polite-client';
import { endpoints } from './endpoints';

const USAGE = 'usage: pnpm fixtures:record <source> <endpoint> <id> [--as <name>] [--force]';

async function main(): Promise<number> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { as: { type: 'string' }, force: { type: 'boolean', default: false } },
  });
  const [source, endpoint, id] = positionals;
  if (positionals.length !== 3 || source === undefined || endpoint === undefined || !id) {
    console.error(USAGE);
    return 1;
  }
  if (!Object.hasOwn(endpoints, source)) {
    console.error(`unknown source "${source}"; valid: ${Object.keys(endpoints).join(', ')}`);
    return 1;
  }
  const table = endpoints[source as keyof typeof endpoints];
  const build = Object.hasOwn(table, endpoint) ? table[endpoint] : undefined;
  if (build === undefined) {
    console.error(
      `unknown endpoint "${endpoint}" for ${source}; valid: ${Object.keys(table).join(', ')}`,
    );
    return 1;
  }

  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as {
    version: string;
  };
  const client = createPoliteClient({
    userAgent: userAgent(pkg.version, loadConfig(process.env).contactUrl),
  });
  try {
    const r = await recordFixture({
      client,
      now: () => new Date(),
      root: fileURLToPath(new URL('../test/fixtures', import.meta.url)),
      source,
      endpoint,
      name: values.as ?? id,
      url: build(id),
      force: values.force,
    });
    console.log(`${r.jsonPath} (${r.bytes} bytes)`);
    return 0;
  } finally {
    console.log(`requests: ${client.requestCount}`);
  }
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (e: unknown) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exitCode = 1;
  },
);

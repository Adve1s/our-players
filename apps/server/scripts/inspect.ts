import { parseArgs } from 'node:util';
import { inspectFixture } from '../src/fixtures/inspect';

const USAGE = 'usage: pnpm inspect <source> <endpoint> <fixture-id>';

async function main(): Promise<void> {
  const { positionals } = parseArgs({ allowPositionals: true });
  const [source, endpoint, id] = positionals;
  if (positionals.length !== 3 || source === undefined || endpoint === undefined || !id)
    throw new Error('expected three arguments');
  console.log(JSON.stringify(await inspectFixture(source, endpoint, id), null, 2));
}

main().catch((e: unknown) => {
  console.error(USAGE);
  console.error(e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
});

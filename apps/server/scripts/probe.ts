import { readFile } from 'node:fs/promises';
import { hostname } from 'node:os';
import { loadConfig } from '../src/config';
import { userAgent } from '../src/http/polite-client';
import { probeTargets, runProbe } from '../src/probe';

const now = new Date();
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as {
  version: string;
};
const ua = userAgent(pkg.version, loadConfig(process.env).contactUrl);

console.log(`probe from ${hostname()} at ${now.toISOString()} as ${ua}`);
const targets = probeTargets(now);
const { lines, failed } = await runProbe(targets, { userAgent: ua, fetch });
for (const line of lines) console.log(line);
console.log(`${targets.length - failed}/${targets.length} ok`);
process.exitCode = failed === 0 ? 0 : 1;

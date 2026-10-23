// TS 6 loads no @types by default, and this Node script needs them.
/// <reference types="node" />
import { existsSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { join, resolve } from 'node:path';
import { serveWeb } from './web-server';

const DIR = resolve('dist');
const PORT = 8090;

if (!existsSync(join(DIR, 'index.html'))) {
  console.error(`${join(DIR, 'index.html')} is missing: run pnpm build:web first`);
  process.exit(1);
}

// 0.0.0.0 so a phone on the same Wi-Fi can open it.
// No top-level await: tsx runs this package's scripts as CommonJS.
serveWeb({ dir: DIR, port: PORT, host: '0.0.0.0' })
  .then(() => {
    const lan = Object.values(networkInterfaces())
      .flat()
      .filter((a) => a?.family === 'IPv4' && !a.internal)
      .map((a) => `http://${a?.address}:${PORT}`);
    console.log(`serving ${DIR} on\n${[`http://localhost:${PORT}`, ...lan].join('\n')}`);
  })
  .catch((e: unknown) => {
    console.error(`can't serve on port ${PORT}: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  });

// TS 6 loads no @types by default, and this Node script needs them.
/// <reference types="node" />
import { readFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

// `expo serve` only serves <project>/dist, so a tiny static server with the single-page fallback.
export function serveWeb(opts: { dir: string; port: number; host: string }): Promise<Server> {
  const dir = resolve(opts.dir);
  const s = createServer(async (req, res) => {
    let body: Buffer;
    let type: string;
    try {
      // Inside the try: malformed percent-encoding (`/%E0%A4%A`) falls back instead of rejecting.
      const path = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
      const file = resolve(dir, `.${path}`);
      type = TYPES[extname(file)] ?? 'application/octet-stream';
      if (!file.startsWith(dir + sep)) throw new Error('outside the export');
      body = await readFile(file);
    } catch {
      // Unknown paths (deep links like /settings, directories) get the app's index.html.
      body = await readFile(join(dir, 'index.html'));
      type = TYPES['.html'] ?? 'text/html';
    }
    res.writeHead(200, { 'content-type': type }).end(body);
  });
  return new Promise((ok, fail) => {
    s.once('error', fail);
    s.listen(opts.port, opts.host, () => ok(s));
  });
}

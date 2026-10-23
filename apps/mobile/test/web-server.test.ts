/// <reference types="node" />
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { get, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { serveWeb } from '../scripts/web-server';

const SECRET = `web-server-secret-${process.pid}-${Date.now()}.txt`;
let tmp: string;
let server: Server;

// node:http, not fetch: the test setup disables fetch, and the raw path must reach the server unnormalised.
function request(
  path: string,
  to: Server = server,
): Promise<{ status: number; type: string; body: string }> {
  const { port } = to.address() as AddressInfo;
  return new Promise((ok, fail) => {
    get({ host: '127.0.0.1', port, path }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk: string) => {
        body += chunk;
      });
      res.on('end', () =>
        ok({ status: res.statusCode ?? 0, type: res.headers['content-type'] ?? '', body }),
      );
    }).once('error', fail);
  });
}

beforeAll(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'web-server-'));
  await writeFile(join(tmp, 'index.html'), '<p>app</p>');
  await writeFile(join(tmp, 'manifest.json'), '{}');
  await writeFile(join(tmp, '..', SECRET), 'secret');
  server = await serveWeb({ dir: tmp, port: 0, host: '127.0.0.1' });
});

afterAll(async () => {
  await new Promise((ok) => server.close(ok));
  await rm(tmp, { recursive: true, force: true });
  await rm(join(tmp, '..', SECRET), { force: true });
});

describe('serveWeb', () => {
  it('serves a file from the export with its content type', async () => {
    const res = await request('/manifest.json');
    expect(res.status).toBe(200);
    expect(res.type).toBe('application/json');
    expect(res.body).toBe('{}');
  });

  it.each(['/player/nhl-1', '/settings?x=1'])(
    'answers the deep link %s with index.html',
    async (path) => {
      const res = await request(path);
      expect(res.status).toBe(200);
      expect(res.type).toBe('text/html; charset=utf-8');
      expect(res.body).toBe('<p>app</p>');
    },
  );

  it('answers a path that escapes the export with index.html, not the file', async () => {
    const res = await request(`/..%2f${SECRET}`);
    expect(res.status).toBe(200);
    expect(res.body).toBe('<p>app</p>');
  });

  it('answers malformed percent-encoding with index.html and keeps serving', async () => {
    const res = await request('/%E0%A4%A');
    expect(res.status).toBe(200);
    expect(res.body).toBe('<p>app</p>');
    expect((await request('/manifest.json')).status).toBe(200);
  });

  it('answers 500 and keeps serving when the export has no index.html (a rebuild in progress)', async () => {
    const empty = await mkdtemp(join(tmpdir(), 'web-server-empty-'));
    await writeFile(join(empty, 'manifest.json'), '{}');
    const bare = await serveWeb({ dir: empty, port: 0, host: '127.0.0.1' });
    try {
      const res = await request('/player/nhl-1', bare);
      expect(res.status).toBe(500);
      expect(res.body).toBe('index.html is missing: run pnpm build:web');
      expect((await request('/manifest.json', bare)).status).toBe(200);
    } finally {
      await new Promise((ok) => bare.close(ok));
      await rm(empty, { recursive: true, force: true });
    }
  });
});

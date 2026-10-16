import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { PoliteClient } from '../http/polite-client';

export async function recordFixture(a: {
  client: Pick<PoliteClient, 'get'>;
  now: () => Date;
  root: string;
  source: string;
  endpoint: string;
  name: string;
  url: string;
  force: boolean;
}): Promise<{ jsonPath: string; metaPath: string; bytes: number }> {
  const dir = join(a.root, a.source, a.endpoint);
  const jsonPath = join(dir, `${a.name}.json`);
  const metaPath = join(dir, `${a.name}.meta.json`);
  if (!a.force) {
    for (const p of [jsonPath, metaPath]) {
      if (existsSync(p)) throw new Error(`${p} already exists (use --force to overwrite)`);
    }
  }
  const res = await a.client.get(a.url);
  let body: unknown;
  try {
    body = JSON.parse(res.text);
  } catch (e) {
    throw new Error(`${a.url} did not return JSON: ${e instanceof Error ? e.message : String(e)}`);
  }
  await mkdir(dir, { recursive: true });
  await writeFile(jsonPath, `${JSON.stringify(body, null, 2)}\n`);
  const meta = {
    url: a.url,
    fetchedAt: a.now().toISOString(),
    status: res.status,
    bytes: res.bytes,
  };
  await writeFile(metaPath, `${JSON.stringify(meta, null, 2)}\n`);
  return { jsonPath, metaPath, bytes: res.bytes };
}

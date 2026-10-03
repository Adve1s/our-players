import { access, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { PoliteClient } from '../http/polite-client';
import type { EndpointMap } from '../sources/endpoint-ids';
import { espnNbaEndpoints } from '../sources/espn-nba/endpoints';
import { nhlEndpoints } from '../sources/nhl/endpoints';

export const fixtureSources: Record<string, EndpointMap> = {
  nhl: nhlEndpoints,
  'espn-nba': espnNbaEndpoints,
};

export interface FixtureMeta {
  source: string;
  endpoint: string;
  id: string;
  url: string;
  fetchedAt: string;
  status: number;
  bytes: number;
}

export interface RecordOptions {
  source: string;
  endpoint: string;
  id: string;
  as?: string;
  force?: boolean;
  client: Pick<PoliteClient, 'get'>;
  /** Directory holding `<source>/<endpoint>/` folders, normally `apps/server/test/fixtures`. */
  root: string;
  now: () => Date;
}

export interface RecordResult {
  path: string;
  metaPath: string;
  meta: FixtureMeta;
}

export function resolveFixtureUrl(source: string, endpoint: string, id: string): string {
  const endpoints = Object.hasOwn(fixtureSources, source) ? fixtureSources[source] : undefined;
  if (!endpoints) {
    throw new Error(`Unknown source "${source}"; known: ${Object.keys(fixtureSources).join(', ')}`);
  }
  const build = Object.hasOwn(endpoints, endpoint) ? endpoints[endpoint] : undefined;
  if (!build) {
    throw new Error(
      `Unknown ${source} endpoint "${endpoint}"; known: ${Object.keys(endpoints).join(', ')}`,
    );
  }
  return build(id);
}

async function exists(path: string): Promise<boolean> {
  return access(path).then(
    () => true,
    () => false,
  );
}

export async function recordFixture(options: RecordOptions): Promise<RecordResult> {
  const { source, endpoint, id, force = false, client, root, now } = options;
  const url = resolveFixtureUrl(source, endpoint, id);
  const name = options.as ?? id;
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name)) {
    throw new Error(`Unsafe fixture name "${name}"`);
  }

  const dir = join(root, source, endpoint);
  const path = join(dir, `${name}.json`);
  const metaPath = join(dir, `${name}.meta.json`);
  if (!force) {
    for (const file of [path, metaPath]) {
      // Checked before fetching so a refused run costs no upstream request.
      if (await exists(file)) {
        throw new Error(`${file} exists; pass --force to overwrite or --as <name> to keep both`);
      }
    }
  }

  const response = await client.get(url);
  let parsed: unknown;
  try {
    parsed = JSON.parse(response.body);
  } catch {
    throw new Error(`Body is not JSON (${response.bytes} bytes): ${url}`);
  }

  const meta: FixtureMeta = {
    source,
    endpoint,
    id,
    url,
    fetchedAt: now().toISOString(),
    status: response.status,
    bytes: response.bytes,
  };
  await mkdir(dir, { recursive: true });
  await writeFile(path, `${JSON.stringify(parsed, null, 2)}\n`);
  await writeFile(metaPath, `${JSON.stringify(meta, null, 2)}\n`);
  return { path, metaPath, meta };
}

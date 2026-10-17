import { readFileSync } from 'node:fs';

// Parsed fresh on every call, so a test can mutate its copy without leaking into others.
export function loadFixture(source: string, endpoint: string, id: string): unknown {
  return JSON.parse(
    readFileSync(new URL(`./fixtures/${source}/${endpoint}/${id}.json`, import.meta.url), 'utf8'),
  );
}

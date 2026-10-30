/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Cloudflare `_headers` syntax: an unindented URL pattern, then indented `Name: value` lines; `#` is a comment.
function parseHeaders(text: string): Record<string, Record<string, string>> {
  const rules: Record<string, Record<string, string>> = {};
  let current: Record<string, string> | undefined;
  for (const line of text.split('\n')) {
    if (line.trim() === '' || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      current = {};
      rules[line.trim()] = current;
      continue;
    }
    const colon = line.indexOf(':');
    if (current && colon > 0) current[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
  }
  return rules;
}

describe('web _headers', () => {
  const headers = parseHeaders(
    readFileSync(new URL('../public/_headers', import.meta.url), 'utf8'),
  );

  it.each([
    [
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src https://api.ourplayers.adveis.dev; manifest-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    ],
    ['X-Content-Type-Options', 'nosniff'],
    ['Referrer-Policy', 'no-referrer'],
    ['X-Frame-Options', 'DENY'],
    ['Strict-Transport-Security', 'max-age=31536000'],
    ['Permissions-Policy', 'camera=(), microphone=(), geolocation=()'],
  ])('every page sends %s', (name, value) => {
    expect(headers['/*']?.[name]).toBe(value);
  });
});

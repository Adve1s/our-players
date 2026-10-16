import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config';

const contactUrl = 'https://github.com/Adve1s/our-players';

describe('loadConfig', () => {
  it('defaults the port to 3001 when PORT is unset', () =>
    expect(loadConfig({})).toEqual({ port: 3001, contactUrl }));
  it('defaults the port to 3001 when PORT is empty', () =>
    expect(loadConfig({ PORT: '' })).toEqual({ port: 3001, contactUrl }));
  it('reads a valid PORT', () =>
    expect(loadConfig({ PORT: '8080' })).toEqual({ port: 8080, contactUrl }));
  it.each(['abc', '3001abc', '0', '70000', '80.5'])('rejects PORT=%s', (v) =>
    expect(() => loadConfig({ PORT: v })).toThrow(/PORT/),
  );
  it('defaults contactUrl', () => expect(loadConfig({}).contactUrl).toBe(contactUrl));
  it('reads CONTACT_URL', () =>
    expect(loadConfig({ CONTACT_URL: 'https://example.org/me' }).contactUrl).toBe(
      'https://example.org/me',
    ));
});

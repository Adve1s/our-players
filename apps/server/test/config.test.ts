import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config';

describe('loadConfig', () => {
  it('defaults the port to 3001 when PORT is unset', () =>
    expect(loadConfig({})).toEqual({ port: 3001 }));
  it('defaults the port to 3001 when PORT is empty', () =>
    expect(loadConfig({ PORT: '' })).toEqual({ port: 3001 }));
  it('reads a valid PORT', () => expect(loadConfig({ PORT: '8080' })).toEqual({ port: 8080 }));
  it.each(['abc', '3001abc', '0', '70000', '80.5'])('rejects PORT=%s', (v) =>
    expect(() => loadConfig({ PORT: v })).toThrow(/PORT/),
  );
});

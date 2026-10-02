import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config';

describe('loadConfig', () => {
  it('defaults the port to 3001', () => {
    expect(loadConfig({}).port).toBe(3001);
  });

  it('reads the port from PORT', () => {
    expect(loadConfig({ PORT: '4000' }).port).toBe(4000);
  });

  it.each(['abc', '0', '70000', '30.5'])('rejects PORT=%s naming the variable', (value) => {
    expect(() => loadConfig({ PORT: value })).toThrow(/PORT/);
  });
});

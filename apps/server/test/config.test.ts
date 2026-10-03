import { describe, expect, it } from 'vitest';
import { loadConfig, userAgent } from '../src/config';

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

  it('defaults the contact URL to the GitHub repo', () => {
    expect(loadConfig({}).contactUrl).toBe('https://github.com/Adve1s/our-players');
  });

  it('rejects a CONTACT_URL that is not a URL', () => {
    expect(() => loadConfig({ CONTACT_URL: 'nope' })).toThrow(/CONTACT_URL/);
  });
});

describe('userAgent', () => {
  it('names the project, its version and the contact URL', () => {
    expect(userAgent(loadConfig({ CONTACT_URL: 'https://example.org/x' }))).toMatch(
      /^OurPlayers\/\d+\.\d+\.\d+ \(\+https:\/\/example\.org\/x\)$/,
    );
  });
});

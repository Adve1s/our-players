import { describe, expect, it } from 'vitest';
import { apiBaseUrl } from '../src/lib/api-url';

describe('apiBaseUrl', () => {
  it.each([
    [undefined, 'http://localhost:3001'],
    ['', 'http://localhost:3001'],
    ['http://192.168.1.5:3001/', 'http://192.168.1.5:3001'],
    ['https://api.example.org', 'https://api.example.org'],
  ])('maps %j to %s', (env, expected) => {
    expect(apiBaseUrl(env)).toBe(expected);
  });
});

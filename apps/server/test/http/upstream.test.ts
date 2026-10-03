import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config';
import { upstreamClient } from '../../src/http/upstream';

describe('upstreamClient', () => {
  it('returns the same client to every caller in the process', () => {
    expect(upstreamClient(loadConfig({}))).toBe(upstreamClient(loadConfig({})));
  });
});

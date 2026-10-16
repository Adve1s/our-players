import { describe, expect, it } from 'vitest';
import { seasonLabel } from '../src/index';

describe('seasonLabel', () => {
  it('formats a season by its start year', () => expect(seasonLabel(2026)).toBe('2026-27'));
  it('pads across a decade', () => expect(seasonLabel(2009)).toBe('2009-10'));
  it('wraps at a century', () => expect(seasonLabel(2099)).toBe('2099-00'));
});

import { describe, expect, it } from 'vitest';
import { DEFAULT_COUNTRIES, formatFollowing } from './app-info';

describe('formatFollowing', () => {
  it('lists the followed country codes in order', () => {
    expect(formatFollowing(['LVA', 'CAN'])).toBe('Following: LVA, CAN');
  });

  it('says nobody when no countries are followed', () => {
    expect(formatFollowing([])).toBe('Following: nobody');
  });

  it('follows Latvia by default', () => {
    expect(formatFollowing(DEFAULT_COUNTRIES)).toBe('Following: LVA');
  });
});

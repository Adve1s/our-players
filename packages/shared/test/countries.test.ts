import { describe, expect, it } from 'vitest';
import { COUNTRY_CODES, countryCodeSchema, countryFromName } from '../src/index';

describe('countryCodeSchema', () => {
  it.each(['LVA', 'USA', 'CMR', 'DOM', 'GBR'])('accepts %s', (code) => {
    expect(countryCodeSchema.parse(code)).toBe(code);
  });

  it.each(['XXX', 'usa', 'US', 'LAV'])(
    'rejects %s with the message "unknown ISO 3166-1 alpha-3 country code"',
    (code) => {
      const result = countryCodeSchema.safeParse(code);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe('unknown ISO 3166-1 alpha-3 country code');
    },
  );

  it('COUNTRY_CODES has 249 unique codes', () => {
    expect(COUNTRY_CODES).toHaveLength(249);
    expect(new Set(COUNTRY_CODES).size).toBe(249);
  });
});

describe('countryFromName', () => {
  it.each([
    ['Latvia', 'LVA'],
    ['Cameroon', 'CMR'],
    ['USA', 'USA'],
    ['Nigeria', 'NGA'],
    ['Dominican Republic', 'DOM'],
    ['Netherlands', 'NLD'],
    ['Brazil', 'BRA'],
    ['Australia', 'AUS'],
    ['England', 'GBR'],
    ['Czech Republic', 'CZE'],
    ['South Korea', 'KOR'],
    ['United States', 'USA'],
    [' Latvia ', 'LVA'],
  ])('maps "%s" to %s', (name, code) => {
    expect(countryFromName(name)).toBe(code);
  });

  it.each(['Atlantis', '', 'constructor'])('maps the unknown name "%s" to null', (name) => {
    expect(countryFromName(name)).toBeNull();
  });
});

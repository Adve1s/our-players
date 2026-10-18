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

// Spellings the first live NBA roster run (2026-10-18) warned about.
describe('countryFromName, ESPN spellings seen live', () => {
  it.each([
    ['Russia', 'RUS'],
    ['Bosnia & Herzegovina', 'BIH'],
    ['Democratic Republic of Congo', 'COD'],
  ])('maps "%s" to %s', (name, code) => {
    expect(countryFromName(name)).toBe(code);
  });
});

// Common English forms that iso-codes spells differently (PR #12 review); none is ambiguous.
describe('countryFromName, English short forms', () => {
  it.each([
    ['Turkey', 'TUR'],
    ['Ivory Coast', 'CIV'],
    ['Cape Verde', 'CPV'],
    ['Great Britain', 'GBR'],
    ['DR Congo', 'COD'],
    ['Macedonia', 'MKD'],
    ['Swaziland', 'SWZ'],
    ['St. Lucia', 'LCA'],
    ['St. Vincent and the Grenadines', 'VCT'],
    ['St. Kitts and Nevis', 'KNA'],
    ['US Virgin Islands', 'VIR'],
    ['U.S. Virgin Islands', 'VIR'],
    ['The Bahamas', 'BHS'],
    ['The Gambia', 'GMB'],
    ['East Timor', 'TLS'],
    ['Burma', 'MMR'],
    ['Brunei', 'BRN'],
  ])('maps "%s" to %s', (name, code) => {
    expect(countryFromName(name)).toBe(code);
  });

  // Kosovo has no ISO 3166-1 code; "Korea" and "Virgin Islands" name two countries each.
  it.each(['Kosovo', 'Korea', 'Virgin Islands'])('leaves "%s" unmapped', (name) => {
    expect(countryFromName(name)).toBeNull();
  });
});

import type { CountriesResponse } from '@our-players/shared';
import { describe, expect, it } from 'vitest';
import { countryRows } from '../src/lib/countries';

const countries: CountriesResponse['countries'] = [
  { code: 'CAN', counts: { NHL: 300 } },
  { code: 'LVA', counts: { NHL: 6, NBA: 1 } },
  { code: 'SWE', counts: { NHL: 80 } },
  { code: 'CHE', counts: { NHL: 80 } },
  { code: 'CIV', counts: { NBA: 1 } },
];

describe('countryRows', () => {
  it('lists selected countries first, then the rest by display name', () => {
    // By name, not code or player count: Canada, Côte d'Ivoire, Sweden, Switzerland.
    const codes = countryRows(countries, ['LVA', 'SWE'], '').map((r) => r.code);
    expect(codes).toEqual(['LVA', 'SWE', 'CAN', 'CIV', 'CHE']);
  });

  it('builds a row with code, display name, counts and the selected flag', () => {
    const lva = countryRows(countries, ['LVA'], '').find((r) => r.code === 'LVA');
    expect(lva).toEqual({
      code: 'LVA',
      name: 'Latvia',
      counts: { NHL: 6, NBA: 1 },
      selected: true,
    });
  });

  it('still lists a selected country missing from the response, with no counts', () => {
    const rows = countryRows(countries, ['LVA', 'NOR'], '');
    expect(rows[1]).toEqual({ code: 'NOR', name: 'Norway', counts: {}, selected: true });
  });

  it.each([
    ['sw', ['SWE', 'CHE']],
    ['  LAT ', ['LVA']],
    ['can', ['CAN']],
    ['cote', ['CIV']],
    ['zzz', []],
  ])('search "%s" finds %j (code or name, case and diacritics ignored)', (query, codes) => {
    expect(countryRows(countries, [], query).map((r) => r.code)).toEqual(codes);
  });
});

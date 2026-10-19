import type { CountriesResponse, CountryCode, League } from '@our-players/shared';

export type CountryRow = {
  code: CountryCode;
  name: string;
  counts: Partial<Record<League, number>>;
  selected: boolean;
};

export function countryRows(
  _countries: CountriesResponse['countries'],
  _selected: readonly CountryCode[],
  _query: string,
): CountryRow[] {
  throw new Error('not implemented');
}

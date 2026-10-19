import {
  type CountriesResponse,
  type CountryCode,
  countryName,
  type League,
} from '@our-players/shared';

export type CountryRow = {
  code: CountryCode;
  name: string;
  counts: Partial<Record<League, number>>;
  selected: boolean;
};

// "Côte" → "cote": search ignores case and diacritics.
const fold = (s: string): string => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

const total = (counts: CountryRow['counts']): number =>
  Object.values(counts).reduce((sum, n) => sum + n, 0);

export function countryRows(
  countries: CountriesResponse['countries'],
  selected: readonly CountryCode[],
  query: string,
): CountryRow[] {
  const listed = new Set(countries.map((c) => c.code));
  // A selected country with no players still gets a row, so it can be unticked.
  const all = [
    ...countries,
    ...selected.filter((code) => !listed.has(code)).map((code) => ({ code, counts: {} })),
  ];
  const q = fold(query);
  return all
    .map((c) => ({
      code: c.code,
      name: countryName(c.code),
      counts: c.counts,
      selected: selected.includes(c.code),
    }))
    .filter((r) => fold(r.code).includes(q) || fold(r.name).includes(q))
    .sort(
      (a, b) =>
        Number(b.selected) - Number(a.selected) ||
        total(b.counts) - total(a.counts) ||
        a.name.localeCompare(b.name),
    );
}

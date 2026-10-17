import type { CountryCode } from './countries';
import type { NationalitySource } from './enums';
import type { PublicId } from './ids';

export type ResolvedNationality =
  | { nationality: CountryCode; source: NationalitySource }
  | { nationality: null; source: null };

// Sporting nationality: the override if one exists, else the birth country, else null.
export function resolveNationality(
  player: { publicId: PublicId; birthCountry: CountryCode | null },
  overrides: ReadonlyMap<PublicId, { readonly nationality: CountryCode }>,
): ResolvedNationality {
  throw new Error('not implemented');
}

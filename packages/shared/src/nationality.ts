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
  const override = overrides.get(player.publicId);
  if (override) return { nationality: override.nationality, source: 'override' };
  if (player.birthCountry) return { nationality: player.birthCountry, source: 'birth' };
  return { nationality: null, source: null };
}

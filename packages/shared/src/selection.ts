import type { CountryCode } from './countries';
import type { League } from './enums';
import type { PublicId } from './ids';

// Sets, not arrays: the rule is about membership, and callers build them once per request.
export type Prefs = {
  leagues: ReadonlySet<League>;
  countries: ReadonlySet<CountryCode>;
  favorites: ReadonlySet<PublicId>;
  hidden: ReadonlySet<PublicId>;
};

export type SelectablePlayer = {
  publicId: PublicId;
  league: League;
  nationality: CountryCode | null;
};

// shown(p) ⇔ league(p) ∈ L ∧ p ∉ H ∧ (p ∈ F ∨ nat(p) ∈ C)
export function isShown(player: SelectablePlayer, prefs: Prefs): boolean {
  throw new Error('not implemented');
}

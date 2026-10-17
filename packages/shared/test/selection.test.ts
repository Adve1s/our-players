import { describe, expect, it } from 'vitest';
import {
  type CountryCode,
  isShown,
  type League,
  type Prefs,
  type PublicId,
  resolveNationality,
  type SelectablePlayer,
} from '../src/index';

function prefs(p: {
  leagues?: League[];
  countries?: CountryCode[];
  favorites?: PublicId[];
  hidden?: PublicId[];
}): Prefs {
  return {
    leagues: new Set(p.leagues ?? ['NHL', 'NBA']),
    countries: new Set(p.countries ?? []),
    favorites: new Set(p.favorites ?? []),
    hidden: new Set(p.hidden ?? []),
  };
}

const latvianNhl: SelectablePlayer = { publicId: 'nhl-8470003', league: 'NHL', nationality: 'LVA' };
const porzingis: SelectablePlayer = { publicId: 'nba-3102531', league: 'NBA', nationality: 'LVA' };
const americanNhl: SelectablePlayer = {
  publicId: 'nhl-8470001',
  league: 'NHL',
  nationality: 'USA',
};
const unknownNhl: SelectablePlayer = { publicId: 'nhl-8470002', league: 'NHL', nationality: null };

describe('isShown (VISION §3)', () => {
  it('shows a player from a followed country in a selected league', () => {
    expect(isShown(latvianNhl, prefs({ countries: ['LVA'] }))).toBe(true);
  });

  it("does not show a player from a country that isn't followed", () => {
    expect(isShown(americanNhl, prefs({ countries: ['LVA'] }))).toBe(false);
  });

  it.each([
    ['is followed', ['LVA'] satisfies CountryCode[]],
    ['is not followed', ['USA'] satisfies CountryCode[]],
  ])('hidden beats favorite when his country %s', (_label, countries) => {
    const p = prefs({ countries, favorites: [latvianNhl.publicId], hidden: [latvianNhl.publicId] });
    expect(isShown(latvianNhl, p)).toBe(false);
  });

  it('the league filter applies to favorites too', () => {
    const favoriteNba: SelectablePlayer = {
      publicId: 'nba-3000001',
      league: 'NBA',
      nationality: 'USA',
    };
    expect(isShown(favoriteNba, prefs({ leagues: ['NHL'], favorites: ['nba-3000001'] }))).toBe(
      false,
    );
  });

  it('the league filter applies to followed countries', () => {
    expect(isShown(porzingis, prefs({ leagues: ['NHL'], countries: ['LVA'] }))).toBe(false);
  });

  it('unknown nationality is not shown when not favorited', () => {
    expect(isShown(unknownNhl, prefs({ countries: ['LVA', 'USA', 'CMR'] }))).toBe(false);
  });

  it('unknown nationality is shown when favorited', () => {
    expect(isShown(unknownNhl, prefs({ favorites: [unknownNhl.publicId] }))).toBe(true);
  });

  it.each([
    ['LVA', latvianNhl],
    ['USA', americanNhl],
    ['unknown', unknownNhl],
  ])('nothing followed shows nothing (nationality %s)', (_label, player) => {
    expect(isShown(player, prefs({ countries: [], favorites: [] }))).toBe(false);
  });

  it('unknown IDs in favorites or hidden are ignored', () => {
    const players = [latvianNhl, porzingis, americanNhl, unknownNhl];
    const base = { countries: ['LVA'] satisfies CountryCode[], favorites: [unknownNhl.publicId] };
    const withUnknown = prefs({
      countries: base.countries,
      favorites: [...base.favorites, 'nhl-9999991', 'nba-9999992'],
      hidden: ['nhl-9999993', 'nba-9999994'],
    });
    const shownIds = (p: Prefs) => players.filter((pl) => isShown(pl, p)).map((pl) => pl.publicId);

    expect(shownIds(withUnknown)).toEqual(shownIds(prefs(base)));
    expect(shownIds(withUnknown)).toEqual([
      latvianNhl.publicId,
      porzingis.publicId,
      unknownNhl.publicId,
    ]);
  });

  describe('overrides decide nationality (Embiid: born CMR, override USA)', () => {
    const embiidId = 'nba-3059318';
    const embiid = (): SelectablePlayer => ({
      publicId: embiidId,
      league: 'NBA',
      nationality: resolveNationality(
        { publicId: embiidId, birthCountry: 'CMR' },
        new Map([[embiidId, { nationality: 'USA' }]]),
      ).nationality,
    });

    it('Embiid is shown for USA', () => {
      expect(isShown(embiid(), prefs({ countries: ['USA'] }))).toBe(true);
    });

    it('Embiid is not shown for CMR', () => {
      expect(isShown(embiid(), prefs({ countries: ['CMR'] }))).toBe(false);
    });
  });

  it('matches the set formula over generated inputs', () => {
    // mulberry32: tiny deterministic PRNG so a failure reproduces with the same seed.
    let seed = 0x5eed2a;
    const rand = () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)] as T;
    const subset = <T>(xs: readonly T[]): T[] => xs.filter(() => rand() < 0.5);

    const leagues: readonly League[] = ['NHL', 'NBA'];
    const nationalities: readonly (CountryCode | null)[] = ['LVA', 'USA', 'CMR', null];
    const countries: readonly CountryCode[] = ['LVA', 'USA', 'CMR'];
    const unknownIds: readonly PublicId[] = ['nhl-9000001', 'nhl-9000002', 'nba-9000003'];

    for (let i = 0; i < 400; i++) {
      const players: SelectablePlayer[] = Array.from({ length: Math.floor(rand() * 9) }, (_, n) => {
        const league = pick(leagues);
        return {
          publicId: `${league === 'NHL' ? 'nhl' : 'nba'}-${100 + n}`,
          league,
          nationality: pick(nationalities),
        };
      });
      const idPool = [...players.map((p) => p.publicId), ...unknownIds];
      const p: Prefs = {
        leagues: new Set(subset(leagues)),
        countries: new Set(subset(countries)),
        favorites: new Set(subset(idPool)),
        hidden: new Set(subset(idPool)),
      };

      // (F-players ∪ players with nat ∈ C) − H-players, filtered by league ∈ L
      const all = new Set(players.map((pl) => pl.publicId));
      const fromF = new Set([...p.favorites].filter((id) => all.has(id)));
      const fromC = new Set(
        players
          .filter((pl) => pl.nationality !== null && p.countries.has(pl.nationality))
          .map((pl) => pl.publicId),
      );
      const fromH = new Set([...p.hidden].filter((id) => all.has(id)));
      const inL = new Set(
        players.filter((pl) => p.leagues.has(pl.league)).map((pl) => pl.publicId),
      );
      const expected = new Set(
        [...new Set([...fromF, ...fromC])].filter((id) => !fromH.has(id) && inL.has(id)),
      );

      const actual = new Set(players.filter((pl) => isShown(pl, p)).map((pl) => pl.publicId));
      expect(actual, `iteration ${i}`).toEqual(expected);
    }
  });
});

import { describe, expect, it } from 'vitest';
import { type CountryCode, type PublicId, resolveNationality } from '../src/index';

type Overrides = ReadonlyMap<PublicId, { readonly nationality: CountryCode }>;

const EMBIID = 'nba-3059318';
const TOWNS = 'nba-3136195';
const PORZINGIS = 'nba-3102531';
const none: Overrides = new Map();

describe('resolveNationality (VISION §7)', () => {
  it('an override replaces the birth country, source override (Embiid: CMR → USA)', () => {
    const r = resolveNationality(
      { publicId: EMBIID, birthCountry: 'CMR' },
      new Map([[EMBIID, { nationality: 'USA' }]]),
    );
    expect(r.nationality).toBe('USA');
    expect(r.source).toBe('override');
  });

  it('an override can replace a birth country of USA (Towns: USA → DOM)', () => {
    const r = resolveNationality(
      { publicId: TOWNS, birthCountry: 'USA' },
      new Map([[TOWNS, { nationality: 'DOM' }]]),
    );
    expect(r.nationality).toBe('DOM');
    expect(r.source).toBe('override');
  });

  it('without an override the birth country is used, source birth (Porziņģis: LVA)', () => {
    const r = resolveNationality({ publicId: PORZINGIS, birthCountry: 'LVA' }, none);
    expect(r.nationality).toBe('LVA');
    expect(r.source).toBe('birth');
  });

  it('an unknown birth country without an override gives null with source null', () => {
    const r = resolveNationality({ publicId: PORZINGIS, birthCountry: null }, none);
    expect(r.nationality).toBeNull();
    expect(r.source).toBeNull();
  });

  it('an override applies even when the birth country is unknown', () => {
    const r = resolveNationality(
      { publicId: EMBIID, birthCountry: null },
      new Map([[EMBIID, { nationality: 'USA' }]]),
    );
    expect(r.nationality).toBe('USA');
    expect(r.source).toBe('override');
  });

  it("an override for another player doesn't change this player's result", () => {
    const r = resolveNationality(
      { publicId: PORZINGIS, birthCountry: 'LVA' },
      new Map([
        [EMBIID, { nationality: 'USA' }],
        [TOWNS, { nationality: 'DOM' }],
      ]),
    );
    expect(r.nationality).toBe('LVA');
    expect(r.source).toBe('birth');
  });

  it('an override equal to the birth country reports source override', () => {
    const r = resolveNationality(
      { publicId: PORZINGIS, birthCountry: 'LVA' },
      new Map([[PORZINGIS, { nationality: 'LVA' }]]),
    );
    expect(r.nationality).toBe('LVA');
    expect(r.source).toBe('override');
  });
});

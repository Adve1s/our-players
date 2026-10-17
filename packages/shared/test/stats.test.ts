import { describe, expect, it } from 'vitest';
import { parseStatPayload, type StatKind } from '../src/index';

const skater = { goals: 1, assists: 1, points: 2, plusMinus: 2, shots: 4, toiSeconds: 1112 };
const skaterFull = { ...skater, pim: 2, hits: 3, blocks: 1, powerPlayGoals: 1 };
const goalie = {
  saves: 28,
  shotsAgainst: 30,
  goalsAgainst: 2,
  savePct: 0.933,
  toiSeconds: 3600,
  decision: 'W',
};
// VISION §4.1
const basketball = {
  minutes: 31,
  points: 22,
  rebounds: 8,
  assists: 3,
  fgMade: 8,
  fgAttempted: 15,
  threeMade: 3,
  threeAttempted: 7,
  ftMade: 3,
  ftAttempted: 3,
  turnovers: 2,
  steals: 1,
  blocks: 0,
  offRebounds: 2,
  defRebounds: 6,
  fouls: 3,
  plusMinus: -4,
};

const valid: [StatKind, Record<string, unknown>][] = [
  ['hockey_skater', skater],
  ['hockey_skater', skaterFull],
  ['hockey_goalie', goalie],
  ['basketball_player', basketball],
];

describe('parseStatPayload', () => {
  it.each(valid)('parses a valid %s payload and round-trips it', (kind, payload) => {
    expect(parseStatPayload(kind, payload)).toEqual(payload);
  });

  it('accepts a goalie with savePct and decision null', () => {
    const payload = { ...goalie, savePct: null, decision: null };
    expect(parseStatPayload('hockey_goalie', payload)).toEqual(payload);
  });

  const base: Record<StatKind, Record<string, unknown>> = {
    hockey_skater: skater,
    hockey_goalie: goalie,
    basketball_player: basketball,
  };
  const field: Record<StatKind, string> = {
    hockey_skater: 'goals',
    hockey_goalie: 'saves',
    basketball_player: 'points',
  };
  const kinds: StatKind[] = ['hockey_skater', 'hockey_goalie', 'basketball_player'];

  describe.each(kinds)('rejects a bad %s payload', (kind) => {
    const name = field[kind];
    const omit = (key: string) =>
      Object.fromEntries(Object.entries(base[kind]).filter(([k]) => k !== key));

    it.each([
      ['a string where a number belongs', { ...base[kind], [name]: String(base[kind][name]) }],
      ['a negative count', { ...base[kind], [name]: -1 }],
      ['a missing required field', omit(name)],
    ])('%s', (_label, payload) => {
      expect(() => parseStatPayload(kind, payload)).toThrow(kind);
      expect(() => parseStatPayload(kind, payload)).toThrow(name);
    });

    it('an unknown key', () => {
      const payload = { ...base[kind], goalz: 1 };
      expect(() => parseStatPayload(kind, payload)).toThrow(kind);
      expect(() => parseStatPayload(kind, payload)).toThrow('goalz');
    });
  });

  it.each([
    ['savePct', 1.5],
    ['decision', 'O'],
  ])('rejects goalie %s %s', (key, value) => {
    const payload = { ...goalie, [key]: value };
    expect(() => parseStatPayload('hockey_goalie', payload)).toThrow('hockey_goalie');
    expect(() => parseStatPayload('hockey_goalie', payload)).toThrow(key);
  });

  // Review Focus 3: non-integers and non-finite numbers are not counts.
  it.each([
    ['hockey_skater', 'toiSeconds', 12.5],
    ['basketball_player', 'points', Number.NaN],
    ['basketball_player', 'minutes', Number.POSITIVE_INFINITY],
  ] as const)('rejects %s %s = %s', (kind, key, value) => {
    const payload = { ...base[kind], [key]: value };
    expect(() => parseStatPayload(kind, payload)).toThrow(kind);
    expect(() => parseStatPayload(kind, payload)).toThrow(key);
  });
});

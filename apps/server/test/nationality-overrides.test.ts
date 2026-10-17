import { describe, expect, it } from 'vitest';
import { loadNationalityOverrides, parseNationalityOverrides } from '../src/nationality/overrides';

const file = 'overrides.json';
const embiid = {
  player: 'nba-3059318',
  name: 'Joel Embiid',
  nationality: 'USA',
  note: 'Born in Cameroon; represents the USA.',
  addedAt: '2026-10-02',
};
const towns = {
  player: 'nba-3136195',
  name: 'Karl-Anthony Towns',
  nationality: 'DOM',
  note: 'Born in the USA; represents the Dominican Republic.',
  addedAt: '2026-10-02',
};
const json = (overrides: unknown[]) => JSON.stringify({ overrides });
const parse = (text: string) => () => parseNationalityOverrides(text, file);

describe('nationality overrides', () => {
  it('the committed overrides file loads cleanly', async () => {
    const map = await loadNationalityOverrides();
    expect(map.size).toBe(2);
    expect(map.get('nba-3059318')).toMatchObject({ nationality: 'USA', name: 'Joel Embiid' });
    expect(map.get('nba-3136195')?.nationality).toBe('DOM');
  });

  it('parses an empty overrides list to an empty map', () =>
    expect(parseNationalityOverrides(json([]), file).size).toBe(0));

  it('bad JSON names the file', () =>
    expect(parse('{ nope')).toThrow(/overrides\.json: invalid JSON/));

  it('unknown country code names the file, entry, player and field', () =>
    expect(parse(json([embiid, { ...towns, nationality: 'DOX' }]))).toThrow(
      /overrides\.json: overrides\[1\] \(nba-3136195\):[\s\S]*unknown ISO 3166-1 alpha-3 country code[\s\S]*nationality/,
    ));

  it.each(['usa', 'US'])('rejects country code %s naming the entry', (code) =>
    expect(parse(json([{ ...embiid, nationality: code }]))).toThrow(
      /overrides\[0\] \(nba-3059318\):[\s\S]*unknown ISO 3166-1 alpha-3 country code/,
    ),
  );

  it('duplicate player names both indexes', () =>
    expect(parse(json([embiid, embiid]))).toThrow(
      'overrides.json: overrides[1] (nba-3059318): duplicate player, first at overrides[0]',
    ));

  // A leading zero can never match an ID derived from a numeric source ID.
  it.each(['embiid', 'NBA-3059318', 'nba-03059318'])('rejects malformed public ID %s', (player) =>
    expect(parse(json([{ ...embiid, player }]))).toThrow(/overrides\[0\][\s\S]*player/),
  );

  it('rejects a missing name', () => {
    const { name: _name, ...noName } = embiid;
    expect(parse(json([noName]))).toThrow(/overrides\[0\] \(nba-3059318\)[\s\S]*name/);
  });

  it('rejects a file without an overrides key', () =>
    expect(parse('{}')).toThrow(/overrides\.json:[\s\S]*overrides/));

  it('rejects an unknown top-level key', () =>
    expect(parse(JSON.stringify({ overrides: [], extra: 1 }))).toThrow(
      /overrides\.json:[\s\S]*extra/,
    ));

  it('a missing file rejects naming the path once, with the error code', () =>
    expect(loadNationalityOverrides('/nonexistent/overrides.json')).rejects.toThrow(
      /^\/nonexistent\/overrides\.json: cannot read \(ENOENT\)$/,
    ));
});

import { describe, expect, it } from 'vitest';
import { mapTeams } from '../src/sources/espn-nba/teams';
import { loadFixture } from './fixtures';
import { obj, only } from './json';

const teams = () => loadFixture('espn-nba', 'teams', '2026-10-18');

describe('mapTeams (teams/2026-10-18)', () => {
  it('returns all 30 teams, each once', () => {
    const result = mapTeams(teams()).teams;
    expect(result).toHaveLength(30);
    expect(new Set(result.map((t) => t.externalId)).size).toBe(30);
  });

  it('maps team 9 to GS by its short name "Warriors"', () => {
    const gs = only(mapTeams(teams()).teams, (t) => t.externalId === '9', 'team 9');
    expect(gs.abbrev).toBe('GS');
    expect(gs.name).toBe('Warriors');
    expect(gs.league).toBe('NBA');
    expect(gs.source).toBe('espn');
  });

  it('maps team 24 to SA "Spurs" (an ESPN abbreviation)', () => {
    const sa = only(mapTeams(teams()).teams, (t) => t.externalId === '24', 'team 24');
    expect(sa.abbrev).toBe('SA');
    expect(sa.name).toBe('Spurs');
  });

  it.each([
    [
      'a team without id',
      (raw: unknown) => {
        delete obj(raw, 'sports', 0, 'leagues', 0, 'teams', 0, 'team').id;
      },
    ],
    [
      'an abbreviation as a number',
      (raw: unknown) => {
        obj(raw, 'sports', 0, 'leagues', 0, 'teams', 0, 'team').abbreviation = 1;
      },
    ],
  ])('throws "espn-nba teams: invalid payload" on %s', (_what, mutate) => {
    const raw = teams();
    mutate(raw);
    expect(() => mapTeams(raw)).toThrow(/^espn-nba teams: invalid payload/);
  });
});

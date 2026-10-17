import { describe, expect, it } from 'vitest';
import { mapScheduleCalendar } from '../src/sources/nhl';
import { loadFixture } from './fixtures';
import { obj, only } from './json';

const calendar = () => loadFixture('nhl', 'schedule-calendar', '2026-10-18');

describe('mapScheduleCalendar (schedule-calendar/2026-10-18)', () => {
  it('returns all 32 current-season teams', () => {
    expect(mapScheduleCalendar(calendar()).teams).toHaveLength(32);
  });

  it('maps the first team, New Jersey, by its common name like score games', () => {
    expect(mapScheduleCalendar(calendar()).teams[0]).toEqual({
      league: 'NHL',
      source: 'nhl',
      externalId: '1',
      abbrev: 'NJD',
      name: 'Devils',
    });
  });

  it('includes Utah and Columbus (id 29)', () => {
    const { teams } = mapScheduleCalendar(calendar());
    expect(teams.map((t) => t.abbrev)).toEqual(expect.arrayContaining(['UTA', 'CBJ']));
    expect(only(teams, (t) => t.abbrev === 'CBJ', 'CBJ').externalId).toBe('29');
  });

  it('throws "nhl schedule-calendar: invalid payload" on a team without id', () => {
    const raw = calendar();
    delete obj(raw, 'teams', 0).id;
    expect(() => mapScheduleCalendar(raw)).toThrow(/^nhl schedule-calendar: invalid payload/);
  });
});

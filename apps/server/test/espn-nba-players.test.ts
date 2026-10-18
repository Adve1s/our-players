import type { Player } from '@our-players/shared';
import { describe, expect, it } from 'vitest';
import { mapAthlete, mapRoster } from '../src/sources/espn-nba/players';
import { loadFixture } from './fixtures';
import { list, obj, only } from './json';

const roster = (teamId: string) => loadFixture('espn-nba', 'roster', teamId);
const athlete = (athleteId: string) => loadFixture('espn-nba', 'athlete', athleteId);

function player(players: Player[], athleteId: string): Player {
  return only(players, (p) => p.externalId === athleteId, `player ${athleteId}`);
}

// A roster athlete, for mutating a copy.
function rawRosterAthlete(raw: unknown, id: string) {
  return only(list(raw, 'athletes'), (a) => a.id === id, `raw roster athlete ${id}`);
}

describe('mapRoster: roster/9 (GS)', () => {
  const result = () => mapRoster(roster('9'));
  const porzingis = () => player(result().players, '3102531');

  it('returns the team the roster names ("9")', () => {
    expect(result().teamExternalId).toBe('9');
  });

  it('maps all 21 players', () => {
    expect(result().players).toHaveLength(21);
  });

  it('derives the public ID from the ESPN athlete ID', () => {
    const p = porzingis();
    expect(p.publicId).toBe('nba-3102531');
    expect(p.league).toBe('NBA');
    expect(p.source).toBe('espn');
  });

  it('takes first and last name (Kristaps Porzingis)', () => {
    expect(porzingis().firstName).toBe('Kristaps');
    expect(porzingis().lastName).toBe('Porzingis');
  });

  it('keeps a suffix in the last name (Jimmy Butler III 6430)', () => {
    const p = player(result().players, '6430');
    expect(p.firstName).toBe('Jimmy');
    expect(p.lastName).toBe('Butler III');
  });

  it('keeps position C and groups it as center', () => {
    expect(porzingis().position).toBe('C');
    expect(porzingis().positionGroup).toBe('center');
  });

  it('gives the jersey as a string ("7")', () => {
    expect(porzingis().jersey).toBe('7');
  });

  it('takes the date part of dateOfBirth "1995-08-02T07:00Z"', () => {
    expect(porzingis().birthDate).toBe('1995-08-02');
  });

  it('takes the birth city "Liepaja"', () => {
    expect(porzingis().birthCity).toBe('Liepaja');
  });

  it('maps birth country "Latvia" to LVA', () => {
    expect(porzingis().birthCountry).toBe('LVA');
  });

  it('sets currentTeamExternalId to the roster team "9"', () => {
    expect(porzingis().currentTeamExternalId).toBe('9');
  });

  it.each([
    ['3213', 'Horford', 'Dominican Republic', 'DOM'],
    ['4897449', 'Leons', 'Netherlands', 'NLD'],
    ['4397886', 'Bassey', 'Nigeria', 'NGA'],
    ['4997536', 'Santos', 'Brazil', 'BRA'],
    ['5170949', 'Toohey', 'Australia', 'AUS'],
    ['3975', 'Curry', 'USA', 'USA'],
  ])('maps %s %s born in "%s" to %s', (athleteId, _name, _country, code) => {
    expect(player(result().players, athleteId).birthCountry).toBe(code);
  });

  it('gives Burton 4431914, who has no jersey, jersey null', () => {
    expect(player(result().players, '4431914').jersey).toBeNull();
  });

  it.each([
    ['4066436', 'G', 'guard'],
    ['6589', 'F', 'forward'],
  ])('groups %s with position %s as %s', (athleteId, position, group) => {
    const p = player(result().players, athleteId);
    expect(p.position).toBe(position);
    expect(p.positionGroup).toBe(group);
  });

  it('gives no warnings when every birth country is known', () => {
    expect(result().warnings).toEqual([]);
  });
});

describe('mapRoster: inputs no fixture contains (mutated copies)', () => {
  it('maps an unknown birth country "Atlantis" to null', () => {
    const raw = roster('9');
    obj(rawRosterAthlete(raw, '3102531'), 'birthPlace').country = 'Atlantis';
    expect(player(mapRoster(raw).players, '3102531').birthCountry).toBeNull();
  });

  it('warns once about an unknown birth country, naming endpoint, player and value', () => {
    const raw = roster('9');
    obj(rawRosterAthlete(raw, '3102531'), 'birthPlace').country = 'Atlantis';
    const { warnings } = mapRoster(raw);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('espn-nba roster');
    expect(warnings[0]).toContain('3102531');
    expect(warnings[0]).toContain('"Atlantis"');
  });

  it('maps a missing birthPlace to null birth city and country without a warning', () => {
    const raw = roster('9');
    delete rawRosterAthlete(raw, '3102531').birthPlace;
    const result = mapRoster(raw);
    const p = player(result.players, '3102531');
    expect(p.birthCountry).toBeNull();
    expect(p.birthCity).toBeNull();
    expect(result.warnings).toEqual([]);
  });

  it('maps a birthPlace without country to birth country null without a warning', () => {
    const raw = roster('9');
    delete obj(rawRosterAthlete(raw, '3102531'), 'birthPlace').country;
    const result = mapRoster(raw);
    const p = player(result.players, '3102531');
    expect(p.birthCountry).toBeNull();
    expect(p.birthCity).toBe('Liepaja');
    expect(result.warnings).toEqual([]);
  });

  it('maps a missing dateOfBirth to birthDate null', () => {
    const raw = roster('9');
    delete rawRosterAthlete(raw, '3102531').dateOfBirth;
    expect(player(mapRoster(raw).players, '3102531').birthDate).toBeNull();
  });

  it.each([
    ['PG', 'guard'],
    ['SG', 'guard'],
    ['SF', 'forward'],
    ['PF', 'forward'],
  ])('keeps position %s as given and groups it as %s', (position, group) => {
    const raw = roster('9');
    obj(rawRosterAthlete(raw, '3102531'), 'position').abbreviation = position;
    const p = player(mapRoster(raw).players, '3102531');
    expect(p.position).toBe(position);
    expect(p.positionGroup).toBe(group);
  });
});

describe('mapRoster: errors', () => {
  it('throws on an unknown position "X"', () => {
    const raw = roster('9');
    obj(rawRosterAthlete(raw, '3102531'), 'position').abbreviation = 'X';
    expect(() => mapRoster(raw)).toThrow(/espn-nba/);
  });

  it.each([
    [
      'an athlete without id',
      (raw: unknown) => {
        delete rawRosterAthlete(raw, '3102531').id;
      },
    ],
    [
      'a first name as a number',
      (raw: unknown) => {
        rawRosterAthlete(raw, '3102531').firstName = 7;
      },
    ],
    [
      'a team without id',
      (raw: unknown) => {
        delete obj(raw, 'team').id;
      },
    ],
  ])('throws "espn-nba roster: invalid payload" on %s', (_what, mutate) => {
    const raw = roster('9');
    mutate(raw);
    expect(() => mapRoster(raw)).toThrow(/^espn-nba roster: invalid payload/);
  });
});

describe('mapAthlete: athlete fixtures', () => {
  it.each([
    ['3102531', 'Kristaps', 'Porzingis', 'LVA', '9'],
    ['3059318', 'Joel', 'Embiid', 'CMR', '20'],
    ['3136195', 'Karl-Anthony', 'Towns', 'USA', '18'],
  ])(
    'maps athlete %s %s %s: birth country %s, current team %s',
    (id, first, last, country, team) => {
      const { player: p } = mapAthlete(athlete(id));
      expect(p.publicId).toBe(`nba-${id}`);
      expect(p.externalId).toBe(id);
      expect(p.firstName).toBe(first);
      expect(p.lastName).toBe(last);
      expect(p.birthCountry).toBe(country);
      expect(p.currentTeamExternalId).toBe(team);
    },
  );

  it.each(['3102531', '3059318', '3136195'])('gives no warnings for athlete %s', (id) => {
    expect(mapAthlete(athlete(id)).warnings).toEqual([]);
  });

  describe('Embiid (athlete/3059318)', () => {
    const embiid = () => mapAthlete(athlete('3059318')).player;

    it('marks the player NBA from source espn', () => {
      expect(embiid().league).toBe('NBA');
      expect(embiid().source).toBe('espn');
    });

    it('takes birth date 1994-03-16 and city Yaounde', () => {
      expect(embiid().birthDate).toBe('1994-03-16');
      expect(embiid().birthCity).toBe('Yaounde');
    });

    it('keeps position C as center and jersey "21"', () => {
      expect(embiid().position).toBe('C');
      expect(embiid().positionGroup).toBe('center');
      expect(embiid().jersey).toBe('21');
    });
  });
});

describe('mapAthlete: inputs no fixture contains (mutated copies)', () => {
  it('gives an athlete without a team (free agent, retired) currentTeamExternalId null', () => {
    const raw = athlete('3102531');
    delete obj(raw).team;
    expect(mapAthlete(raw).player.currentTeamExternalId).toBeNull();
  });

  it('maps an unknown birth country to null with one warning naming endpoint, player and value', () => {
    const raw = athlete('3102531');
    obj(raw, 'birthPlace').country = 'Atlantis';
    const { player: p, warnings } = mapAthlete(raw);
    expect(p.birthCountry).toBeNull();
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('espn-nba athlete');
    expect(warnings[0]).toContain('3102531');
    expect(warnings[0]).toContain('"Atlantis"');
  });

  it('maps a missing birthPlace to birth country null without a warning', () => {
    const raw = athlete('3102531');
    delete obj(raw).birthPlace;
    const { player: p, warnings } = mapAthlete(raw);
    expect(p.birthCountry).toBeNull();
    expect(warnings).toEqual([]);
  });

  it('maps a missing jersey to jersey null', () => {
    const raw = athlete('3102531');
    delete obj(raw).jersey;
    expect(mapAthlete(raw).player.jersey).toBeNull();
  });
});

describe('mapAthlete: errors', () => {
  it.each([
    [
      'no id',
      (raw: unknown) => {
        delete obj(raw).id;
      },
    ],
    [
      'a team $ref as a number',
      (raw: unknown) => {
        obj(raw, 'team').$ref = 9;
      },
    ],
  ])('throws "espn-nba athlete: invalid payload" on %s', (_what, mutate) => {
    const raw = athlete('3102531');
    mutate(raw);
    expect(() => mapAthlete(raw)).toThrow(/^espn-nba athlete: invalid payload/);
  });
});

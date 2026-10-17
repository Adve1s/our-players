import type { Player } from '@our-players/shared';
import { describe, expect, it } from 'vitest';
import { mapPlayerLanding, mapRoster } from '../src/sources/nhl/players';
import { loadFixture } from './fixtures';
import { list, obj, only } from './json';

const roster = (team: string) => loadFixture('nhl', 'roster', team);
const landing = (playerId: string) => loadFixture('nhl', 'player-landing', playerId);

function player(players: Player[], playerId: string): Player {
  return only(players, (p) => p.externalId === playerId, `player ${playerId}`);
}

// A roster entry in forwards, defensemen or goalies, for mutating a copy.
function rawRosterPlayer(raw: unknown, id: number) {
  const all = ['forwards', 'defensemen', 'goalies'].flatMap((group) => list(raw, group));
  return only(all, (p) => p.id === id, `raw roster player ${id}`);
}

// Team IDs from the score fixtures: FLA 13, PIT 5, CBJ 29. A roster response doesn't name its team.
describe('mapRoster: roster/FLA', () => {
  const result = () => mapRoster(roster('FLA'), '13');
  const vilmanis = () => player(result().players, '8483771');

  it('derives the public ID from the NHL player ID', () => {
    const p = vilmanis();
    expect(p.publicId).toBe('nhl-8483771');
    expect(p.league).toBe('NHL');
    expect(p.source).toBe('nhl');
  });

  it('takes first and last name (Sandis Vilmanis)', () => {
    expect(vilmanis().firstName).toBe('Sandis');
    expect(vilmanis().lastName).toBe('Vilmanis');
  });

  it('keeps positionCode L as position and groups it as forward', () => {
    expect(vilmanis().position).toBe('L');
    expect(vilmanis().positionGroup).toBe('forward');
  });

  it('gives the jersey as a string ("95")', () => {
    expect(vilmanis().jersey).toBe('95');
  });

  it('takes birth date, city and country (2004-01-23, Riga, LVA)', () => {
    expect(vilmanis().birthDate).toBe('2004-01-23');
    expect(vilmanis().birthCity).toBe('Riga');
    expect(vilmanis().birthCountry).toBe('LVA');
  });

  it('sets currentTeamExternalId to the team ID it was given', () => {
    expect(vilmanis().currentTeamExternalId).toBe('13');
  });

  it('maps all 24 players (15 forwards, 7 defensemen, 2 goalies)', () => {
    expect(result().players).toHaveLength(24);
  });

  it('gives no warnings when every birthCountry is a valid code', () => {
    expect(result().warnings).toEqual([]);
  });

  it('groups defenseman Balinskis 8484304 as defense', () => {
    expect(player(result().players, '8484304').positionGroup).toBe('defense');
  });
});

describe('mapRoster: roster/PIT', () => {
  const result = () => mapRoster(roster('PIT'), '5');

  it('maps Silovs 8481668 as a goalie born in LVA', () => {
    const p = player(result().players, '8481668');
    expect(p.position).toBe('G');
    expect(p.positionGroup).toBe('goalie');
    expect(p.birthCountry).toBe('LVA');
    expect(p.lastName).toBe('Silovs');
    expect(p.jersey).toBe('37');
    expect(p.currentTeamExternalId).toBe('5');
  });

  it('maps all 25 players', () => {
    expect(result().players).toHaveLength(25);
  });
});

describe('mapRoster: roster/CBJ', () => {
  const result = () => mapRoster(roster('CBJ'), '29');

  it('maps all 23 players', () => {
    expect(result().players).toHaveLength(23);
  });

  it('has no player born in LVA', () => {
    expect(result().players.filter((p) => p.birthCountry === 'LVA')).toEqual([]);
  });

  it('groups defenseman Andrae 8482126 (D) as defense', () => {
    const p = player(result().players, '8482126');
    expect(p.position).toBe('D');
    expect(p.positionGroup).toBe('defense');
    expect(p.birthCountry).toBe('SWE');
  });
});

describe('mapRoster: birth country (mutated copies)', () => {
  it('maps an unknown birthCountry "XXX" to null', () => {
    const raw = roster('FLA');
    rawRosterPlayer(raw, 8483771).birthCountry = 'XXX';
    expect(player(mapRoster(raw, '13').players, '8483771').birthCountry).toBeNull();
  });

  it('warns once about an unknown birthCountry, naming endpoint, player and value', () => {
    const raw = roster('FLA');
    rawRosterPlayer(raw, 8483771).birthCountry = 'XXX';
    const { warnings } = mapRoster(raw, '13');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('nhl roster');
    expect(warnings[0]).toContain('8483771');
    expect(warnings[0]).toContain('"XXX"');
  });

  it('maps a missing birthCountry to null without a warning', () => {
    const raw = roster('FLA');
    delete rawRosterPlayer(raw, 8483771).birthCountry;
    const result = mapRoster(raw, '13');
    expect(player(result.players, '8483771').birthCountry).toBeNull();
    expect(result.warnings).toEqual([]);
  });

  it('maps a missing sweaterNumber to jersey null', () => {
    const raw = roster('FLA');
    delete rawRosterPlayer(raw, 8483771).sweaterNumber;
    expect(player(mapRoster(raw, '13').players, '8483771').jersey).toBeNull();
  });
});

describe('mapRoster: errors', () => {
  it('throws on an unknown positionCode', () => {
    const raw = roster('FLA');
    rawRosterPlayer(raw, 8483771).positionCode = 'X';
    expect(() => mapRoster(raw, '13')).toThrow(/^nhl roster/);
  });

  it.each([
    [
      'a player without id',
      (raw: unknown) => {
        delete rawRosterPlayer(raw, 8483771).id;
      },
    ],
    [
      'a first name that is not an object',
      (raw: unknown) => {
        rawRosterPlayer(raw, 8483771).firstName = 'Sandis';
      },
    ],
    [
      'missing goalies',
      (raw: unknown) => {
        delete obj(raw).goalies;
      },
    ],
  ])('throws "nhl roster: invalid payload" on %s', (_what, mutate) => {
    const raw = roster('FLA');
    mutate(raw);
    expect(() => mapRoster(raw, '13')).toThrow(/^nhl roster: invalid payload/);
  });
});

describe('mapPlayerLanding: Girgensons (player-landing/8476878)', () => {
  const result = () => mapPlayerLanding(landing('8476878'));

  it('derives the public ID from playerId', () => {
    const p = result().player;
    expect(p.publicId).toBe('nhl-8476878');
    expect(p.externalId).toBe('8476878');
    expect(p.league).toBe('NHL');
    expect(p.source).toBe('nhl');
  });

  it('takes first and last name (Zemgus Girgensons)', () => {
    expect(result().player.firstName).toBe('Zemgus');
    expect(result().player.lastName).toBe('Girgensons');
  });

  it('keeps position C and groups it as forward', () => {
    expect(result().player.position).toBe('C');
    expect(result().player.positionGroup).toBe('forward');
  });

  it('gives the jersey as a string ("28")', () => {
    expect(result().player.jersey).toBe('28');
  });

  it('takes the current team from currentTeamId as a string ("14")', () => {
    expect(result().player.currentTeamExternalId).toBe('14');
  });

  it('takes birth date, city and country (1994-01-05, Riga, LVA)', () => {
    const p = result().player;
    expect(p.birthDate).toBe('1994-01-05');
    expect(p.birthCity).toBe('Riga');
    expect(p.birthCountry).toBe('LVA');
  });

  it('gives no warnings', () => {
    expect(result().warnings).toEqual([]);
  });
});

describe('mapPlayerLanding: Merzlikins (player-landing/8478007)', () => {
  const merzlikins = () => mapPlayerLanding(landing('8478007')).player;

  it('keeps position G and groups it as goalie', () => {
    expect(merzlikins().position).toBe('G');
    expect(merzlikins().positionGroup).toBe('goalie');
  });

  it('takes the current team "10" and jersey "90"', () => {
    expect(merzlikins().currentTeamExternalId).toBe('10');
    expect(merzlikins().jersey).toBe('90');
  });

  it('takes the name without diacritics from default ("Elvis Merzlikins")', () => {
    expect(merzlikins().firstName).toBe('Elvis');
    expect(merzlikins().lastName).toBe('Merzlikins');
  });
});

describe('mapPlayerLanding: inputs no fixture contains (mutated copies)', () => {
  // A retired player: no sweaterNumber, no currentTeamId.
  const retired = () => {
    const raw = landing('8476878');
    delete obj(raw).sweaterNumber;
    delete obj(raw).currentTeamId;
    return mapPlayerLanding(raw).player;
  };

  it('maps a retired player without sweaterNumber to jersey null', () => {
    expect(retired().jersey).toBeNull();
  });

  it('maps a retired player without currentTeamId to currentTeamExternalId null', () => {
    expect(retired().currentTeamExternalId).toBeNull();
  });

  it('maps an unknown birthCountry "XXX" to null with a warning naming endpoint, player and value', () => {
    const raw = landing('8476878');
    obj(raw).birthCountry = 'XXX';
    const result = mapPlayerLanding(raw);
    expect(result.player.birthCountry).toBeNull();
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('nhl player-landing');
    expect(result.warnings[0]).toContain('8476878');
    expect(result.warnings[0]).toContain('"XXX"');
  });

  it('maps missing birth fields to null without a warning', () => {
    const raw = landing('8476878');
    delete obj(raw).birthCountry;
    delete obj(raw).birthCity;
    delete obj(raw).birthDate;
    const result = mapPlayerLanding(raw);
    expect(result.player.birthCountry).toBeNull();
    expect(result.player.birthCity).toBeNull();
    expect(result.player.birthDate).toBeNull();
    expect(result.warnings).toEqual([]);
  });
});

describe('mapPlayerLanding: errors', () => {
  it.each([
    [
      'missing firstName',
      (raw: unknown) => {
        delete obj(raw).firstName;
      },
    ],
    [
      'playerId as a string',
      (raw: unknown) => {
        obj(raw).playerId = '8476878';
      },
    ],
    [
      'missing position',
      (raw: unknown) => {
        delete obj(raw).position;
      },
    ],
  ])('throws "nhl player-landing: invalid payload" on %s', (_what, mutate) => {
    const raw = landing('8476878');
    mutate(raw);
    expect(() => mapPlayerLanding(raw)).toThrow(/^nhl player-landing: invalid payload/);
  });
});

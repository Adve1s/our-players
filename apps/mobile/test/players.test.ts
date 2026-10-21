import type { PlayerSummary } from '@our-players/shared';
import { describe, expect, it } from 'vitest';
import { listIds, listRows, playerMeta, searchTerm } from '../src/lib/players';

const porzingis: PlayerSummary = {
  id: 'nba-3102531',
  league: 'NBA',
  firstName: 'Kristaps',
  lastName: 'Porziņģis',
  position: 'C',
  team: { abbrev: 'BOS', name: 'Boston Celtics' },
  nationality: 'LVA',
  active: true,
};

const player = (
  id: string,
  league: PlayerSummary['league'],
  firstName: string,
  lastName: string,
): PlayerSummary => ({ ...porzingis, id, league, firstName, lastName });

describe('searchTerm', () => {
  it.each([
    ['an empty string', ''],
    ['a single space', ' '],
    ['one letter', 'p'],
    ['one letter padded with spaces', ' p '],
  ])('gives null for %s', (_label, raw) => {
    expect(searchTerm(raw)).toBeNull();
  });

  it('keeps a two-letter term', () => {
    expect(searchTerm('po')).toBe('po');
  });

  it('trims the term', () => {
    expect(searchTerm('  porz  ')).toBe('porz');
  });

  it('cuts a long term to its first 50 characters', () => {
    const long = 'abcdefghij'.repeat(6);
    expect(searchTerm(long)).toBe(long.slice(0, 50));
  });
});

describe('playerMeta', () => {
  it('shows league, team, position and nationality', () => {
    expect(playerMeta(porzingis)).toBe('NBA · BOS · C · LVA');
  });

  it('shows "No team" for a player without a team', () => {
    expect(playerMeta({ ...porzingis, team: null })).toBe('NBA · No team · C · LVA');
  });

  it('leaves the code out for a player without a nationality', () => {
    expect(playerMeta({ ...porzingis, nationality: null })).toBe('NBA · BOS · C');
  });
});

describe('listRows', () => {
  const ozolins = player('nhl-3', 'NHL', 'Oskars', 'Ozolins');
  const zemgus = player('nhl-2', 'NHL', 'Zemgus', 'Berzins');
  const andris = player('nhl-1', 'NHL', 'Andris', 'Berzins');
  const nbaPlayer = player('nba-4', 'NBA', 'Davis', 'Bertans');

  it('drops players of leagues that are not selected', () => {
    const rows = listRows([nbaPlayer, andris], ['NHL'], new Set());
    expect(rows.map((r) => r.player.id)).toEqual(['nhl-1']);
  });

  it('sorts by last name, then first name', () => {
    const rows = listRows([ozolins, zemgus, andris], ['NBA', 'NHL'], new Set());
    expect(rows.map((r) => r.player.id)).toEqual(['nhl-1', 'nhl-2', 'nhl-3']);
  });

  it('marks removed exactly for the IDs in the set', () => {
    const rows = listRows([ozolins, zemgus, andris], ['NHL'], new Set(['nhl-2']));
    expect(rows.map((r) => [r.player.id, r.removed])).toEqual([
      ['nhl-1', false],
      ['nhl-2', true],
      ['nhl-3', false],
    ]);
  });

  it('gives no rows for no players', () => {
    expect(listRows([], ['NBA', 'NHL'], new Set())).toEqual([]);
  });
});

describe('listIds', () => {
  it('adds the IDs removed from this list, sorted and unique', () => {
    const removed = new Map([
      ['nhl-1', 'favorite'],
      ['nhl-9', 'hidden'],
    ] as const);
    expect(listIds(['nhl-3', 'nhl-2'], removed, 'favorite')).toEqual(['nhl-1', 'nhl-2', 'nhl-3']);
    expect(listIds(['nhl-9'], removed, 'hidden')).toEqual(['nhl-9']);
  });

  it('gives no IDs for an empty list with nothing removed', () => {
    expect(listIds([], new Map(), 'favorite')).toEqual([]);
  });
});

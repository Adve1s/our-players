import type { PlayerSummary } from '@our-players/shared';
import { describe, expect, it } from 'vitest';
import { listIds, listRows, listView, playerMeta, searchTerm } from '../src/lib/players';

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
  const all = ['nhl-1', 'nhl-2', 'nhl-3'];

  it('drops players whose IDs were not asked for (an older placeholder result)', () => {
    const rows = listRows([ozolins, zemgus, andris], ['nhl-2'], ['NHL'], new Set());
    expect(rows.map((r) => r.player.id)).toEqual(['nhl-2']);
  });

  it('gives no rows when no IDs were asked for', () => {
    expect(listRows([ozolins], [], ['NHL'], new Set())).toEqual([]);
  });

  it('drops players of leagues that are not selected', () => {
    const rows = listRows([nbaPlayer, andris], ['nba-4', 'nhl-1'], ['NHL'], new Set());
    expect(rows.map((r) => r.player.id)).toEqual(['nhl-1']);
  });

  it('sorts by last name, then first name', () => {
    const rows = listRows([ozolins, zemgus, andris], all, ['NBA', 'NHL'], new Set());
    expect(rows.map((r) => r.player.id)).toEqual(['nhl-1', 'nhl-2', 'nhl-3']);
  });

  it('marks removed exactly for the IDs in the set', () => {
    const rows = listRows([ozolins, zemgus, andris], all, ['NHL'], new Set(['nhl-2']));
    expect(rows.map((r) => [r.player.id, r.removed])).toEqual([
      ['nhl-1', false],
      ['nhl-2', true],
      ['nhl-3', false],
    ]);
  });

  it('gives no rows for no players', () => {
    expect(listRows([], [], ['NBA', 'NHL'], new Set())).toEqual([]);
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

describe('listView', () => {
  const idle = {
    data: undefined,
    isPending: true,
    isError: false,
    fetchStatus: 'idle',
    isPlaceholderData: false,
  } as const;
  const loaded = { ...idle, data: { players: [] as PlayerSummary[] }, isPending: false };
  const row = { player: porzingis, removed: false };

  it('empty with no IDs', () => {
    expect(listView([], idle, [])).toBe('empty');
  });

  it('loading while the first result is on its way', () => {
    expect(listView(['nba-3102531'], { ...idle, fetchStatus: 'fetching' }, [])).toBe('loading');
  });

  it('offline while paused without a result', () => {
    expect(listView(['nba-3102531'], { ...idle, fetchStatus: 'paused' }, [])).toBe('offline');
  });

  it('error when the fetch failed and nothing is loaded', () => {
    expect(listView(['nba-3102531'], { ...idle, isPending: false, isError: true }, [])).toBe(
      'error',
    );
  });

  it('keeps the rows when a background refetch fails', () => {
    expect(listView(['nba-3102531'], { ...loaded, isError: true }, [row])).toBe('rows');
  });

  it('none shown when the list has IDs but no row (a deselected league)', () => {
    expect(listView(['nba-3102531'], loaded, [])).toBe('none-shown');
  });

  it('rows when there are rows', () => {
    expect(listView(['nba-3102531'], loaded, [row])).toBe('rows');
  });
});

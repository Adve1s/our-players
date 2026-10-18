import { describe, expect, it } from 'vitest';
import { parseJobArgs, parseRecapArgs } from '../src/cli-args';

describe('parseJobArgs', () => {
  it('defaults the league to NHL', () => {
    expect(parseJobArgs(['results'])).toEqual({
      name: 'results',
      args: { league: 'NHL', catchUp: true },
    });
  });

  it('takes --league and --date', () => {
    expect(parseJobArgs(['results', '--league', 'nhl', '--date', '2026-01-17'])).toEqual({
      name: 'results',
      args: { league: 'NHL', date: '2026-01-17', catchUp: true },
    });
  });

  // Only the scheduler's 10-minute ticks need the 24 h bound; a manual run is rare and deliberate.
  it('a manual results run catches up corrections of any age', () => {
    expect(parseJobArgs(['results']).args.catchUp).toBe(true);
  });

  it.each(['schedule', 'roster'])('accepts --date for %s', (name) => {
    expect(parseJobArgs([name, '--date', '2026-01-17'])).toEqual({
      name,
      args: { league: 'NHL', date: '2026-01-17' },
    });
  });

  it('takes --from and --to for backfill', () => {
    expect(parseJobArgs(['backfill', '--from', '2026-03-23', '--to', '2026-03-24'])).toEqual({
      name: 'backfill',
      args: { league: 'NHL', from: '2026-03-23', to: '2026-03-24' },
    });
  });

  it.each([
    [[], 'unknown job'],
    [['nope'], 'unknown job'],
    [['results', '--league', 'nba'], 'nba arrives in S05'],
    [['results', '--date', '2026-02-30'], 'invalid date'],
    [['backfill', '--from', '2026-03-24', '--to', '2026-03-23'], '--from is after --to'],
    [['backfill', '--from', '2026-03-23'], 'backfill needs --from and --to'],
    [['results', '--from', '2026-03-23'], 'only backfill takes --from/--to'],
  ])('rejects %j with "%s"', (argv, message) => {
    expect(() => parseJobArgs(argv)).toThrow(message);
  });
});

describe('parseRecapArgs', () => {
  it('defaults the countries to LVA', () => {
    expect(parseRecapArgs(['--date', '2026-01-17'])).toEqual({
      date: '2026-01-17',
      countries: ['LVA'],
    });
  });

  it('takes a comma-separated --countries list', () => {
    expect(parseRecapArgs(['--date', '2026-01-17', '--countries', 'LVA,EST'])).toEqual({
      date: '2026-01-17',
      countries: ['LVA', 'EST'],
    });
  });

  it('needs a date', () => {
    expect(() => parseRecapArgs([])).toThrow('--date');
  });

  it('rejects an unknown country code', () => {
    expect(() => parseRecapArgs(['--date', '2026-01-17', '--countries', 'LAV'])).toThrow(
      'unknown country code LAV',
    );
  });
});

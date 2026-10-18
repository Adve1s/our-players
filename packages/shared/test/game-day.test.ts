import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { latestStartedGameDay, nextGameDay, previousGameDay, usGameDay } from '../src/index';

describe('usGameDay', () => {
  it.each([
    ['US evening, after midnight UTC', '2026-03-24T03:00:00Z', '2026-03-23'],
    ['West Coast games still on, after midnight Eastern', '2026-03-24T06:30:00Z', '2026-03-23'],
    ['after midnight Pacific (PDT)', '2026-03-24T07:30:00Z', '2026-03-24'],
    ['still before midnight Pacific (PST)', '2026-01-17T07:30:00Z', '2026-01-16'],
    ['UTC midday', '2026-10-18T12:00:00Z', '2026-10-18'],
  ])('%s: %s → %s', (_, now, day) => expect(usGameDay(new Date(now))).toBe(day));
});

// The scheduler runs on hosts in any zone; none of these may depend on the host's local time.
describe.each(['UTC', 'Europe/Riga', 'Pacific/Honolulu'])('host TZ %s', (tz) => {
  // vi.stubEnv sets process.env.TZ (Node re-reads it at runtime); unstubAllEnvs restores or deletes it.
  // packages/shared has no Node types, so the test does not touch `process` directly.
  beforeEach(() => {
    vi.stubEnv('TZ', tz);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('usGameDay', () => {
    it('stays on the previous day one minute before midnight PDT', () =>
      expect(usGameDay(new Date('2026-10-18T06:59:00Z'))).toBe('2026-10-17'));
    it('turns over at midnight PDT (UTC−7)', () =>
      expect(usGameDay(new Date('2026-10-18T07:00:00Z'))).toBe('2026-10-18'));
  });

  describe('latestStartedGameDay', () => {
    const games = [
      { gameDate: '2026-10-17', startTimeUtc: new Date('2026-10-18T02:30:00Z') },
      { gameDate: '2026-10-18', startTimeUtc: new Date('2026-10-18T23:00:00Z') },
    ];
    it('ignores a game that has not started yet', () =>
      expect(latestStartedGameDay(games, new Date('2026-10-18T22:59:00Z'))).toBe('2026-10-17'));
    it('counts a game starting exactly now', () =>
      expect(latestStartedGameDay(games, new Date('2026-10-18T23:00:00Z'))).toBe('2026-10-18'));
    it('is null before every start', () =>
      expect(latestStartedGameDay(games, new Date('2026-10-18T02:29:00Z'))).toBeNull());
    it('is null with no games', () =>
      expect(latestStartedGameDay([], new Date('2026-10-18T23:00:00Z'))).toBeNull());
    it('does not depend on input order', () =>
      expect(latestStartedGameDay([...games].reverse(), new Date('2026-10-18T23:00:00Z'))).toBe(
        '2026-10-18',
      ));
  });

  describe('previousGameDay / nextGameDay', () => {
    const days = ['2026-10-15', '2026-10-18', '2026-10-15', '2026-10-12'];
    it.each([
      ['a game day', '2026-10-15', '2026-10-12'],
      ['a non-game day', '2026-10-17', '2026-10-15'],
      ['the first game day', '2026-10-12', null],
    ])('previous from %s (%s) → %s', (_, day, expected) =>
      expect(previousGameDay(days, day)).toBe(expected),
    );
    it.each([
      ['a game day', '2026-10-15', '2026-10-18'],
      ['a non-game day', '2026-10-17', '2026-10-18'],
      ['the last game day', '2026-10-18', null],
    ])('next from %s (%s) → %s', (_, day, expected) =>
      expect(nextGameDay(days, day)).toBe(expected),
    );
  });
});

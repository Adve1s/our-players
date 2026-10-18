import { describe, expect, it } from 'vitest';
import { usGameDay } from '../src/index';

describe('usGameDay', () => {
  it.each([
    ['US evening, after midnight UTC', '2026-03-24T03:00:00Z', '2026-03-23'],
    ['West Coast games still on, after midnight Eastern', '2026-03-24T06:30:00Z', '2026-03-23'],
    ['after midnight Pacific (PDT)', '2026-03-24T07:30:00Z', '2026-03-24'],
    ['still before midnight Pacific (PST)', '2026-01-17T07:30:00Z', '2026-01-16'],
    ['UTC midday', '2026-10-18T12:00:00Z', '2026-10-18'],
  ])('%s: %s → %s', (_, now, day) => expect(usGameDay(new Date(now))).toBe(day));
});

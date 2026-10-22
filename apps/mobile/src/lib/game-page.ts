import type { BoxScoreRow, GameResponse } from '@our-players/shared';
import { dayLabel, startTime } from './format';

export type PeriodTable = { labels: string[]; rows: { abbrev: string; cells: string[] }[] };

const SIDES = ['away', 'home'] as const;

export function periodTable(game: GameResponse): PeriodTable | null {
  const periods = game.periodScores;
  if (periods === null || periods.length === 0) return null;
  return {
    labels: [...periods.map((p) => p.period), 'T'],
    rows: SIDES.map((side) => {
      const goals = periods.map((p) => p[side]);
      // The game's score, so a shootout totals the result and a live game the score so far.
      const total = game[side].score ?? goals.reduce((sum, n) => sum + n, 0);
      return { abbrev: game[side].abbrev, cells: [...goals, total].map(String) };
    }),
  };
}

// A screen reader gets each number with its period, or "1, 1, 1, 0, 1" can't tell OT from SO.
export function periodTableLabel(table: PeriodTable): string {
  const last = table.labels.length - 1;
  const names = table.labels.map((l, i) =>
    i === last ? 'total' : /^\d+$/.test(l) ? `period ${l}` : l,
  );
  return table.rows
    .map((r) => [r.abbrev, ...r.cells.map((c, i) => `${names[i]}: ${c}`)].join(', '))
    .join('; ');
}

export type BoxSection = { side: 'away' | 'home'; abbrev: string; rows: BoxScoreRow[] };

export const boxSections = (game: GameResponse): BoxSection[] =>
  SIDES.map((side) => ({
    side,
    abbrev: game[side].abbrev,
    rows: game.rows.filter((r) => r.side === side),
  })).filter((s) => s.rows.length > 0);

export const gameWhen = (game: GameResponse, locale?: string, timeZone?: string): string =>
  `${dayLabel(game.gameDate)} · ${startTime(game.startTimeUtc, game.gameDate, locale, timeZone)}`;

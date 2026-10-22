import {
  type BoxScoreRow,
  type GameResponse,
  type PublicId,
  publicIdSchema,
} from '@our-players/shared';
import { dayLabel, startTime } from './format';

// A repeated `?id=` arrives as an array; anything but one valid public ID is no page.
export const pageId = (raw: string | string[] | undefined): PublicId | null =>
  typeof raw === 'string' && publicIdSchema.safeParse(raw).success ? raw : null;

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

export type BoxSection = { side: 'away' | 'home'; abbrev: string; rows: BoxScoreRow[] };

export const boxSections = (game: GameResponse): BoxSection[] =>
  SIDES.map((side) => ({
    side,
    abbrev: game[side].abbrev,
    rows: game.rows.filter((r) => r.side === side),
  })).filter((s) => s.rows.length > 0);

export const gameWhen = (game: GameResponse, locale?: string, timeZone?: string): string =>
  `${dayLabel(game.gameDate)} · ${startTime(game.startTimeUtc, game.gameDate, locale, timeZone)}`;

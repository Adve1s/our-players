import type { SeasonStats } from '@our-players/shared';

// Season and season type are read from the response's requestedSeason.
export function mapByAthlete(raw: unknown): {
  seasonStats: SeasonStats[];
  page: number;
  pages: number;
  count: number;
} {
  throw new Error('not implemented');
}

import type { SeasonStats, SeasonType } from '@our-players/shared';

export function mapSkaterSummary(
  _raw: unknown,
  _seasonType: SeasonType,
): { seasonStats: SeasonStats[]; total: number } {
  throw new Error('not implemented');
}

export function mapGoalieSummary(
  _raw: unknown,
  _seasonType: SeasonType,
): { seasonStats: SeasonStats[]; total: number } {
  throw new Error('not implemented');
}

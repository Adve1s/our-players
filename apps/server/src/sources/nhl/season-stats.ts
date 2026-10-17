import type { SeasonStats, SeasonType } from '@our-players/shared';
import { parsePayload, seasonFromId } from './common';
import { goalieSummarySchema, skaterSummarySchema } from './schemas';

// Values as the source gives them, never recomputed or rounded (rule 5). The response has no
// game type, so the caller passes the one its URL asked for.

export function mapSkaterSummary(
  raw: unknown,
  seasonType: SeasonType,
): { seasonStats: SeasonStats[]; total: number } {
  const { total, data } = parsePayload(skaterSummarySchema, 'skater-summary', raw);
  const seasonStats = data.map((r) => ({
    playerPublicId: `nhl-${r.playerId}`,
    season: seasonFromId(r.seasonId, `nhl skater-summary: player ${r.playerId}`),
    seasonType,
    kind: 'hockey_skater' as const,
    basis: 'totals' as const,
    stats: {
      gamesPlayed: r.gamesPlayed,
      goals: r.goals,
      assists: r.assists,
      points: r.points,
      plusMinus: r.plusMinus,
      shots: r.shots,
      pim: r.penaltyMinutes,
      powerPlayGoals: r.ppGoals,
      toiPerGameSeconds: r.timeOnIcePerGame,
    },
  }));
  return { seasonStats, total };
}

export function mapGoalieSummary(
  raw: unknown,
  seasonType: SeasonType,
): { seasonStats: SeasonStats[]; total: number } {
  const { total, data } = parsePayload(goalieSummarySchema, 'goalie-summary', raw);
  const seasonStats = data.map((r) => ({
    playerPublicId: `nhl-${r.playerId}`,
    season: seasonFromId(r.seasonId, `nhl goalie-summary: player ${r.playerId}`),
    seasonType,
    kind: 'hockey_goalie' as const,
    basis: 'totals' as const,
    stats: {
      gamesPlayed: r.gamesPlayed,
      gamesStarted: r.gamesStarted,
      wins: r.wins,
      losses: r.losses,
      otLosses: r.otLosses,
      saves: r.saves,
      shotsAgainst: r.shotsAgainst,
      goalsAgainst: r.goalsAgainst,
      // The source gives null with no shots faced; stats hold numbers only, so the key is left out.
      ...(r.savePct === null ? {} : { savePct: r.savePct }),
      goalsAgainstAverage: r.goalsAgainstAverage,
      shutouts: r.shutouts,
      toiSeconds: r.timeOnIce,
    },
  }));
  return { seasonStats, total };
}

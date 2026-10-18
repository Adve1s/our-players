import type { SeasonStats, SeasonType } from '@our-players/shared';
import { lookup, parsePayload, SEASON_TYPES, seasonFromYear } from './common';
import { byAthleteSchema } from './schemas';

// Totals and percentages as the source gives them (rule 5); labels repeat, so values go by stat name.
const TOTALS = {
  gamesPlayed: ['general', 'gamesPlayed'],
  minutes: ['general', 'minutes'],
  rebounds: ['general', 'rebounds'],
  fouls: ['general', 'fouls'],
  points: ['offensive', 'points'],
  assists: ['offensive', 'assists'],
  turnovers: ['offensive', 'turnovers'],
  fgMade: ['offensive', 'fieldGoalsMade'],
  fgAttempted: ['offensive', 'fieldGoalsAttempted'],
  threeMade: ['offensive', 'threePointFieldGoalsMade'],
  threeAttempted: ['offensive', 'threePointFieldGoalsAttempted'],
  ftMade: ['offensive', 'freeThrowsMade'],
  ftAttempted: ['offensive', 'freeThrowsAttempted'],
  steals: ['defensive', 'steals'],
  blocks: ['defensive', 'blocks'],
} as const;
// ESPN gives 47.56; we store 0–1.
const PERCENTAGES = {
  fgPct: ['offensive', 'fieldGoalPct'],
  threePct: ['offensive', 'threePointFieldGoalPct'],
  ftPct: ['offensive', 'freeThrowPct'],
} as const;

// Season and season type are read from the response's requestedSeason.
export function mapByAthlete(raw: unknown): {
  seasonStats: SeasonStats[];
  season: string;
  seasonType: SeasonType;
  page: number;
  pages: number;
  count: number;
} {
  const { pagination, requestedSeason, categories, athletes } = parsePayload(
    byAthleteSchema,
    'byathlete',
    raw,
  );
  const seasonType = lookup(SEASON_TYPES, requestedSeason.type.type);
  if (!seasonType) {
    throw new Error(`espn-nba byathlete: unknown season type ${requestedSeason.type.type}`);
  }
  const season = seasonFromYear(requestedSeason.year);
  const names = new Map(categories.map((c) => [c.name, c.names]));

  const seasonStats = athletes.map((a) => {
    const where = `espn-nba byathlete: player ${a.athlete.id}`;
    const value = ([category, name]: readonly [string, string]): number => {
      const index = names.get(category)?.indexOf(name) ?? -1;
      const v = a.categories.find((c) => c.name === category)?.values[index];
      if (v === undefined) throw new Error(`${where}: missing stat ${category}.${name}`);
      return v;
    };
    const stats: Record<string, number> = {};
    for (const [key, path] of Object.entries(TOTALS)) stats[key] = value(path);
    for (const [key, path] of Object.entries(PERCENTAGES)) stats[key] = value(path) / 100;
    return {
      playerPublicId: `nba-${a.athlete.id}`,
      season,
      seasonType,
      kind: 'basketball_player' as const,
      basis: 'totals' as const,
      stats,
    };
  });
  return {
    seasonStats,
    season,
    seasonType,
    page: pagination.page,
    pages: pagination.pages,
    count: pagination.count,
  };
}

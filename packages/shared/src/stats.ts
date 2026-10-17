import { z } from 'zod';
import type { StatKind } from './enums';

// VISION §8. Strict objects: an unknown key is a typo, not data.
const count = z.int().nonnegative();

export const hockeySkaterStatsSchema = z.strictObject({
  goals: count,
  assists: count,
  points: count,
  plusMinus: z.int(),
  shots: count,
  toiSeconds: count,
  pim: count.optional(),
  hits: count.optional(),
  blocks: count.optional(),
  powerPlayGoals: count.optional(),
});
export type HockeySkaterStats = z.infer<typeof hockeySkaterStatsSchema>;

export const hockeyGoalieStatsSchema = z.strictObject({
  saves: count,
  shotsAgainst: count,
  goalsAgainst: count,
  savePct: z.number().min(0).max(1).nullable(), // null when no shots faced
  toiSeconds: count,
  decision: z.enum(['W', 'L', 'OTL']).nullable(),
});
export type HockeyGoalieStats = z.infer<typeof hockeyGoalieStatsSchema>;

export const basketballPlayerStatsSchema = z.strictObject({
  minutes: count,
  points: count,
  rebounds: count,
  assists: count,
  fgMade: count,
  fgAttempted: count,
  threeMade: count,
  threeAttempted: count,
  ftMade: count,
  ftAttempted: count,
  turnovers: count,
  steals: count,
  blocks: count,
  offRebounds: count,
  defRebounds: count,
  fouls: count,
  plusMinus: z.int(),
});
export type BasketballPlayerStats = z.infer<typeof basketballPlayerStatsSchema>;

export const statPayloadSchemas = {
  hockey_skater: hockeySkaterStatsSchema,
  hockey_goalie: hockeyGoalieStatsSchema,
  basketball_player: basketballPlayerStatsSchema,
} satisfies Record<StatKind, z.ZodType>;

// The message names the kind, field and problem, so a bad payload is traceable from a log line.
export function parseStatPayload<K extends StatKind>(
  kind: K,
  value: unknown,
): z.infer<(typeof statPayloadSchemas)[K]> {
  const result = statPayloadSchemas[kind].safeParse(value);
  if (!result.success) throw new Error(`invalid ${kind} stats:\n${z.prettifyError(result.error)}`);
  // TS cannot narrow the union of outputs through the generic index K.
  return result.data as z.infer<(typeof statPayloadSchemas)[K]>;
}

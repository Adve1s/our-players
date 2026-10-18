import { z } from 'zod';
import { countryCodeSchema } from '../countries';
import { endedInSchema, gameStatusSchema, leagueSchema, seasonTypeSchema } from '../enums';
import { publicIdSchema } from '../ids';
import {
  basketballPlayerStatsSchema,
  hockeyGoalieStatsSchema,
  hockeySkaterStatsSchema,
} from '../stats';

// Plain z.object, not strict: an app from the store must still parse a response that gained a field.

export const errorResponseSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;

export const healthResponseSchema = z.object({
  ok: z.literal(true),
  lastSuccess: z.record(z.string(), z.iso.datetime()),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const metaResponseSchema = z.object({
  leagues: z.array(
    z.object({
      league: leagueSchema,
      currentSeason: z.string().nullable(),
      latestGameDate: z.iso.date().nullable(),
    }),
  ),
  dataUpdatedAt: z.iso.datetime().nullable(),
});
export type MetaResponse = z.infer<typeof metaResponseSchema>;

const teamScore = z.object({ abbrev: z.string(), score: z.int().nullable() });

const gameSummary = z.object({
  id: publicIdSchema,
  league: leagueSchema,
  seasonType: seasonTypeSchema,
  gameDate: z.iso.date(),
  startTimeUtc: z.iso.datetime(),
  status: gameStatusSchema,
  endedIn: endedInSchema.nullable(),
  away: teamScore,
  home: teamScore,
});

const playerRef = z.object({
  id: publicIdSchema,
  firstName: z.string(),
  lastName: z.string(),
  nationality: countryCodeSchema.nullable(),
});

const line = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('hockey_skater'), stats: z.object(hockeySkaterStatsSchema.shape) }),
  z.object({ kind: z.literal('hockey_goalie'), stats: z.object(hockeyGoalieStatsSchema.shape) }),
  z.object({
    kind: z.literal('basketball_player'),
    stats: z.object(basketballPlayerStatsSchema.shape),
  }),
]);

// side, not a team object: the game already carries both teams.
const side = z.enum(['away', 'home']);

export const playerRowSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('line'), side, player: playerRef, line }),
  z.object({ type: z.literal('dnp'), side, player: playerRef, reason: z.string().nullable() }),
  z.object({ type: z.literal('not-in-lineup'), side, player: playerRef }),
]);
export type PlayerRow = z.infer<typeof playerRowSchema>;

export const dayGameSchema = gameSummary.extend({ rows: z.array(playerRowSchema) });
export type DayGameResponse = z.infer<typeof dayGameSchema>;

export const dayResponseSchema = z.object({
  gameDate: z.iso.date(),
  prevGameDate: z.iso.date().nullable(),
  nextGameDate: z.iso.date().nullable(),
  games: z.array(dayGameSchema),
});
export type DayResponse = z.infer<typeof dayResponseSchema>;

export const gameResponseSchema = dayGameSchema.extend({
  // null: a schedule-only game with no box score yet.
  periodScores: z.array(z.object({ period: z.string(), away: z.int(), home: z.int() })).nullable(),
});
export type GameResponse = z.infer<typeof gameResponseSchema>;

import { z } from 'zod';
import { countryCodeSchema } from '../countries';
import {
  endedInSchema,
  gameStatusSchema,
  leagueSchema,
  nationalitySourceSchema,
  positionGroupSchema,
  seasonTypeSchema,
} from '../enums';
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

// A stale answer is a 503 in the error format, so only the healthy body needs a schema.
export const dataHealthResponseSchema = z.object({ ok: z.literal(true) });
export type DataHealthResponse = z.infer<typeof dataHealthResponseSchema>;

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

export const lineSchema = z.discriminatedUnion('kind', [
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
  z.object({ type: z.literal('line'), side, player: playerRef, line: lineSchema }),
  z.object({ type: z.literal('dnp'), side, player: playerRef, reason: z.string().nullable() }),
  z.object({ type: z.literal('not-in-lineup'), side, player: playerRef }),
  // No text field: the app words it from the game's status.
  z.object({ type: z.literal('upcoming'), side, player: playerRef }),
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

// A box-score row also says whether the player is one of the viewer's (isShown), so the app marks him.
export const boxScoreRowSchema = playerRowSchema.and(z.object({ shown: z.boolean() }));
export type BoxScoreRow = z.infer<typeof boxScoreRowSchema>;

export const gameResponseSchema = gameSummary.extend({
  rows: z.array(boxScoreRowSchema),
  // null: a schedule-only game with no box score yet.
  periodScores: z.array(z.object({ period: z.string(), away: z.int(), home: z.int() })).nullable(),
});
export type GameResponse = z.infer<typeof gameResponseSchema>;

export const playerSummarySchema = z.object({
  id: publicIdSchema,
  league: leagueSchema,
  firstName: z.string(),
  lastName: z.string(),
  position: z.string().nullable(),
  team: z.object({ abbrev: z.string(), name: z.string() }).nullable(), // current team
  nationality: countryCodeSchema.nullable(),
  active: z.boolean(),
});
export type PlayerSummary = z.infer<typeof playerSummarySchema>;

export const playersResponseSchema = z.object({ players: z.array(playerSummarySchema) });
export type PlayersResponse = z.infer<typeof playersResponseSchema>;

const seasonEntry = <K extends string, S extends z.ZodRawShape>(kind: K, stats: S) =>
  z.object({
    kind: z.literal(kind),
    season: z.string(),
    seasonType: seasonTypeSchema,
    basis: z.enum(['totals', 'per_game']),
    stats: z.object(stats),
  });

// Keys as the season-stats mappers store them: parsing each stored row makes a drifting mapper fail loudly.
export const seasonStatsEntrySchema = z.discriminatedUnion('kind', [
  seasonEntry('hockey_skater', {
    gamesPlayed: z.number(),
    goals: z.number(),
    assists: z.number(),
    points: z.number(),
    plusMinus: z.number(),
    shots: z.number(),
    pim: z.number(),
    powerPlayGoals: z.number(),
    toiPerGameSeconds: z.number(),
  }),
  seasonEntry('hockey_goalie', {
    gamesPlayed: z.number(),
    gamesStarted: z.number(),
    wins: z.number(),
    losses: z.number(),
    otLosses: z.number(),
    saves: z.number(),
    shotsAgainst: z.number(),
    goalsAgainst: z.number(),
    savePct: z.number().optional(), // absent with no shots faced
    goalsAgainstAverage: z.number(),
    shutouts: z.number(),
    toiSeconds: z.number(),
  }),
  seasonEntry('basketball_player', {
    gamesPlayed: z.number(),
    minutes: z.number(),
    points: z.number(),
    rebounds: z.number(),
    assists: z.number(),
    turnovers: z.number(),
    steals: z.number(),
    blocks: z.number(),
    fouls: z.number(),
    fgMade: z.number(),
    fgAttempted: z.number(),
    threeMade: z.number(),
    threeAttempted: z.number(),
    ftMade: z.number(),
    ftAttempted: z.number(),
    fgPct: z.number(),
    threePct: z.number(),
    ftPct: z.number(),
  }),
]);
export type SeasonStatsEntry = z.infer<typeof seasonStatsEntrySchema>;

export const gameLogEntrySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('line'), game: gameSummary, side, line: lineSchema }),
  z.object({ type: z.literal('dnp'), game: gameSummary, side, reason: z.string().nullable() }),
]);
export type GameLogEntry = z.infer<typeof gameLogEntrySchema>;

export const playerResponseSchema = playerSummarySchema.extend({
  positionGroup: positionGroupSchema.nullable(),
  jersey: z.string().nullable(),
  birthDate: z.iso.date().nullable(),
  birthCity: z.string().nullable(),
  birthCountry: countryCodeSchema.nullable(),
  // The app marks an override; null when nationality is null.
  nationalitySource: nationalitySourceSchema.nullable(),
  seasonStats: z.array(seasonStatsEntrySchema),
  gameLog: z.array(gameLogEntrySchema), // newest first, at most 10
});
export type PlayerResponse = z.infer<typeof playerResponseSchema>;

export const countriesResponseSchema = z.object({
  countries: z.array(
    z.object({
      code: countryCodeSchema,
      // A league with no players is left out, never 0.
      counts: z.partialRecord(leagueSchema, z.int().positive()),
    }),
  ),
});
export type CountriesResponse = z.infer<typeof countriesResponseSchema>;

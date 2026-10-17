import { z } from 'zod';

// Raw NHL payloads, the fields we use only: z.object strips unknown keys, the ones listed are strict.
const localized = z.object({ default: z.string() });

const periodDescriptor = z.object({
  number: z.int(),
  periodType: z.string(),
  maxRegulationPeriods: z.int(),
});

// score names a team `name`, schedule `commonName` (both "Blue Jackets"); one shape after parsing.
const gameTeam = z.object({ id: z.int(), abbrev: z.string(), score: z.int().optional() });
const scoreTeam = gameTeam
  .extend({ name: localized })
  .transform(({ name, ...t }) => ({ ...t, name: name.default }));
const scheduleTeam = gameTeam
  .extend({ commonName: localized })
  .transform(({ commonName, ...t }) => ({ ...t, name: commonName.default }));

// gameState and gameScheduleState stay strings: the mapper's tables reject unknown values by name.
const game = z.object({
  id: z.int(),
  season: z.int(),
  gameType: z.int(),
  startTimeUTC: z.string(),
  gameState: z.string(),
  gameScheduleState: z.string(),
  periodDescriptor: periodDescriptor.nullish(),
  gameOutcome: z.object({ lastPeriodType: z.string() }).optional(),
});

// Only gameType 1–3 (PRE/REG/POST) are league games. Others (All-Star, international) are dropped
// before the strict parse: their placeholder teams may lack fields, and one would sink the payload.
// A game without a numeric gameType is kept, so the strict parse still fails on it.
const LEAGUE_GAME_TYPES: readonly unknown[] = [1, 2, 3];
const gameTypeOnly = z.object({ gameType: z.int() });
const leagueGames = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (games) =>
      Array.isArray(games)
        ? games.filter((g: unknown) => {
            const parsed = gameTypeOnly.safeParse(g);
            return !parsed.success || LEAGUE_GAME_TYPES.includes(parsed.data.gameType);
          })
        : games,
    z.array(schema),
  );

export const scoreGameSchema = game.extend({
  gameDate: z.string(),
  awayTeam: scoreTeam,
  homeTeam: scoreTeam,
  goals: z
    .array(z.object({ periodDescriptor: z.object({ number: z.int() }), teamAbbrev: z.string() }))
    .optional(),
});
export const scoreSchema = z.object({ games: leagueGames(scoreGameSchema) });

export const scheduleGameSchema = game.extend({ awayTeam: scheduleTeam, homeTeam: scheduleTeam });
export const scheduleSchema = z.object({
  gameWeek: z.array(z.object({ date: z.string(), games: leagueGames(scheduleGameSchema) })),
});

const boxscorePlayer = {
  playerId: z.int(),
  sweaterNumber: z.int(),
  position: z.string(),
  name: localized,
  toi: z.string(),
};
const boxscoreSkater = z.object({
  ...boxscorePlayer,
  goals: z.int(),
  assists: z.int(),
  points: z.int(),
  plusMinus: z.int(),
  sog: z.int(),
  pim: z.int(),
  hits: z.int(),
  blockedShots: z.int(),
  powerPlayGoals: z.int(),
});
const boxscoreGoalie = z.object({
  ...boxscorePlayer,
  saves: z.int(),
  shotsAgainst: z.int(),
  goalsAgainst: z.int(),
  savePctg: z.number().optional(),
  decision: z.string().optional(),
  starter: z.boolean().optional(),
});
const boxscoreSide = z.object({
  forwards: z.array(boxscoreSkater),
  defense: z.array(boxscoreSkater),
  goalies: z.array(boxscoreGoalie),
});
const boxscoreTeam = z.object({ id: z.int(), abbrev: z.string(), commonName: localized });
export const boxscoreSchema = z.object({
  id: z.int(),
  awayTeam: boxscoreTeam,
  homeTeam: boxscoreTeam,
  playerByGameStats: z.object({ awayTeam: boxscoreSide, homeTeam: boxscoreSide }),
});

const bio = {
  firstName: localized,
  lastName: localized,
  sweaterNumber: z.int().optional(),
  birthDate: z.string().optional(),
  birthCity: localized.optional(),
  birthCountry: z.string().optional(),
};
const rosterPlayer = z.object({ ...bio, id: z.int(), positionCode: z.string() });
export const rosterSchema = z.object({
  forwards: z.array(rosterPlayer),
  defensemen: z.array(rosterPlayer),
  goalies: z.array(rosterPlayer),
});

export const playerLandingSchema = z.object({
  ...bio,
  playerId: z.int(),
  position: z.string(),
  currentTeamId: z.int().optional(),
});

export const skaterSummarySchema = z.object({
  total: z.int(),
  data: z.array(
    z.object({
      playerId: z.int(),
      seasonId: z.int(),
      gamesPlayed: z.int(),
      goals: z.int(),
      assists: z.int(),
      points: z.int(),
      plusMinus: z.int(),
      shots: z.int(),
      penaltyMinutes: z.int(),
      ppGoals: z.int(),
      timeOnIcePerGame: z.number(),
    }),
  ),
});

export const goalieSummarySchema = z.object({
  total: z.int(),
  data: z.array(
    z.object({
      playerId: z.int(),
      seasonId: z.int(),
      gamesPlayed: z.int(),
      gamesStarted: z.int(),
      wins: z.int(),
      losses: z.int(),
      otLosses: z.int(),
      saves: z.int(),
      shotsAgainst: z.int(),
      goalsAgainst: z.int(),
      savePct: z.number().nullable(),
      goalsAgainstAverage: z.number(),
      shutouts: z.int(),
      timeOnIce: z.int(),
    }),
  ),
});

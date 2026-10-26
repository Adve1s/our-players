import { z } from 'zod';

// Raw ESPN NBA payloads, the fields we use only: z.object strips unknown keys, the ones listed are strict.
// ESPN IDs are strings everywhere ("9", "3102531").

// At least one item, typed so `[0]` needs no check (zod's nonempty() keeps the type T[]).
const nonEmpty = <T extends z.ZodType>(item: T) => z.tuple([item], item);

const team = z.object({ id: z.string(), abbreviation: z.string(), name: z.string() });

// Statuses and season types stay raw: the mapper's tables skip unknown values by name (D-035).
const competitor = z.object({
  homeAway: z.enum(['home', 'away']),
  team,
  // Read only for LIVE/FINAL games; a scheduled game shows "0".
  score: z.string().optional(),
  linescores: z.array(z.object({ value: z.int() })).optional(),
});
export const scoreboardEventSchema = z.object({
  id: z.string(),
  date: z.string(),
  season: z.object({ year: z.int(), type: z.int() }),
  status: z.object({ type: z.object({ name: z.string() }) }),
  competitions: nonEmpty(z.object({ competitors: z.array(competitor) })),
});
export const scoreboardSchema = z.object({ events: z.array(scoreboardEventSchema) });

const rowFields = {
  starter: z.boolean(),
  reason: z.string().optional(),
  stats: z.array(z.string()),
};
const boxscoreRow = z.union([
  z.object({
    athlete: z.object({
      id: z.string(),
      displayName: z.string(),
      jersey: z.string().nullish(),
      position: z.object({ abbreviation: z.string() }),
    }),
    didNotPlay: z.boolean(),
    ...rowFields,
  }),
  // Some DNP rows carry an athlete with only a short name (2025-26, game 401810126): no ID to
  // tie a line to and no stats to lose, so the mapper skips them. A played row must have an ID.
  z.object({
    athlete: z.object({ id: z.undefined().optional(), shortName: z.string().optional() }),
    didNotPlay: z.literal(true),
    ...rowFields,
  }),
]);
export const summarySchema = z.object({
  header: z.object({ id: z.string() }),
  boxscore: z.object({
    // Absent or empty before tip-off; the mapper says so instead of a generic parse error.
    players: z
      .array(
        z.object({
          team,
          statistics: nonEmpty(
            z.object({ labels: z.array(z.string()), athletes: z.array(boxscoreRow) }),
          ),
        }),
      )
      .optional(),
  }),
});

// roster/9 has `"jersey": null` for some athletes; others may omit it.
const bio = {
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  jersey: z.string().nullish(),
  position: z.object({ abbreviation: z.string() }),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T/)
    .optional(),
  birthPlace: z.object({ city: z.string().optional(), country: z.string().optional() }).optional(),
};
export const rosterSchema = z.object({
  team: z.object({ id: z.string() }),
  athletes: z.array(z.object(bio)),
});
export const athleteSchema = z.object({ ...bio, team: z.object({ $ref: z.string() }).optional() });

export const byAthleteSchema = z.object({
  pagination: z.object({ count: z.int(), page: z.int(), pages: z.int() }),
  requestedSeason: z.object({ year: z.int(), type: z.object({ type: z.int() }) }),
  // Stat names per category; an athlete's values line up with them by index.
  categories: z.array(z.object({ name: z.string(), names: z.array(z.string()) })),
  athletes: z.array(
    z.object({
      athlete: z.object({ id: z.string() }),
      categories: z.array(z.object({ name: z.string(), values: z.array(z.number()) })),
    }),
  ),
});

export const teamsSchema = z.object({
  sports: nonEmpty(
    z.object({ leagues: nonEmpty(z.object({ teams: z.array(z.object({ team })) })) }),
  ),
});

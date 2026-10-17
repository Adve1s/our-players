import {
  type CountryCode,
  endedInSchema,
  gameStatusSchema,
  leagueSchema,
  nationalitySourceSchema,
  type PeriodScore,
  positionGroupSchema,
  type SeasonStats,
  type StatLine,
  seasonTypeSchema,
  sourceSchema,
  sportSchema,
  statKindSchema,
} from '@our-players/shared';
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';

// Built from the shared zod enums so the DB rejects a value the model doesn't know.
export const leagueEnum = pgEnum('league', leagueSchema.enum);
export const sportEnum = pgEnum('sport', sportSchema.enum);
export const sourceEnum = pgEnum('source', sourceSchema.enum);
export const gameStatusEnum = pgEnum('game_status', gameStatusSchema.enum);
export const seasonTypeEnum = pgEnum('season_type', seasonTypeSchema.enum);
export const endedInEnum = pgEnum('ended_in', endedInSchema.enum);
export const statKindEnum = pgEnum('stat_kind', statKindSchema.enum);
export const positionGroupEnum = pgEnum('position_group', positionGroupSchema.enum);
export const nationalitySourceEnum = pgEnum('nationality_source', nationalitySourceSchema.enum);
const STAT_BASES = ['totals', 'per_game'] as const satisfies readonly SeasonStats['basis'][];
export const statBasisEnum = pgEnum('stat_basis', STAT_BASES);
// VISION §6.1: a roster run can fail for some teams and still store the rest.
export const JOB_STATUSES = ['running', 'succeeded', 'failed', 'partial'] as const;
export const jobStatusEnum = pgEnum('job_status', JOB_STATUSES);

const tz = { withTimezone: true } as const;
const updatedAt = () => timestamp('updated_at', tz).notNull().defaultNow();

export const leagues = pgTable('leagues', {
  code: leagueEnum('code').primaryKey(),
  sport: sportEnum('sport').notNull(),
  name: text('name').notNull(),
});

export const teams = pgTable(
  'teams',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    league: leagueEnum('league')
      .notNull()
      .references(() => leagues.code),
    source: sourceEnum('source').notNull(),
    externalId: text('external_id').notNull(),
    abbrev: text('abbrev').notNull(),
    name: text('name').notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [unique().on(t.source, t.externalId)],
);

export const players = pgTable(
  'players',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    publicId: text('public_id').notNull().unique(),
    league: leagueEnum('league')
      .notNull()
      .references(() => leagues.code),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    searchName: text('search_name').notNull(),
    position: text('position').notNull(),
    positionGroup: positionGroupEnum('position_group').notNull(),
    currentTeamId: integer('current_team_id').references(() => teams.id),
    jersey: text('jersey'),
    birthDate: date('birth_date', { mode: 'string' }),
    birthCity: text('birth_city'),
    birthCountry: text('birth_country').$type<CountryCode>(),
    nationality: text('nationality').$type<CountryCode>(),
    nationalitySource: nationalitySourceEnum('nationality_source'),
    active: boolean('active').notNull().default(true),
    updatedAt: updatedAt(),
  },
  (t) => [index('players_nationality_idx').on(t.nationality)],
);

export const playerExternalIds = pgTable(
  'player_external_ids',
  {
    source: sourceEnum('source').notNull(),
    externalId: text('external_id').notNull(),
    playerId: integer('player_id')
      .notNull()
      .references(() => players.id),
  },
  (t) => [
    primaryKey({ columns: [t.source, t.externalId] }),
    index('player_external_ids_player_id_idx').on(t.playerId),
  ],
);

export const games = pgTable(
  'games',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    publicId: text('public_id').notNull().unique(),
    source: sourceEnum('source').notNull(),
    externalId: text('external_id').notNull(),
    league: leagueEnum('league')
      .notNull()
      .references(() => leagues.code),
    season: text('season').notNull(),
    seasonType: seasonTypeEnum('season_type').notNull(),
    gameDate: date('game_date', { mode: 'string' }).notNull(),
    startTimeUtc: timestamp('start_time_utc', tz).notNull(),
    status: gameStatusEnum('status').notNull(),
    homeTeamId: integer('home_team_id')
      .notNull()
      .references(() => teams.id),
    awayTeamId: integer('away_team_id')
      .notNull()
      .references(() => teams.id),
    homeScore: integer('home_score'),
    awayScore: integer('away_score'),
    periodScores: jsonb('period_scores').$type<PeriodScore[]>(),
    endedIn: endedInEnum('ended_in'),
    // Ingestion bookkeeping: S04a's jobs set these.
    finalAt: timestamp('final_at', tz),
    boxscoreFetchedAt: timestamp('boxscore_fetched_at', tz),
    correctedAt: timestamp('corrected_at', tz),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique().on(t.source, t.externalId),
    // The game-day view.
    index('games_league_game_date_idx').on(t.league, t.gameDate),
  ],
);

export const statLines = pgTable(
  'stat_lines',
  {
    gameId: integer('game_id')
      .notNull()
      .references(() => games.id),
    playerId: integer('player_id')
      .notNull()
      .references(() => players.id),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id),
    kind: statKindEnum('kind').notNull(),
    played: boolean('played').notNull(),
    dnpReason: text('dnp_reason'),
    starter: boolean('starter'),
    stats: jsonb('stats').$type<StatLine['stats']>(),
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({ columns: [t.gameId, t.playerId] }),
    // The game log.
    index('stat_lines_player_id_idx').on(t.playerId),
  ],
);

export const seasonStats = pgTable(
  'season_stats',
  {
    playerId: integer('player_id')
      .notNull()
      .references(() => players.id),
    season: text('season').notNull(),
    seasonType: seasonTypeEnum('season_type').notNull(),
    kind: statKindEnum('kind').notNull(),
    basis: statBasisEnum('basis').notNull(),
    stats: jsonb('stats').notNull().$type<SeasonStats['stats']>(),
    // When these values were stored, not the last fetch: a repeat write is a no-op; feed freshness is job_runs (D-033).
    fetchedAt: timestamp('fetched_at', tz).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.playerId, t.season, t.seasonType, t.kind] })],
);

export const jobRuns = pgTable('job_runs', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  job: text('job').notNull(),
  args: jsonb('args').notNull().$type<Record<string, unknown>>(),
  startedAt: timestamp('started_at', tz).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', tz),
  status: jobStatusEnum('status').notNull(),
  counts: jsonb('counts').$type<Record<string, number>>(),
  error: text('error'),
});

import type { CountryCode } from './countries';
import type {
  EndedIn,
  GameStatus,
  League,
  PositionGroup,
  SeasonType,
  Source,
  StatKind,
} from './enums';
import type { PublicId } from './ids';

// What adapters return and repositories store. Ingestion bookkeeping and nationality
// (computed on store by resolveNationality) are deliberately not part of it.

// Temporary plain payload types; Task 4 replaces them with z.infer types from stats.ts.
export type HockeySkaterStats = {
  goals: number;
  assists: number;
  points: number;
  plusMinus: number;
  shots: number;
  toiSeconds: number;
  pim?: number;
  hits?: number;
  blocks?: number;
  powerPlayGoals?: number;
};
export type HockeyGoalieStats = {
  saves: number;
  shotsAgainst: number;
  goalsAgainst: number;
  savePct: number | null;
  toiSeconds: number;
  decision: 'W' | 'L' | 'OTL' | null;
};
export type BasketballPlayerStats = {
  minutes: number;
  points: number;
  rebounds: number;
  assists: number;
  fgMade: number;
  fgAttempted: number;
  threeMade: number;
  threeAttempted: number;
  ftMade: number;
  ftAttempted: number;
  turnovers: number;
  steals: number;
  blocks: number;
  offRebounds: number;
  defRebounds: number;
  fouls: number;
  plusMinus: number;
};

export type Team = {
  league: League;
  source: Source;
  externalId: string;
  abbrev: string;
  name: string;
};

export type Player = {
  publicId: PublicId;
  league: League;
  source: Source;
  externalId: string;
  firstName: string;
  lastName: string;
  position: string; // as the source gives it ('C', 'L', 'PG')
  positionGroup: PositionGroup;
  currentTeamExternalId: string | null;
  jersey: string | null;
  birthDate: string | null; // 'YYYY-MM-DD'
  birthCity: string | null;
  birthCountry: CountryCode | null;
};

export type PeriodScore = { period: string; away: number; home: number }; // '1'…'3', 'OT', 'SO', 'Q1'…'Q4'

export type Game = {
  publicId: PublicId;
  league: League;
  source: Source;
  externalId: string;
  season: string; // '2026-27'
  seasonType: SeasonType;
  gameDate: string; // the league's schedule date 'YYYY-MM-DD', not the viewer's local date
  startTimeUtc: string; // ISO UTC
  status: GameStatus;
  homeTeamExternalId: string;
  awayTeamExternalId: string;
  homeScore: number | null;
  awayScore: number | null;
  periodScores: PeriodScore[] | null;
  endedIn: EndedIn | null;
};

type StatLineBase = {
  gamePublicId: PublicId;
  playerPublicId: PublicId;
  teamExternalId: string;
  played: boolean;
  dnpReason: string | null;
  starter: boolean | null;
};

// stats is null when played is false.
export type StatLine = StatLineBase &
  (
    | { kind: 'hockey_skater'; stats: HockeySkaterStats | null }
    | { kind: 'hockey_goalie'; stats: HockeyGoalieStats | null }
    | { kind: 'basketball_player'; stats: BasketballPlayerStats | null }
  );

export type SeasonStats = {
  playerPublicId: PublicId;
  season: string;
  seasonType: SeasonType;
  kind: StatKind;
  basis: 'totals' | 'per_game';
  stats: Readonly<Record<string, number>>; // shortcut: untyped per source, typed schemas when S03/S05 map them
};

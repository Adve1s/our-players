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
import type { BasketballPlayerStats, HockeyGoalieStats, HockeySkaterStats } from './stats';

// What adapters return and repositories store. Ingestion bookkeeping and nationality
// (computed on store by resolveNationality) are deliberately not part of it.

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
  dnpReason: string | null;
  starter: boolean | null;
};

// A played line always has stats and a DNP line never does, so the compiler rejects the mix.
type KindLine<K extends StatKind, S> = { kind: K } & (
  | { played: true; stats: S }
  | { played: false; stats: null }
);

export type StatLine = StatLineBase &
  (
    | KindLine<'hockey_skater', HockeySkaterStats>
    | KindLine<'hockey_goalie', HockeyGoalieStats>
    | KindLine<'basketball_player', BasketballPlayerStats>
  );

export type SeasonStats = {
  playerPublicId: PublicId;
  season: string;
  seasonType: SeasonType;
  kind: StatKind;
  // The basis of the counting stats; rates (toiPerGameSeconds, savePct, goalsAgainstAverage…) are
  // named as rates and never divided by gamesPlayed.
  basis: 'totals' | 'per_game';
  stats: Readonly<Record<string, number>>; // shortcut: untyped per source, typed schemas when S03/S05 map them
};

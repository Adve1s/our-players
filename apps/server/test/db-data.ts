import type {
  BasketballPlayerStats,
  Game,
  HockeyGoalieStats,
  HockeySkaterStats,
  Player,
  PublicId,
  SeasonStats,
  StatLine,
  Team,
} from '@our-players/shared';
import type { NationalityOverride } from '../src/nationality/overrides';

// Hand-written normalized objects (adapters arrive in S03), one small league slice each.

export const NO_OVERRIDES: ReadonlyMap<PublicId, NationalityOverride> = new Map();

export function override(
  player: PublicId,
  name: string,
  nationality: NationalityOverride['nationality'],
): NationalityOverride {
  return { player, name, nationality, note: 'test override', addedAt: '2026-10-17' };
}

export function overrides(...entries: NationalityOverride[]): Map<PublicId, NationalityOverride> {
  return new Map(entries.map((o) => [o.player, o]));
}

// --- NHL (source nhl) ---

export const cbj = {
  league: 'NHL',
  source: 'nhl',
  externalId: '29',
  abbrev: 'CBJ',
  name: 'Columbus Blue Jackets',
} satisfies Team;
export const tbl = {
  league: 'NHL',
  source: 'nhl',
  externalId: '14',
  abbrev: 'TBL',
  name: 'Tampa Bay Lightning',
} satisfies Team;
// Stored only by the test that needs a team not playing in the NHL game.
export const bos = {
  league: 'NHL',
  source: 'nhl',
  externalId: '6',
  abbrev: 'BOS',
  name: 'Boston Bruins',
} satisfies Team;

export const girgensons = {
  publicId: 'nhl-8476878',
  league: 'NHL',
  source: 'nhl',
  externalId: '8476878',
  firstName: 'Zemgus',
  lastName: 'Girgensons',
  position: 'C',
  positionGroup: 'forward',
  currentTeamExternalId: '14',
  jersey: '28',
  birthDate: '1994-01-05',
  birthCity: 'Riga',
  birthCountry: 'LVA',
} satisfies Player;
export const merzlikins = {
  publicId: 'nhl-8478007',
  league: 'NHL',
  source: 'nhl',
  externalId: '8478007',
  firstName: 'Elvis',
  lastName: 'Merzļikins',
  position: 'G',
  positionGroup: 'goalie',
  currentTeamExternalId: '29',
  jersey: '90',
  birthDate: '1994-04-13',
  birthCity: 'Riga',
  birthCountry: 'LVA',
} satisfies Player;
// A free agent whose birth country the source doesn't give.
export const freeAgent = {
  publicId: 'nhl-8479356',
  league: 'NHL',
  source: 'nhl',
  externalId: '8479356',
  firstName: 'Kārlis',
  lastName: 'Čukste',
  position: 'D',
  positionGroup: 'defense',
  currentTeamExternalId: null,
  jersey: null,
  birthDate: null,
  birthCity: null,
  birthCountry: null,
} satisfies Player;

export const nhlGame = {
  publicId: 'nhl-2026020001',
  league: 'NHL',
  source: 'nhl',
  externalId: '2026020001',
  season: '2026-27',
  seasonType: 'REG',
  gameDate: '2026-10-07',
  startTimeUtc: '2026-10-07T23:00:00.000Z',
  status: 'FINAL',
  homeTeamExternalId: '29',
  awayTeamExternalId: '14',
  homeScore: 3,
  awayScore: 2,
  periodScores: [
    { period: '1', away: 1, home: 0 },
    { period: '2', away: 1, home: 1 },
    { period: '3', away: 0, home: 1 },
    { period: 'OT', away: 0, home: 1 },
  ],
  endedIn: 'OT',
} satisfies Game;

export const skaterStats = {
  goals: 1,
  assists: 1,
  points: 2,
  plusMinus: 1,
  shots: 4,
  toiSeconds: 1102,
  hits: 2,
} satisfies HockeySkaterStats;
export const goalieStats = {
  saves: 30,
  shotsAgainst: 32,
  goalsAgainst: 2,
  savePct: 0.9375,
  toiSeconds: 3725,
  decision: 'W',
} satisfies HockeyGoalieStats;

export const girgensonsLine = {
  gamePublicId: 'nhl-2026020001',
  playerPublicId: 'nhl-8476878',
  teamExternalId: '14',
  kind: 'hockey_skater',
  played: true,
  dnpReason: null,
  starter: null,
  stats: skaterStats,
} satisfies StatLine;
export const merzlikinsLine = {
  gamePublicId: 'nhl-2026020001',
  playerPublicId: 'nhl-8478007',
  teamExternalId: '29',
  kind: 'hockey_goalie',
  played: true,
  dnpReason: null,
  starter: true,
  stats: goalieStats,
} satisfies StatLine;

export const nhlSeasonStats = {
  playerPublicId: 'nhl-8476878',
  season: '2026-27',
  seasonType: 'REG',
  kind: 'hockey_skater',
  basis: 'totals',
  stats: { gamesPlayed: 1, goals: 1, assists: 1, points: 2 },
} satisfies SeasonStats;

// --- NBA (source espn) ---

export const celtics = {
  league: 'NBA',
  source: 'espn',
  externalId: '2',
  abbrev: 'BOS',
  name: 'Boston Celtics',
} satisfies Team;
export const sixers = {
  league: 'NBA',
  source: 'espn',
  externalId: '20',
  abbrev: 'PHI',
  name: 'Philadelphia 76ers',
} satisfies Team;

export const porzingis = {
  publicId: 'nba-3102531',
  league: 'NBA',
  source: 'espn',
  externalId: '3102531',
  firstName: 'Kristaps',
  lastName: 'Porziņģis',
  position: 'C',
  positionGroup: 'center',
  currentTeamExternalId: '2',
  jersey: '8',
  birthDate: '1995-08-02',
  birthCity: 'Liepāja',
  birthCountry: 'LVA',
} satisfies Player;
export const embiid = {
  publicId: 'nba-3059318',
  league: 'NBA',
  source: 'espn',
  externalId: '3059318',
  firstName: 'Joel',
  lastName: 'Embiid',
  position: 'C',
  positionGroup: 'center',
  currentTeamExternalId: '20',
  jersey: '21',
  birthDate: '1994-03-16',
  birthCity: 'Yaoundé',
  birthCountry: 'CMR',
} satisfies Player;
export const bertans = {
  publicId: 'nba-2594226',
  league: 'NBA',
  source: 'espn',
  externalId: '2594226',
  firstName: 'Dāvis',
  lastName: 'Bertāns',
  position: 'PF',
  positionGroup: 'forward',
  currentTeamExternalId: '2',
  jersey: '42',
  birthDate: '1992-11-12',
  birthCity: 'Valmiera',
  birthCountry: 'LVA',
} satisfies Player;

export const nbaGame = {
  publicId: 'nba-401810001',
  league: 'NBA',
  source: 'espn',
  externalId: '401810001',
  season: '2026-27',
  seasonType: 'REG',
  gameDate: '2026-10-21',
  startTimeUtc: '2026-10-21T23:30:00.000Z',
  status: 'FINAL',
  homeTeamExternalId: '2',
  awayTeamExternalId: '20',
  homeScore: 112,
  awayScore: 108,
  periodScores: [
    { period: 'Q1', away: 26, home: 28 },
    { period: 'Q2', away: 27, home: 30 },
    { period: 'Q3', away: 30, home: 25 },
    { period: 'Q4', away: 25, home: 29 },
  ],
  endedIn: 'REG',
} satisfies Game;

export const porzingisStats = {
  minutes: 31,
  points: 24,
  rebounds: 9,
  assists: 2,
  fgMade: 9,
  fgAttempted: 17,
  threeMade: 3,
  threeAttempted: 7,
  ftMade: 3,
  ftAttempted: 4,
  turnovers: 2,
  steals: 1,
  blocks: 3,
  offRebounds: 2,
  defRebounds: 7,
  fouls: 3,
  plusMinus: 8,
} satisfies BasketballPlayerStats;
export const embiidStats = {
  minutes: 35,
  points: 30,
  rebounds: 11,
  assists: 4,
  fgMade: 10,
  fgAttempted: 21,
  threeMade: 1,
  threeAttempted: 4,
  ftMade: 9,
  ftAttempted: 11,
  turnovers: 4,
  steals: 1,
  blocks: 2,
  offRebounds: 3,
  defRebounds: 8,
  fouls: 4,
  plusMinus: -6,
} satisfies BasketballPlayerStats;

export const porzingisLine = {
  gamePublicId: 'nba-401810001',
  playerPublicId: 'nba-3102531',
  teamExternalId: '2',
  kind: 'basketball_player',
  played: true,
  dnpReason: null,
  starter: true,
  stats: porzingisStats,
} satisfies StatLine;
export const embiidLine = {
  gamePublicId: 'nba-401810001',
  playerPublicId: 'nba-3059318',
  teamExternalId: '20',
  kind: 'basketball_player',
  played: true,
  dnpReason: null,
  starter: true,
  stats: embiidStats,
} satisfies StatLine;
export const bertansDnpLine = {
  gamePublicId: 'nba-401810001',
  playerPublicId: 'nba-2594226',
  teamExternalId: '2',
  kind: 'basketball_player',
  played: false,
  dnpReason: "COACH'S DECISION",
  starter: false,
  stats: null,
} satisfies StatLine;

export const nbaSeasonStats = {
  playerPublicId: 'nba-3102531',
  season: '2026-27',
  seasonType: 'REG',
  kind: 'basketball_player',
  basis: 'per_game',
  stats: { gamesPlayed: 1, points: 24, rebounds: 9, assists: 2 },
} satisfies SeasonStats;

export type LeagueSlice = {
  teams: readonly Team[];
  players: readonly Player[];
  game: Game;
  lines: readonly StatLine[];
  seasonStats: readonly SeasonStats[];
};

export const nhl: LeagueSlice = {
  teams: [cbj, tbl],
  players: [girgensons, merzlikins, freeAgent],
  game: nhlGame,
  lines: [girgensonsLine, merzlikinsLine],
  seasonStats: [nhlSeasonStats],
};

export const nba: LeagueSlice = {
  teams: [celtics, sixers],
  players: [porzingis, embiid, bertans],
  game: nbaGame,
  lines: [porzingisLine, embiidLine, bertansDnpLine],
  seasonStats: [nbaSeasonStats],
};

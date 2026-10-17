import type { EndedIn, Game, GameStatus, PeriodScore, SeasonType, Team } from '@our-players/shared';
import type { z } from 'zod';
import { lookup, parsePayload, seasonFromId, toTeam } from './common';
import {
  type scheduleGameSchema,
  scheduleSchema,
  type scoreGameSchema,
  scoreSchema,
} from './schemas';

type RawGame = z.output<typeof scheduleGameSchema>;
type RawGoals = NonNullable<z.output<typeof scoreGameSchema>['goals']>;
// warnings name skipped games; jobs must log them.
type NhlGames = { games: Game[]; teams: Team[]; warnings: string[] };

// gameScheduleState decides first; only an OK game is read by gameState (VISION §8).
const SCHEDULE_STATUS: Readonly<Record<string, GameStatus>> = {
  PPD: 'POSTPONED',
  CNCL: 'CANCELLED',
};
const GAME_STATUS: Readonly<Record<string, GameStatus>> = {
  FUT: 'SCHEDULED',
  PRE: 'SCHEDULED',
  LIVE: 'LIVE',
  CRIT: 'LIVE',
  OVER: 'LIVE', // final horn sounded, result not official until FINAL/OFF
  FINAL: 'FINAL', // preseason finals stay FINAL
  OFF: 'FINAL', // regular-season finals become OFF
};
// Other game types (4 = All-Star, international events) never get here: the schema drops them.
const SEASON_TYPES: Readonly<Record<number, SeasonType>> = { 1: 'PRE', 2: 'REG', 3: 'POST' };
const ENDED_IN: Readonly<Record<string, EndedIn>> = { REG: 'REG', OT: 'OT', SO: 'SO' };

// An unknown gameScheduleState (SUSP, TBD… are documented but unseen) skips only its game, with a
// warning (D-035); an unknown gameState still throws.
function status(g: RawGame, where: string, warnings: string[]): GameStatus | null {
  const bySchedule = lookup(SCHEDULE_STATUS, g.gameScheduleState);
  if (bySchedule) return bySchedule;
  if (g.gameScheduleState !== 'OK') {
    warnings.push(`${where}: unknown gameScheduleState "${g.gameScheduleState}", game skipped`);
    return null;
  }
  const byGame = lookup(GAME_STATUS, g.gameState);
  if (!byGame) throw new Error(`${where}: unknown gameState "${g.gameState}"`);
  return byGame;
}

function endedIn(g: RawGame, where: string): EndedIn {
  if (!g.gameOutcome) throw new Error(`${where}: FINAL without gameOutcome`);
  const last = g.gameOutcome.lastPeriodType;
  const ended = lookup(ENDED_IN, last);
  if (!ended) throw new Error(`${where}: unknown lastPeriodType "${last}"`);
  return ended;
}

// 1..n by the current period; overtimes are "OT", "2OT"…, a final shootout period is "SO".
function periodScores(g: RawGame, goals: RawGoals): PeriodScore[] | null {
  const current = g.periodDescriptor;
  if (!current) return null;
  const max = current.maxRegulationPeriods;
  const label = (n: number) => {
    if (n <= max) return String(n);
    if (n === current.number && current.periodType === 'SO') return 'SO';
    return n === max + 1 ? 'OT' : `${n - max}OT`;
  };
  const count = (n: number, abbrev: string) =>
    goals.filter((goal) => goal.periodDescriptor.number === n && goal.teamAbbrev === abbrev).length;
  return Array.from({ length: current.number }, (_, i) => ({
    period: label(i + 1),
    away: count(i + 1, g.awayTeam.abbrev),
    home: count(i + 1, g.homeTeam.abbrev),
  }));
}

// null for a game we skip.
function toGame(
  endpoint: string,
  g: RawGame,
  gameDate: string,
  goals: RawGoals | null,
  warnings: string[],
): Game | null {
  const seasonType = lookup(SEASON_TYPES, g.gameType);
  if (!seasonType) return null;
  const where = `nhl ${endpoint}: game ${g.id}`;
  const gameStatus = status(g, where, warnings);
  if (!gameStatus) return null;
  return {
    publicId: `nhl-${g.id}`,
    league: 'NHL',
    source: 'nhl',
    externalId: String(g.id),
    season: seasonFromId(g.season, where),
    seasonType,
    gameDate,
    startTimeUtc: g.startTimeUTC,
    status: gameStatus,
    homeTeamExternalId: String(g.homeTeam.id),
    awayTeamExternalId: String(g.awayTeam.id),
    homeScore: g.homeTeam.score ?? null,
    awayScore: g.awayTeam.score ?? null,
    // A pregame game can already carry a period descriptor; no line score before puck drop.
    periodScores:
      goals && (gameStatus === 'LIVE' || gameStatus === 'FINAL') ? periodScores(g, goals) : null,
    endedIn: gameStatus === 'FINAL' ? endedIn(g, where) : null,
  };
}

function collect(
  endpoint: string,
  dated: { g: RawGame; gameDate: string; goals: RawGoals | null }[],
): NhlGames {
  const games: Game[] = [];
  const teams = new Map<string, Team>();
  const warnings: string[] = [];
  for (const { g, gameDate, goals } of dated) {
    const game = toGame(endpoint, g, gameDate, goals, warnings);
    if (!game) continue;
    games.push(game);
    for (const t of [g.awayTeam, g.homeTeam])
      teams.set(String(t.id), toTeam(t.id, t.abbrev, t.name));
  }
  return { games, teams: [...teams.values()], warnings };
}

export function mapScore(raw: unknown): NhlGames {
  const { games } = parsePayload(scoreSchema, 'score', raw);
  return collect(
    'score',
    games.map((g) => ({ g, gameDate: g.gameDate, goals: g.goals ?? [] })),
  );
}

// The schedule has no goals, so no period scores; a game's date is the gameWeek day it is listed under.
export function mapSchedule(raw: unknown): NhlGames {
  const { gameWeek } = parsePayload(scheduleSchema, 'schedule', raw);
  return collect(
    'schedule',
    gameWeek.flatMap((day) => day.games.map((g) => ({ g, gameDate: day.date, goals: null }))),
  );
}

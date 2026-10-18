import type { EndedIn, Game, GameStatus, PeriodScore, Team } from '@our-players/shared';
import type { z } from 'zod';
import { lookup, parsePayload, SEASON_TYPES, seasonFromYear, toTeam } from './common';
import { type scoreboardEventSchema, scoreboardSchema } from './schemas';

type RawEvent = z.output<typeof scoreboardEventSchema>;
type RawCompetitor = RawEvent['competitions'][0]['competitors'][number];
// warnings name skipped games; jobs must log them.
export type EspnGames = { games: Game[]; teams: Team[]; warnings: string[] };

// VISION §8.
const STATUS: Readonly<Record<string, GameStatus>> = {
  STATUS_SCHEDULED: 'SCHEDULED',
  STATUS_IN_PROGRESS: 'LIVE',
  STATUS_HALFTIME: 'LIVE',
  STATUS_END_PERIOD: 'LIVE',
  STATUS_FINAL: 'FINAL',
  STATUS_POSTPONED: 'POSTPONED',
  STATUS_CANCELED: 'CANCELLED',
};
const REGULATION_PERIODS = 4;

function side(e: RawEvent, homeAway: 'home' | 'away', where: string): RawCompetitor {
  const c = e.competitions[0].competitors.find((x) => x.homeAway === homeAway);
  if (!c) throw new Error(`${where}: no ${homeAway} competitor`);
  return c;
}

function score(c: RawCompetitor, where: string): number {
  if (c.score === undefined || !/^\d+$/.test(c.score)) {
    throw new Error(`${where}: malformed ${c.homeAway} score "${c.score}"`);
  }
  return Number(c.score);
}

// Q1…Q4, then OT, 2OT…
function periodLabel(n: number): string {
  if (n <= REGULATION_PERIODS) return `Q${n}`;
  return n === REGULATION_PERIODS + 1 ? 'OT' : `${n - REGULATION_PERIODS}OT`;
}

function periodScores(home: RawCompetitor, away: RawCompetitor, where: string): PeriodScore[] {
  const h = home.linescores?.map((l) => l.value) ?? [];
  const a = away.linescores?.map((l) => l.value) ?? [];
  if (h.length !== a.length) {
    throw new Error(`${where}: ${h.length} home and ${a.length} away period scores`);
  }
  return h.map((homeScore, i) => ({
    period: periodLabel(i + 1),
    away: a[i] as number,
    home: homeScore,
  }));
}

// null for a game we skip: an unknown season type (play-in, All-Star) or status, with a warning (D-035).
function toGame(e: RawEvent, gameDate: string, warnings: string[]): Game | null {
  const where = `espn-nba scoreboard: game ${e.id}`;
  const seasonType = lookup(SEASON_TYPES, e.season.type);
  if (!seasonType) {
    warnings.push(`${where}: unknown season type ${e.season.type}, game skipped`);
    return null;
  }
  const status = lookup(STATUS, e.status.type.name);
  if (!status) {
    warnings.push(`${where}: unknown status "${e.status.type.name}", game skipped`);
    return null;
  }
  const home = side(e, 'home', where);
  const away = side(e, 'away', where);
  const started = status === 'LIVE' || status === 'FINAL';
  const periods = started ? periodScores(home, away, where) : null;
  let endedIn: EndedIn | null = null;
  if (status === 'FINAL') {
    if (!periods?.length) throw new Error(`${where}: FINAL without linescores`);
    // The NBA has no shootout: any period past regulation is overtime.
    endedIn = periods.length > REGULATION_PERIODS ? 'OT' : 'REG';
  }
  return {
    publicId: `nba-${e.id}`,
    league: 'NBA',
    source: 'espn',
    externalId: e.id,
    season: seasonFromYear(e.season.year),
    seasonType,
    gameDate,
    startTimeUtc: e.date,
    status,
    homeTeamExternalId: home.team.id,
    awayTeamExternalId: away.team.id,
    homeScore: started ? score(home, where) : null,
    awayScore: started ? score(away, where) : null,
    periodScores: periods,
    endedIn,
  };
}

// No event field carries the schedule day, so the caller passes the `dates=` day it requested.
export function mapScoreboard(raw: unknown, gameDate: string): EspnGames {
  const { events } = parsePayload(scoreboardSchema, 'scoreboard', raw);
  const games: Game[] = [];
  const teams = new Map<string, Team>();
  const warnings: string[] = [];
  for (const e of events) {
    const game = toGame(e, gameDate, warnings);
    if (!game) continue;
    games.push(game);
    for (const c of e.competitions[0].competitors) teams.set(c.team.id, toTeam(c.team));
  }
  return { games, teams: [...teams.values()], warnings };
}

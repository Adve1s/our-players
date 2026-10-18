import {
  addDays,
  type Game,
  type League,
  type Player,
  type SeasonStats,
  type SeasonType,
  type StatLine,
  type Team,
} from '@our-players/shared';
import type { PoliteClient } from '../http/polite-client';
import * as espn from '../sources/espn-nba';
import * as nhl from '../sources/nhl';

type Client = Pick<PoliteClient, 'get'>;
type DayGames = { games: Game[]; teams: Team[]; warnings: string[] };

// What a job needs from a league's source; jobs never import a source directly.
export type LeagueAdapter = {
  day(client: Client, date: string): Promise<DayGames>;
  week(client: Client, date: string): Promise<DayGames>;
  boxscore(
    client: Client,
    externalId: string,
  ): Promise<{ lines: StatLine[]; teams: Team[]; players: Player[] }>;
  player(client: Client, externalId: string): Promise<{ player: Player; warnings: string[] }>;
  teams(client: Client, date: string): Promise<{ teams: Team[] }>;
  roster(client: Client, team: Team): Promise<{ players: Player[]; warnings: string[] }>;
  seasonStats(client: Client, season: string, seasonType: SeasonType): Promise<SeasonStats[]>;
};

// ESPN has no week endpoint that keeps the game day, so a week is seven scoreboards.
async function espnWeek(client: Client, date: string): Promise<DayGames> {
  const week: DayGames = { games: [], teams: [], warnings: [] };
  const teams = new Map<string, Team>();
  for (let i = 0; i < 7; i++) {
    const day = await espn.fetchScoreboard(client, addDays(date, i));
    week.games.push(...day.games);
    week.warnings.push(...day.warnings);
    for (const t of day.teams) teams.set(t.externalId, t);
  }
  week.teams = [...teams.values()];
  return week;
}

export const ADAPTERS: Record<League, LeagueAdapter> = {
  NHL: {
    day: nhl.fetchScore,
    week: nhl.fetchSchedule,
    boxscore: nhl.fetchBoxscore,
    player: nhl.fetchPlayerLanding,
    teams: nhl.fetchScheduleCalendar,
    roster: nhl.fetchRoster,
    seasonStats: async (client, season, seasonType) => [
      ...(await nhl.fetchSkaterSummary(client, season, seasonType)),
      ...(await nhl.fetchGoalieSummary(client, season, seasonType)),
    ],
  },
  NBA: {
    day: espn.fetchScoreboard,
    week: espnWeek,
    boxscore: espn.fetchSummary,
    player: espn.fetchAthlete,
    // ESPN's team list is current, not dated.
    teams: (client) => espn.fetchTeams(client),
    roster: espn.fetchRoster,
    seasonStats: espn.fetchSeasonStats,
  },
};

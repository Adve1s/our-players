import { type SeasonStats, type SeasonType, seasonLabel, type Team } from '@our-players/shared';
import type { PoliteClient } from '../../http/polite-client';
import { getJson as getSourceJson } from '../common';
import { mapSummary } from './boxscore';
import { mapScoreboard } from './games';
import { mapAthlete, mapRoster } from './players';
import { mapByAthlete } from './season-stats';
import { mapTeams } from './teams';

const SITE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';
const CORE = 'https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba';
const WEB = 'https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba';
const e = encodeURIComponent;

type SeasonTypeId = 1 | 2 | 3;

export const espnUrls = {
  // Takes YYYY-MM-DD like the NHL date endpoints; ESPN wants YYYYMMDD.
  scoreboard: (date: string) => `${SITE}/scoreboard?dates=${e(date.replaceAll('-', ''))}`,
  summary: (eventId: string) => `${SITE}/summary?event=${e(eventId)}`,
  teams: () => `${SITE}/teams`,
  roster: (teamId: string) => `${SITE}/teams/${e(teamId)}/roster`,
  athlete: (athleteId: string) => `${CORE}/athletes/${e(athleteId)}`,
  byathlete: (endYear: string, seasonType: SeasonTypeId, page: number) =>
    `${WEB}/statistics/byathlete?season=${e(endYear)}&seasontype=${seasonType}&limit=50&page=${page}`,
};

// ~12 pages per season type at 578 players; more means the source changed under us.
export const BYATHLETE_MAX_PAGES = 20;

type Client = Pick<PoliteClient, 'get'>;

const getJson = (client: Client, endpoint: string, url: string) =>
  getSourceJson('espn-nba', client, endpoint, url);

// The scoreboard carries no game day, so the requested date becomes gameDate.
export const fetchScoreboard = async (client: Client, date: string) =>
  mapScoreboard(await getJson(client, 'scoreboard', espnUrls.scoreboard(date)), date);

export const fetchSummary = async (client: Client, eventId: string) =>
  mapSummary(await getJson(client, 'summary', espnUrls.summary(eventId)));

export const fetchTeams = async (client: Client) =>
  mapTeams(await getJson(client, 'teams', espnUrls.teams()));

export async function fetchRoster(client: Client, team: Pick<Team, 'externalId'>) {
  const { teamExternalId, players, warnings } = mapRoster(
    await getJson(client, 'roster', espnUrls.roster(team.externalId)),
  );
  if (teamExternalId !== team.externalId) {
    throw new Error(`espn-nba roster: asked for team ${team.externalId}, got ${teamExternalId}`);
  }
  return { players, warnings };
}

export const fetchAthlete = async (client: Client, athleteId: string) =>
  mapAthlete(await getJson(client, 'athlete', espnUrls.athlete(athleteId)));

const SEASON_TYPE_IDS: Readonly<Record<SeasonType, SeasonTypeId>> = { PRE: 1, REG: 2, POST: 3 };

// "2026-27" → "2027" (ESPN labels a season by its end year); the seasonLabel round trip rejects typos.
function toEndYear(season: string): string {
  const start = Number(season.slice(0, 4));
  if (seasonLabel(start) !== season) {
    throw new Error(`espn-nba byathlete: unknown season "${season}"`);
  }
  return String(start + 1);
}

export async function fetchSeasonStats(
  client: Client,
  season: string,
  seasonType: SeasonType,
): Promise<SeasonStats[]> {
  const endYear = toEndYear(season);
  const typeId = SEASON_TYPE_IDS[seasonType];
  // Keyed by player: rows can shift between pages while we page, repeating an athlete.
  const rows = new Map<string, SeasonStats>();
  let pages = 1;
  let count = 0;
  for (let page = 1; page <= pages; page++) {
    const url = espnUrls.byathlete(endYear, typeId, page);
    const result = mapByAthlete(await getJson(client, 'byathlete', url));
    if (page === 1) {
      // Rows are labelled from the response, so a fallback season would be stored as success.
      if (result.season !== season || result.seasonType !== seasonType) {
        throw new Error(
          `espn-nba byathlete: asked for ${season} ${seasonType}, got ${result.season} ${result.seasonType}`,
        );
      }
      if (result.pages > BYATHLETE_MAX_PAGES) {
        throw new Error(
          `espn-nba byathlete: ${result.pages} pages exceeds the budget of ${BYATHLETE_MAX_PAGES}`,
        );
      }
      pages = result.pages;
      count = result.count;
    }
    for (const s of result.seasonStats) rows.set(s.playerPublicId, s);
  }
  if (rows.size < count) {
    throw new Error(`espn-nba byathlete: truncated, ${rows.size} of ${count} rows`);
  }
  return [...rows.values()];
}

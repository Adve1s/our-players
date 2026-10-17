import { type SeasonStats, type SeasonType, seasonLabel } from '@our-players/shared';
import type { PoliteClient } from '../../http/polite-client';
import { mapBoxscore } from './boxscore';
import { mapSchedule, mapScore } from './games';
import { mapPlayerLanding, mapRoster } from './players';
import { mapGoalieSummary, mapSkaterSummary } from './season-stats';

const WEB = 'https://api-web.nhle.com/v1';
const STATS = 'https://api.nhle.com/stats/rest/en';
const e = encodeURIComponent;

type GameTypeId = 1 | 2 | 3;

const summaryUrl = (kind: 'skater' | 'goalie', seasonId: string, gameTypeId: GameTypeId) =>
  `${STATS}/${kind}/summary?limit=-1&cayenneExp=${e(`seasonId=${seasonId} and gameTypeId=${gameTypeId}`)}`;

export const nhlUrls = {
  score: (date: string) => `${WEB}/score/${e(date)}`,
  schedule: (date: string) => `${WEB}/schedule/${e(date)}`,
  boxscore: (gameId: string) => `${WEB}/gamecenter/${e(gameId)}/boxscore`,
  roster: (teamAbbrev: string) => `${WEB}/roster/${e(teamAbbrev)}/current`,
  playerLanding: (playerId: string) => `${WEB}/player/${e(playerId)}/landing`,
  skaterSummary: (seasonId: string, gameTypeId: GameTypeId) =>
    summaryUrl('skater', seasonId, gameTypeId),
  goalieSummary: (seasonId: string, gameTypeId: GameTypeId) =>
    summaryUrl('goalie', seasonId, gameTypeId),
};

type Client = Pick<PoliteClient, 'get'>;

async function getJson(client: Client, endpoint: string, url: string): Promise<unknown> {
  const { text } = await client.get(url);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`nhl ${endpoint}: response is not JSON (${url})`);
  }
}

export const fetchScore = async (client: Client, date: string) =>
  mapScore(await getJson(client, 'score', nhlUrls.score(date)));

export const fetchSchedule = async (client: Client, date: string) =>
  mapSchedule(await getJson(client, 'schedule', nhlUrls.schedule(date)));

export const fetchBoxscore = async (client: Client, gameId: string) =>
  mapBoxscore(await getJson(client, 'boxscore', nhlUrls.boxscore(gameId)));

export const fetchRoster = async (client: Client, teamAbbrev: string, teamExternalId: string) =>
  mapRoster(await getJson(client, 'roster', nhlUrls.roster(teamAbbrev)), teamExternalId);

export const fetchPlayerLanding = async (client: Client, playerId: string) =>
  mapPlayerLanding(await getJson(client, 'player-landing', nhlUrls.playerLanding(playerId)));

const GAME_TYPE_IDS: Readonly<Record<SeasonType, GameTypeId>> = { PRE: 1, REG: 2, POST: 3 };

// "2025-26" → "20252026"; the round trip through seasonLabel rejects "2025-27" and other typos.
function toSeasonId(season: string): string {
  const start = Number(season.slice(0, 4));
  if (seasonLabel(start) !== season) throw new Error(`nhl: unknown season "${season}"`);
  return `${start}${start + 1}`;
}

async function fetchSummary(
  client: Client,
  kind: 'skater' | 'goalie',
  season: string,
  seasonType: SeasonType,
): Promise<SeasonStats[]> {
  const endpoint = `${kind}-summary`;
  const url = summaryUrl(kind, toSeasonId(season), GAME_TYPE_IDS[seasonType]);
  const map = kind === 'skater' ? mapSkaterSummary : mapGoalieSummary;
  const { seasonStats, total } = map(await getJson(client, endpoint, url), seasonType);
  // limit=-1 returned every row in live probes; a short page means it silently stopped doing so.
  if (seasonStats.length < total) {
    throw new Error(`nhl ${endpoint}: truncated, ${seasonStats.length} of ${total} rows`);
  }
  return seasonStats;
}

export const fetchSkaterSummary = (client: Client, season: string, seasonType: SeasonType) =>
  fetchSummary(client, 'skater', season, seasonType);

export const fetchGoalieSummary = (client: Client, season: string, seasonType: SeasonType) =>
  fetchSummary(client, 'goalie', season, seasonType);

import { digits, type EndpointMap, isoDate, withOptionalSeason } from '../endpoint-ids';

const WEB = 'https://api-web.nhle.com/v1';
const STATS = 'https://api.nhle.com/stats/rest/en';

function seasonSummary(kind: 'skater' | 'goalie', sortBy: string, seasonId: string): string {
  const params = new URLSearchParams({
    isAggregate: 'false',
    isGame: 'false',
    sort: JSON.stringify([
      { property: sortBy, direction: 'DESC' },
      { property: 'playerId', direction: 'ASC' },
    ]),
    start: '0',
    limit: '100',
    cayenneExp: `seasonId=${digits(seasonId)} and gameTypeId=2`,
  });
  return `${STATS}/${kind}/summary?${params}`;
}

export const nhlEndpoints = {
  score: (date) => `${WEB}/score/${isoDate(date)}`,
  schedule: (date) => `${WEB}/schedule/${isoDate(date)}`,
  boxscore: (gameId) => `${WEB}/gamecenter/${digits(gameId)}/boxscore`,
  'gamecenter-landing': (gameId) => `${WEB}/gamecenter/${digits(gameId)}/landing`,
  'gamecenter-right-rail': (gameId) => `${WEB}/gamecenter/${digits(gameId)}/right-rail`,
  /** `TBL` → current roster, `TBL-20252026` → that season's roster. */
  roster: (id) => {
    const { base, season } = withOptionalSeason(id, /[A-Z]{3}/);
    return `${WEB}/roster/${base}/${season ?? 'current'}`;
  },
  'player-landing': (playerId) => `${WEB}/player/${digits(playerId)}/landing`,
  'skater-summary': (seasonId) => seasonSummary('skater', 'points', seasonId),
  'goalie-summary': (seasonId) => seasonSummary('goalie', 'wins', seasonId),
} satisfies EndpointMap;

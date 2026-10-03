import { digits, type EndpointMap, isoDate, withOptionalSeason } from '../endpoint-ids';

const SITE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';
const CORE = 'https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba';
const COMMON = 'https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba';

export const espnNbaEndpoints = {
  scoreboard: (date) => `${SITE}/scoreboard?dates=${isoDate(date).replaceAll('-', '')}`,
  summary: (eventId) => `${SITE}/summary?event=${digits(eventId)}`,
  athlete: (athleteId) => `${CORE}/athletes/${digits(athleteId)}`,
  /** `9` → current roster, `9-2026` → that season's roster (ESPN labels a season by its end year). */
  roster: (id) => {
    const { base, season } = withOptionalSeason(id, /\d+/);
    return `${SITE}/teams/${base}/roster${season ? `?season=${season}` : ''}`;
  },
  overview: (athleteId) => `${COMMON}/athletes/${digits(athleteId)}/overview`,
  /** `<season>-<seasontype>`, e.g. `2026-2`: first page of every athlete's season averages. */
  'stats-byathlete': (id) => {
    const match = /^(\d{4})-([123])$/.exec(id);
    if (!match) throw new Error(`Expected <season>-<seasontype> like 2026-2, got "${id}"`);
    const params = new URLSearchParams({
      region: 'us',
      lang: 'en',
      contentorigin: 'espn',
      isqualified: 'false',
      page: '1',
      limit: '50',
      sort: 'offensive.avgPoints:desc',
      season: String(match[1]),
      seasontype: String(match[2]),
    });
    return `${COMMON}/statistics/byathlete?${params}`;
  },
} satisfies EndpointMap;

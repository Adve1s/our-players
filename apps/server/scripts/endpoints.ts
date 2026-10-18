import { espnUrls } from '../src/sources/espn-nba/client';
import { nhlUrls } from '../src/sources/nhl/client';

const NHL = 'https://api-web.nhle.com/v1';
const NHL_STATS = 'https://api.nhle.com/stats/rest/en';

// Ids come from the command line, so each is escaped before it goes into a URL.
const e = encodeURIComponent;

export const endpoints = {
  nhl: {
    score: nhlUrls.score,
    schedule: nhlUrls.schedule,
    'schedule-calendar': nhlUrls.scheduleCalendar,
    boxscore: nhlUrls.boxscore,
    'right-rail': (gameId) => `${NHL}/gamecenter/${e(gameId)}/right-rail`,
    roster: nhlUrls.roster,
    'player-landing': nhlUrls.playerLanding,
    'skater-summary': (seasonId) =>
      `${NHL_STATS}/skater/summary?cayenneExp=seasonId=${e(seasonId)}`,
    'goalie-summary': (seasonId) =>
      `${NHL_STATS}/goalie/summary?cayenneExp=seasonId=${e(seasonId)}`,
    'skater-bios': (seasonId) => `${NHL_STATS}/skater/bios?cayenneExp=seasonId=${e(seasonId)}`,
    'goalie-bios': (seasonId) => `${NHL_STATS}/goalie/bios?cayenneExp=seasonId=${e(seasonId)}`,
    'skater-bios-lva': (seasonId) =>
      `${NHL_STATS}/skater/bios?cayenneExp=${encodeURIComponent(`seasonId=${seasonId} and nationalityCode="LVA"`)}`,
    'skater-summary-lva': (seasonId) =>
      `${NHL_STATS}/skater/summary?cayenneExp=${encodeURIComponent(`seasonId=${seasonId} and nationalityCode="LVA"`)}`,
    'skater-summary-reg': (seasonId) =>
      `${NHL_STATS}/skater/summary?cayenneExp=${encodeURIComponent(`seasonId=${seasonId} and gameTypeId=2`)}`,
    'goalie-summary-reg': (seasonId) =>
      `${NHL_STATS}/goalie/summary?cayenneExp=${encodeURIComponent(`seasonId=${seasonId} and gameTypeId=2`)}`,
    'skater-summary-reg-all': (seasonId) => nhlUrls.summary('skater', seasonId, 2),
    'goalie-summary-reg-all': (seasonId) => nhlUrls.summary('goalie', seasonId, 2),
    'goalie-bios-lva': (seasonId) =>
      `${NHL_STATS}/goalie/bios?cayenneExp=${encodeURIComponent(`seasonId=${seasonId} and nationalityCode="LVA"`)}`,
  },
  'espn-nba': {
    scoreboard: espnUrls.scoreboard,
    summary: espnUrls.summary,
    roster: espnUrls.roster,
    // The id is ignored; it only names the fixture file.
    teams: espnUrls.teams,
    athlete: espnUrls.athlete,
    overview: (athleteId) =>
      `https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/${e(athleteId)}/overview`,
    // ESPN labels a season by its end year; page 1 of the regular season.
    byathlete: (season) => espnUrls.byathlete(season, 2, 1),
  },
} satisfies Record<'nhl' | 'espn-nba', Record<string, (id: string) => string>>;

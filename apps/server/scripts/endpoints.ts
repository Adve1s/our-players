import { nhlUrls } from '../src/sources/nhl/client';

const NHL = 'https://api-web.nhle.com/v1';
const NHL_STATS = 'https://api.nhle.com/stats/rest/en';
const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';

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
    'goalie-bios-lva': (seasonId) =>
      `${NHL_STATS}/goalie/bios?cayenneExp=${encodeURIComponent(`seasonId=${seasonId} and nationalityCode="LVA"`)}`,
  },
  'espn-nba': {
    // Takes YYYY-MM-DD like the NHL date endpoints; ESPN wants YYYYMMDD.
    scoreboard: (date) => `${ESPN}/scoreboard?dates=${e(date.replaceAll('-', ''))}`,
    summary: (eventId) => `${ESPN}/summary?event=${e(eventId)}`,
    roster: (teamId) => `${ESPN}/teams/${e(teamId)}/roster`,
    athlete: (athleteId) =>
      `https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/athletes/${e(athleteId)}`,
    overview: (athleteId) =>
      `https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/${e(athleteId)}/overview`,
    // Q5 probe: ESPN labels a season by its end year; seasontype 2 = regular season.
    byathlete: (season) =>
      `https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/statistics/byathlete?season=${e(season)}&seasontype=2&limit=50&page=1`,
  },
} satisfies Record<'nhl' | 'espn-nba', Record<string, (id: string) => string>>;

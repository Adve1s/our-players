const NHL = 'https://api-web.nhle.com/v1';
const NHL_STATS = 'https://api.nhle.com/stats/rest/en';
const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';

export const endpoints: Record<'nhl' | 'espn-nba', Record<string, (id: string) => string>> = {
  nhl: {
    score: (date) => `${NHL}/score/${date}`,
    schedule: (date) => `${NHL}/schedule/${date}`,
    boxscore: (gameId) => `${NHL}/gamecenter/${gameId}/boxscore`,
    'right-rail': (gameId) => `${NHL}/gamecenter/${gameId}/right-rail`,
    roster: (team) => `${NHL}/roster/${team}/current`,
    'player-landing': (playerId) => `${NHL}/player/${playerId}/landing`,
    'skater-summary': (seasonId) => `${NHL_STATS}/skater/summary?cayenneExp=seasonId=${seasonId}`,
    'goalie-summary': (seasonId) => `${NHL_STATS}/goalie/summary?cayenneExp=seasonId=${seasonId}`,
    'skater-bios': (seasonId) => `${NHL_STATS}/skater/bios?cayenneExp=seasonId=${seasonId}`,
    'goalie-bios': (seasonId) => `${NHL_STATS}/goalie/bios?cayenneExp=seasonId=${seasonId}`,
  },
  'espn-nba': {
    // Takes YYYY-MM-DD like the NHL date endpoints; ESPN wants YYYYMMDD.
    scoreboard: (date) => `${ESPN}/scoreboard?dates=${date.replaceAll('-', '')}`,
    summary: (eventId) => `${ESPN}/summary?event=${eventId}`,
    roster: (teamId) => `${ESPN}/teams/${teamId}/roster`,
    athlete: (athleteId) =>
      `https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/athletes/${athleteId}`,
    overview: (athleteId) =>
      `https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/${athleteId}/overview`,
  },
};

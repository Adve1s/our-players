import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lookup } from '../sources/common';
import {
  mapAthlete,
  mapByAthlete,
  mapRoster as mapEspnRoster,
  mapScoreboard,
  mapSummary,
  mapTeams,
} from '../sources/espn-nba';
import {
  mapBoxscore,
  mapGoalieSummary,
  mapPlayerLanding,
  mapRoster,
  mapSchedule,
  mapScheduleCalendar,
  mapScore,
  mapSkaterSummary,
} from '../sources/nhl';

// Keys are fixture directory names under test/fixtures/nhl.
const nhl: Record<string, (raw: unknown, id: string) => unknown> = {
  score: mapScore,
  schedule: mapSchedule,
  boxscore: mapBoxscore,
  // A roster response doesn't name its team, so the fixture id (e.g. FLA) stands in.
  roster: mapRoster,
  'player-landing': mapPlayerLanding,
  'skater-summary-reg': (raw) => mapSkaterSummary(raw, 'REG'),
  'goalie-summary-reg': (raw) => mapGoalieSummary(raw, 'REG'),
  'schedule-calendar': mapScheduleCalendar,
};

// Keys are fixture directory names under test/fixtures/espn-nba.
const espnNba: Record<string, (raw: unknown, id: string) => unknown> = {
  // The scoreboard carries no game day, so the fixture id (the requested date) stands in.
  scoreboard: (raw, id) => mapScoreboard(raw, id),
  summary: mapSummary,
  teams: mapTeams,
  roster: mapEspnRoster,
  athlete: mapAthlete,
  byathlete: mapByAthlete,
};

const sources: Record<string, Record<string, (raw: unknown, id: string) => unknown>> = {
  nhl,
  'espn-nba': espnNba,
};

export async function inspectFixture(
  source: string,
  endpoint: string,
  id: string,
  root = fileURLToPath(new URL('../../test/fixtures', import.meta.url)),
): Promise<unknown> {
  const mappers = lookup(sources, source);
  if (mappers === undefined)
    throw new Error(`unknown source "${source}"; valid: ${Object.keys(sources).join(', ')}`);
  const map = lookup(mappers, endpoint);
  if (map === undefined)
    throw new Error(
      `unknown endpoint "${endpoint}" for ${source}; valid: ${Object.keys(mappers).join(', ')}`,
    );
  const raw: unknown = JSON.parse(
    await readFile(join(root, source, endpoint, `${id}.json`), 'utf8'),
  );
  return map(raw, id);
}

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
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
import { lookup } from '../sources/nhl/common';

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

export async function inspectFixture(
  source: string,
  endpoint: string,
  id: string,
  root = fileURLToPath(new URL('../../test/fixtures', import.meta.url)),
): Promise<unknown> {
  if (source === 'espn-nba') throw new Error('espn-nba arrives in S05');
  if (source !== 'nhl') throw new Error(`unknown source "${source}"; valid: nhl`);
  const map = lookup(nhl, endpoint);
  if (map === undefined)
    throw new Error(
      `unknown endpoint "${endpoint}" for nhl; valid: ${Object.keys(nhl).join(', ')}`,
    );
  const raw: unknown = JSON.parse(
    await readFile(join(root, 'nhl', endpoint, `${id}.json`), 'utf8'),
  );
  return map(raw, id);
}

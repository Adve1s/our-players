import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { recordFixture, resolveFixtureUrl } from '../src/fixtures/record';
import type { PoliteResponse } from '../src/http/polite-client';

const NOW = new Date('2026-10-03T10:00:00.000Z');

function fakeClient(body: string) {
  const urls: string[] = [];
  return {
    urls,
    client: {
      get: async (url: string): Promise<PoliteResponse> => {
        urls.push(url);
        return {
          url,
          status: 200,
          headers: new Headers(),
          body,
          bytes: new TextEncoder().encode(body).length,
        };
      },
    },
  };
}

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'fixtures-'));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

function record(body: string, extra: { id?: string; as?: string; force?: boolean } = {}) {
  const fake = fakeClient(body);
  const result = recordFixture({
    source: 'nhl',
    endpoint: 'boxscore',
    id: extra.id ?? '2025021000',
    as: extra.as,
    force: extra.force,
    client: fake.client,
    root,
    now: () => NOW,
  });
  return { result, urls: fake.urls };
}

describe('resolveFixtureUrl', () => {
  it.each([
    ['nhl', 'score', '2026-03-10', 'https://api-web.nhle.com/v1/score/2026-03-10'],
    ['nhl', 'roster', 'TBL', 'https://api-web.nhle.com/v1/roster/TBL/current'],
    ['nhl', 'roster', 'TBL-20252026', 'https://api-web.nhle.com/v1/roster/TBL/20252026'],
    [
      'espn-nba',
      'scoreboard',
      '2026-03-10',
      'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=20260310',
    ],
    [
      'espn-nba',
      'athlete',
      '3102531',
      'https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/athletes/3102531',
    ],
    [
      'espn-nba',
      'roster',
      '9-2026',
      'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/9/roster?season=2026',
    ],
    // The next three are copied from the recorded .meta.json files.
    [
      'espn-nba',
      'stats-byathlete',
      '2026-2',
      'https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/statistics/byathlete?region=us&lang=en&contentorigin=espn&isqualified=false&page=1&limit=50&sort=offensive.avgPoints%3Adesc&season=2026&seasontype=2',
    ],
    [
      'nhl',
      'skater-summary',
      '20252026',
      'https://api.nhle.com/stats/rest/en/skater/summary?isAggregate=false&isGame=false&sort=%5B%7B%22property%22%3A%22points%22%2C%22direction%22%3A%22DESC%22%7D%2C%7B%22property%22%3A%22playerId%22%2C%22direction%22%3A%22ASC%22%7D%5D&start=0&limit=100&cayenneExp=seasonId%3D20252026+and+gameTypeId%3D2',
    ],
    [
      'nhl',
      'goalie-summary',
      '20252026',
      'https://api.nhle.com/stats/rest/en/goalie/summary?isAggregate=false&isGame=false&sort=%5B%7B%22property%22%3A%22wins%22%2C%22direction%22%3A%22DESC%22%7D%2C%7B%22property%22%3A%22playerId%22%2C%22direction%22%3A%22ASC%22%7D%5D&start=0&limit=100&cayenneExp=seasonId%3D20252026+and+gameTypeId%3D2',
    ],
  ])('%s %s %s', (source, endpoint, id, url) => {
    expect(resolveFixtureUrl(source, endpoint, id)).toBe(url);
  });

  it('rejects an unknown source or endpoint, naming the known ones', () => {
    expect(() => resolveFixtureUrl('nfl', 'score', '2026-03-10')).toThrow(/nfl.*nhl/);
    expect(() => resolveFixtureUrl('nhl', 'scores', '2026-03-10')).toThrow(/scores.*score/);
    expect(() => resolveFixtureUrl('nhl', 'constructor', '1')).toThrow(/Unknown nhl endpoint/);
  });

  it('rejects a malformed ID', () => {
    expect(() => resolveFixtureUrl('nhl', 'score', '20260310')).toThrow(/YYYY-MM-DD/);
    expect(() => resolveFixtureUrl('nhl', 'boxscore', '../x')).toThrow(/numeric/);
  });
});

describe('recordFixture', () => {
  it('writes pretty-printed JSON and a meta file under <source>/<endpoint>/', async () => {
    const raw = '{"id":2025021000,"gameState":"OFF"}';
    const { result, urls } = record(raw);
    const { path, metaPath } = await result;

    expect(path).toBe(join(root, 'nhl', 'boxscore', '2025021000.json'));
    expect(metaPath).toBe(join(root, 'nhl', 'boxscore', '2025021000.meta.json'));
    expect(await readFile(path, 'utf8')).toBe(`${JSON.stringify(JSON.parse(raw), null, 2)}\n`);
    expect(JSON.parse(await readFile(metaPath, 'utf8'))).toEqual({
      source: 'nhl',
      endpoint: 'boxscore',
      id: '2025021000',
      url: 'https://api-web.nhle.com/v1/gamecenter/2025021000/boxscore',
      fetchedAt: '2026-10-03T10:00:00.000Z',
      status: 200,
      bytes: raw.length,
    });
    expect(urls).toEqual(['https://api-web.nhle.com/v1/gamecenter/2025021000/boxscore']);
  });

  it('refuses to overwrite an existing fixture without force, before fetching', async () => {
    await record('{"v":1}').result;
    const second = record('{"v":2}');
    await expect(second.result).rejects.toThrow(/exists.*--force/);
    expect(second.urls).toEqual([]);
    const path = join(root, 'nhl', 'boxscore', '2025021000.json');
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual({ v: 1 });
  });

  it('refuses when only the meta file exists', async () => {
    await record('{"v":1}').result;
    await rm(join(root, 'nhl', 'boxscore', '2025021000.json'));
    await expect(record('{"v":2}').result).rejects.toThrow(/exists/);
  });

  it('overwrites with force', async () => {
    await record('{"v":1}').result;
    const { path } = await record('{"v":2}', { force: true }).result;
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual({ v: 2 });
  });

  it('saves under another name with as, next to the old one', async () => {
    const { path: first } = await record('{"v":1}').result;
    const { path, meta } = await record('{"v":2}', { as: '2025021000-rerecorded' }).result;
    expect(path).toBe(join(root, 'nhl', 'boxscore', '2025021000-rerecorded.json'));
    expect(meta.id).toBe('2025021000');
    expect(JSON.parse(await readFile(first, 'utf8'))).toEqual({ v: 1 });
  });

  it('rejects an unsafe as name', async () => {
    await expect(record('{}', { as: '../evil' }).result).rejects.toThrow(/name/);
  });

  it('fails loudly on a body that is not JSON and writes nothing', async () => {
    await expect(record('<html>blocked</html>').result).rejects.toThrow(
      /not JSON.*gamecenter\/2025021000/,
    );
    await expect(readFile(join(root, 'nhl', 'boxscore', '2025021000.json'))).rejects.toThrow();
  });

  it('works when the endpoint folder already holds other fixtures', async () => {
    await record('{}', { id: '2025021001' }).result;
    await writeFile(join(root, 'nhl', 'boxscore', 'notes.txt'), 'x');
    await expect(record('{}').result).resolves.toBeDefined();
  });
});

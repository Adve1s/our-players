import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  BYATHLETE_MAX_PAGES,
  espnUrls,
  fetchAthlete,
  fetchRoster,
  fetchScoreboard,
  fetchSeasonStats,
  fetchSummary,
  fetchTeams,
} from '../src/sources/espn-nba/client';
import { fakeClient } from './fake-client';
import { loadFixture } from './fixtures';
import { list, obj, only } from './json';

const recordedUrl = (endpoint: string, id: string): string => {
  const meta: unknown = JSON.parse(
    readFileSync(
      new URL(`./fixtures/espn-nba/${endpoint}/${id}.meta.json`, import.meta.url),
      'utf8',
    ),
  );
  return String(obj(meta).url);
};

// Serves the fixture at exactly its recorded URL; any other URL is a 404.
const recorded = (endpoint: string, id: string) =>
  fakeClient({ [recordedUrl(endpoint, id)]: loadFixture('espn-nba', endpoint, id) });

describe('espnUrls', () => {
  it.each([
    ['scoreboard', '2026-03-23', () => espnUrls.scoreboard('2026-03-23')],
    ['summary', '401810839', () => espnUrls.summary('401810839')],
    ['teams', '2026-10-18', () => espnUrls.teams()],
    ['roster', '9', () => espnUrls.roster('9')],
    ['athlete', '3102531', () => espnUrls.athlete('3102531')],
    ['byathlete', '2026', () => espnUrls.byathlete('2026', 2, 1)],
  ])('%s rebuilds the recorded URL of fixture %s', (endpoint, id, build) => {
    expect(build()).toBe(recordedUrl(endpoint, id));
  });

  it('caps byathlete at 20 pages', () => {
    expect(BYATHLETE_MAX_PAGES).toBe(20);
  });
});

describe('ESPN NBA fetchers', () => {
  it('fetchScoreboard requests the date and maps GS@DAL as FINAL on that game day', async () => {
    const client = recorded('scoreboard', '2026-03-23');
    const { games } = await fetchScoreboard(client, '2026-03-23');
    expect(client.requests).toEqual([recordedUrl('scoreboard', '2026-03-23')]);
    const g = only(games, (x) => x.publicId === 'nba-401810899', 'game 401810899');
    expect(g).toMatchObject({ status: 'FINAL', gameDate: '2026-03-23' });
  });

  it('fetchSummary requests the event and maps Porziņģis (30 points)', async () => {
    const client = recorded('summary', '401810839');
    const { lines } = await fetchSummary(client, '401810839');
    expect(client.requests).toEqual([recordedUrl('summary', '401810839')]);
    const l = only(lines, (x) => x.playerPublicId === 'nba-3102531', 'Porziņģis line');
    expect(l.kind === 'basketball_player' && l.played && l.stats.points).toBe(30);
  });

  it('fetchTeams requests the team list and maps 30 teams', async () => {
    const client = recorded('teams', '2026-10-18');
    const { teams } = await fetchTeams(client);
    expect(client.requests).toEqual([recordedUrl('teams', '2026-10-18')]);
    expect(teams).toHaveLength(30);
  });

  it("fetchRoster requests the team's roster and maps Porziņģis to it", async () => {
    const client = recorded('roster', '9');
    const { players } = await fetchRoster(client, { externalId: '9' });
    expect(client.requests).toEqual([recordedUrl('roster', '9')]);
    const p = only(players, (x) => x.externalId === '3102531', 'Porziņģis');
    expect(p).toMatchObject({ currentTeamExternalId: '9', birthCountry: 'LVA' });
  });

  it('fetchRoster throws when the roster names another team', async () => {
    const client = fakeClient({ [espnUrls.roster('10')]: loadFixture('espn-nba', 'roster', '9') });
    await expect(fetchRoster(client, { externalId: '10' })).rejects.toThrow(
      /espn-nba roster: asked for team 10, got 9/,
    );
  });

  it('fetchAthlete requests the athlete and maps Porziņģis as LVA', async () => {
    const client = recorded('athlete', '3102531');
    const { player } = await fetchAthlete(client, '3102531');
    expect(client.requests).toEqual([recordedUrl('athlete', '3102531')]);
    expect(player).toMatchObject({ publicId: 'nba-3102531', birthCountry: 'LVA' });
  });

  it('throws naming source and endpoint when the body is not JSON', async () => {
    const client = {
      get: async (url: string) => ({ url, status: 200, text: '<html>', bytes: 6 }),
    };
    await expect(fetchSummary(client, '401810839')).rejects.toThrow(
      /^espn-nba summary: response is not JSON/,
    );
  });
});

describe('fetchSeasonStats', () => {
  const page1Url = espnUrls.byathlete('2026', 2, 1);
  const page2Url = espnUrls.byathlete('2026', 2, 2);

  // Page 1 as recorded, cut to `pages` pages of `count` rows.
  function page1(pages: number, count: number): unknown {
    const raw = loadFixture('espn-nba', 'byathlete', '2026');
    Object.assign(obj(raw, 'pagination'), { pages, count, page: 1 });
    return raw;
  }

  // A page 2 holding `fresh` athletes not on page 1 (ids renumbered), after `repeated` page-1 athletes.
  function page2(fresh: number, repeated = 0): unknown {
    const raw = loadFixture('espn-nba', 'byathlete', '2026');
    Object.assign(obj(raw, 'pagination'), { pages: 2, count: 60, page: 2 });
    const athletes = list(raw, 'athletes');
    const renumbered = athletes.slice(repeated, repeated + fresh).map((a, i) => {
      obj(a, 'athlete').id = String(900000 + i);
      return a;
    });
    obj(raw).athletes = [...athletes.slice(0, repeated), ...renumbered];
    return raw;
  }

  it('requests page 1 then page 2 of the REG season and returns every row', async () => {
    const client = fakeClient({ [page1Url]: page1(2, 60), [page2Url]: page2(10) });
    const rows = await fetchSeasonStats(client, '2025-26', 'REG');
    expect(client.requests).toEqual([
      'https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/statistics/byathlete?season=2026&seasontype=2&limit=50&page=1',
      'https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/statistics/byathlete?season=2026&seasontype=2&limit=50&page=2',
    ]);
    expect(rows).toHaveLength(60);
  });

  it('throws after one request when the pages exceed the budget', async () => {
    const client = fakeClient({ [page1Url]: page1(21, 1050) });
    await expect(fetchSeasonStats(client, '2025-26', 'REG')).rejects.toThrow(
      /espn-nba byathlete: 21 pages exceeds the budget of 20/,
    );
    expect(client.requests).toEqual([page1Url]);
  });

  it('throws when fewer rows arrive than the count', async () => {
    const client = fakeClient({ [page1Url]: page1(1, 60) });
    await expect(fetchSeasonStats(client, '2025-26', 'REG')).rejects.toThrow(/truncated/);
  });

  // A shift mid-paging: page 2 repeats one page-1 athlete in place of a new one, so one is lost.
  it('counts an athlete repeated across pages once, so the rows fall short of the count', async () => {
    const client = fakeClient({ [page1Url]: page1(2, 60), [page2Url]: page2(9, 1) });
    await expect(fetchSeasonStats(client, '2025-26', 'REG')).rejects.toThrow(/truncated/);
  });

  it('returns an athlete repeated across pages once', async () => {
    const client = fakeClient({ [page1Url]: page1(2, 59), [page2Url]: page2(9, 1) });
    const rows = await fetchSeasonStats(client, '2025-26', 'REG');
    expect(rows).toHaveLength(59);
    expect(new Set(rows.map((r) => r.playerPublicId)).size).toBe(59);
  });

  it('rejects a malformed season before any request', async () => {
    const client = fakeClient({});
    await expect(fetchSeasonStats(client, '2025-27', 'REG')).rejects.toThrow(
      /^espn-nba byathlete: unknown season "2025-27"/,
    );
    expect(client.requests).toEqual([]);
  });
});

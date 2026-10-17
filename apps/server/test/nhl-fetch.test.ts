import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { HttpError, type PoliteResponse } from '../src/http/polite-client';
import {
  fetchBoxscore,
  fetchGoalieSummary,
  fetchRoster,
  fetchScore,
  fetchSkaterSummary,
} from '../src/sources/nhl/client';
import { loadFixture } from './fixtures';
import { obj, only } from './json';

const fixtureText = (endpoint: string, id: string) =>
  readFileSync(new URL(`./fixtures/nhl/${endpoint}/${id}.json`, import.meta.url), 'utf8');

// A fake polite client that serves one body for any URL and records what was asked for.
function serving(text: string) {
  return {
    get: vi.fn(
      async (url: string): Promise<PoliteResponse> => ({
        url,
        status: 200,
        text,
        bytes: Buffer.byteLength(text, 'utf8'),
      }),
    ),
  };
}

describe('NHL fetchers', () => {
  it('fetchBoxscore requests the gamecenter boxscore and maps Merzlikins (30 saves)', async () => {
    const client = serving(fixtureText('boxscore', '2025020760'));
    const { lines } = await fetchBoxscore(client, '2025020760');
    expect(client.get).toHaveBeenCalledWith(
      'https://api-web.nhle.com/v1/gamecenter/2025020760/boxscore',
    );
    const l = only(lines, (x) => x.playerPublicId === 'nhl-8478007', 'Merzlikins line');
    expect(l.kind === 'hockey_goalie' && l.played && l.stats.saves).toBe(30);
  });

  it('fetchScore requests the score of the date', async () => {
    const client = serving(fixtureText('score', '2026-01-17'));
    const { games } = await fetchScore(client, '2026-01-17');
    expect(client.get).toHaveBeenCalledWith('https://api-web.nhle.com/v1/score/2026-01-17');
    expect(games.some((g) => g.publicId === 'nhl-2025020760')).toBe(true);
  });

  it('fetchRoster requests the current roster and sets the given team id', async () => {
    const client = serving(fixtureText('roster', 'FLA'));
    const { players } = await fetchRoster(client, 'FLA', '13');
    expect(client.get).toHaveBeenCalledWith('https://api-web.nhle.com/v1/roster/FLA/current');
    const vilmanis = only(players, (p) => p.externalId === '8483771', 'Vilmanis');
    expect(vilmanis.currentTeamExternalId).toBe('13');
  });

  it('fetchSkaterSummary requests every REG row of 2025-26 and maps them', async () => {
    const client = serving(fixtureText('skater-summary-lva', '20252026'));
    const rows = await fetchSkaterSummary(client, '2025-26', 'REG');
    expect(client.get).toHaveBeenCalledWith(
      'https://api.nhle.com/stats/rest/en/skater/summary?limit=-1&cayenneExp=seasonId%3D20252026%20and%20gameTypeId%3D2',
    );
    expect(rows).toHaveLength(5);
  });

  it('fetchGoalieSummary returns every row when the response is complete', async () => {
    const raw = loadFixture('nhl', 'goalie-summary-reg', '20252026');
    const data = obj(raw).data as unknown[];
    obj(raw).total = data.length;
    const client = serving(JSON.stringify(raw));
    const rows = await fetchGoalieSummary(client, '2025-26', 'REG');
    expect(client.get).toHaveBeenCalledWith(
      'https://api.nhle.com/stats/rest/en/goalie/summary?limit=-1&cayenneExp=seasonId%3D20252026%20and%20gameTypeId%3D2',
    );
    expect(rows).toHaveLength(50);
  });

  it('fetchGoalieSummary throws when the source returned fewer rows than its total', async () => {
    const client = serving(fixtureText('goalie-summary-reg', '20252026'));
    await expect(fetchGoalieSummary(client, '2025-26', 'REG')).rejects.toThrow(
      'nhl goalie-summary: truncated, 50 of 98 rows',
    );
  });

  it('throws naming source and endpoint when the body is not JSON', async () => {
    await expect(fetchBoxscore(serving('<html>'), '2025020760')).rejects.toThrow(
      /^nhl boxscore: response is not JSON/,
    );
  });

  it('lets the client HttpError through unchanged', async () => {
    const err = new HttpError('u', 404, 'GET u → 404');
    const client = {
      get: vi.fn(async (): Promise<PoliteResponse> => {
        throw err;
      }),
    };
    await expect(fetchBoxscore(client, '2025020760')).rejects.toBe(err);
  });
});

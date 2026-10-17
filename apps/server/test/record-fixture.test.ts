import { mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { endpoints } from '../scripts/endpoints';
import { recordFixture } from '../src/fixtures/record-fixture';
import { HttpError, type PoliteResponse } from '../src/http/polite-client';

const URL_ = 'https://api-web.nhle.com/v1/score/2026-03-16';
const NOW = new Date('2026-10-17T12:00:00.000Z');

const reply = (text: string, status = 200): PoliteResponse => ({
  url: URL_,
  status,
  text,
  bytes: Buffer.byteLength(text, 'utf8'),
});

let root: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'record-fixture-'));
});

function args(
  get: (url: string) => Promise<PoliteResponse>,
  over: { name?: string; force?: boolean } = {},
) {
  return {
    client: { get: vi.fn(get) },
    now: () => NOW,
    root,
    source: 'nhl',
    endpoint: 'score',
    name: over.name ?? '2026-03-16',
    url: URL_,
    force: over.force ?? false,
  };
}

describe('recordFixture', () => {
  it('writes the body and meta', async () => {
    const a = args(async () => reply('{"a":1}'));
    const r = await recordFixture(a);
    expect(a.client.get).toHaveBeenCalledWith(URL_);
    expect(r.jsonPath).toBe(join(root, 'nhl', 'score', '2026-03-16.json'));
    expect(r.metaPath).toBe(join(root, 'nhl', 'score', '2026-03-16.meta.json'));
    expect(r.bytes).toBe(7);
    expect(await readFile(r.jsonPath, 'utf8')).toBe('{\n  "a": 1\n}\n');
    expect(JSON.parse(await readFile(r.metaPath, 'utf8'))).toEqual({
      url: URL_,
      fetchedAt: '2026-10-17T12:00:00.000Z',
      status: 200,
      bytes: 7,
    });
  });

  it('uses --as name', async () => {
    const r = await recordFixture(args(async () => reply('{}'), { name: 'latvian-night' }));
    expect(r.jsonPath).toBe(join(root, 'nhl', 'score', 'latvian-night.json'));
    expect(await readdir(join(root, 'nhl', 'score'))).toEqual([
      'latvian-night.json',
      'latvian-night.meta.json',
    ]);
  });

  it.each(['../x', 'a/b', 'a\\b', '.hidden', ''])('rejects the unsafe name %j', async (name) => {
    const a = args(async () => reply('{}'), { name });
    await expect(recordFixture(a)).rejects.toThrow('invalid fixture name');
    expect(a.client.get).not.toHaveBeenCalled();
    expect(await readdir(root)).toEqual([]);
  });

  it('refuses to overwrite without force', async () => {
    const dir = join(root, 'nhl', 'score');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, '2026-03-16.meta.json'), 'old');
    const a = args(async () => reply('{}'));
    await expect(recordFixture(a)).rejects.toThrow('2026-03-16.meta.json');
    expect(a.client.get).not.toHaveBeenCalled();
    expect(await readFile(join(dir, '2026-03-16.meta.json'), 'utf8')).toBe('old');
  });

  it('overwrites with force', async () => {
    const dir = join(root, 'nhl', 'score');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, '2026-03-16.json'), 'old');
    const r = await recordFixture(args(async () => reply('{"b":2}'), { force: true }));
    expect(await readFile(r.jsonPath, 'utf8')).toBe('{\n  "b": 2\n}\n');
  });

  it('writes nothing for a non-JSON body', async () => {
    await expect(recordFixture(args(async () => reply('<html>oops</html>')))).rejects.toThrow();
    expect(await readdir(root)).toEqual([]);
  });

  it('writes nothing when the client throws HttpError', async () => {
    const err = new HttpError(URL_, 404, `GET ${URL_} → 404`);
    await expect(
      recordFixture(
        args(async () => {
          throw err;
        }),
      ),
    ).rejects.toBe(err);
    expect(await readdir(root)).toEqual([]);
  });

  it('creates missing directories', async () => {
    const a = { ...args(async () => reply('[]')), source: 'espn-nba', endpoint: 'summary' };
    const r = await recordFixture(a);
    expect(r.jsonPath).toBe(join(root, 'espn-nba', 'summary', '2026-03-16.json'));
    expect(await readFile(r.jsonPath, 'utf8')).toBe('[]\n');
  });
});

describe('endpoints', () => {
  it('builds the scoreboard URL with dates=20260316', () => {
    expect(endpoints['espn-nba'].scoreboard?.('2026-03-16')).toBe(
      'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=20260316',
    );
  });

  it('escapes ids so they cannot change the URL', () => {
    expect(endpoints.nhl.boxscore('1&x=y#z')).toBe(
      'https://api-web.nhle.com/v1/gamecenter/1%26x%3Dy%23z/boxscore',
    );
    expect(endpoints.nhl['skater-summary']('2025/2026')).toBe(
      'https://api.nhle.com/stats/rest/en/skater/summary?cayenneExp=seasonId=2025%2F2026',
    );
  });

  it('covers every spec endpoint', () => {
    // Subset, not equality: later tasks may add probe endpoints.
    const spec = {
      nhl: [
        'score',
        'schedule',
        'boxscore',
        'right-rail',
        'roster',
        'player-landing',
        'skater-summary',
        'goalie-summary',
        'skater-bios',
        'goalie-bios',
      ],
      'espn-nba': ['scoreboard', 'summary', 'roster', 'athlete', 'overview'],
    };
    for (const [source, keys] of Object.entries(spec)) {
      const table = endpoints[source as keyof typeof endpoints];
      expect(Object.keys(table)).toEqual(expect.arrayContaining(keys));
    }
  });
});

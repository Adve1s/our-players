import { describe, expect, it, vi } from 'vitest';
import { userAgent } from '../src/http/polite-client';
import { type ProbeTarget, probeTargets, runProbe } from '../src/probe';
import { espnUrls } from '../src/sources/espn-nba/client';
import { nhlUrls } from '../src/sources/nhl/client';

const UA = userAgent('0.1.0', 'https://github.com/Adve1s/our-players');

const NAMES = [
  'nhl score',
  'nhl schedule',
  'nhl schedule-calendar',
  'nhl boxscore',
  'nhl roster',
  'nhl player-landing',
  'nhl skater-summary',
  'nhl goalie-summary',
  'espn scoreboard',
  'espn summary',
  'espn teams',
  'espn roster',
  'espn athlete',
  'espn byathlete',
];

const urlOf = (targets: ProbeTarget[], name: string) => targets.find((t) => t.name === name)?.url;

describe('probeTargets', () => {
  it('lists every upstream endpoint the jobs use, in order', () => {
    expect(probeTargets(new Date('2026-10-22T12:00:00Z')).map((t) => t.name)).toEqual(NAMES);
  });

  it('uses today and the season that started this year from October on', () => {
    const targets = probeTargets(new Date('2026-10-22T12:00:00Z'));
    expect(urlOf(targets, 'nhl score')).toBe(nhlUrls.score('2026-10-22'));
    expect(urlOf(targets, 'nhl skater-summary')).toBe(nhlUrls.summary('skater', '20262027', 2));
    expect(urlOf(targets, 'espn byathlete')).toBe(espnUrls.byathlete('2027', 2, 1));
  });

  it.each(['2026-03-01T12:00:00Z', '2026-09-30T12:00:00Z'])(
    'uses the season that started last year before October (%s)',
    (now) => {
      const targets = probeTargets(new Date(now));
      expect(urlOf(targets, 'nhl skater-summary')).toBe(nhlUrls.summary('skater', '20252026', 2));
      expect(urlOf(targets, 'espn byathlete')).toBe(espnUrls.byathlete('2026', 2, 1));
    },
  );

  it('uses the US game day, not the UTC date', () => {
    const targets = probeTargets(new Date('2026-03-17T03:00:00Z'));
    expect(urlOf(targets, 'nhl score')).toBe(nhlUrls.score('2026-03-16'));
    expect(urlOf(targets, 'nhl schedule')).toBe(nhlUrls.schedule('2026-03-16'));
    expect(urlOf(targets, 'espn scoreboard')).toBe(espnUrls.scoreboard('2026-03-16'));
  });
});

describe('runProbe', () => {
  it('reports ok for every JSON answer and sends the User-Agent', async () => {
    const targets = probeTargets(new Date('2026-10-22T12:00:00Z'));
    const fetch = vi.fn<typeof globalThis.fetch>(
      async () => new Response('{"a":1}', { status: 200 }),
    );

    const { lines, failed } = await runProbe(targets, { userAgent: UA, fetch, minIntervalMs: 0 });

    expect(failed).toBe(0);
    expect(lines).toHaveLength(14);
    targets.forEach((t, i) => {
      expect(lines[i]?.startsWith('ok   200')).toBe(true);
      expect(lines[i]).toContain(t.name);
      expect(lines[i]).toContain(new URL(t.url).hostname);
    });
    expect(fetch.mock.calls.map(([input]) => input)).toEqual(targets.map((t) => t.url));
    for (const [, init] of fetch.mock.calls) {
      expect(new Headers(init?.headers).get('User-Agent')).toBe(UA);
    }
  });

  it('reports an error status, a network error and a non-JSON body as failures, without retrying', async () => {
    const targets: ProbeTarget[] = [
      { name: 'down', url: 'https://down.example/x' },
      { name: 'offline', url: 'https://offline.example/x' },
      { name: 'html', url: 'https://html.example/x' },
    ];
    const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
      const host = new URL(String(input)).hostname;
      if (host === 'down.example') return new Response('nope', { status: 503 });
      if (host === 'offline.example') throw new TypeError('fetch failed');
      return new Response('<html>nope</html>', { status: 200 });
    });

    const { lines, failed } = await runProbe(targets, { userAgent: UA, fetch, minIntervalMs: 0 });

    expect(failed).toBe(3);
    expect(lines[0]?.startsWith('FAIL 503')).toBe(true);
    expect(lines[1]?.startsWith('FAIL ---')).toBe(true);
    expect(lines[2]?.startsWith('FAIL 200')).toBe(true);
    expect(lines[2]).toContain('not JSON');
    targets.forEach((t, i) => {
      expect(lines[i]).toContain(t.name);
    });
    expect(fetch.mock.calls.filter(([input]) => input === 'https://down.example/x')).toHaveLength(
      1,
    );
  });

  it('times the whole response, body included', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => {
      const body = new ReadableStream<Uint8Array>({
        async start(c) {
          await new Promise((r) => setTimeout(r, 80));
          c.enqueue(new TextEncoder().encode('{"a":1}'));
          c.close();
        },
      });
      return new Response(body, { status: 200 });
    });

    const { lines } = await runProbe([{ name: 'slow', url: 'https://slow.example/x' }], {
      userAgent: UA,
      fetch,
      minIntervalMs: 0,
    });

    const ms = Number(/ (\d+) ms /.exec(lines[0] ?? '')?.[1]);
    expect(ms).toBeGreaterThanOrEqual(70);
  });

  it('lines up the name column in ok and FAIL lines', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async (input) =>
      String(input).includes('down')
        ? new Response('nope', { status: 503 })
        : new Response('{"a":1}', { status: 200 }),
    );

    const { lines } = await runProbe(
      [
        { name: 'up', url: 'https://up.example/x' },
        { name: 'down', url: 'https://down.example/x' },
      ],
      { userAgent: UA, fetch, minIntervalMs: 0 },
    );

    expect(lines[1]?.indexOf('down')).toBe(lines[0]?.indexOf('up'));
  });
});

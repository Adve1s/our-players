// TS 6 loads no @types by default, and this Node script needs them.
/// <reference types="node" />
import { type ChildProcess, spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import { createInterface } from 'node:readline';
import { type Browser, chromium, type Page } from 'playwright';
import { DEFAULT_PREFS, type StoredPrefs } from '../src/state/prefs';

// Own ports, so this runs next to `pnpm dev:server` (:3001) and `pnpm dev:mobile` (:8081).
const API_PORT = 3101;
const WEB_PORT = 8091;
const API = `http://localhost:${API_PORT}`;
const WEB = `http://localhost:${WEB_PORT}`;
const OUT = resolve('.screenshots');
const WEB_DIR = join(OUT, 'web');

const children: ChildProcess[] = [];
let server: Server | undefined;
let browser: Browser | undefined;

async function step<T>(name: string, fn: () => Promise<T>): Promise<T> {
  console.log(`> ${name}`);
  try {
    return await fn();
  } catch (e) {
    throw new Error(`step "${name}" failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function answers(url: string): Promise<boolean> {
  try {
    await fetch(url, { signal: AbortSignal.timeout(1000) });
    return true;
  } catch {
    return false;
  }
}

// Detached = its own process group (Ctrl-C doesn't reach it), so killing -pid also takes tsx's node child.
function spawnGroup(cmd: string, args: string[], cwd: string): ChildProcess {
  const child = spawn(cmd, args, { cwd, detached: true, stdio: ['ignore', 'pipe', 'inherit'] });
  children.push(child);
  return child;
}

function waitForReady(child: ChildProcess): Promise<void> {
  return new Promise((ok, fail) => {
    const timer = setTimeout(() => fail(new Error('no "ready" within 60 s')), 60_000);
    child.once('error', fail);
    child.once('exit', (code) => fail(new Error(`exited with ${code} before "ready"`)));
    if (!child.stdout) return fail(new Error('no stdout'));
    // Keeps reading after "ready" (the request log), so a full pipe never blocks the API.
    createInterface({ input: child.stdout }).on('line', (line) => {
      if (line.trim() === 'ready') {
        clearTimeout(timer);
        ok();
      }
    });
  });
}

function run(cmd: string, args: string[], env: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((ok, fail) => {
    const child = spawn(cmd, args, { stdio: 'inherit', env });
    child.once('error', fail);
    child.once('exit', (code) => (code === 0 ? ok() : fail(new Error(`exited with ${code}`))));
  });
}

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

// `expo serve` only serves <project>/dist, so a tiny static server with the single-page fallback.
function serveWeb(): Promise<Server> {
  const s = createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url ?? '/', WEB).pathname);
    const file = resolve(WEB_DIR, `.${path}`);
    let body: Buffer;
    let type = TYPES[extname(file)] ?? 'application/octet-stream';
    try {
      if (!file.startsWith(WEB_DIR + sep)) throw new Error('outside the export');
      body = await readFile(file);
    } catch {
      // Unknown paths (deep links like /settings, directories) get the app's index.html.
      body = await readFile(join(WEB_DIR, 'index.html'));
      type = TYPES['.html'] ?? 'text/html';
    }
    res.writeHead(200, { 'content-type': type }).end(body);
  });
  return new Promise((ok, fail) => {
    s.once('error', fail);
    s.listen(WEB_PORT, '127.0.0.1', () => ok(s));
  });
}

// Stored prefs other than the defaults, written before the first load as the app's persist layer does.
// `after` runs once the image is taken: checks that belong to the shot but not to its picture.
type Shot = {
  name: string;
  prefs?: Partial<StoredPrefs>;
  take: (page: Page) => Promise<void>;
  after?: (page: Page) => Promise<void>;
};

const RUST = 'nhl-8475810';
const LEONS = 'nba-4897449';
const PORZINGIS = 'nba-3102531';
const MERZLIKINS = 'nhl-8478007';
const GIRGENSONS = 'nhl-8476878';
const BALINSKIS = 'nhl-8484304';

// Tabs stay mounted on web: a tab left behind sits under the current one, aria-hidden but
// "visible" to Playwright, so text only counts outside an aria-hidden subtree.
const shown = (page: Page, text: string, exact = false) =>
  page
    .getByText(text, { exact })
    .and(page.locator('xpath=//*[not(ancestor-or-self::*[@aria-hidden="true"])]'));

// .first(): a wait only needs the text on screen, not that it's the only match.
async function seen(page: Page, ...texts: string[]): Promise<void> {
  for (const text of texts) await shown(page, text).first().waitFor();
}

async function gone(page: Page, text: string, exact = false): Promise<void> {
  await shown(page, text, exact).first().waitFor({ state: 'hidden' });
}

async function day(page: Page, date?: string): Promise<void> {
  await page.goto(date ? `${WEB}/?date=${date}` : WEB);
}

async function tab(page: Page, label: string): Promise<void> {
  await page.goto(WEB);
  await page.getByRole('tab', { name: label }).click();
}

// The tab bar, not a reload: the init script would write the shot's prefs over what the flow stored.
async function switchTo(page: Page, label: string): Promise<void> {
  await page.getByRole('tab', { name: label }).click();
}

async function search(page: Page, term: string): Promise<void> {
  await page.getByLabel('Search players').fill(term);
}

async function lists(page: Page): Promise<void> {
  await tab(page, 'Settings');
  await page.getByText('Sweden').waitFor();
  await shown(page, 'Favorites', true).evaluate((el) => el.scrollIntoView({ block: 'start' }));
}

const SHOTS: Shot[] = [
  {
    name: 'today',
    take: async (page) => {
      await day(page);
      await seen(page, 'Other games (9)', 'Porzingis');
    },
  },
  {
    // Silovs played for PIT that night (25 of 27, W), so Rust is the only favorite needed.
    name: 'night-mixed',
    prefs: { favorites: [RUST] },
    take: async (page) => {
      await day(page, '2026-03-16');
      await seen(page, 'Other games (7)', 'Silovs', 'Rust', 'Porzingis');
    },
  },
  {
    name: 'night-busy',
    prefs: { favorites: [RUST] },
    take: async (page) => {
      await day(page, '2026-03-16');
      await page.getByRole('button', { name: 'Other games (7)' }).click();
      await seen(page, 'ORL 112 – 124 ATL');
      await page
        .getByText('Other games (7)')
        .evaluate((el) => el.scrollIntoView({ block: 'start' }));
    },
  },
  {
    name: 'dnp',
    prefs: { favorites: [LEONS] },
    take: async (page) => {
      await day(page, '2026-03-23');
      await seen(page, "DNP — Coach's decision");
    },
  },
  {
    name: 'not-in-lineup',
    take: async (page) => {
      await day(page, '2026-01-17');
      await seen(page, 'Not in lineup', 'Merzlikins', 'Silovs');
    },
  },
  {
    name: 'upcoming',
    prefs: { favorites: [RUST] },
    take: async (page) => {
      await day(page, '2026-10-16');
      await seen(page, 'Not started', 'Sat 04:00');
    },
  },
  {
    name: 'waiting',
    take: async (page) => {
      await day(page, '2026-03-24');
      await seen(page, 'Waiting for stats', 'Girgensons');
    },
  },
  {
    name: 'empty-past',
    prefs: { countries: ['SWE'] },
    take: async (page) => {
      await day(page, '2026-03-23');
      await seen(page, 'None of your players played on Mon, Mar 23.', 'Other games (10)');
    },
  },
  {
    name: 'empty-future',
    take: async (page) => {
      await day(page, '2026-03-25');
      // "play", not "played": only once meta is in does the day read as after the latest.
      await seen(page, 'None of your players play on Wed, Mar 25.');
    },
  },
  {
    name: 'nothing-followed',
    prefs: { countries: [] },
    take: async (page) => {
      await day(page);
      await seen(page, "You're not following any countries or players yet.");
    },
  },
  {
    name: 'api-down',
    take: async (page) => {
      await page.context().route(`${API}/**`, (r) => r.abort());
      await day(page);
      await seen(page, "Can't reach the server");
    },
  },
  {
    name: 'offline-banner',
    take: async (page) => {
      await page.clock.install();
      await day(page);
      await seen(page, 'Other games (9)');
      await page.context().route(`${API}/**`, (r) => r.abort());
      // Past the 5-minute staleTime, then the focus event TanStack Query listens for on web.
      await page.clock.fastForward('06:00');
      await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')));
      await seen(page, "Couldn't refresh — showing saved data.");
    },
  },
  {
    name: 'search-empty',
    take: async (page) => {
      await tab(page, 'Search');
      await seen(page, "Type at least 2 letters of a player's name.");
    },
  },
  {
    // "ins": both leagues, two Latvians (one starred, one hidden) and two others.
    name: 'search-results',
    prefs: { favorites: [MERZLIKINS], hidden: [BALINSKIS] },
    take: async (page) => {
      await tab(page, 'Search');
      await search(page, 'ins');
      await seen(page, 'Jamir Watkins', 'Uvis Balinskis', 'Elvis Merzlikins');
      await page
        .getByRole('checkbox', { name: 'Favorite Elvis Merzlikins', checked: true })
        .waitFor();
      await page.getByRole('checkbox', { name: 'Hide Uvis Balinskis', checked: true }).waitFor();
    },
  },
  {
    name: 'search-no-match',
    take: async (page) => {
      await tab(page, 'Search');
      await search(page, 'zzzz');
      await seen(page, 'No player matches "zzzz".');
    },
  },
  {
    name: 'search-api-down',
    take: async (page) => {
      await tab(page, 'Search');
      // After the first load: the tab is reached with the API up, then a search finds it down.
      await page.context().route(`${API}/**`, (r) => r.abort());
      await search(page, 'silovs');
      await seen(page, "Can't reach the server");
    },
  },
  {
    name: 'settings',
    take: async (page) => {
      await tab(page, 'Settings');
      // Sweden comes only from /v1/countries (Latvia shows before it loads, being selected).
      await page.getByText('Sweden').waitFor();
    },
  },
  {
    name: 'settings-one-league',
    take: async (page) => {
      await tab(page, 'Settings');
      await page.getByText('Sweden').waitFor();
      // NBA off leaves NHL as the last league, so its switch is the disabled one.
      await page.getByRole('switch', { name: 'NBA' }).click();
      await page.getByText('At least one league stays on.').waitFor();
    },
  },
  {
    name: 'settings-search',
    take: async (page) => {
      await tab(page, 'Settings');
      await page.getByText('Sweden').waitFor();
      await page.getByLabel('Search countries').fill('sw');
      await page.getByText('Canada').waitFor({ state: 'hidden' });
      await page.getByText('Switzerland').waitFor();
    },
  },
  {
    name: 'settings-about',
    take: async (page) => {
      await tab(page, 'Settings');
      await page.getByText('Sweden').waitFor();
      await page.getByText('Not affiliated with the NHL or NBA.').scrollIntoViewIfNeeded();
    },
  },
  {
    name: 'settings-lists',
    prefs: { favorites: [PORZINGIS, RUST], hidden: [GIRGENSONS] },
    take: async (page) => {
      await lists(page);
      await seen(page, 'Kristaps Porzingis', 'Bryan Rust', 'Zemgus Girgensons');
    },
  },
  {
    name: 'settings-undo',
    prefs: { favorites: [PORZINGIS, RUST] },
    take: async (page) => {
      await lists(page);
      await page.getByRole('button', { name: 'Remove Kristaps Porzingis' }).click();
      await page.getByRole('button', { name: 'Undo removing Kristaps Porzingis' }).waitFor();
      await seen(page, 'Undo');
    },
    // Leaving Settings makes the removal final: back there, no Undo and no Porziņģis.
    after: async (page) => {
      await switchTo(page, 'Today');
      await seen(page, 'Other games');
      await switchTo(page, 'Settings');
      await page.getByRole('button', { name: 'Remove Bryan Rust' }).waitFor();
      await gone(page, 'Undo', true);
      await gone(page, 'Kristaps Porzingis');
    },
  },
  {
    name: 'settings-lists-empty',
    take: async (page) => {
      await lists(page);
      await seen(page, 'No favorites yet. Star players in Search.');
      await seen(page, 'Nobody hidden. Hidden players never show on Today.');
    },
  },
  {
    // Criterion 2 on web: no countries, so only the star puts Porziņģis on Today.
    name: 'flow-favorite',
    prefs: { countries: [] },
    take: async (page) => {
      await day(page, '2026-03-16');
      await seen(page, "You're not following any countries or players yet.");
      await switchTo(page, 'Search');
      await search(page, 'porzingis');
      await seen(page, 'Kristaps Porzingis');
      await page.getByRole('checkbox', { name: 'Favorite Kristaps Porzingis' }).click();
      await page
        .getByRole('checkbox', { name: 'Favorite Kristaps Porzingis', checked: true })
        .waitFor();
      await switchTo(page, 'Today');
      await seen(page, 'Mon, Mar 16', 'Porzingis');
    },
  },
  {
    // Criterion 3 on web: Hide takes Silovs off Today, un-hiding brings him back (the image).
    name: 'flow-hidden',
    take: async (page) => {
      await day(page, '2026-03-16');
      await seen(page, 'Mon, Mar 16', 'Silovs', 'Porzingis');
      await switchTo(page, 'Search');
      await search(page, 'silovs');
      await page.getByRole('checkbox', { name: 'Hide Arturs Silovs' }).click();
      await page.getByRole('checkbox', { name: 'Hide Arturs Silovs', checked: true }).waitFor();
      await switchTo(page, 'Today');
      // The date first: while Today is still aria-hidden, "gone" would pass on no match at all.
      // Once it's on screen, keepPreviousData holds the old day until the refetch lands.
      await seen(page, 'Mon, Mar 16');
      await gone(page, 'Silovs');
      await seen(page, 'Porzingis');
      await switchTo(page, 'Search');
      await page.getByRole('checkbox', { name: 'Hide Arturs Silovs' }).click();
      await page.getByRole('checkbox', { name: 'Hide Arturs Silovs', checked: false }).waitFor();
      await switchTo(page, 'Today');
      await seen(page, 'Mon, Mar 16', 'Silovs', 'Porzingis');
    },
  },
  {
    name: 'settings-api-down',
    take: async (page) => {
      await page.context().route(`${API}/**`, (r) => r.abort());
      await tab(page, 'Settings');
      await page.getByText("Can't reach the server").waitFor();
    },
  },
];

async function cleanup(): Promise<void> {
  for (const child of children) {
    try {
      if (child.pid && child.exitCode === null) process.kill(-child.pid, 'SIGTERM');
    } catch {
      // Already gone.
    }
  }
  server?.close();
  await browser?.close();
}

async function main(): Promise<void> {
  await step('check ports', async () => {
    for (const url of [API, WEB]) if (await answers(url)) throw new Error(`${url} already answers`);
  });
  await step('start API', () =>
    waitForReady(
      // tsx straight from the server package, not via `pnpm exec`, which reports our kill as a failure.
      spawnGroup('tsx', ['scripts/screenshot-api.ts'], resolve('../server')),
    ),
  );
  // Expo doesn't let apps/mobile/.env override a variable already in the environment.
  await step('export web', () =>
    run('pnpm', ['exec', 'expo', 'export', '-p', 'web', '--output-dir', WEB_DIR], {
      ...process.env,
      EXPO_PUBLIC_API_URL: API,
    }),
  );
  server = await step('serve web', serveWeb);
  const b = await step('launch browser', () =>
    chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined }),
  );
  browser = b;
  const written: string[] = [];
  for (const colorScheme of ['light', 'dark'] as const) {
    for (const shot of SHOTS) {
      const file = join(OUT, `${colorScheme}-${shot.name}.png`);
      await step(`${colorScheme}-${shot.name}`, async () => {
        // A fresh context per shot = a fresh install (no stored preferences unless the shot has some).
        const context = await b.newContext({
          viewport: { width: 412, height: 915 },
          deviceScaleFactor: 2,
          colorScheme,
          timezoneId: 'Europe/Riga',
          locale: 'en-GB',
        });
        try {
          if (shot.prefs) {
            const state = { ...DEFAULT_PREFS, ...shot.prefs };
            await context.addInitScript(
              (value) => localStorage.setItem('prefs', value),
              JSON.stringify({ state, version: 1 }),
            );
          }
          const page = await context.newPage();
          await shot.take(page);
          // Finishes CSS transitions (a switch just toggled would be caught mid-slide).
          await page.screenshot({ path: file, animations: 'disabled' });
          await shot.after?.(page);
        } finally {
          await context.close();
        }
      });
      written.push(file);
    }
  }
  console.log(`wrote ${written.length} screenshots:\n${written.join('\n')}`);
}

process.once('SIGINT', () => {
  void cleanup().finally(() => process.exit(130));
});

// No top-level await: apps/mobile isn't "type": "module", so tsx runs this as CommonJS.
void main()
  .catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exitCode = 1;
  })
  .finally(cleanup);

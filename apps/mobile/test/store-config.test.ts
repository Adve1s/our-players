/// <reference types="node" />
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PRIVACY_URL } from '../src/lib/links';

function read(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

function readJson<T>(path: string): T {
  return JSON.parse(read(path)) as T;
}

type AppJson = { expo: { name: string; owner?: string; android: { package: string } } };
type EasJson = {
  cli: { appVersionSource?: string };
  build: Record<
    string,
    {
      autoIncrement?: boolean;
      android?: { buildType?: string };
      env?: Record<string, string>;
    }
  >;
};

describe('app identity', () => {
  it('uses the permanent package under the personal Expo account', () => {
    const app = readJson<AppJson>('../app.json');
    expect(app.expo.android.package).toBe('dev.adveis.ourplayers');
    expect(app.expo.owner).toBe('adveis');
    expect(app.expo.name).toBe('Our Players');
  });
});

describe('eas.json', () => {
  // Read per test, not per describe: a missing file then fails these tests and leaves the others running.
  const eas = () => readJson<EasJson>('../eas.json');

  it.each(['preview', 'production'])('%s points at the production API', (profile) => {
    expect(eas().build[profile]?.env?.EXPO_PUBLIC_API_URL).toBe(
      'https://api.ourplayers.adveis.dev',
    );
  });

  it('keeps version codes on EAS and raises them on every production build', () => {
    const { cli, build } = eas();
    expect(cli.appVersionSource).toBe('remote');
    expect(build.production?.autoIncrement).toBe(true);
    expect(build.production?.android?.buildType).toBe('app-bundle');
  });

  it('has the three profiles', () => {
    expect(Object.keys(eas().build)).toEqual(
      expect.arrayContaining(['development', 'preview', 'production']),
    );
  });
});

describe('privacy page', () => {
  const html = read('../public/privacy.html');
  it('is the file Cloudflare serves at the link in the app', () => {
    // A missing file answers 200 with the app, so nothing else would catch this.
    expect(new URL(PRIVACY_URL).origin).toBe('https://ourplayers.adveis.dev');
    expect(
      existsSync(new URL(`../public${new URL(PRIVACY_URL).pathname}.html`, import.meta.url)),
    ).toBe(true);
  });
  it.each(['Privacy policy', 'Our Players', 'Adveis', 'ourplayers@adveis.dev'])(
    'names %s',
    (text) => {
      expect(html).toContain(text);
    },
  );
  it('states the retention and deletion policy and who holds data', () => {
    expect(html).toMatch(/Deletion/);
    expect(html).toContain('Linode');
    expect(html).toContain('Cloudflare');
  });
  it('runs under the web CSP: no scripts, nothing external', () => {
    expect(html).not.toMatch(/<script|<link|src=/i);
  });
  it('says preferences and search text never reach a log or database', () => {
    expect(html.replace(/\s+/g, ' ')).toContain('never written to a log or database');
  });
  it.each([
    'request>remote_ip delete',
    'request>client_ip delete',
    'request>headers>X-Forwarded-For delete',
  ])('backs "no IP in a log" with the proxy log filter: %s', (rule) => {
    expect(read('../../../deploy/Caddyfile')).toContain(rule);
  });
  it('claims only what the host is configured to do', () => {
    const compose = read('../../../deploy/compose.yaml');
    expect(compose).toContain('max-size: 10m');
    expect(compose).toContain('max-file: "5"');
    expect(html).toContain('50 MB');
    // The log is declared as Analytics on the Data safety form, so the page can't say "no analytics" outright.
    expect(html).toContain('no analytics or tracking services');
  });
});

describe('listing graphics', () => {
  const png = (file: string) => {
    const b = readFileSync(new URL(`../../../docs/store/graphics/${file}`, import.meta.url));
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), type: b[25], bytes: b.length };
  };
  it('has a 512 px 32-bit icon', () => {
    expect(png('icon-512.png')).toMatchObject({ w: 512, h: 512, type: 6 });
    expect(png('icon-512.png').bytes).toBeLessThanOrEqual(1024 * 1024);
  });
  it('has a 1024x500 feature graphic without alpha', () => {
    expect(png('feature-graphic.png')).toMatchObject({ w: 1024, h: 500, type: 2 });
  });
  it('has 4 to 8 screenshots Google accepts and can recommend', () => {
    const files = readdirSync(
      new URL('../../../docs/store/graphics/screenshots/', import.meta.url),
    );
    expect(files.length).toBeGreaterThanOrEqual(4);
    expect(files.length).toBeLessThanOrEqual(8);
    for (const f of files) {
      const { w, h, type } = png(`screenshots/${f}`);
      expect(type).toBe(2);
      expect(Math.min(w, h)).toBeGreaterThanOrEqual(1080);
      expect(Math.max(w, h)).toBeLessThanOrEqual(2 * Math.min(w, h));
      expect(Math.max(w, h)).toBeLessThanOrEqual(3840);
    }
  });
});

describe('store documents', () => {
  const section = (md: string, title: string) =>
    md.split(`## ${title}\n`)[1]?.split(/^## /m)[0]?.trim() ?? '';
  const listing = read('../../../docs/store/listing.md');
  it.each([
    ['App name', 30],
    ['Short description', 80],
    ['Full description', 4000],
  ])('%s fits within %i characters', (title, max) => {
    const text = section(listing, title as string);
    expect(text.length).toBeGreaterThan(0);
    expect(text.length).toBeLessThanOrEqual(max as number);
  });
  it('the full description carries the non-affiliation note', () => {
    expect(section(listing, 'Full description')).toMatch(
      /isn't affiliated with or endorsed by the NHL, the NBA/,
    );
  });
  it('declares what the server log actually keeps', () => {
    const ds = read('../../../docs/store/data-safety.md');
    for (const type of [
      'In-app search history',
      'Other actions',
      'App interactions',
      'Diagnostics',
    ]) {
      expect(ds).toContain(type);
    }
  });
  it('holds no email address but the public support one', () => {
    for (const f of readdirSync(new URL('../../../docs/store/', import.meta.url))) {
      if (!f.endsWith('.md')) continue;
      // The domain starts with a letter so a pinned package (a CLI name @ its version) isn't read as an address.
      const found =
        read(`../../../docs/store/${f}`).match(/[\w.+-]+@[a-z][\w-]*(\.[\w-]+)*\.[a-z]{2,}\b/gi) ??
        [];
      expect(found.filter((e) => e !== 'ourplayers@adveis.dev')).toEqual([]);
    }
  });
});

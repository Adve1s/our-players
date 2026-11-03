/// <reference types="node" />
import { existsSync, readFileSync } from 'node:fs';
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
  it('claims only what the host is configured to do', () => {
    const compose = read('../../../deploy/compose.yaml');
    expect(compose).toContain('max-size: 10m');
    expect(compose).toContain('max-file: "5"');
    expect(html).toContain('50 MB');
    // The log is declared as Analytics on the Data safety form, so the page can't say "no analytics" outright.
    expect(html).toContain('no analytics or tracking services');
  });
});

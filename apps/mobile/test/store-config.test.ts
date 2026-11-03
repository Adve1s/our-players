/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

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

/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The web build always gets zero insets from expo-router, so no browser check can see this; the
// real proof is scrolling on a phone. This only pins where the padding sits in the source.
describe('tab screens', () => {
  it.each(['index', 'search', 'settings'])(
    '%s keeps the status bar inset outside its scrolling part',
    (screen) => {
      const source = readFileSync(
        new URL(`../src/app/(tabs)/${screen}.tsx`, import.meta.url),
        'utf8',
      );
      expect(source.indexOf('paddingTop: insets.top')).toBeGreaterThan(-1);
      expect(source.indexOf('paddingTop: insets.top')).toBeLessThan(source.indexOf('<ScrollView'));
    },
  );
});

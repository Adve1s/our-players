/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { type ColorRole, type Colors, dark, layout, light } from '../src/tokens';

// WCAG 2.x relative luminance of a #RRGGBB color.
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const pairs: [ColorRole, ColorRole][] = [
  ['text', 'background'],
  ['textMuted', 'background'],
  ['accent', 'background'],
  ['danger', 'background'],
  ['text', 'surface'],
  ['textMuted', 'surface'],
  ['accent', 'surface'],
  ['danger', 'surface'],
  ['onPlate', 'plate'],
  ['onPlateMuted', 'plate'],
  ['onAccent', 'accentFill'],
  ['onInverse', 'inverse'],
  ['accent', 'accentWash'],
  ['text', 'accentWash'],
];

const schemes: [string, Colors][] = [
  ['light', light],
  ['dark', dark],
];

const cases = schemes.flatMap(([scheme, colors]) =>
  pairs.map(([fg, bg]) => [scheme, fg, bg, colors[fg], colors[bg]] as const),
);

describe('color tokens', () => {
  it('contrast of black on white is 21', () => {
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
  });

  it.each(cases)('%s: %s on %s reaches 4.5:1', (_scheme, _fg, _bg, fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  // A control, not text: WCAG 1.4.11 asks 3:1.
  it.each(schemes)('%s: the on-state switch thumb stands out on its track', (_scheme, colors) => {
    expect(contrast(colors.thumb, colors.accentFill)).toBeGreaterThanOrEqual(3);
  });
});

describe('tab bar geometry', () => {
  // The tab bar's height copies these two private values; an upgrade that changes them clips the label.
  const views = '../../../node_modules/expo-router/build/react-navigation/bottom-tabs/views/';
  const source = (file: string) => readFileSync(new URL(views + file, import.meta.url), 'utf8');

  it('matches the item padding of the installed expo-router', () => {
    expect(source('BottomTabItem.js')).toMatch(
      new RegExp(`tabVerticalUiKit: \\{[^}]*padding: ${layout.tabItemPadding}\\b`),
    );
  });

  it('matches the icon slot of the installed expo-router', () => {
    expect(source('TabBarIcon.js')).toContain(`ICON_SIZE_TALL = ${layout.tabIconSlot};`);
  });
});

// TS 6 loads no @types by default, and this Node script needs them.
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

// One source of art (assets/icon.svg) for every PNG the app and the web export ship.
// The PNGs are committed: rerun this only when the SVG changes.
const source = readFileSync(resolve('assets/icon.svg'), 'utf8');
if (source.split('<g id="mark"').length !== 2 || source.split('<rect id="field"').length !== 2)
  throw new Error('assets/icon.svg needs exactly one <g id="mark"> and one <rect id="field">');
const FIELD = /<rect id="field"[^>]*\/>/;
// shortcut: MARK stops at the first </g>, so the mark can't contain nested <g>; switch to a DOM parse if it ever needs groups
const MARK = /<g id="mark"[\s\S]*?<\/g>/;
// The mark is sized for Android's adaptive safe zone (66 of 108 dp), which also fits the
// W3C maskable safe radius (40%). Plain squares have no mask, so they zoom it to fill the
// tile, the favicon most so it reads in a 16 px tab.
const scaled = (s: number) =>
  source.replace(
    '<g id="mark"',
    `<g id="mark" transform="translate(512 512) scale(${s}) translate(-512 -512)"`,
  );
const markOnly = source.replace(FIELD, '');
// The launcher tints a monochrome icon itself; only the alpha counts.
const monochrome = markOnly.replace(/#(FFB547|F5F5F4)/g, '#FFFFFF');
const fieldOnly = source.replace(MARK, '');

const b64 = (svg: string) => Buffer.from(svg).toString('base64');
const tile = b64(scaled(1.4));

const SIZES: [string, number, string][] = [
  ['public/icon-192.png', 192, tile],
  ['public/icon-512.png', 512, tile],
  ['public/icon-maskable-512.png', 512, b64(source)],
  ['public/apple-touch-icon.png', 180, tile],
  ['assets/images/favicon.png', 48, b64(scaled(1.7))],
  ['assets/images/icon.png', 1024, tile],
  ['assets/images/android-icon-foreground.png', 1024, b64(markOnly)],
  ['assets/images/android-icon-background.png', 1024, b64(fieldOnly)],
  ['assets/images/android-icon-monochrome.png', 1024, b64(monochrome)],
  ['assets/images/splash-icon.png', 1024, b64(markOnly)],
];

async function main(): Promise<void> {
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
  });
  try {
    const page = await browser.newPage();
    for (const [file, size, svg] of SIZES) {
      await page.setViewportSize({ width: size, height: size });
      await page.setContent(
        `<style>body{margin:0}img{display:block}</style><img src="data:image/svg+xml;base64,${svg}" width="${size}" height="${size}">`,
        { waitUntil: 'load' },
      );
      const path = resolve(file);
      // Transparent where the SVG paints nothing: the foreground, monochrome and splash layers.
      await page.screenshot({ path, omitBackground: true });
      // A PNG's IHDR holds width and height at bytes 16-23, big-endian.
      const png = readFileSync(path);
      const w = png.readUInt32BE(16);
      const h = png.readUInt32BE(20);
      if (w !== size || h !== size)
        throw new Error(`${file} is ${w}x${h}, expected ${size}x${size}`);
      console.log(`${file} ${w}x${h}`);
    }
  } finally {
    await browser.close();
  }
}

// No top-level await: tsx runs this package's scripts as CommonJS.
main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});

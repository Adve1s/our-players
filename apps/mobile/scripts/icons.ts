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
const MARK = /<g id="mark"[\s\S]*?<\/g>/;
// Android launchers crop a maskable icon to its middle 2/3 (72 of 108 dp) and zoom in,
// so the maskable copy shrinks the mark further (0.72: owner checked it on a phone).
const maskable = source.replace(
  '<g id="mark"',
  '<g id="mark" transform="translate(512 512) scale(0.72) translate(-512 -512)"',
);
const markOnly = source.replace(FIELD, '');
// The launcher tints a monochrome icon itself; only the alpha counts.
const monochrome = markOnly.replace(/#(FFB547|F5F5F4)/g, '#FFFFFF');
const fieldOnly = source.replace(MARK, '');

const b64 = (svg: string) => Buffer.from(svg).toString('base64');
const plain = b64(source);

const SIZES: [string, number, string][] = [
  ['public/icon-192.png', 192, plain],
  ['public/icon-512.png', 512, plain],
  ['public/icon-maskable-512.png', 512, b64(maskable)],
  ['public/apple-touch-icon.png', 180, plain],
  ['assets/images/favicon.png', 48, plain],
  ['assets/images/icon.png', 1024, plain],
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

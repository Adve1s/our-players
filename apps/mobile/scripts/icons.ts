// TS 6 loads no @types by default, and this Node script needs them.
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

// One source of art (assets/icon.svg) for every PNG the app and the web export ship.
// The PNGs are committed: rerun this only when the SVG changes.
const source = readFileSync(resolve('assets/icon.svg'), 'utf8');
if (source.split('<text ').length !== 2)
  throw new Error('assets/icon.svg needs exactly one <text>');
// Android launchers crop a maskable icon to its middle 2/3 (72 of 108 dp) and zoom in,
// so the maskable copy shrinks the letters to about that (0.72: owner checked it on a phone).
const maskable = source.replace(
  '<text ',
  '<text transform="translate(512 512) scale(0.72) translate(-512 -512)" ',
);
const plain = Buffer.from(source).toString('base64');
const masked = Buffer.from(maskable).toString('base64');

const SIZES: [string, number, string][] = [
  ['public/icon-192.png', 192, plain],
  ['public/icon-512.png', 512, plain],
  ['public/icon-maskable-512.png', 512, masked],
  ['public/apple-touch-icon.png', 180, plain],
  ['assets/images/favicon.png', 48, plain],
  ['assets/images/icon.png', 1024, plain],
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
      await page.screenshot({ path });
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

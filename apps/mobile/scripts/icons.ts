// TS 6 loads no @types by default, and this Node script needs them.
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

// One source of art (assets/icon.svg) for every PNG the app and the web export ship.
// The PNGs are committed: rerun this only when the SVG changes.
const SIZES: [string, number][] = [
  ['public/icon-192.png', 192],
  ['public/icon-512.png', 512],
  ['public/apple-touch-icon.png', 180],
  ['assets/images/favicon.png', 48],
  ['assets/images/icon.png', 1024],
];

const svg = readFileSync(resolve('assets/icon.svg')).toString('base64');

async function main(): Promise<void> {
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
  });
  try {
    const page = await browser.newPage();
    for (const [file, size] of SIZES) {
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

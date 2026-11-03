// TS 6 loads no @types by default, and this Node script needs them.
/// <reference types="node" />
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

// The Play listing's icon and feature graphic. Committed: rerun only when the art or the tagline changes.
const OUT = resolve('../../docs/store/graphics');

// Play can crop a feature graphic's edges, so everything stays inside the central 80%.
const WIDTH = 1024;
const HEIGHT = 500;
const SAFE = { left: WIDTH * 0.1, right: WIDTH * 0.9, top: HEIGHT * 0.1, bottom: HEIGHT * 0.9 };

const font = (weight: number, file: string) => {
  const ttf = readFileSync(require.resolve(`@expo-google-fonts/instrument-sans/${file}`));
  return `@font-face{font-family:Instrument Sans;font-weight:${weight};src:url(data:font/ttf;base64,${ttf.toString('base64')})}`;
};

// The mark's own box (see the coordinates in the SVG), so it sits on the layout without the icon's padding.
const mark = readFileSync(resolve('assets/icon.svg'), 'utf8')
  .replace(/<rect id="field"[^>]*\/>/, '')
  .replace('viewBox="0 0 1024 1024"', 'viewBox="290 333 444 358" width="200" height="161"');

const FEATURE = `<!doctype html><style>
${font(700, '700Bold/InstrumentSans_700Bold.ttf')}
${font(500, '500Medium/InstrumentSans_500Medium.ttf')}
body{margin:0;width:${WIDTH}px;height:${HEIGHT}px;background:#1D2024;color:#F5F5F4;font-family:Instrument Sans;display:flex;align-items:center;justify-content:center;gap:44px}
h1{margin:0;font-size:88px;font-weight:700;line-height:1.1;letter-spacing:-1px}
p{margin:8px 0 0;font-size:29px;font-weight:500;line-height:1.3}
</style>${mark}<div id="text"><h1>Our Players</h1><p>Your countries' players, every morning</p></div>`;

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  // PNG32 forces the alpha channel Play's console page asks for; the field stays opaque.
  execFileSync('magick', ['public/icon-512.png', `PNG32:${resolve(OUT, 'icon-512.png')}`]);
  console.log(resolve(OUT, 'icon-512.png'));

  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
  });
  try {
    const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
    await page.setContent(FEATURE, { waitUntil: 'load' });
    // A font that fails falls back silently, so check it before the text is measured or shot.
    const fontsOk = await page.evaluate(async () => {
      await document.fonts.ready;
      return (
        document.fonts.check('700 88px "Instrument Sans"') &&
        document.fonts.check('500 29px "Instrument Sans"') &&
        [...document.fonts].every((f) => f.status === 'loaded')
      );
    });
    if (!fontsOk) throw new Error('Instrument Sans did not load');
    const boxes = await page.evaluate(() =>
      ['svg', 'h1', 'p'].map((sel) => {
        const r = document.querySelector(sel)?.getBoundingClientRect();
        return r && { sel, left: r.left, right: r.right, top: r.top, bottom: r.bottom };
      }),
    );
    for (const box of boxes) {
      if (
        !box ||
        box.left < SAFE.left ||
        box.right > SAFE.right ||
        box.top < SAFE.top ||
        box.bottom > SAFE.bottom
      )
        throw new Error(`outside the central 80%: ${JSON.stringify(box)}`);
    }
    console.log(JSON.stringify(boxes));
    await page.screenshot({ path: resolve(OUT, 'feature-graphic.png') });
    console.log(resolve(OUT, 'feature-graphic.png'));
  } finally {
    await browser.close();
  }
}

// No top-level await: tsx runs this package's scripts as CommonJS.
main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});

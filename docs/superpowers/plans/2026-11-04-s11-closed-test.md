# S11 — Google Play closed test Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Everything in the repo that Google's internal and closed tracks need: the permanent app identity, EAS build profiles, the privacy page and in-app link, listing graphics and the store documents.

**Architecture:** Config and documents, plus one Settings link and one graphics script. `apps/mobile/test/store-config.test.ts` pins what would otherwise fail silently or only at Google: a wrong API URL, a privacy file the SPA fallback hides, a graphic Google refuses, a listing over its limits, a tester's email in the public repo. No server code changes.

**Tech Stack:** Expo SDK 58, EAS CLI 27.2.0 (via `pnpm dlx`, not a dependency), React Native `Linking`, Playwright, ImageMagick (once, on the owner's laptop), Vitest.

**Spec:** `docs/superpowers/specs/2026-11-04-s11-closed-test.md`. Read it first: §6 has the page's content, §8 the store documents' answers, §10 the walkthrough `release.md` is built from.

## Global Constraints

Acceptance criteria (`docs/SESSIONS.md` §S11, as it stood; Task 1 updates criterion 2's package to `dev.adveis.ourplayers`, the owner's decision):
1. A production AAB builds (you run the EAS build; Claude fixes config issues).
2. The uploaded AAB's package is `io.github.adve1s.ourplayers` — permanent from this upload on.
3. Installed from internal testing on your phone, it loads Today from the production API without crashing (run by you).
4. Signing credentials backed up (you confirm); `docs/store/release.md` written.
5. `docs/store/` complete, listing graphics ready; the privacy page is in the PR and the app links to its URL.
6. Security re-run (sections 2, 3 and 4), including the built-app check on the uploaded AAB; results in PROGRESS.md (run with you).
7. In-app About shows the non-affiliation note and the privacy link; no logos or player photos anywhere.
8. `pnpm verify` green.

Out of scope: New features beyond the privacy link; recruiting testers, the 14-day requirement and production access (see "Between S11 and S15" and S15).

Owner steps (EAS login and builds, console, phone, host, credential backup) are not in this plan: Claude walks the owner through them after the final review (spec §10). Criteria 1–4 and 6 finish there.

Exact values:
- Package `dev.adveis.ourplayers`; Expo owner `adveis`; production API `https://api.ourplayers.adveis.dev`; privacy URL `https://ourplayers.adveis.dev/privacy`; support email `ourplayers@adveis.dev`; developer "Adveis, an individual developer based in Latvia". Never a legal name, a tester's name or the forwarding Gmail address in the repo.
- No new dependency in any `package.json`. EAS CLI is `pnpm dlx eas-cli@27.2.0`, run from `apps/mobile`.
- `Adve1s` stays in GitHub URLs and the server's User-Agent contact: don't touch `apps/server`.
- Green before each commit: `pnpm typecheck && pnpm lint && pnpm test --maxWorkers=2` (the laptop swaps under plain `pnpm verify`). Small Conventional Commits. End commit messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Mobile rules: theme tokens only in `src/`, `accessibilityLabel` on touchables, no hex or font sizes outside `tokens.ts`.

## Review Focus

1. **The privacy file is misnamed or dropped from the export:** Cloudflare then answers 200 with the app, so the link looks fine and Google sees no policy. Task 2 pins the file name against the URL and checks `dist/privacy.html`.
2. **The policy and the Data safety form disagree, or drift from the host's config** (the "50 MB" cap, "no analytics"): Task 2 pins the page's log claims against `deploy/compose.yaml`; Task 4 pins the form's declared types.
3. **A store graphic Google refuses** (alpha where none is allowed, wrong size, 2.01:1 screenshots): Task 3 reads every committed file's PNG header.
4. **Private data reaches the public repo through a store document:** Task 4 fails on any email address in `docs/store/` other than the support address.
5. **The API URL is missing from a build profile:** `apiBaseUrl` silently falls back to localhost and the release build can't load anything. Task 1 pins it for `preview` and `production`.

---

### Task 1: App identity and EAS profiles

**Files:**
- Create: `apps/mobile/eas.json`, `apps/mobile/test/store-config.test.ts`
- Modify: `apps/mobile/app.json`, `.gitignore`, `docs/VISION.md` (§11), `docs/SESSIONS.md` (§S11), `docs/SECURITY-CHECKS.md` (§4.4), `docs/DECISIONS.md`

**Interfaces:**
- Produces: `store-config.test.ts` with a `readJson(path)` helper reading relative to the test file (`new URL(path, import.meta.url)`), extended by Tasks 2–4.

- [ ] **Step 1: Write the failing test** in `store-config.test.ts`, shaped like `test/web-headers.test.ts` (`/// <reference types="node" />`, `readFileSync`).

```ts
describe('app identity', () => {
  it('uses the permanent package under the personal Expo account', () => {
    expect(app.expo.android.package).toBe('dev.adveis.ourplayers');
    expect(app.expo.owner).toBe('adveis');
    expect(app.expo.name).toBe('Our Players');
  });
});
describe('eas.json', () => {
  it.each(['preview', 'production'])('%s points at the production API', (profile) => {
    expect(eas.build[profile].env.EXPO_PUBLIC_API_URL).toBe('https://api.ourplayers.adveis.dev');
  });
  it('keeps version codes on EAS and raises them on every production build', () => {
    expect(eas.cli.appVersionSource).toBe('remote');
    expect(eas.build.production.autoIncrement).toBe(true);
    expect(eas.build.production.android.buildType).toBe('app-bundle');
  });
  it('has the three profiles', () => {
    expect(Object.keys(eas.build)).toEqual(expect.arrayContaining(['development', 'preview', 'production']));
  });
});
```

- [ ] **Step 2: Run it.** `pnpm test store-config`. Expected: FAIL (no `eas.json`; package is `io.github.adve1s.ourplayers`).

- [ ] **Step 3: Write `apps/mobile/eas.json`** exactly as spec §3, and change `app.json`: `android.package`, top-level `owner`. Add `*.jks`, `*.keystore` and `credentials.json` to `.gitignore` under "Environment and secrets".

- [ ] **Step 4: Check `eas.json` against the CLI's schema.** Download the package into a new, empty scratchpad directory (`npm pack @expo/eas-json` at the version `eas-cli@27.2.0` depends on) and read its Joi schema without running anything from it. Confirm `corepack`, `node` and `extends` are valid build-profile keys. If `corepack` isn't, use `"pnpm": "12.14.0"` in `base` instead. Record the result as a `Ruling:`. Don't log in or start a build.

- [ ] **Step 5: Run the test.** `pnpm test store-config`. Expected: PASS.

- [ ] **Step 6: Update the docs for the package.**
  - `docs/VISION.md` §11, App identity: package `dev.adveis.ourplayers`, "the reverse of the web app's host `ourplayers.adveis.dev`, on the domain the owner owns"; keep "permanent once the first build is uploaded".
  - `docs/VISION.md` §11, Play listing prep: replace "(GitHub Pages works for a public repo)" with the URL `https://ourplayers.adveis.dev/privacy`; replace "no accounts, ads or analytics" with "no accounts or ads, no analytics or tracking services, only a server request log with no IP addresses or query strings".
  - `docs/SESSIONS.md` §S11: the package in "In scope" and criterion 2.
  - `docs/SECURITY-CHECKS.md` §4.4: `io.github.adve1s.ourplayers.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` → `dev.adveis.ourplayers.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`. Add that no `com.google.android.gms.permission.AD_ID` may appear (the Advertising ID form answers No), that the same `bundletool dump manifest` output shows `android:targetSdkVersion` 36 and `package="dev.adveis.ourplayers"`, and how to run it with no Java installed: `mise x java@temurin-21 -- java -jar bundletool.jar dump manifest --bundle=<path-to.aab>`.
  - `docs/DECISIONS.md`: append after D-069 in the file's format: `**D-070 — Android package dev.adveis.ourplayers** (2026-11-03, accepted; owner; amends D-017)` with why (owner's domain, exact reverse of the web host, scales to `dev.adveis.<app>`, a lapsed domain wouldn't affect the app) and the alternative (`io.github.adve1s.ourplayers`, the spelling the owner doesn't want on the product).

- [ ] **Step 7: Verify and commit.** `pnpm typecheck && pnpm lint && pnpm test --maxWorkers=2`, then:

```bash
git add apps/mobile/eas.json apps/mobile/app.json apps/mobile/test/store-config.test.ts .gitignore docs/VISION.md docs/SESSIONS.md docs/SECURITY-CHECKS.md docs/DECISIONS.md docs/superpowers/specs/2026-11-04-s11-closed-test.md docs/superpowers/plans/2026-11-04-s11-closed-test.md
git commit -m "feat: set the permanent app identity and EAS build profiles"
```

### Task 2: Privacy page and the in-app link

**Files:**
- Create: `apps/mobile/public/privacy.html`, `apps/mobile/src/lib/links.ts`
- Modify: `apps/mobile/src/app/(tabs)/settings.tsx` (the About section, ~line 292), `apps/mobile/scripts/screenshots.ts` (`settings-about`), `apps/mobile/test/store-config.test.ts`, `docs/SECURITY-CHECKS.md` (§4.2), `docs/DEPLOY.md` (§10)

**Interfaces:**
- Produces: `export const PRIVACY_URL = 'https://ourplayers.adveis.dev/privacy'` from `src/lib/links.ts`.

- [ ] **Step 1: Write the failing tests** in `store-config.test.ts`:

```ts
describe('privacy page', () => {
  const html = read('../public/privacy.html');
  it('is the file Cloudflare serves at the link in the app', () => {
    // A missing file answers 200 with the app, so nothing else would catch this.
    expect(new URL(PRIVACY_URL).origin).toBe('https://ourplayers.adveis.dev');
    expect(existsSync(new URL(`../public${new URL(PRIVACY_URL).pathname}.html`, import.meta.url))).toBe(true);
  });
  it.each(['Privacy policy', 'Our Players', 'Adveis', 'ourplayers@adveis.dev'])('names %s', (text) => {
    expect(html).toContain(text);
  });
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
```

- [ ] **Step 2: Run it.** `pnpm test store-config`. Expected: FAIL on the missing file and module.

- [ ] **Step 3: Write `public/privacy.html`** from spec §6's bullets, in that order, each as a short section. `<title>Privacy policy — Our Players</title>`, a date line "Last updated: 4 November 2026", `lang="en"`, viewport meta, one inline `<style>` with `color-scheme: light dark` and a readable column. Word it for a reader who isn't technical. A `mailto:` for the email is fine.

- [ ] **Step 4: Add `src/lib/links.ts` and the link.** In Settings' About, after the two notes and before the web-only Install link: a `Pressable` with `accessibilityRole="link"`, `accessibilityLabel="Privacy policy"`, `onPress={() => void Linking.openURL(PRIVACY_URL)}`, the same style and text as "Add to Home Screen", on every platform. `Linking` comes from `react-native`, which is already imported in the file.

- [ ] **Step 5: Assert it in the screenshot flow.** In `settings-about`'s `take`, also `await page.getByRole('link', { name: 'Privacy policy' }).waitFor();`.

- [ ] **Step 6: Run tests, then the build and screenshots.**
  - `pnpm test store-config`: PASS.
  - `EXPO_PUBLIC_API_URL=https://api.ourplayers.adveis.dev pnpm build:web && test -f apps/mobile/dist/privacy.html && echo copied`: prints `copied`.
  - `PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium pnpm screenshots`: all shots pass; look at `apps/mobile/.screenshots/{light,dark}-settings-about.png` (link in place, tokens' accent). Open `dist/privacy.html` in Chromium in both schemes (a Playwright one-off in the scratchpad is fine) and look at it.

- [ ] **Step 7: Update `docs/SECURITY-CHECKS.md` §4.2:** the bundle grep's expected output becomes `https://api.ourplayers.adveis.dev` and `https://ourplayers.adveis.dev` (the privacy link). **`docs/DEPLOY.md` §10:** one sentence: the privacy policy is `apps/mobile/public/privacy.html`, served at `/privacy` and deployed with the site; check it by its text, because a missing file answers 200 with the app: `curl -sS https://ourplayers.adveis.dev/privacy | grep -c 'Privacy policy'`.

- [ ] **Step 8: Verify and commit.** `pnpm typecheck && pnpm lint && pnpm test --maxWorkers=2`, then commit `feat: add the privacy policy page and link it from About`.

### Task 3: Listing graphics

**Files:**
- Create: `apps/mobile/scripts/store-graphics.ts`, `docs/store/graphics/icon-512.png`, `docs/store/graphics/feature-graphic.png`, `docs/store/graphics/screenshots/0{1..5}-*.png`
- Modify: `apps/mobile/scripts/screenshots.ts`, `apps/mobile/package.json` (script `"store-graphics": "tsx scripts/store-graphics.ts"`), `apps/mobile/test/store-config.test.ts`, `CLAUDE.md` (Commands)

**Interfaces:**
- Consumes: `SHOTS`, the context setup and `step` in `screenshots.ts`; `assets/icon.svg`.
- Produces: the committed files, named in Step 1.

- [ ] **Step 1: Write the failing test** in `store-config.test.ts`. A PNG's IHDR holds width and height at bytes 16–23 (big-endian) and the colour type at byte 25: 2 is RGB, 6 is RGBA.

```ts
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
    const files = readdirSync(new URL('../../../docs/store/graphics/screenshots/', import.meta.url));
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
```

- [ ] **Step 2: Run it.** `pnpm test store-config`. Expected: FAIL (no files).

- [ ] **Step 3: Add `--store` to `screenshots.ts`.** `process.argv.includes('--store')` runs only `['night-mixed', 'game-hockey', 'player-skater', 'search-results', 'settings']` from `SHOTS`, in that order, in `dark`, at viewport 360×720 with `deviceScaleFactor: 3`, writing `resolve('../../docs/store/graphics/screenshots', 'NN-<name>.png')` (`01-night-mixed.png`…), and skips `after`. Without the flag it behaves as today. Share the context setup rather than copying it: pull the per-shot body into a function taking `{ colorScheme, viewport, deviceScaleFactor, file, runAfter }`.

- [ ] **Step 4: Write `store-graphics.ts`,** in `icons.ts`'s style (Playwright, `PLAYWRIGHT_CHROMIUM_PATH`, CommonJS `main()`):
  - **Icon:** `execFileSync('magick', ['public/icon-512.png', 'PNG32:../../docs/store/graphics/icon-512.png'])`. `PNG32:` forces the alpha channel; the field stays opaque.
  - **Feature graphic:** a 1024×500 opaque page on the `#1D2024` field: the `<g id="mark">` from `assets/icon.svg` inlined at left, "Our Players" (`InstrumentSans_700Bold.ttf`, base64 `@font-face`) with the tagline "Your countries' players, every morning" (`InstrumentSans_500Medium.ttf`) at right. Keep the text within the central 80%, because Play can crop edges. No league names, logos or photos. Use `#F5F5F4` for text. Write `docs/store/graphics/feature-graphic.png`.
  - Don't use `omitBackground`. If Chromium writes colour type 6 for either file (the test tells you), add `magick … PNG24:…` for it, as for the icon.

- [ ] **Step 5: Generate.** From the repo root:

```bash
PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium pnpm --filter @our-players/mobile store-graphics
PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium pnpm screenshots --store
```

Expected: 2 + 5 files written. **Look at every image.** The Today shot should fill the phone height with cards; if a shot is mostly empty or cut oddly, change only its scroll position under `--store`, or pick another `SHOTS` name, and say so.

- [ ] **Step 6: Run the test.** `pnpm test store-config`. Expected: PASS.

- [ ] **Step 7: `CLAUDE.md` Commands:** extend the `pnpm screenshots` line: "`--store` writes the Play listing's phone screenshots to `docs/store/graphics/screenshots/`; `pnpm --filter @our-players/mobile store-graphics` writes its icon and feature graphic".

- [ ] **Step 8: Verify and commit.** `pnpm typecheck && pnpm lint && pnpm test --maxWorkers=2`, then commit `feat: generate the Play listing graphics`.

### Task 4: Store documents

**Files:**
- Create: `docs/store/listing.md`, `docs/store/data-safety.md`, `docs/store/app-content.md`, `docs/store/testers.md`, `docs/store/release.md`
- Modify: `docs/store/play-requirements.md`, `docs/PROGRESS.md` (parking lot only), `docs/DECISIONS.md`, `CLAUDE.md` (repo map), `apps/mobile/test/store-config.test.ts`

**Interfaces:**
- Consumes: the graphics paths from Task 3, `PRIVACY_URL` from Task 2.

- [ ] **Step 1: Write the failing tests** in `store-config.test.ts`. `listing.md` uses these exact headings, each section holding only the text to paste: `## App name`, `## Short description`, `## Full description`, then the rest.

```ts
describe('store documents', () => {
  const section = (md: string, title: string) =>
    md.split(`## ${title}\n`)[1]?.split(/^## /m)[0]?.trim() ?? '';
  const listing = read('../../../docs/store/listing.md');
  it.each([['App name', 30], ['Short description', 80], ['Full description', 4000]])(
    '%s fits within %i characters',
    (title, max) => {
      const text = section(listing, title as string);
      expect(text.length).toBeGreaterThan(0);
      expect(text.length).toBeLessThanOrEqual(max as number);
    },
  );
  it('the full description carries the non-affiliation note', () => {
    expect(section(listing, 'Full description')).toMatch(/isn't affiliated with or endorsed by the NHL, the NBA/);
  });
  it('declares what the server log actually keeps', () => {
    const ds = read('../../../docs/store/data-safety.md');
    for (const type of ['In-app search history', 'Other actions', 'App interactions', 'Other app performance data']) {
      expect(ds).toContain(type);
    }
  });
  it('holds no email address but the public support one', () => {
    for (const f of readdirSync(new URL('../../../docs/store/', import.meta.url))) {
      if (!f.endsWith('.md')) continue;
      const found = read(`../../../docs/store/${f}`).match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) ?? [];
      expect(found.filter((e) => e !== 'ourplayers@adveis.dev')).toEqual([]);
    }
  });
});
```

- [ ] **Step 2: Run it.** `pnpm test store-config`. Expected: FAIL (no `listing.md`).

- [ ] **Step 3: Write `listing.md`** from spec §8: the three sections to paste, then category, tags, contact details, privacy URL and which graphic goes where. Warm, plain English; league names only descriptively; no "best", no ranking claims.

- [ ] **Step 4: Write `data-safety.md`** from spec §8: the three top questions, the four-row table with each evidence path, "Not declared, and why", how the listing will read, and a warning that a new SDK or logged field means re-answering. Say which walkthrough check re-verifies the host (`SECURITY-CHECKS.md` §4.3, "0 and 0").

- [ ] **Step 5: Write `app-content.md`** from spec §8's "Other forms" table, in the console's order, ending with the "stop and ask rather than guess" line. Include the account-level items: check the public developer email (public on every app, so it should be `ourplayers@adveis.dev` or an address the owner accepts as public), declare non-trader (due 1 Feb 2027), verification status on Home.

- [ ] **Step 6: Write `testers.md`:** the invitation message and the keep-opted-in plan from spec §8 and SESSIONS "Between S11 and S15". A `<opt-in link>` placeholder, no names or emails, and a reminder that notes live outside the repo. Light-touch: the owner adds people as they meet them.

- [ ] **Step 7: Write `release.md`,** every command runnable as written:
  - **Ship an update:** bump `version` in `app.json` if users should see it; `cd apps/mobile && pnpm dlx eas-cli@27.2.0 build -p android --profile production` (the version code rises by itself); download the AAB; `SECURITY-CHECKS.md` §4.4; console → the track → Create new release → upload → notes → roll out.
  - **First time on EAS:** login, `init`, the keystore prompt.
  - **Internal track** and **Submit to the closed track:** spec §10's "After the merge", as a checklist pointing at `app-content.md`, `data-safety.md`, `listing.md` and `graphics/`. The privacy check is by text: `curl -sS https://ourplayers.adveis.dev/privacy | grep -c 'Privacy policy'`, then tap the link in the app.
  - **Add a tester:** their Google-account email in the track's list, then send the opt-in link (`testers.md`).
  - **If Google rejects it:** a bug-fix session, new version code, new AAB, resubmit.
  - **Credentials:** spec §9.
  - **Support email:** Cloudflare Email Routing, how to repoint it; describe the forwarding destination without naming the address.
  - **Notes:** `development` needs `expo-dev-client`, not installed (Expo Go is the dev path); `eas submit` was left out on purpose (spec §3) and can be added later; 16 KB page support is enforced for updates from 1 Feb 2027 (check App bundle explorer).

- [ ] **Step 8: Update `play-requirements.md`** with spec §1's corrections, the "read on" date 2026-11-04, and sources for what's new (`answer/10144311`, `answer/13628312`, `answer/10841920`, `answer/9867159`, the icon spec, the page-size guide). Keep its table's right-hand column current: the privacy link now exists.

- [ ] **Step 9: `docs/DECISIONS.md`:** append `**D-071 — Data safety: declare the request log, no deletion badge, target audience 13+, manual uploads** (2026-11-04, accepted; owner)`: the log is declared as App interactions and performance data with purpose Analytics, because Google has no anonymized exemption for collection and defines Analytics to include monitoring app health; "No" on deletion, because nobody could act on a request and rotation is by size; target audience is a declaration not a limit, so younger children can still use the app, and under-13 stays unselected; `eas submit` left out because the service-account key isn't worth a minute per release. **`docs/PROGRESS.md` parking lot, one line:** a 90-day cap on host logs would allow Data safety's deletion badge and a firmer sentence in the policy, at the cost of a host change; reconsider in S15. **`CLAUDE.md` repo map:** add `store/` to the `docs/` line.

- [ ] **Step 10: Verify and commit.** `pnpm test store-config` PASS; `pnpm typecheck && pnpm lint && pnpm test --maxWorkers=2`; then commit `docs: add the Play Store listing, forms, testers and release guide`.

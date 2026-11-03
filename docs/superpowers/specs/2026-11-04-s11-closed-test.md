# S11 — Google Play closed test: design

Session S11 (slice 7), branch `s11-closed-test`. Contract: `docs/SESSIONS.md` §S11; what follows it: "Between S11 and S15"; process: D-069. Brainstormed 2026-11-03/04 with the owner.

## Intent

The finished app becomes ready for Google. Its first native build is checked on the owner's phone through internal testing, the store documents are written, and security is re-checked, all reviewed and merged. After the merge the owner submits to the closed track with Claude's help, then adds testers on their own time with nothing open.

Anti-goals: a Data safety form that claims less than the app does; anything in the public repo that names a tester; a permanent package ID nobody questioned; owner time spent on things a CLI can do.

## Acceptance criteria (verbatim from §S11)

1. A production AAB builds (you run the EAS build; Claude fixes config issues).
2. The uploaded AAB's package is `io.github.adve1s.ourplayers` — permanent from this upload on.
3. Installed from internal testing on your phone, it loads Today from the production API without crashing (run by you).
4. Signing credentials backed up (you confirm); `docs/store/release.md` written.
5. `docs/store/` complete, listing graphics ready; the privacy page is in the PR and the app links to its URL.
6. Security re-run (sections 2, 3 and 4), including the built-app check on the uploaded AAB; results in PROGRESS.md (run with you).
7. In-app About shows the non-affiliation note and the privacy link; no logos or player photos anywhere.
8. `pnpm verify` green.

**Criterion 2's package changes:** the owner chose `dev.adveis.ourplayers` in this brainstorm, as §S11 allowed ("verify it") and the saved pick asked. This session updates §S11 to match; the quote above is the text as it stood.

## Out of scope (verbatim from §S11)

New features beyond the privacy link; recruiting testers, the 14-day requirement and production access (see "Between S11 and S15" and S15).

## Owner's decisions (2026-11-03)

| Pick | Decision | What the challenge found |
|---|---|---|
| Support email | `ourplayers@adveis.dev`, forwarded to the owner's Gmail by Cloudflare Email Routing | Google's 6-digit verification arrives through a forward. Routing is receive-only, so replies come from the Gmail address. It can be repointed without touching the app. |
| Privacy page | `https://ourplayers.adveis.dev/privacy`, from `apps/mobile/public/privacy.html` | Cloudflare serves `/privacy` from `privacy.html` ahead of the SPA fallback (`auto-trailing-slash`). A missing file answers 200 with the app, so a status check proves nothing: check the page's text. Live only after the merge. |
| Developer name | Adveis; the policy says "Adveis, an individual developer based in Latvia" | Allowed, and changeable at any time. It doesn't hide the owner: Google shows a personal account's legal name, country and developer email (EEA non-traders: email and country only). No legal name in the repo: accepted risk against GDPR's identity rule, one edit to change. |
| Package ID | `dev.adveis.ourplayers` | Valid, exact reverse of the web host, scales to `dev.adveis.<app>`. Amends D-017. A lapsed domain wouldn't affect the app. |

## 1. `docs/store/play-requirements.md` against Google's current rules

Re-read 2026-11-04. Still true: target API 36, AAB, version code limit, listing limits, tester limits, the 12-tester rule, the production form. To correct in the file:

- **Screenshots:** "a minimum of two screenshots across different device types", not two per type. Four at 1080 px or more is required for recommendation eligibility, not to publish.
- **Icon:** Google's two pages differ. The console page says 32-bit PNG with alpha; the design spec says full square, no rounded corners or shadow, avoid transparency (Google masks it with a 30% radius). So: 32-bit PNG with a fully opaque field.
- **Privacy policy contents:** developer information and a privacy contact, data types and recipients, secure handling, retention and deletion, clear labelling, and the listing's entity or the app's name.
- **Data safety:** ephemeral data is still answered in the form but not shown on the listing; anything logged beyond that must be declared. There is no anonymized-data exemption on the collection side. (One FAQ line says ephemeral use needn't be included; the main text says it must. We include it, the stricter reading.)
- **Internal track:** "You can start an internal test before completing app setup." Closed needs "Complete app setup", which no page defines, so the console's Dashboard decides.
- **New:** public developer profile and trader declaration (by 1 Feb 2027); the public developer email must be verified and stay working; 16 KB pages are required for updates from 1 Feb 2027 (developer.android.com).

## 2. App identity (`app.json` against VISION §11)

Name "Our Players", slug, scheme, `permissions: [INTERNET]` and the blocked list all match. Changes: `android.package` → `dev.adveis.ourplayers`; `owner: "adveis"`, so the project lands under the personal account and not the empty `Adveis team`; `eas init` adds `extra.eas.projectId` during the walkthrough (public, safe to commit).

The package change reaches `app.json`, VISION §11 (with the Analytics wording from §8), SESSIONS §S11 (scope and criterion 2), SECURITY-CHECKS §4.4 and a new decision amending D-017. `Adve1s` stays in GitHub URLs and the server's User-Agent contact.

## 3. `eas.json` and versioning (`apps/mobile/eas.json`)

```json
{
  "cli": { "version": ">= 27.2.0", "appVersionSource": "remote" },
  "build": {
    "base": { "node": "24.22.0", "corepack": true },
    "development": { "extends": "base", "developmentClient": true, "distribution": "internal" },
    "preview": {
      "extends": "base",
      "distribution": "internal",
      "android": { "buildType": "apk" },
      "env": { "EXPO_PUBLIC_API_URL": "https://api.ourplayers.adveis.dev" }
    },
    "production": {
      "extends": "base",
      "autoIncrement": true,
      "android": { "buildType": "app-bundle" },
      "env": { "EXPO_PUBLIC_API_URL": "https://api.ourplayers.adveis.dev" }
    }
  }
}
```

- **Version code:** EAS stores it remotely and raises it on every production build, so "every upload needs a higher one" can't be forgotten. `version` in `app.json` (1.0.0, shown in About) is changed by hand.
- **`development`** exists because §S11 lists it. It needs `expo-dev-client`, a new dependency nobody needs yet, so it stays uninstalled and Expo Go remains the dev path. `release.md` says so.
- **API URL:** `apiBaseUrl` silently falls back to localhost, so a test pins both profiles' URL. `apps/mobile/.env` is git-ignored, so EAS doesn't upload it.
- **The CLI** isn't a repo dependency: `pnpm dlx eas-cli@27.2.0` from `apps/mobile`, a pinned version old enough for `minimumReleaseAge`. Implementers check the `corepack` key against that CLI's `eas.json` schema, because the docs only show it for Yarn; if unsupported, use `"pnpm": "12.14.0"`.
- **Submitting:** by hand in the console (owner, 2026-11-04). `eas submit` could do even the first upload, but it needs a Google Cloud service account and its key: a setup job and one more secret, to save about a minute per release. It can be added later without touching the app.
- **Free plan:** EAS's free tier costs nothing but queues builds and has a monthly limit (expo.dev/pricing).

## 4. Assets against Play's requirements

| Asset | Check | Result |
|---|---|---|
| Launcher icon `icon.png`, adaptive layers, monochrome, splash | 1024 px, foreground and monochrome transparent, mark inside the 66/108 safe zone (S17) | Meets Android's rules. First visible in this build, so the phone check confirms it. |
| Play icon, 512 px | `public/icon-512.png` is full square, opaque, 8 KB, mark well inside the 30% mask, but its PNG colour type is 2 (24-bit, no alpha channel) | Needs a 32-bit copy, see §7. |
| Fonts | S17 removed the `expo-font` plugin; `useFonts` loads bundled files at runtime | Keep it (smallest). No network call. The root layout waits for them. Phone check confirms. |

## 5. Which console forms each track requires

- **Internal (this session):** create the app (name, default language English, App, Free, the two declarations), an email list with the owner's account, upload the AAB. Testers may see a temporary name. If the console demands anything more, fill it from `docs/store/`.
- **Closed (after the merge):** everything in "App content" (privacy policy, ads, app access, content rating, target audience, Data safety, advertising ID, news, government, financial features, health), the store listing, category and contact details, countries, a tester list, and the release itself.
- **Account level, once:** check the public developer email, declare non-trader, check the verification status on Home.

## 6. Privacy page and in-app link

**Page:** `apps/mobile/public/privacy.html`, plain HTML with inline CSS (the CSP allows inline styles, not scripts), light and dark, labelled "Privacy policy", dated. Near-final content, each line matching the code:

- **Who:** Our Players is made by Adveis, an individual developer based in Latvia. Contact `ourplayers@adveis.dev`.
- **What the app is:** shows how players from chosen countries did. No account, no ads, and no analytics or tracking services in the app; the only record is the server log described below.
- **On your device:** followed countries, leagues, favorites and hidden players are stored on the device. Android's automatic backup may copy them to your Google account (`allowBackup`, X3). Uninstalling removes them from the device.
- **Sent to our server:** to fetch the right results, the app sends those preferences and any search text in each request's query, over HTTPS. They're used to answer that request and then discarded, and are never written to a log or database.
- **Your IP address:** your network address reaches our server, as with any internet request. It's held only in the server's memory to limit abusive traffic. The first request after each minute clears it, so it can stay longer when nobody else is using the app, and a server restart clears it too. It isn't saved to disk, written to a log or used to work out your location.
- **What's logged:** each request's path (which may name a date, game or player), status and duration, with no query string or IP address, so a line can't be tied to a person. The proxy's error log, written when the API can't answer, holds the path and request headers such as the app or browser type. Logs are capped at 50 MB per service and overwritten as they fill, with no fixed time limit.
- **Deletion:** no account, and nothing in the app or on its server is tied to a person, so there's nothing there we could find and delete on request. Clear your data by uninstalling the app, or clearing site data on the web. If you've emailed us, ask and we'll delete your messages.
- **Sharing:** nothing is sold or shared. The API runs on our rented server at Linode (Germany), which acts for us. The website version is served by Cloudflare, which handles visitors' addresses as any web host does; the Android app doesn't use it for data. Mail you send to the support address passes through Cloudflare's forwarding to Gmail, and is kept as long as needed to answer.
- **Data sources:** player and game data comes from public NHL and ESPN web APIs, fetched by our server on a schedule. No user data goes to them. Not affiliated with the NHL, NBA or ESPN.
- **Children:** the app isn't directed at children under 13. It asks for no personal information and has no ads or accounts.
- **Your rights and changes:** write to the contact above with questions; you may also complain to a data protection authority. Changes appear on this page with a new date.

**Link:** a `PRIVACY_URL` constant in `src/lib/links.ts`; in Settings → About, a "Privacy policy" `Pressable` (`accessibilityRole="link"`, same style as "Add to Home Screen") calling React Native's `Linking.openURL`, on every platform. The `settings-about` screenshot asserts the link. The existing notes stay ("Not affiliated with the NHL or NBA").

**Test** (`apps/mobile/test/store-config.test.ts`, red first): `privacy.html` exists and contains "Privacy policy", "Our Players", "Adveis" and the email; `PRIVACY_URL` is the production origin + `/privacy` and the file is named to match; both `eas.json` profiles carry the production API URL; `app.json`'s package is `dev.adveis.ourplayers`.

**SECURITY-CHECKS §4.2** currently expects only the API host in the bundle; the link adds `https://ourplayers.adveis.dev`, so update the expected output.

## 7. Listing graphics (`docs/store/graphics/`, committed)

- **Icon:** `magick public/icon-512.png PNG32:…/icon-512.png`, asserting IHDR colour type 6. `magick` exists on the owner's laptop; the file is generated once and committed.
- **Feature graphic, 1024×500:** `apps/mobile/scripts/store-graphics.ts`, Playwright rendering HTML: the mark from `assets/icon.svg` on the `#1D2024` field, "Our Players" in Instrument Sans (base64 `@font-face` from the installed package), tagline "Your countries' players, every morning". No league names. Asserts size and colour type 2 (no alpha).
- **Screenshots:** `pnpm screenshots --store` reuses `SHOTS` for five names (`night-mixed`, `game-hockey`, `player-skater`, `search-results`, `settings`) in the dark scheme at 360×720 @3x = 1080×2160, exactly at the 2:1 limit, written as `docs/store/graphics/screenshots/NN-<name>.png` with `after` skipped. Asserts colour type 2. From the web build, because real phone screenshots are often taller than 2:1 and get refused; it's the same code and the seeded data is real.

## 8. `docs/store/` files

- **`listing.md`**
  - Name: Our Players
  - Short (≤ 80): "Morning recap of how players from the countries you follow did last night."
  - Full: the morning moment; Latvia by default and any country you pick; stat lines, box scores, player pages; favorites and hidden; no account, no ads; "Data comes from public NHL and ESPN web APIs. Our Players is an independent, free project and isn't affiliated with or endorsed by the NHL, the NBA, their teams or ESPN."
  - Category Sports, tags chosen in the console; email `ourplayers@adveis.dev`; website `https://ourplayers.adveis.dev`; privacy URL. League names appear only descriptively (VISION §11).
- **`data-safety.md`** (answers below, each with its evidence).
- **`app-content.md`**: every other form's answers (below).
- **`testers.md`**: invitation message (what it is, what Google asks: stay opted in 14 days, use all of it, the opt-in link and the Play install link, how to send feedback) and a short "keep testers opted in" plan: aim for 15, one reminder around day 7, nobody opts out until S15 is done, private notes outside the repo. No names or emails.
- **`release.md`**: ship an update (build, version code, §4.4, upload, roll out); submit to the closed track (the checklist in §10); add a tester; credentials; the `development` note.
- **`play-requirements.md`**: the corrections in §1.

### Data safety answers

Checked in the code: `packages/shared/src/client.ts` is the only `fetch`; preferences and `q` go in query strings; `apps/server/src/api/app.ts` logs `c.req.path`; `rate-limit.ts` keeps IPs only in an in-memory map that the first request after each minute clears, as does a restart; `deploy/Caddyfile` strips the query and client IPs, `X-Forwarded-For` included; `deploy/compose.yaml` caps logs at 5 × 10 MB. No analytics, crash reporting, ads or update SDK in `apps/mobile/package.json`. API DNS is grey-cloud, so Cloudflare doesn't see API traffic. The host part (`docs/SECURITY-CHECKS.md` §4.3, "0, 0 and 0") is re-verified in the walkthrough.

**Collects or shares required data?** Yes. **Encrypted in transit?** Yes (HTTPS only; HTTP redirects). **Way to request deletion?** No (owner, 2026-11-04): there's no account and nothing links to a person, so nobody could act on a request. Log rotation is by size, so the 90-day route would need a host change for one listing line Google doesn't require, and that line would say users can request something they can't. Parked in PROGRESS for S15.

| Type | Collected | Shared | Ephemeral | Required? | Purpose | Evidence |
|---|---|---|---|---|---|---|
| App activity → In-app search history | Yes | No | Yes | Optional | App functionality | `q`, never logged |
| App activity → Other actions | Yes | No | Yes | Required | App functionality | countries, leagues, favorites, hidden in queries, never logged |
| App activity → App interactions | Yes | No | No | Required | Analytics | the logged path shows which day, game or player page was requested |
| App info and performance → Other app performance data | Yes | No | No | Required | Analytics | the logged status and duration |

**Not declared, and why:** location (the IP is never used to work out a location, per Google's FAQ, and is held only in memory); device IDs (none exist); personal info (none); crash logs (no crash reporter). Linode is a service provider, so it's not "sharing".

**The listing will read:** "No data shared", collects "App activity" and "App info and performance", encrypted in transit. This is more than VISION's "no data" impression, and it's what Google's wording requires. **Why Analytics:** the log is read to watch the service's health and diagnose bugs, and Google's definition of Analytics names exactly that ("to monitor app health, to diagnose and fix bugs or crashes"). VISION §11 changes to match: preferences are still never stored or logged, but "no analytics" becomes "no analytics or tracking services, only a server request log with no IP addresses or query strings". The policy and the form must say the same thing.

### Other forms (`app-content.md`)

| Form | Answer |
|---|---|
| Privacy policy | The URL |
| Ads | No ads |
| App access | All functionality available without special access |
| Content rating | Category "all other app types" (or nearest); no to violence, sexuality, language, drugs, gambling, user interaction, sharing location, purchases; IARC email: the support email |
| Target audience | Ages 13–15, 16–17 and 18+ (owner, 2026-11-04). A declaration of who it's designed for, not an age limit: younger children can still install and use it. Under-13 stays unselected, since it would let nobody new in and would commit us to the Families policy. "Restrict minor access" stays off (it's only offered for 18+ alone). If the console asks a follow-up about children, answer truthfully: not designed for or directed at them. |
| Advertising ID | No (`AD_ID` permission checked in §4.4) |
| News / Government / Financial / Health | Not a news app; no; none; none |
| Countries | All, closed track |
| Account | Developer name Adveis; declare non-trader |

If the console asks something not in the file: stop and ask Claude rather than guess.

## 9. Credential backup

The EAS keystore is the *upload* key; with Play App Signing, Google holds the app-signing key, so a lost upload key can be reset through Google rather than losing the app. Backup anyway: `pnpm dlx eas-cli@27.2.0 credentials -p android` → production → download the keystore → save the `.jks` file and its passwords in the password manager → delete the local copy. `.gitignore` gains `*.jks`, `*.keystore` and `credentials.json`. Never in the repo. The owner confirms.

## 10. Walkthrough, one step at a time after the final review

Owner time: about an hour, excluding EAS's queue.

**In this session**
1. Cloudflare → Email Routing → enable for `adveis.dev`, add `ourplayers@` → the owner's Gmail, send a test.
2. `eas login` (the owner, interactive, 2FA). Claude runs `eas init`, commits `projectId`, and §4.4's config check.
3. First production build: the owner runs it once, because the keystore prompt is interactive. Claude watches it and fixes config issues (AC1).
4. Claude downloads the AAB and runs §4.4 with bundletool (Java through `mise x`, nothing added to the repo): package, `targetSdk` 36, permissions. Fix the doc if the expected permission list differs (AC2, AC6).
5. Console: create the app, internal track, email list with the owner's account, upload the AAB, check the warnings (including 16 KB) and App bundle explorer. Roll out, accept through the link.
6. Phone: install; icon, adaptive icon, monochrome, splash, fonts; Today loads from production; About's link opens the browser (the page is live only after the merge); warm open timed, under 2 s; note it in PROGRESS (AC3).
7. Credential backup (AC4).
8. Security re-run: Claude runs §2, §4.1, §4.2, §4.6 and §3 "scan changes"; the owner runs §4.3 on the host, or lets Claude over ssh, and confirms §4.5's consoles. Results in PROGRESS (AC6).

Then: ready for `/handoff`.

**After the merge** (`release.md`)
1. Right after the merge, deploy the API (`deploy/deploy.sh`, which also ships and reloads the Caddyfile), because the page goes live at merge and the Data safety answers rely on the log fixes.
2. `curl https://ourplayers.adveis.dev/privacy | grep "Privacy policy"`, then tap the link on the phone.
3. If the review changed the app: new AAB, §4.4, phone check.
4. Console: account checks; App content from `app-content.md` and `data-safety.md`; listing and graphics; countries; closed track, tester list with the owner's account; promote the release; submit.
5. On approval: opt in with the link, install, Today loads. People can then be added.
6. If rejected: a bug-fix session, then a new version code and resubmit.

## Left to the builder

File layout inside the scripts, the page's CSS, exact wording within the drafts above, and the order of plan tasks.

## Calls the owner reviewed (2026-11-04)

Target audience 13+ with under-13s left out and no age restriction; declaring the request log as App interactions and performance data with purpose Analytics; "No" on deletion; manual uploads with no `eas submit`; `expo-dev-client` left out; runtime fonts kept; web-build screenshots rather than phone ones; a 32-bit Play icon generated once with `magick`.

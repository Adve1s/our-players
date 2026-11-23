# Release guide

How to build the app and get it to Google Play. Commands start from the repo root unless a step says otherwise. A block that needs `apps/mobile` finds it from anywhere in the repo and leaves your terminal there; `cd "$(git rev-parse --show-toplevel)"` takes you back to the root. Replace anything in `<angle brackets>` with your own value.

Play Console menu names change, so the paths below are the best current names: look for the nearest match. The console's wording may differ. If it asks something these files don't answer, stop and ask Claude rather than guess.

- [First time on EAS](#first-time-on-eas)
- [Ship an update](#ship-an-update)
- [Internal track](#internal-track)
- [Submit to the closed track](#submit-to-the-closed-track)
- [Add a tester](#add-a-tester)
- [If Google rejects it](#if-google-rejects-it)
- [Credentials](#credentials)
- [Support email](#support-email)
- [Notes](#notes)

## First time on EAS

EAS is Expo's build service: it turns the code into the Android App Bundle (AAB) you upload to Google. Its CLI isn't a repo dependency: `pnpm dlx` fetches the pinned version each time. You only need this section once per computer (login) or once ever (the rest).

```bash
cd "$(git rev-parse --show-toplevel)/apps/mobile"
pnpm dlx eas-cli@27.2.0 login
pnpm dlx eas-cli@27.2.0 whoami
pnpm dlx eas-cli@27.2.0 init
```

- **`login`** asks for your Expo account's password and 2FA code. Success: `whoami` prints `adveis`.
- **`init`** offers to create the project under `adveis`: accept. Success: `apps/mobile/app.json` gains `extra.eas.projectId`. That ID is public and safe to commit.

The first production build asks about signing, so run it yourself in a terminal:

```bash
cd "$(git rev-parse --show-toplevel)/apps/mobile"
pnpm dlx eas-cli@27.2.0 build -p android --profile production
```

When it asks to generate a new Android keystore, say yes. EAS keeps it for you. Then back it up (see [Credentials](#credentials)). The free plan costs nothing but queues builds and has a monthly limit (expo.dev/pricing), so a build can wait a while before it starts.

## Ship an update

Merge the change to `main` first, so what's built is what was reviewed.

1. **Decide the version.** If users should see a new version, change `version` in `apps/mobile/app.json` (shown in About) and merge that too. The version code rises by itself on every production build, so you never set it.
2. **Build:**
   ```bash
   git switch main && git pull
   cd "$(git rev-parse --show-toplevel)/apps/mobile" && pnpm dlx eas-cli@27.2.0 build -p android --profile production
   ```
   Success: it ends with a link to the finished build on expo.dev.
3. **Download the AAB** from that page's download button (or expo.dev → the `our-players` project → Builds).
4. **Check the build** with `docs/SECURITY-CHECKS.md` §4.4, "The built app". Don't upload it if an unexpected permission shows up: tell Claude first.
5. **Upload.** Play Console → your app → Test and release → Testing → the track (Closed testing for testers, Internal testing to try it on your own phone first) → Create new release → upload the AAB.
6. **Write release notes:** a sentence or two in plain English, for example "Fixes a crash on the player page."
7. **Roll out.** Next → check the warnings → Save → start the rollout. On the closed track this may then need "Send for review" under Publishing overview; the console's wording may differ.

Success: the release's status moves to in review or published, and testers get the update through Google Play with nothing to do.

If the change adds an SDK, a logged field or a permission, redo `data-safety.md` first.

## Internal track

No Google review and no waiting, so use it to check a build on your own phone.

- [ ] **Create the app (once).** Play Console → Home → Create app. Name "Our Players", default language English, App, Free, then accept the two declarations. If it asks about Play App Signing, accept it: Google holds the signing key and your EAS keystore is the upload key.
- [ ] **Add yourself.** Test and release → Testing → Internal testing → Testers → create an email list with your own Google account. Save.
- [ ] **Upload.** Internal testing → Create new release → upload the AAB that passed §4.4. The first upload makes `dev.adveis.ourplayers` permanent.
- [ ] **Read the warnings,** including any about 16 KB memory pages, and look at App bundle explorer.
- [ ] **Roll out,** then copy the link from the Testers tab, open it on your phone, accept and install. Testers may see a temporary name at first.

If the console demands more before an internal release, fill it in from the files in `docs/store/`.

Success: the app installs on your phone and Today loads from the production API.

## Submit to the closed track

Do these in order, after the S11 pull request is merged. The merge publishes the privacy page, and the Data safety answers rely on the log fixes, so the deploy comes first.

**1. Deploy the API, right after the merge.**

On your computer (the tree must be clean):
```bash
cd "$(git rev-parse --show-toplevel)"
git switch main && git pull && deploy/deploy.sh root@<server-ip>
```
Success: it ends with `deployed <tag>`, having shown `docker compose ps` and the health check's answer. The API is down for 10–40 s. If it fails, see `docs/DEPLOY.md` §3.

On the host, first deploy after S11 only (`ssh root@<server-ip>`):
```bash
cd /opt/our-players && docker compose up -d --force-recreate caddy
```
This drops older log lines that hold a client address, because the deploy only reloads Caddy. Caddy is down for a few seconds. Success: the output shows the Caddy container started.

**2. Check the logs.** Still on the host, in `/opt/our-players`, run `docs/SECURITY-CHECKS.md` §4.3's four log greps:
```bash
docker compose logs --since 48h caddy | grep -v '"logger":"admin.api"' | grep -cE 'remote_ip|client_ip|X-Forwarded-For'
docker compose logs --since 48h caddy | grep -v '"logger":"admin.api"' | grep -v 'served key authentication' | sed -E 's/"User-Agent":\[[^]]*\]//' | grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}' | grep -vcE '^(127\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)'
docker compose logs --since 48h api | grep -c '"path":"[^"]*?'
docker compose logs --since 48h api | grep -c 'Failed query'
```
Success: `0`, `0`, `0` and `0`. Anything else: stop and tell Claude. Don't submit.

**3. Check the privacy page by its text.** On your computer:
```bash
gh run list --workflow "Deploy web" --branch main --limit 1
curl -sS https://ourplayers.adveis.dev/privacy | grep -c 'Privacy policy'
```
Success: the run shows a ✓ in the terminal (`completed success` when piped), and the count is above `0` (it's `2` today). `0` means the site answered with the app and not the policy. Checking the status code proves nothing, because a missing page still answers 200. Then on your phone, tap Settings → About → Privacy policy. Success: the browser opens the policy.

**4. Build the AAB that goes to the closed track,** whenever the app changed after the internal-track upload. For S11 it always did: the launcher icon and splash shrank to 70% after the phone check (versionCode 3 still has the big ones). Build it as in [Ship an update](#ship-an-update), repeat §4.4, put it on Internal testing and check it on your phone: the icon, the splash and that Today loads.

**5. Fill in the console.** Only after steps 1 to 3:

- [ ] **Account checks:** `app-content.md`, "Account".
- [ ] **App content forms:** `app-content.md`.
- [ ] **Data safety:** `data-safety.md`.
- [ ] **Store listing and contact details:** `listing.md`. Graphics are in `docs/store/graphics/`.
- [ ] **Countries:** Test and release → Testing → Closed testing → Countries / regions → all countries.
- [ ] **Tester list:** Closed testing → Testers → create an email list with your own Google account. Save.
- [ ] **The release:** on Internal testing, promote the step 4 release (not versionCode 3) to the closed track, or create a new release on Closed testing with the step 4 AAB.
- [ ] **Dashboard:** its setup list must show nothing left to do.
- [ ] **Submit:** Publishing overview → Send for review. The console's wording may differ.

Success: the closed track's status shows it's in review. Google's pages give no review time; guides say about 1–5 days, and some accounts can take longer. No pull request waits for it.

**6. Once Google approves it,** note the date in your private notes (`testers.md`). The opt-in link appears under Closed testing → Testers only once the track's status is "Published". Open it on your phone with your own account, opt in, install from Google Play and check Today loads. From then on you can add people.

If Google rejects it, see [If Google rejects it](#if-google-rejects-it).

## Add a tester

1. Ask for the email of the Google account they use on their Android phone. Keep it in the console and your private notes, never in the repo.
2. Play Console → your app → Test and release → Testing → Closed testing → Testers → your email list → add the address → Save.
3. Copy the opt-in link from the same page.
4. Send them the invitation in `testers.md` with that link in it.

Success: they can open the link and tap to join. The 14 days count from when they opt in. Note the date in your private notes.

## If Google rejects it

1. Read the reason in the console's email or under Publishing overview / Policy status.
2. Come back for a bug-fix session with that text, and fix what it names.
3. Merge, then ship as in [Ship an update](#ship-an-update): new version code, new AAB, §4.4, upload, send for review again.

If the rejection is about a form rather than the app, the fix may be only a changed answer: correct the file in `docs/store/` in the same session, so the repo stays true.

## Credentials

The EAS keystore is the **upload** key. With Play App Signing, Google holds the app-signing key, so a lost upload key can be reset through Google rather than losing the app. Back it up anyway:

```bash
cd "$(git rev-parse --show-toplevel)/apps/mobile"
pnpm dlx eas-cli@27.2.0 credentials -p android
```

Pick the production profile, then the option that downloads the keystore; its wording may differ. If it offers to show the keystore's passwords, say yes. EAS saves the keystore in this folder, as `@adveis__our-players.jks`. Save that file and its passwords in your password manager, then delete the local copies. The `rm` also names what the menu's `credentials.json` option leaves behind, in case you picked it:

```bash
rm -f @adveis__our-players.jks credentials.json credentials/android/keystore.jks
ls *.jks *.keystore credentials.json credentials/android/keystore.jks
```

Never put them in the repo. `.gitignore` already blocks `*.jks`, `*.keystore` and `credentials.json`, which is also why `git status` can't show whether they're gone.

Success: the password manager holds the file and passwords, and `ls` prints `No such file or directory` for all four.

## Support email

`ourplayers@adveis.dev` is a forward, not a mailbox. Cloudflare Email Routing sends it on to your personal Gmail.

- **Set it up:** Cloudflare dashboard → `adveis.dev` → Email → Email Routing → enable it, then add a route from `ourplayers@` to your Gmail. The dashboard's wording may differ.
- **Repoint it:** add the new address under Destination addresses, click the link Cloudflare mails to it, then edit the `ourplayers@` route to point at it. The app, the listing and the policy don't change.
- **Check it works:** send a test mail to `ourplayers@adveis.dev` from another account. Success: it arrives at the destination.
- **It only receives.** When you reply from Gmail, the reply comes from your Gmail address, and the person sees that address.
- **Keep it working.** If it's your public developer email, Google needs it to stay active (`app-content.md`).

The forwarding address is deliberately not written in this repo: the repo is public.

## Notes

- **`development` profile:** it needs `expo-dev-client`, which isn't installed, so it won't build as it stands. Expo Go is the development path. The profile exists because S11's scope lists it.
- **`eas submit` was left out on purpose.** It needs a Google Cloud service account and its key: a setup job and one more secret, to save about a minute per release. It can be added later without touching the app (D-071).
- **16 KB memory pages:** updates must support them from 1 February 2027. After each upload, check the warnings and App bundle explorer (Test and release → Latest releases and bundles, or the nearest match).
- **The production API URL** is pinned in `apps/mobile/eas.json`. `apps/mobile/.env` is git-ignored, so EAS doesn't upload it.

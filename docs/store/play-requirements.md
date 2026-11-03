# Google Play requirements

Read on 2026-11-04 from Google's help pages, for a personal developer account. Google changes these without notice, so re-check them at the start of S15. Marked *(not from Google)* where only third-party guides say it.

## Before anyone can test

| Requirement | Rule | Our Players |
|---|---|---|
| Target API | New apps and updates must target Android 16 (API 36) or higher. The deadlines on Google's page (31 Aug 2026, extension to 1 Nov 2026) have passed. | React Native 0.88 sets `targetSdk` 36. `SECURITY-CHECKS.md` §4.4 confirms it on each AAB. |
| Format | Upload an Android App Bundle; version code at most 2100000000. | EAS builds an AAB and raises the version code by itself (`apps/mobile/eas.json`). |
| Privacy policy | Must be linked **on the store listing and inside the app**, even for an app with no personal data. Public `https` page, no login or geofence, not a PDF, specific to this app. It must give developer information and a privacy contact, the data types and who receives them, secure handling, retention and deletion, clear labelling as a privacy policy, and the listing's entity or the app's name. | `https://ourplayers.adveis.dev/privacy`, from `apps/mobile/public/privacy.html`, linked from Settings → About and the listing. |
| Data safety form | Required for closed, open and production tracks; internal-only apps are exempt. "Collect" means transmitting data off the device. Ephemeral data (processed only in memory and discarded) is still answered in the form but not shown on the listing; anything logged beyond that must be declared. There is no anonymized-data exemption on the collection side. One FAQ line says ephemeral use needn't be included, while the main text says it must; we include it, the stricter reading. | The app sends preferences to our API, and the API logs each request's path, status and duration. Answers and evidence in `data-safety.md`. |
| Other declarations | Ads, target age group, content rating questionnaire, sign-in details only if parts of the app need a login, permissions declaration only for high-risk permissions. | No ads, no login, only `INTERNET`. Answers in `app-content.md`. |
| Store listing | Name up to 30 characters, short description up to 80, full description up to 4000, category and tags, a required support email. | Written in `listing.md`. The email `ourplayers@adveis.dev` is shown publicly *(not from Google)*. |
| Icon | 512×512 px, up to 1024 KB. No badges or ranking text. Google's two pages differ: the console page says 32-bit PNG with alpha; the design spec says full square, no rounded corners or shadow, avoid transparency (Google masks it with a 30% radius). So: 32-bit PNG with a fully opaque field. | `docs/store/graphics/icon-512.png`. |
| Feature graphic | 1024×500 px, JPEG or 24-bit PNG without alpha. | `docs/store/graphics/feature-graphic.png`. |
| Screenshots | A minimum of two across different device types, up to 8 per device type. JPEG or 24-bit PNG without alpha, 320–3840 px, longest side at most twice the shortest. Four at 1080 px or more are required for recommendation eligibility, not to publish. | Four at 1080×2160 in `docs/store/graphics/screenshots/`, from `pnpm screenshots --store`. |

## Testing tracks

- **Internal:** up to 100 testers by email list. Builds are normally available within seconds, and "might not be subject to standard Play policy or security reviews". "You can start an internal test before completing app setup."
- **Closed:** by email list (up to 2000 people per list) or Google Group. It needs "Complete app setup", which no page defines, so the console's Dashboard decides. Google's pages give no review time; guides say about 1–5 days *(not from Google)*, and Google says some accounts can take up to 7 days or longer.
- **Joining:** each tester needs a Google account and must opt in through the link, which only appears once the track's status is "Published". Testers can't find the app by searching Google Play.

## The 12 testers

Personal accounts created after 13 Nov 2023 need "a minimum of 12 testers who have been opted in continuously for at least 14 days" before they can apply for production.

- The days are counted per tester. Someone who opts out before 14 days doesn't count, and if they rejoin, their 14 days must be consecutive.
- So the earliest finish is 14 days after the twelfth tester who stays has joined. Google doesn't say what happens if someone leaves after their 14 days, so keep everyone opted in until production access is approved.
- Google sets no minimum usage, but it asks about usage, and too few testers or too little engagement can mean more testing is required.
- It applies to each new app, not once per account *(not from Google)*.

## Applying for production

From the Dashboard, "Apply for production". Review "usually takes seven days or less". The form asks:

- **The closed test:** how easy it was to recruit testers, whether they used all the features, whether their usage matched expected production use, and a summary of their feedback and how you collected it.
- **The app:** target audience, why it's valuable, and expected installs in the first year.
- **Readiness:** what you changed because of the test, and how you decided it was ready.

## Also check in the console

- **Android developer verification:** the Play Console Home page shows the status of the account and app. Google enforced it in four countries from 30 Sep 2026 and plans to go global in 2027 (Android Developers Blog, June 2026).
- **Public developer profile and email:** a personal account's developer email is shown on Google Play, is verified with a one-time code and must stay working. Google shows a personal account's legal name, country and developer email; in the EEA and UK, a non-trader shows only email and country.
- **Trader declaration:** every active account must declare trader or non-trader status by 1 Feb 2027, wherever its apps are distributed.
- **16 KB memory pages:** apps targeting API 35 or higher must support them, and updates that don't can't be released from 1 Feb 2027 (developer.android.com). Check the upload's warnings and App bundle explorer.

## Sources

- [App testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465)
- [Open, closed and internal tests](https://support.google.com/googleplay/android-developer/answer/9845334)
- [Prepare your app for review](https://support.google.com/googleplay/android-developer/answer/9859455)
- [Create and set up your app](https://support.google.com/googleplay/android-developer/answer/9859152)
- [Review times](https://support.google.com/googleplay/android-developer/answer/9859751)
- [Preview assets](https://support.google.com/googleplay/android-developer/answer/9866151)
- [Data safety](https://support.google.com/googleplay/android-developer/answer/10787469)
- [Target API level](https://support.google.com/googleplay/android-developer/answer/11926878)
- [Android developer verification](https://android-developers.googleblog.com/2026/06/android-developer-verification.html)
- [User Data policy](https://support.google.com/googleplay/android-developer/answer/10144311) (what a privacy policy must contain)
- [Required information to create a developer account](https://support.google.com/googleplay/android-developer/answer/13628312) (public developer details)
- [Verify your developer identity information](https://support.google.com/googleplay/android-developer/answer/10841920)
- [Trader status declaration](https://support.google.com/googleplay/android-developer/answer/17594752)
- [Manage target audience and app content settings](https://support.google.com/googleplay/android-developer/answer/9867159)
- [Icon design specifications](https://developer.android.com/distribute/google-play/resources/icon-design-specifications)
- [Support 16 KB page sizes](https://developer.android.com/guide/practices/page-sizes)
- Per-app rule and closed-track review times (third-party): [Tester Community](https://www.testerscommunity.com/blog/google-play-closed-testing-requirements-2026), [ontest.app](https://ontest.app/blog/google-play-closed-testing-review-time-2026)

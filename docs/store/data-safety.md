# Data safety answers

What to put in the Play Console's Data safety form, and the evidence for each answer. The public privacy policy (`apps/mobile/public/privacy.html`) and this form must say the same thing.

**Where it goes:** Play Console → your app → Monitor and improve → Policy and programs → App content → Data safety. Console menu names change, so look for the nearest match. If the form asks anything this file doesn't answer, stop and ask Claude rather than guess.

**Do this after the API deploy.** These answers rely on the deploy in `release.md` ("Submit to the closed track", step 1), which puts this session's two log fixes on the host. Don't submit the form before it.

**If anything changes, answer again.** A new SDK, a new logged field or a new permission can make this form untrue. Before shipping one, come back here and re-answer it, and update the policy to match.

## The three top questions

| Question | Answer | Why |
|---|---|---|
| Does your app collect or share any of the required user data types? | **Yes** | The app sends preferences and search text to our server, and the server logs each request's path, status and duration. |
| Is all of the user data collected by your app encrypted in transit? | **Yes** | HTTPS only: the build's API URL is `https://` (`apps/mobile/eas.json`), and Caddy redirects HTTP to HTTPS (`deploy/Caddyfile`, which sets up HTTPS by default). |
| Do you provide a way for users to request that their data is deleted? | **No** | There's no account and nothing links to a person, so nobody could act on a request. Logs rotate by size, so there's no fixed time limit to offer either. |

The policy also offers to delete emails people send to the support address. That sits outside the app, and those emails aren't data the app collects, so the form's deletion answer stays "No".

If the form asks about accounts: the app has none, and users can't create one.

## The four data types

Tick these four and nothing else. For each one, the form then asks the questions in the table's columns.

| Data type | Collected | Shared | Processed ephemerally | Required or optional | Purpose | Evidence |
|---|---|---|---|---|---|---|
| App activity → In-app search history | Yes | No | Yes | Optional | App functionality | Search text goes in the `q` query parameter (`packages/shared/src/client.ts`). The server answers and discards it, and it's never logged (`apps/server/src/api/app.ts`). |
| App activity → Other actions | Yes | No | Yes | Required | App functionality | Followed countries, leagues, favorites and hidden players go in query parameters on each request and are never logged (same two files). |
| App activity → App interactions | Yes | No | No | Required | Analytics | The logged path shows which day, game or player page was requested (`apps/server/src/api/app.ts`, which logs `c.req.path`). |
| App info and performance → Diagnostics | Yes | No | No | Required | Analytics | The logged status and duration (same file). Google's definition of Diagnostics covers them: "loading time, latency, framerate, or any technical diagnostics". |

**Why Analytics:** we read the log to watch the service's health and to diagnose bugs, and Google's definition of Analytics names exactly that ("to monitor app health, to diagnose and fix bugs or crashes"). Google has no exemption for anonymized data on the collection side, so a log with no IP address still gets declared.

**The proxy's error log** holds the path and request headers such as the app or browser type, and only when the API can't answer. It's covered by the two Analytics rows. The app sends no device ID, so none of those headers holds one.

## What the log holds, and how we know

- **`apps/server/src/api/app.ts`** logs `c.req.path`, which has no query string.
- **This session's first log fix:** the API's error log no longer holds query parameters. A failed database query's message carried them, so it now logs only the error code.
- **`deploy/Caddyfile`** strips the query from Caddy's logs and deletes client addresses from them.
- **This session's second log fix:** Caddy's filter also drops `X-Forwarded-For`, a header that holds the client address, and cuts the client address from `error`, where a failed write to a client that left quotes it.
- **`deploy/compose.yaml`** caps logs at 5 × 10 MB per service.
- **`apps/server/src/api/rate-limit.ts`** holds the IP address in memory only. Later traffic or a restart clears it, and it isn't saved to disk or written to a log.
- **`apps/mobile/package.json`** has no analytics, crash reporting, ads or update SDK.
- **`docs/SECURITY-CHECKS.md` §4.3** re-verifies the host: its four log greps must print 0, 0, 0 and 0.

## Not declared, and why

- **Location:** the IP address is never used to work out a location, which per Google's FAQ is what would make it location data.
- **IP address:** leaving it out is a decision, not an oversight. The address is used only as the per-client key for the rate limit (`apps/server/src/api/rate-limit.ts`). It's held in memory, and never stored, logged or used for location. Google says to disclose IPs "based on their particular usage", and no data type on the form describes this use.
- **Device or other IDs:** none exist.
- **Personal info:** the app asks for none, and there's no account.
- **Crash logs:** there's no crash reporter.
- **Linode:** a service provider acting for us, so it isn't "sharing".
- **Cloudflare:** serves the website only, and the Android app doesn't use it for data. The API's DNS is grey-cloud (DNS only), so Cloudflare doesn't see API traffic.

## How the listing will read

"No data shared", collects "App activity" and "App info and performance", encrypted in transit. With "No" on deletion, Google may also show that the data can't be deleted *(not from Google)*; the console's wording may differ.

This is more than the "no data" impression you might expect from an app with no accounts, and it's what Google's wording requires. The ephemeral rows are answered in the form but not shown on the listing, as Google's rules say.

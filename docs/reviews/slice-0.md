# Slice 0 review — 2026-10-03

**PR:** https://github.com/Adve1s/our-players/pull/2 · **Verdict:** ready to merge. No blockers or majors. The polite client, the recorder and the source notes are solid and well tested. Three minor findings are worth fixing before S03/S04a build on this code: two in the polite client's behavior under load, and one about contracts that haven't absorbed S01's findings.

## Acceptance criteria
| Session | # | Criterion (short) | Status | Evidence |
|---|---|---|---|---|
| S00 | 1 | Clean install; versions pinned | Met (deviation accepted in D-022) | `.tool-versions` `nodejs 24.21.0`; `packageManager: pnpm@12.8.1`; `engines.node >=22`; CI log "Resolved .tool-versions as 24.21.0". pnpm isn't read by mise (D-022: one place, corepack) |
| S00 | 2 | `pnpm verify` = typecheck + Biome + Vitest, green, real tests in shared + server | Met | `pnpm verify`: 3 typechecks Done; `biome check` 42 files, no fixes; Vitest 5 files, 45 passed |
| S00 | 3 | `/health` → `{"ok":true}` | Met | `pnpm dev:server` → `curl localhost:3001/health` → `{"ok":true}`; `PORT=abc` → `Invalid environment: PORT: …` |
| S00 | 4 | Web shows the placeholder with the value from shared | Met | `expo export --platform web` (to a scratch dir) → `index.html` contains `Following: LVA` |
| S00 | 5 | Every CLAUDE.md command exists; later ones name their session | Met | `pnpm job` → "arrives in session S04a", exit 1; `pnpm inspect` → S03; `recap`, `db:*`, `screenshots` scripts present |
| S00 | 6 | Edit → formatted by the hook | Met | Hook run on a scratch file: `export const   x={a:1,\n b:"two"}` → `export const x = { a: 1, b: 'two' };` |
| S00 | 7 | `app.json` identity per VISION §11 | Met | name `Our Players`, slug `our-players`, scheme `ourplayers`, `android.package` `io.github.adve1s.ourplayers` |
| S00 | 8 | `verify (22)` / `verify (24)` pass on the PR | Met | `gh pr checks`: both pass; branch protection requires both |
| S01 | 1 | Polite-client tests: spacing, 429/503 backoff, Retry-After, timeout, no retry on 404, User-Agent | Met | `test/http/polite-client.test.ts`: 17 tests, exact fake-timer timelines (e.g. 503×3 → `[0,1000,3000,7000]`) |
| S01 | 2 | Spike prints ≥1 NHL and ≥1 NBA Latvian line, plus requests and runtime | Met (owner run; not re-run here, live API) | Handoff: 2026-03-10, Merzļikins, Girgensons, Balinskis, Šilovs DNP, Porziņģis, 59 requests, 42 s. `pnpm spike` with no date → usage, exit 2 |
| S01 | 3 | Fixture set recorded with `.meta.json`, committed | Met | 33 fixtures. Every SESSIONS item is covered (NBA summaries: 401810798 played + OT, 401810643 DNP, 401812697 preseason; plus 401810401 for the missing-ID athlete). Provenance below |
| S01 | 4 | Both source docs answer the 8 questions (endpoint, field path, example) | Met | `docs/sources/nhl.md` and `espn-nba.md` Q1–Q8. Spot checks against fixtures hold: Kuemper `decision "O"`, Šilovs `toi "00:00"`, Porziņģis `didNotPlay:false` + `reason "COACH'S DECISION"`, NSH@SEA `startTimeUTC 2026-03-11T02:00:00Z` on `gameDate 2026-03-10`, right-rail 5 periods |
| S01 | 5 | `pnpm verify` green | Met | as S00 #2 |

## Findings
| ID | Sev | Location | Issue | Why it matters | Suggested fix | Decision |
|---|---|---|---|---|---|---|
| F1 | minor | `apps/server/src/http/polite-client.ts:155` | After a `Retry-After` above `maxRetryAfterMs` (120 s), the URL fails loudly, but every later request to that host waits out the whole period: up to an hour with no log line (`sleep` at :132). The test at `polite-client.test.ts:181` pins this. | A recorder or `pnpm job` run would hang silently for an hour. From S04b on, a scheduled job would hold its lock and write no `job_runs` failure. That breaks "jobs fail loudly" exactly when an upstream is throttling us. | While a host is on hold beyond `maxRetryAfterMs`, reject new requests right away with `UpstreamError("<host> on hold until <time>")`. Keep `nextAllowedAt` so nothing is sent early. Change the test to expect a fast failure. | accept: fail fast |
| F2 | minor | `apps/server/src/http/upstream.ts:6` | The rate limit lives inside each client instance, and `createUpstreamClient()` returns a new instance on every call. Two clients in one process can each send 1 request/s to the same host. | Today each CLI builds one client, so nothing breaks yet. But S04a/S04b add jobs and a scheduler in one long-lived process. If each job builds its own client, Architecture rule 3 (≤ 1 request/s per host) is quietly broken. | Make the process share one client: either a module-level singleton returned by `createUpstreamClient`, or a doc comment plus an S04a note that the scheduler builds one client and injects it into every job. | accept |
| F3 | minor | `docs/SESSIONS.md` §S03 (In scope), `docs/VISION.md` §8 `season_stats` row and §9 | The contracts haven't absorbed S01's findings. S03 says "schedule/score → games (… period scores …)", but period scores come from `gamecenter/{id}/right-rail` (nhl.md Q4), which S03 doesn't mention. Nor does it mention `"O"` → OTL or `FINAL` for preseason. VISION §8 says ESPN season stats come from `overview`, while espn-nba.md Q5 recommends bulk `byathlete` (totals and averages). §9 still says "(verify `dates` in S01)". | The SESSIONS section is "the contract" for S03, and its reviewer checks against it. Right now the right-rail fetch relies on a handoff suggestion to edit the next prompt by hand. VISION says to raise code/doc disagreements, not silently pick one. | Add to S03 in scope: "`right-rail` → period scores; decision `"O"` → OTL; `FINAL` and `OFF` are both final (nhl.md)". Add a sentence to VISION §8 and §9 pointing to `docs/sources/*.md` for verified endpoints, and reword `season_stats` as "ESPN per S01: per-game averages and totals from `byathlete`, stored as given". | accept |
| F4 | nit | `docs/PROGRESS.md:17`; `docs/WORKFLOW.md:83`; `docs/DECISIONS.md:84` | PROGRESS cites "cloud-install hook (D-023)", but D-023 is the Expo/pnpm decision and the hook has no decision entry. WORKFLOW's setup check expects "one SessionStart hook"; there are now two. DECISIONS has a double blank line before D-026. | Small doc drift that sends a reader to the wrong place. | Drop "(D-023)" (or say "S00"). Change WORKFLOW to "two SessionStart hooks (context, cloud install)". Remove the blank line. | accept |
| F5 | nit | `apps/server/test/fixtures-record.test.ts:41` (`resolveFixtureUrl` table) | The URL builders with the most logic have no test: `stats-byathlete`, `skater-summary`/`goalie-summary` (URLSearchParams and JSON sort), and the ESPN `roster` with a season. The recorded `.meta.json` URLs prove they worked once. | S03/S05 fetchers will reuse these builders (D-026). A regression would only show up as a live 400. | Add 3 table rows, with expected URLs copied from the existing `.meta.json` files. | accept |
| F6 | nit | `CLAUDE.md:27` | The `fixtures:record` command line omits `--force` (the CLI usage, PROGRESS and SESSIONS mention it). | CLAUDE.md is the command reference every session loads. | Append `[--force]` and "`--force` overwrites". | accept |

## Tests
- **Would they catch a broken implementation?** Yes, for what slice 0 builds. The polite-client tests assert exact fake-timer timelines, so removing the spacing, the jitter cap, the `Retry-After` handling or the body-read timeout fails a specific test. A 404 retry, a missing User-Agent or a wrong attempt count fails too. The recorder tests cover the path, pretty-printing, the meta contents, refusing before any fetch, `--force`, `--as`, unsafe names, non-JSON bodies and partial existing files. `test/setup.ts` makes any real `fetch` throw in server tests.
- **Gaps:** the URL builders (F5). The test at :181 encodes the F1 behavior and would change with that fix. The spike is untested, which is fine for throwaway code. `apps/mobile` isn't in the Vitest projects, which is parked for S08.
- **Weakened, skipped or snapshot-only:** none (no `.skip`/`.only`/`.todo`/snapshots in `apps` or `packages`).
- **Fixture provenance:** all 33 fixtures pass a check script. Each has a `.meta.json` with exactly the recorder's keys and `status 200`. Its `source`/`endpoint`/`id` match its path, its `url` equals `resolveFixtureUrl(source, endpoint, id)`, and its body is byte-identical to `JSON.stringify(JSON.parse(body), null, 2) + "\n"`. Only two commits touch fixtures, both adding files and none modifying them: `ccb5a34` (64 files) and `df8684a` (2 files). Raw sizes are 6 KB–432 KB, so nothing is near the 1 MB pruning threshold.

## Simplification opportunities (at most 3)
1. Once the spike is deleted (S04a), its URLs that sit outside `endpoints.ts` (ESPN `teams`, NHL `bios`) go away. If `roster` needs the team list, add `teams` to `espnNbaEndpoints` rather than re-creating a constant.
2. The two copies of `parse(schema, body, what)` in `spike/nba.ts` and `spike/nhl.ts` are the seed of rule 2's "loud error naming source + endpoint". In S03 make it one shared helper in `src/sources/` that also wraps `JSON.parse` (the parked item), rather than one copy per adapter.
3. `withOptionalSeason` builds a `RegExp` from another regex's `.source`. Two explicit regexes (`/^([A-Z]{3})(?:-(\d{8}))?$/`, `/^(\d+)(?:-(\d{4}))?$/`) would be shorter and tighten the season width per source.

## Reading guide
1. `pnpm-workspace.yaml` + root `package.json`: hoisted linker, `allowBuilds`, the metro-config override, and every root script (not-yet ones go through `scripts/not-yet.mjs`).
2. `.github/workflows/ci.yml`: the matrix where leg 22 uses a literal and leg 24 reads `.tool-versions`; what `verify` runs.
3. `apps/server/src/http/polite-client.ts`: per-host promise chain (`tail`), `nextAllowedAt`, retry loop, `Retry-After` and timeout handling. Keep F1/F2 in mind.
4. `apps/server/test/http/polite-client.test.ts`: how the fake fetch and `settle()` turn timing into exact assertions.
5. `apps/server/src/sources/{nhl,espn-nba}/endpoints.ts` + `src/fixtures/record.ts`: the URL builders S03/S05 will reuse, and the recorder's safety checks.
6. `docs/sources/nhl.md` Q2, Q4, Q7 and `docs/sources/espn-nba.md` Q3, Q5, Q6, Quirks: the facts S03/S05 depend on (right-rail, `"O"`, `FINAL`, no past rosters, `byathlete`, the DNP traps, missing athlete IDs).
7. `apps/server/scripts/spike/nhl.ts`: the end-to-end flow the S04a jobs will replace.

## Questions for the human
1. D-022 pins pnpm via corepack only, not mise, while the S00 contract said "read by all three". Do you confirm that deviation (the review treats it as accepted)? — *Owner (R0-fix): not answered; D-022 stands.*
2. F1: when a host is on hold, should later requests fail fast (suggested), or wait if the hold is shorter than some second limit? — *Owner: fail fast.*
3. Should I run `pnpm spike --date 2026-03-10` (about 59 live requests) as a fresh end-to-end check, or do your runs from S01 suffice? Not run in this review. — *Owner: skip; the S01 runs suffice.*

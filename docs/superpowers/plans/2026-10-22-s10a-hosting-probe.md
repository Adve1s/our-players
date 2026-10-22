# S10a — Hosting choice + upstream probe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** keep `pnpm probe` as a tested deliverable, and make Today keep the last shown day when a step to another day can't load.

**Architecture:** the probe spike splits like `recap`: logic in `apps/server/src/probe.ts` (targets + a runner over the polite client), I/O in `apps/server/scripts/probe.ts`. On Today, a pure `refreshBanner` in `apps/mobile/src/lib/day-message.ts` gains the "step didn't open" texts, and the screen keeps the last day it loaded for its own key in a ref, shown when the requested day failed.

**Tech Stack:** Node 24 + tsx, the house polite client, Vitest; Expo Router + React Native (web via react-native-web 0.21, React Compiler on), TanStack Query 5 (`@tanstack/query-core` observers in tests), Playwright screenshots.

**Spec:** `docs/superpowers/specs/2026-10-22-s10a-hosting-probe.md` — read it first; "Repo work 1" and "Repo work 2" are what this plan builds. The memo and probe results there are already done.

## Global Constraints

Acceptance criteria (verbatim, SESSIONS.md §S10a):
1. The memo compares the options on the points above; your pick is recorded in the design doc.
2. Probe output from the chosen provider shows both APIs reachable with normal latency (pasted by you); the throwaway server is deleted (you confirm).
3. `pnpm verify` green.

Out of scope (verbatim): Dockerfile, deploy, alerting, rate limit (S10b).

Project rules that bind every task:
- All upstream HTTP goes through `apps/server/src/http/polite-client.ts`. Tests never touch the network (the test setup fails any real fetch); fake only the edges (fetch, clock).
- `apps/mobile` never imports `apps/server`. Style only via `useTheme()` tokens; pressables get `accessibilityRole` + `accessibilityLabel`; state in `aria-*` props.
- React Compiler is on (`app.json` `experiments.reactCompiler`): write refs in effects or handlers, never during render.
- Copy is fixed by the spec: `You're offline — couldn't open {dayLabel}.`, `Couldn't load {dayLabel}.` (with a "Try again" button), and the existing `You're offline — showing saved data.` / `Couldn't refresh — showing saved data.`. `dayLabel` from `src/lib/format.ts` (renders like `Mon, Mar 16`).
- Never weaken, skip or delete a test; the existing `refreshBanner` tests move to the new signature/return shape with the same assertions.
- No new dependency. `pnpm verify` green before every commit; Conventional Commits ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Back online after an offline step: the paused fetch resumes on its own, the new day replaces the kept one and the banner disappears (pinned in Task 2's tests: `setOnline(true)` → banner `null`, data is the new day).
2. `onlineManager` is global state: a test that sets it offline must restore it (`finally`/`afterEach`), or later tests hang paused (Task 2).
3. After a failed step, ‹ steps from the kept day (enabled, its own `prevGameDate`), not from the day that failed (checked in Task 3's `today-step-failed` shot: "Previous game day" has `aria-disabled` false).
4. Cold start with the API down (no day ever shown) still shows the full-screen error — the existing `api-down` shot must still pass unchanged (Task 3).
5. A probe target whose body is empty or HTML on a 200 counts as FAIL, not ok (pinned in Task 1: the HTML case).

---

### Task 1: `pnpm probe` as a tested module

**Files:**
- Create: `apps/server/src/probe.ts`
- Modify: `apps/server/scripts/probe.ts` (the uncommitted spike: keep only I/O), `package.json` + `apps/server/package.json` (the `probe` scripts already in the working tree — commit them)
- Test: `apps/server/test/probe.test.ts`

**Interfaces:**
- Produces: `type ProbeTarget = { name: string; url: string }`; `probeTargets(now: Date): ProbeTarget[]`; `runProbe(targets: ProbeTarget[], o: { userAgent: string; fetch: typeof fetch; minIntervalMs?: number }): Promise<{ lines: string[]; failed: number }>`.

- [ ] **Step 1: Write the failing tests** in `apps/server/test/probe.test.ts` (fake fetch only; `minIntervalMs: 0`):
  - `probeTargets(new Date('2026-10-22T12:00:00Z'))` returns the spike's 14 names in its order (`nhl score` … `espn byathlete`); `nhl score` URL equals `nhlUrls.score('2026-10-22')`, `nhl skater-summary` equals `nhlUrls.summary('skater', '20262027', 2)`, `espn byathlete` equals `espnUrls.byathlete('2027', 2, 1)`.
  - `probeTargets(new Date('2026-03-01T12:00:00Z'))`: skater summary uses `'20252026'`, byathlete `'2026'` (before July = the season that started last year).
  - all-ok: a fetch answering `200` with `'{"a":1}'` for every target → `failed === 0`, 14 lines each starting `ok   200`, each line containing its target's name and URL host; the fetch was called 14 times with the targets' URLs in order, each with header `User-Agent` equal to the passed `userAgent`.
  - failures: three targets on distinct hosts answering `503`, throwing `new TypeError('fetch failed')`, and `200` with `'<html>nope</html>'` → `failed === 3`; lines start `FAIL 503`, `FAIL ---`, `FAIL 200`; the third line contains `not JSON`; each line contains its target's name. The 503 target is fetched exactly once (no retries).

- [ ] **Step 2: Run** `pnpm test probe` — expected: FAIL, cannot resolve `../src/probe`.

- [ ] **Step 3: Implement `apps/server/src/probe.ts`** by moving the spike's target list and loop: `runProbe` wraps the injected fetch for timing, builds `createPoliteClient({ userAgent, fetch: timed, maxRetries: 0, minIntervalMs })` (keep the spike's "No retries" comment), and returns the spike's line strings (same columns) instead of printing. Season start year: UTC month ≥ July → this year, else last year (spike rule).

- [ ] **Step 4: Slim `apps/server/scripts/probe.ts`** to: read the package version, `userAgent(version, loadConfig(process.env).contactUrl)`, print `probe from {hostname()} at {iso} as {ua}`, print `runProbe(probeTargets(now), { userAgent: ua, fetch })` lines, then `{ok}/{total} ok`, `process.exitCode = failed === 0 ? 0 : 1`.

- [ ] **Step 5: Run** `pnpm test probe` — expected: PASS. Then `pnpm verify` — expected: green.

- [ ] **Step 6: Commit** `src/probe.ts`, the script, the test, both `package.json`s: `feat(server): pnpm probe checks every upstream endpoint the jobs use`.

---

### Task 2: Today keeps the last shown day when a step fails

**Files:**
- Modify: `apps/mobile/src/lib/day-message.ts` (`refreshBanner`)
- Modify: `apps/mobile/src/app/(tabs)/index.tsx`
- Test: `apps/mobile/test/today-queries.test.ts`

**Interfaces:**
- Produces: `type DayBanner = { text: string; retry: boolean }`; `refreshBanner(meta: QueryState, day: QueryState, requested: string, shown: string): DayBanner | null`, where `QueryState = Pick<QueryObserverResult, 'fetchStatus' | 'isRefetchError' | 'isLoadingError' | 'isPlaceholderData'>`, `requested` = the date the screen asks for, `shown` = the `gameDate` on screen.

Verified TanStack behaviour (query-core 5, `placeholderData: keepPreviousData`): a new key that errors has `data: undefined`, `isPlaceholderData: false`, `isLoadingError: true` (the placeholder is dropped — why the screen needs its own ref); a new key fetched while offline is `status: 'success'`, `isPlaceholderData: true`, `fetchStatus: 'paused'`.

- [ ] **Step 1: Write the failing tests** (real `QueryObserver`s over `dayQuery(...)` with a fake `queryFn`, as the file already does; wrap offline tests in `try { onlineManager.setOnline(false) … } finally { onlineManager.setOnline(true) }`). A day A = `2026-03-16`, B = `2026-03-17`:
  - pins the library: a step A → B whose fetch throws leaves `data` undefined and `isLoadingError` true.
  - a step A → B that errors: `refreshBanner(meta, day, '2026-03-17', '2026-03-16')` → `{ text: "Couldn't load " + dayLabel('2026-03-17') + '.', retry: true }`.
  - the same step offline: → `{ text: "You're offline — couldn't open " + dayLabel('2026-03-17') + '.', retry: false }`.
  - the step offline, then `onlineManager.setOnline(true)` and the fetch settles: `data.gameDate` is `'2026-03-17'` and `refreshBanner(meta, day, '2026-03-17', '2026-03-17')` → `null`.
  - same date, new prefs (A with `DEFAULT_PREFS` → A with `countries: ['EST']`) that errors: `refreshBanner(meta, day, '2026-03-16', '2026-03-16')` → `{ text: "Couldn't refresh — showing saved data.", retry: false }`; offline → `{ text: "You're offline — showing saved data.", retry: false }`.
  - a step still loading (B's fetch never settles): → `null`.
  - meta's refetch failed and the step errored: the step's `Couldn't load …` text wins.
  - the two existing `refreshBanner` tests: same scenarios, new arguments (`requested` = `shown` = the day's date), expecting `null` and `{ text: "Couldn't refresh — showing saved data.", retry: false }`.

- [ ] **Step 2: Run** `pnpm test today-queries` — expected: the library-pinning test passes; the new banner tests fail on the old signature/return (wrong text or a string instead of `{ text, retry }`). Typecheck errors in the test file are expected at this point.

- [ ] **Step 3: Implement `refreshBanner`.** A failed step is `day.isLoadingError || (day.fetchStatus === 'paused' && day.isPlaceholderData)`; it wins over everything else: `requested !== shown` → the two new texts (offline when paused, else `Couldn't load …` with `retry: true`); same date → the two "showing saved data" texts. Otherwise the existing logic, wrapped as `{ text, retry: false }`.

- [ ] **Step 4: Run** `pnpm test today-queries` — expected: PASS.

- [ ] **Step 5: Wire Today** (`index.tsx`):
  - `const last = useRef<DayResponse | undefined>(undefined)`, set in a `useEffect` from `day.data` when `!day.isPlaceholderData`.
  - `const data = day.data ?? (day.isLoadingError ? last.current : undefined)`; the existing `!day.data` branch becomes `!data` (so a cold-start failure still shows `ErrorState`).
  - Banner: `refreshBanner(meta, day, date, data.gameDate)` (`date` is non-null there); `Banner` takes an optional `onRetry` and, when given, renders `AccentButton label="Try again"` under the text; pass `retry` (the existing function) when `banner.retry`.
  - Stepper: `date={data.gameDate}`; prev/next `null` only while `day.isPlaceholderData && day.fetchStatus === 'fetching'` (update the comment). `onLatest` unchanged.

- [ ] **Step 6: Run** `pnpm verify` — expected: green.

- [ ] **Step 7: Commit** `fix(mobile): a day that can't open keeps the last shown day on Today`.

---

### Task 3: Screenshots of a failed step

**Files:**
- Modify: `apps/mobile/scripts/screenshots.ts`

**Interfaces:**
- Consumes: Task 2's copy.

- [ ] **Step 1: Add two states** after `offline-banner`, using the existing helpers (`day`, `seen`):
  - `today-step-failed`: `day(page, '2026-03-23')`, wait for `Other games (10)`; `page.context().route(\`${API}/v1/days/**\`, (r) => r.abort())`; click the "Previous game day" button; `seen` `Couldn't load {label}.` (the label of `/v1/days/2026-03-23`'s `prevGameDate` in the screenshot seed — look it up once and hard-code it) and `Try again`; the stepper header still reads `Mon, Mar 23`; "Previous game day" has `aria-disabled` `false`.
  - `today-step-offline`: same start, then `page.context().setOffline(true)`, click "Previous game day", `seen` `You're offline — couldn't open {label}.`.

- [ ] **Step 2: Run** `PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium pnpm screenshots` — expected: all states pass (90 PNGs: the 86 before plus 2 states × light/dark), `api-down` and `offline-banner` unchanged. Look at the four new PNGs: the banner sits above the kept day's cards, the Try again button is themed in both modes.

- [ ] **Step 3: Run** `pnpm verify` — expected: green. **Commit** `test(mobile): screenshots of a day step that fails`.

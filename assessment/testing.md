# Testing: what exists and what's missing

The brief's baseline was "RSpec has no specs, web has no test runner, no CI". This page records what has been built
since, what each layer is for, and what's still missing, in priority order. For each API change traced from the
code to the tests that prove it, see [05-api-walkthrough.md](05-api-walkthrough.md) and
[06-web-walkthrough.md](06-web-walkthrough.md); for what's planned, with its tests, see
[07-next-steps.md](07-next-steps.md).

## The layers

| Layer | Question it answers | API | Web |
|---|---|---|---|
| **Unit** | Does this one piece behave, at its edges? | `api/spec/{services,models,lib,clients,auth,workers}` | `*.test.ts(x)` beside the source |
| **Integration** | Does it work against the real thing it connects to? | `api/spec/integration` (Postgres, Redis, Rack, Sidekiq) | `web/src/test/integration` (REST + WebSocket; live API contract) |
| **Functional** | Does a user's whole path work? | `api/spec/functional` (journeys over HTTP) | `web/src/test/functional` (whole app rendered at a URL) |

Shared rules (see [GUARDRAILS.md](../GUARDRAILS.md)): no test calls Gemini; the web fakes only the network, at the
HTTP level, and fails on any request it didn't expect; synthetic data only; test jobs never go to the real Redis.

## What exists

### API (RSpec): 404 examples, 0 failures, 2 pending

| Suite | Examples | Covers |
|---|---|---|
| Original harness | 84 (6 pending) | Coverage state engine, analyzer, map injector; portfolio generator; fit/gap engine; auth, tenancy and fit/gap requests; two models; portfolio worker (leaves "failed" to the retries-exhausted hook, P2-26) |
| Functional | 18 (2 pending) | The PRD 02 journey from setup to export; model timeout and retry, non-JSON answer, a portfolio kept "generating" while Sidekiq retries and one job for two Retry clicks (P2-26), failed narrative, invalid requests; known defects end to end; the invite link ends an interview only once the server has asked the page to finish (P1-10, sub-PR 28) |
| Unit | 80 (1 pending) | Prompt compiler; session start and end; the invite link (P1-15); JWT and request authorization; audio buffer; Gemini HTTP client through its real Faraday stack; PDF export; model validations; workers |
| Gap fill | 30 | Skill library model and endpoints; tenant resolver (JWT, header, Referer order, unknown scheme); coverage analyzer worker (applying updates, discovered skills and their cap of ten, auto-advancing stale partials, publishing); keeping or deleting skills on assessment update |
| Tenant routes | 30 (1 pending) | Every API route called by another company with this company's IDs in the URL or body: 404 and no change; lists and creates stay in the caller's company; a route with no case fails the suite (sub-PR 8) |
| Production guards | 10 | Login pinned to the server-set company (3); boot refused on the free tier, without a login company (4) or without `APP_BASE_URL` (1, sub-PR 17); the app booted in production mode in a subprocess (2) (sub-PR 9) |
| Audio proxy | 41 | `AudioWebSocketMiddleware` between fake browser and Gemini sockets, timers fired by hand: who may connect (invite link, assessor token, another company, ended session, mismatched ID); the opening; the echo gate; transcripts saved, numbered and kept free of the instructions sent to Gemini; End; reconnects with backoff and GoAway; the time warnings and ceiling; the two-minute grace after the browser leaves; the AI closing the interview (sub-PR 15), recording that it asked the page to finish (P1-10, sub-PR 28) |
| Proctoring | 12 | The setting: off by default, turned on per assessment, reaches the candidate endpoint (sub-PR 22). The stops: only known events recorded, capped at 200, summed per device (a repeated stop counts once, an unresumed stop runs to the end), sent by the page over the interview socket, shown to the assessor only when required (sub-PR 23). A second screen connected and disconnected, summed apart as times and seconds (P2-28, sub-PR 27) |
| Integration | 28 | Postgres constraints; the Redis coverage channel's exact messages; the Rack pipeline (tenant, CORS, rate limits, WebSocket paths); Sidekiq jobs inline with strict JSON args |

Run: `docker compose exec -e RAILS_ENV=test api bundle exec rspec` (setup in the [README](../README.md)).

### E2E (Playwright): 28 tests, 14 per width (1280px and 375px)

| Spec | Covers |
|---|---|
| `portfolio.spec.ts` | Mixed (summary line, two "Not assessed" with reasons, Add rating), all assessed (no summary), failed (safe message, Retry), generating, long text (Show more, `aria-expanded`) |
| `fitgap.spec.ts` | Unknowns counted apart and never as gaps, with the reason; at 375px the header hides and each value carries its column name; the waiting state |
| `pages.spec.ts` | Login, the assessment list, the invite page and the vacancy list (sub-PR 12) |
| `keyboard.spec.ts` | Without a mouse: Show more; an Add rating filled in up to Save; opening an assessment from the list (P2-8) (sub-PR 12) |

Every page is also checked with axe (WCAG 2.1 A/AA, serious and critical), and every test checks that nothing is wider than the screen, against the configured viewport (see AI verification
moment 14). The built web app runs against the real API with synthetic data from `rails e2e:seed`, and nothing calls
the model. Run: see "Running the E2E tests" in the [README](../README.md); CI job `e2e`.

### Web (Vitest, Testing Library, MSW): 234 tests, 206 passing, 21 expected to fail, 7 opt-in

| Suite | Tests | Covers |
|---|---|---|
| Unit | 125 (7 expected to fail) | The production headers in `vercel.json` let the page use the microphone, camera (P1-16), screen sharing and the screen count; the closing screen (the role, the three steps that follow); the audio hook reports "interrupted", not "complete", once every reconnect fails (P2-27); the hardware check runs every device check whatever failed before (P2-21, sub-PR 19), reruns on Retry and stops the mic it opened (P2-23, P2-24); the timer counts while reconnecting (P2-25); the upload minimum against the interview stream; `LevelRadio` and `SkillPicker` (search, pick, anchors); `parseLevel` (strict: 28 inputs) and labels; `cn`; browser and OS detection; the speed test offline and under the production CSP; token storage; the axios client; `usePolling`; level badge, confidence, skill card (with the not-assessed reason) and override panel (including rating an unrated skill), `ExpandableText`, comparison table (reasons, `data-label`), timer, connection status, error boundary |
| Functional | 61 (12 expected to fail) | Sign-in and the route guard; assessment list; creating an assessment (library and custom skills, validation, API errors) and editing it; inviting candidates (session states, named and unnamed links, copying); vacancy list, create and edit; transcript (turns, download, empty, error); portfolio review, the not-assessed summary, generating, failed and retry, load error, overrides; fit/gap, including the two-minute timeout and a failed fetch; the candidate page from a link, and how it ends: a broken link, a failed load with Try again, the microphone off once the server ends the interview (P2-27) |
| Proctoring | 33 | Chrome on a computer only, from real user-agent strings and brand lists (Edge, Opera, Brave, phones refused); entire screen kept, a tab or a window stopped and refused; the setup notice, camera and screen steps and their errors; the page in Chrome, on a phone, in Edge and with the setting off; the form sending it; Start held back until the steps are done (sub-PR 22); the pause screen (what stopped, one button each, the error) and the assessor's line on the portfolio (sub-PR 23); one screen: `screen.isExtended`, its change event and the five-second check, Start held while a second screen is connected, the live page pausing (no mic frames sent) and carrying on once it's out, the camera's pause in the live page, the assessor's line (P2-28, sub-PR 27) |
| Integration | 14 (2 expected to fail) | Live monitor over REST + WebSocket (7); contract against the running API (7, opt-in) |

Run: `docker compose exec web npm test`, or `cd web && npm install --include=dev && npm test`. The contract test needs
`API_INTEGRATION_URL`, `API_INTEGRATION_EMAIL` and `API_INTEGRATION_PASSWORD`, and must run from the host.

Without the API, the run is 180 passing, 22 expected to fail, 7 skipped.

### How the tests were checked

- **Every known-defect test fails for its stated reason.** `pending` (RSpec) and `it.fails` (Vitest) accept *any*
  failure, so each one was run as a normal test and its failure message read. Two early web runs "passed" for the
  wrong reason; see AI verification moments 7 and 8 in the [work log](00-work-log.md).
- **Deliberate faults were caught in every suite.** Examples: flipping the fit/gap verdict, the audio buffer's
  eviction bound, the prompt's skill order, the end message's keys, the login rate limit (API); not saving the login
  token, the timer's warning threshold, the polling hook's ref, the coverage message type (web). Each was reverted
  straight away. The recorded seeded fault test is on `scratch/seeded-fault-clamp` (see the work log, sub-PR 3).
- **Stable:** the web suite passed repeatedly on the host and in the Docker container.

## Known defects pinned by tests

These turn into ordinary passing tests when the defect is fixed; the marker is removed in the same commit as the fix.

| Finding ([Step 3](03-problem-and-gap.md)) | API (`pending`) | Web (`it.fails`) |
|---|---|---|
| ~~P0-1 unassessed skill stored as L1~~ **fixed** (web in sub-PR 2, API in sub-PR 3) | generator; functional journey now pass | `parseLevel`; portfolio page now pass |
| ~~P0-2 cross-tenant read/write~~ **fixed** in sub-PR 1 | export, override, fit/gap read and both fit/gap writes now pass | |
| ~~P1-1 fit/gap counts unreached skills as gaps~~ **fixed** in sub-PR 4 | engine; functional journey now pass | |
| ~~P1-2 web reads `required_level`, API sends `expected_level`~~ **fixed** in sub-PR 5 | | comparison table; fit/gap page now pass |
| ~~P1-3 omitted skills vanish~~ **fixed** in sub-PR 3 | generator now passes | |
| ~~P1-4 non-atomic writes wipe overrides~~ **fixed** in sub-PR 3 | generator (×2) now pass | |
| ~~P1-5 unverified evidence quotes~~ **fixed** in sub-PR 3 | generator now passes | |
| ~~P1-6 duplicate fit/gap jobs~~ **fixed** (web in sub-PR 5: one request per visit; server lock in sub-PR 7) | fit/gap request now passes | fit/gap page now passes |
| ~~P1-7 passwords in logs~~ **fixed** in sub-PR 6 | auth request; four request-log specs now pass | |
| C2 login lets the caller pick the company (`X-Tenant-Scheme`) | tenant routes (sign-in) | |
| P1-8 list only loads page 1 | | assessment list |
| P1-9 every ended session reads "completed" | | assessment list |
| ~~P1-10 invite link ends a session as `all_covered`~~ **fixed** in sub-PR 28 | functional journey (×2) now pass | |
| ~~P1-11 broken link says "recorded"~~ **fixed** in sub-PR 26 (the pin's wording corrected in sub-PR 27) | | candidate page now passes |
| P1-12 hardware check calls third parties, and fails under the production CSP | | candidate page; speed test under CSP |
| ~~P1-13 PDF export crashes on overrides and emoji~~ **fixed** in sub-PR 14 | PDF generator (×2) now pass | |
| P1-14 removing a skill on an edit form doesn't delete it | assessment update shows `_destroy` works (passing) | assessment form; vacancy form |
| ~~P1-15 invite links point at the API~~ **fixed** in sub-PR 17 | invite link and production guard specs now pass | |
| ~~P2-1 portfolio load error is a blank page~~ **fixed** in sub-PR 5 | | portfolio page now passes |
| P2-3 Gemini retries never fire | HTTP client | |
| P2-4 no notice before the interview | | candidate page |
| ~~P2-5 fit/gap summary leaves out "not assessed"~~ **fixed** (discovered-skill level in sub-PR 2, summary in sub-PR 5) | | comparison table now passes |
| P2-6 list shows error and empty state together | | assessment list; vacancy list |
| ~~P2-11 null level crashes the portfolio page~~ **fixed** in sub-PR 2 | | `parseLevel` now passes |
| P2-12 monitor misses an end during reconnect | | live monitor |
| P2-13 monitor gives up reconnecting silently | | live monitor |
| P2-14 a level label on the second skill sets the first | | `LevelRadio` |
| P2-15 skill picker drops the taxonomy skill id | | `SkillPicker` |
| P2-16 required fields fail silently | | assessment form (custom skill); vacancy form (role title) |
| P2-17 edit and invite pages hide a load failure | | assessment form; invite page |
| ~~P2-8 assessment cards not reachable by keyboard~~ **fixed** in sub-PR 12 | | E2E keyboard spec now passes |
| ~~P2-18 low contrast~~, ~~P2-19 unnamed controls~~ **fixed** in sub-PR 12 | | E2E axe on every page |
| ~~P2-20 microphone frames starting with `{` dropped~~ **fixed** in sub-PR 15 | audio proxy now passes | |
| ~~P2-21 a failed check skips the mic and audio output checks~~ **fixed** in sub-PR 19 | | hardware check (×2) now pass |
| ~~P2-22 the portfolio page waits forever for a stalled generation~~ **fixed** in sub-PR 21 | | portfolio (stops after three minutes) now passes |
| ~~P2-23 Retry gets stuck~~, ~~P2-24 the check leaves the mic on~~, ~~P2-25 the timer stops while reconnecting~~ **fixed** in sub-PR 24 | | hardware check (×2), timer rule now pass |
| ~~P2-26 a retried portfolio job shows "failed" and Retry queues a second one~~ **fixed** in sub-PR 25 | functional journey, portfolio worker now pass | |
| ~~P2-27 "Interview Complete" for a broken link, a failed load or an interruption, and the mic left on~~ **fixed** in sub-PR 26 | | interview end (×4), audio hook now pass |
| ~~P1-16 the production headers block the camera~~ **fixed** in sub-PR 27 | | production headers now pass |
| ~~P2-28 a proctored interview doesn't notice a second screen~~ **fixed** in sub-PR 27 | session model (×2), proctoring request now pass | live page (×2), portfolio now pass |
| P3 (override label, optional reason, Edge, Android, offline upload) | | override panel (×2), hardware utils (×2), speed test |

## What's missing, in priority order

| # | What | Why it matters | Required by the brief? | Effort |
|---|---|---|---|---|
| 1 | ~~**CI** (GitHub Actions running both suites on every push and PR)~~ **done** (`bd51d00`; E2E, coverage and security jobs added later) | Today the tests only protect the code when someone remembers to run them. CI makes every test above a gate, and shows the reviewer a green check on the PR. | Yes: "no CI" is part of the baseline to fix | Small |
| 2 | ~~**Recorded seeded fault test**~~ **done** (sub-PR 3) | Proves the suite catches a regression, with the history visible: break the logic on a scratch branch, show the failing run, revert. Best done in Step 5 on the P0-1 fix, so the fault is a regression of that fix. | Yes, explicitly | Small |
| 3 | ~~**End-to-end in a real browser** (Playwright: real web + real API)~~ **done** (sub-PR 10, below) | Nothing yet runs both services together in a browser. It can also capture every state at desktop and 375px, which the submission needs as screenshots. | Screenshots are | Medium |
| 4 | ~~**Accessibility checks** (axe on the existing page tests, plus keyboard paths)~~ **done** (sub-PR 12: axe on every E2E page, keyboard specs) | Catches missing labels, roles and keyboard access (P2-8: assessment cards can't be opened with a keyboard). "Poor UI/UX" is a disqualifier. | Indirectly | Small |
| 5 | ~~**Migration up/down test**~~ **done** for the not-assessed migration (sub-PR 3, `api/spec/db/`: rolls back and re-applies without changing a rating, refuses to roll back while a skill has no level). The later migrations only add columns. | Step 5's migration must be reversible and safe for existing rows; a spec that migrates down and up with data in place proves it. | Yes, for Step 5 | Small |
| 6 | ~~**Coverage reports in CI** (SimpleCov, `@vitest/coverage-v8`)~~ **done** (sub-PR 13: API 62.1% lines, floor 61; web 68.5%, floor 67. Sub-PR 15: API 77.8%, floor 76) | Measured once by hand (Ruby's `Coverage`, and the Vitest provider installed without saving): lines went from 69.7% to 71.6% (API) and 50.6% to 68.3% (web) with the gap-fill tests, which closed the gaps listed here before. What's left untouched is the audio path (below), `SignupPage` (unreachable, P3) and `StatusIndicator`/`VoiceBars`; on the API, `vacancies_controller` is at 76%. Adding the gems/packages would make it a CI report. | No | Small |
| 7 | ~~**Security scans** (`brakeman`, `bundle audit`, `npm audit`)~~ **done** (sub-PR 13: CI job `security`; 147 gem advisories down to 14, all escalated) | Cheap static checks for known vulnerable patterns and dependencies; fits into CI. | No | Small |

**Not testable yet:** the Gemini Live client and the interviewer's behaviour (the failure modes in PRD 01 §7). They
need a live model on a paid tier (constraint C1), and a paid tier is also a requirement before any real candidate
data is sent (Step 2, Pillar 5). The audio WebSocket middleware is under test since sub-PR 15, against fake browser
and Gemini sockets.

**Recommended next step:** all seven are done; what's left is planned in [07-next-steps.md](07-next-steps.md).

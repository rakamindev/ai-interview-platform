# Work log

A running record of what was done, in order, so the report can tell the journey step by step. Each entry lists
what changed, why, how it was verified, and where it lives.

Findings use the brief's format: severity, a one-line impact, and whether it's a **missing specification** (never
defined) or a **defective implementation** (defined but broken).

| Date | Step | What | Branch / commit |
|---|---|---|---|
| 2026-10-15 | 1 | Docker Compose dev environment; Puma pid fix | `chore/docker-dev-setup` · `b4ec762` |
| 2026-10-15 | 1 | Seeded dev admin so `/login` works | `chore/docker-dev-setup` · `6ef652d` |
| 2026-10-15 | 1 | Setup findings written up | `chore/docker-dev-setup` · `52c36d6` |
| 2026-10-15 | 1 | Own repo created (`mwyzer/ai-interview-platform`, private); `upstream` kept for the final PR | n/a |
| 2026-10-15 | 3 | Product spec read, code traced, findings reproduced and written up | `docs/step-3-gap-analysis` · `076cca4` |
| 2026-10-15 | 3 | Setup log renamed to this work log; AI verification moments added | `docs/step-3-gap-analysis` · `5e19594` |
| 2026-10-15 | 1/3 | RSpec harness + 67 passing specs + 11 pending specs that pin the Step 3 defects | `test/rspec-harness` · `630ce38`, `23eeee8`, `172eaf8` |
| 2026-10-15 | 1 | Gemini API key configured locally; default model IDs found retired | `test/rspec-harness` · `3e644c7` (log only; key never committed) |
| 2026-10-15 | 1 | `.gitattributes`: LF for `api/bin/*` and `db/schema.rb` | `test/rspec-harness` (see 1.5) |
| 2026-10-15 | 3 | Assessment list findings added (P1-8, P1-9, P2-6..P2-9) | `docs/step-3-gap-analysis` · `4f746a8` |
| 2026-10-15 | 2 | Domain immersion: 5 pillars, UU PDP mapping, Gemini tier constraint | `docs/step-2-domain-immersion` · `b80a6de` |
| 2026-10-15 | 3 | Candidate-link findings (P1-10, P2-10, C6), reproduced over HTTP | `docs/step-3-gap-analysis` · `b32f1ec` |
| 2026-10-15 | 4 | Strategy: 30 acceptance criteria, options A/B/C compared, Option B chosen | `docs/step-4-strategy` · `4b363ec` |
| 2026-10-15 | 3 | Findings from the functional tests added (P1-11, P1-12, P2-11) | `docs/step-3-gap-analysis` · `1c36a91` |
| 2026-10-15 | 4 | Delivery plan: web null-level fix lands before the API change | `docs/step-4-strategy` · `814072d` |
| 2026-10-16 | 1/5 | Testing overview: layers, inventory, known-defect pins, and the gaps in priority order ([testing.md](testing.md)) | `test/integration-tests` |
| 2026-10-16 | 3 | Findings from the unit and integration tests added (P1-13, P2-12, P2-13, P3, C7) | `docs/step-3-gap-analysis` · `93101ac` |
| 2026-10-16 | 1/5 | Integration tests: Postgres, Redis channel, Rack pipeline, Sidekiq inline; live monitor REST + WebSocket; API contract | `test/integration-tests` · `164d12c`, `b0058f9` |
| 2026-10-16 | 1/5 | Unit tests: API services, clients, auth, models, workers; web utils, client, hooks, components | `test/unit-tests` · `f1aeec2`, `0a96f4d` |
| 2026-10-15 | 1/5 | Functional tests: API journeys over HTTP; web harness (Vitest, Testing Library, MSW) and page tests | `test/functional-tests` · `ad6c091`, `44474e3`, `d65e3e9` |
| 2026-10-16 | 1 | WebSocket middlewares eager-load correctly; CI runs both suites on every push and PR | `ci/github-actions` · `4c2e510`, `bd51d00` |
| 2026-10-16 | 6 | Report draft: print-styled HTML built to PDF, Mermaid diagrams, UU PDP privacy roadmap | `docs/report` · `304941a`, `5260958`, `bfb5f86` |
| 2026-10-16 | 3 | P1-12 widened: under the production CSP the hardware check can never pass; C8 escalated | `docs/report` · `1708513` |
| 2026-10-16 | 6 | Draft PR opened on `rakamindev` from the public fork `mwyzer/ai-interview-platform-fs` | [PR #160](https://github.com/rakamindev/ai-interview-platform/pull/160) |
| 2026-10-16 | 5 | Sub-PR 1: tenant scoping (P0-2), including two fit/gap write routes not pinned before | `fix/tenant-scoping` · `d7e58ac`, `ecd3124` |
| 2026-10-16 | 5 | Sub-PR 2: the web shows a skill with no level as not assessed (AC-23, P2-11, part of P2-5) | `fix/web-null-level` · `8292c0a`, `79328eb`, `9907398` |
| 2026-10-16 | 5 | Sub-PR 3: migration + generator: "not assessed" is stored, never a fabricated level (P0-1, P1-3, P1-4, P1-5; AC-1..12, 17..21) | `feat/not-assessed-generator` · `4a4f5ca`, `69aebe4`, `8cb0a9d`, `841fb35`, `5192358` |
| 2026-10-16 | 5 | Seeded fault test: the clamp put back on purpose, caught by 13 specs, reverted | `feat/not-assessed-generator` · `27f49f3`, `5b34128` |
| 2026-10-16 | 5 | Sub-PR 4: fit/gap reports not-assessed skills as unknowns, not gaps (P1-1, AC-13..16) | `feat/fitgap-not-assessed` · `bb4b797`, `dedee56`, `054c6b9` |
| 2026-10-16 | 5 | Sub-PR 5: portfolio and fit/gap screens show "not assessed" with the reason; error, retry, long-text and 375px states (P1-2, P2-1, P2-5; AC-20, 22, 24..30) | `feat/not-assessed-screens` · `5e30533`, `342adec`, `c40c78d`, `8e0a650` |
| 2026-10-16 | 6 | Report: Step 5 filled in, with screenshots of every state at 1280px and 375px | `feat/not-assessed-screens` |
| 2026-10-16 | 1 | No password in the repo: Postgres, Redis and the dev admin read theirs from a gitignored `.env` (`.env.example`); Postgres and Redis bind to 127.0.0.1; CI's throwaway database uses no password. Prompted by GitGuardian flagging the dev DB password on PR #160 | `feat/not-assessed-screens` · `ad82538`, `61735da` and the next commit |
| 2026-10-20 | 6 | Draft PR #160 closed at the candidate's request; replaced by draft PR #167 from a fresh branch, `case-study-submission`, with everything #160 had plus sub-PR 25 | [PR #167](https://github.com/rakamindev/ai-interview-platform/pull/167) |
| 2026-10-20 | 6 | Walkthrough video added to the report (Google Drive, viewable with the link); the DRAFT banner and the blue review markers removed, and sub-PRs 26 to 28 merged into `case-study-submission` | [video](https://drive.google.com/file/d/16tFmF__U1cvyYbDWRMrgp91GKFdZaVOL/view?usp=drive_link) |

Hashes are current as of the last rebase of the branch stack; a rebase changes the hashes of every branch above
the one that changed.

**Branches.** They're stacked, so each contains the ones before it: `main` → `chore/docker-dev-setup` →
`docs/step-3-gap-analysis` → `test/rspec-harness` → `docs/step-2-domain-immersion` → `docs/step-4-strategy` →
`test/functional-tests` → `test/unit-tests` → `test/integration-tests` → `ci/github-actions` → `docs/report` →
`fix/tenant-scoping`. Up to `ci/github-actions` they're on `origin` (`github.com/mwyzer/ai-interview-platform`,
private). The submission branch is `fullstack-case-study` on the public fork `mwyzer/ai-interview-platform-fs`,
the head of draft PR #160. The P1-12/C8 update was committed on `docs/report` rather than on
`docs/step-3-gap-analysis`, to avoid rebasing the whole stack.

**Local-only changes** (gitignored, never committed): `api/config/application.yml` (secret key base, Gemini key,
model IDs), `web/.env` (dev JWT), and synthetic test data in the local database.

---

## Step 1: Setup and local exploration

### 1.1 API server crashes on boot in a fresh checkout

- **Severity:** P1 (blocks local setup; no production impact)
- **Impact:** a new developer's API never comes up, so nobody can use the product locally until they find the cause.
- **Category:** defective implementation (dev environment)
- **Symptom:** migrations and seeds succeed, then Puma exits with
  `Errno::ENOENT: No such file or directory @ rb_sysopen - tmp/pids/server.pid`.
  `docker compose ps` still showed the container as "Up", which hid the failure.
- **Cause:** `config/puma.rb` writes its pid file to `tmp/pids/server.pid`. `tmp/*` is gitignored, so a fresh
  checkout has no `tmp/pids/` directory, and the `./api:/app` bind mount hides anything the image would have created.
- **Fix:** the API command in `docker-compose.yml` now runs `mkdir -p tmp/pids` before removing a stale pid file.
- **Verified:** Puma logs `Listening on http://0.0.0.0:3001`; an unauthenticated `GET /api/v1/assessments` returns 403
  and an authenticated one returns 200.

### 1.2 Nobody can log in: the seeds create no users

- **Severity:** P1 (the login screen is a dead end on any fresh environment)
- **Impact:** an assessor opening `/login` has no account to use. The only workaround is minting a JWT in the
  Rails console and pasting it into `web/.env`, which non-developers (product reviewers, QA) can't do.
- **Category:** missing specification. `POST /api/v1/auth/login` exists and accepts only `role == 'admin'`, but no
  part of the codebase or docs says how the first admin account comes to exist. The seeds only print instructions
  for minting tokens by hand.
- **Fix:** `api/db/seeds.rb` now creates a dev admin, `admin@example.com` / `password123`, only if it's missing
  (re-running the seeds never resets its password). The seed output prints the credentials.
- **Verified:** seeds ran twice, once with the user present (skipped) and once after deleting it (recreated).
  `POST /api/v1/auth/login` with these credentials returns 200.
- **Note:** this is a development credential only. Production still needs a defined way to create the first
  admin, for example an invite flow or a one-off task. Open question for the Tech Lead (constraint signal).

### 1.3 Smaller observations

- **Line endings:** on a Windows checkout, Ruby warns `shebang line ending with \r` for scripts in `api/bin/`, and
  `rails db:migrate` rewrites `db/schema.rb` with different line endings. A `.gitattributes` entry with `eol=lf`
  would stop both.
- **No lockfile:** `web/` has no `package-lock.json`, so dependency versions aren't pinned between installs.
- **Wrong default port:** `web/.env.example` points to the API on port 3000, but the API serves on 3001.
- **Empty Postgres is fine:** the seeds create `public.organizations` themselves, so the platform runs without the
  `rakamin-api` database it normally shares.

### 1.4 Gemini access: the default models no longer exist

- **Where the key lives:** `api/config/application.yml` (gitignored, loaded by Figaro). It's never committed and
  never printed in logs or scripts.
- **Severity:** P1 (constraint C1 confirmed). With the repo's defaults, every model call fails, so no interview,
  coverage analysis or portfolio can run.
- **Category:** defective implementation (configuration)
- **Found:** listing models with the key returned HTTP 200, but all three configured IDs are gone:
  `gemini-2.0-pro-001`, `gemini-2.0-flash-001` and `gemini-2.0-flash-live-001`. `gemini-2.5-*` is still listed,
  but `generateContent` answers 404 "no longer available to new users". Pro models (`gemini-3.1-pro-preview`,
  `gemini-4-argon`) answer 429: the key's tier has no Pro quota.
- **Local config now:** `GEMINI_PRO_MODEL` and `GEMINI_FLASH_MODEL` = `gemini-3.5-flash`; `GEMINI_LIVE_MODEL` =
  `gemini-3.1-flash-live-preview` (already the code default in `Gemini::LiveClient`, but overridden by the old value
  in the yml).
- **Assumption to state in the report:** in local development, the portfolio generator (N10) runs on a Flash model
  instead of Pro because of quota. Ratings produced locally aren't representative of Pro quality.
- **Verified:** through the app's own `Gemini::HttpClient`, the Pro slot call returned `{"ok"=>true}`. A second call
  to the same model seconds later returned **503 "high demand"** and was not retried. That's live confirmation of
  P2-3 (Faraday never retries POST).
- **Follow-up for the Tech Lead:** model IDs should come from configuration with a startup check, not hardcoded
  defaults that go stale; and which tier or quota production runs on.

### 1.5 Line endings fixed at the source

- **Problem** (first noted in 1.3): on a Windows checkout, `api/bin/*` had CRLF endings, so Ruby warned
  `shebang line ending with \r` on every command in the container. Every `rails db:migrate` also rewrote
  `db/schema.rb` with LF endings, leaving a permanent fake change in `git status`.
- **Category:** defective implementation (repo configuration). P3, developer friction only.
- **Fix:** a root `.gitattributes` pins `api/bin/*` and `api/db/schema.rb` to `eol=lf`, and the affected files were
  checked out again. Scoped to just these paths on purpose: a repo-wide rule would renormalize every file and
  bury real changes in a huge diff.
- **Verified:** `file` reports no CRLF in `api/bin/*` or `db/schema.rb`, and `git status` is clean after a migrate
  run.

---

## Step 3: Problem and gap analysis

Full write-up: [03-problem-and-gap.md](03-problem-and-gap.md).

- **Read:** the product spec in the wiki (PRD 01, AI interview behavior; PRD 02, end-to-end simulation), then traced
  nodes N1–N14 to the code.
- **Reproduced:** [evidence/repro_findings.rb](evidence/repro_findings.rb) runs the real `Portfolios::Generator` and
  `FitGap::Engine` against the local database, with the model response stubbed. It uses synthetic data only.
- **HTTP checks:** tokens for two organizations (`test-corp`, `other-corp`) confirmed the cross-tenant read and write.
  Sidekiq and Rails logs confirmed the duplicate-job race and the plaintext passwords.
- **Result:** 2 P0, 7 P1, 5 P2 findings, plus 5 constraint signals. The proposed Step 4 focus is the post-interview
  result pipeline.
- **Test data left in the local DB:** assessment 1, vacancy 1, sessions 1–4, organization "Other Corp". Wipe it with
  `docker compose down -v`.

---

## Test harness (API)

The brief's baseline: "RSpec currently has no specs written." The gems were already in the Gemfile, but there was
no `spec/` folder, no helpers and no factories.

**Added** (`api/spec/`):

- `rails_helper.rb` / `spec_helper.rb`: transactional fixtures, random order, `Sidekiq::Testing.fake!` (jobs are
  asserted, not run), and Rack::Attack disabled so throttling can't make specs order-dependent.
- `factories.rb`: synthetic data only (Faker names, `example.test` emails), never real candidate data.
- `support/fake_gemini.rb`: stands in for `Gemini::HttpClient`. It returns a canned response or raises a given
  error, and records prompts. **No spec calls the network.**
- `support/auth_helpers.rb`: signs a JWT for a given organization and role.

**What's covered** (78 examples, run in ~25 s):

| Area | What the specs pin down |
|---|---|
| `Coverage::StateEngine` | Forward-only transitions; the PRD hard rule (no advance past `initiated` with < 2 probes); jumps walked step by step |
| `Coverage::Analyzer` | No model call without transcript; probe increment capped at +1; covered skills frozen; unknown IDs ignored; prose instead of JSON handled; transcript marked untrusted in the prompt |
| `Coverage::MapInjector` | `all_covered?` rules; priority of the least-covered skill; pacing buckets; time never negative |
| `Portfolios::Generator` | Skills stored and status complete; discovered skills separate; evidence capped at 3; regeneration replaces skills; **model timeout → `failed` with the error, re-raised for Sidekiq** |
| `FitGap::Engine` | match / gap / exceed / not assessed with delta; override beats the AI level; match by skill ID then by label; **model failure → fallback narrative**; one report per portfolio and vacancy |
| Auth (requests) | Login: case-insensitive email, same error for a wrong password and an unknown email, non-admins refused; 401 for no token, a forged token or an expired token; 403 for the wrong role |
| Tenant isolation (requests) | The owner can read; another organization gets 404 for assessments, sessions, portfolios and vacancies; listings only show the caller's rows |
| Fit/gap (requests) | 202 + one job when missing; stored report returned without a new job; 422 when the portfolio isn't complete or the vacancy is missing |
| Models / worker | Invite token 64 hex characters and unique; tenant scoping and auto-assignment; level and confidence validation; worker skips missing sessions and marks `failed` once retries are exhausted |

**Known defects pinned as `pending`.** Each Step 3 finding that the backend can prove is written as a spec of the
*correct* behavior, marked `pending`. RSpec runs these and expects them to fail. When a fix lands, RSpec reports
"Expected pending ... to fail", and the marker is removed. That makes them the failing tests for Step 5.

| Spec | Fails today because |
|---|---|
| P0-1 unrated skill must not become L1 | `expected: nil, got: 1` |
| P0-1/P1-1 unreached skill is `not_assessed` in fit/gap | `expected: "not_assessed", got: "gap"` |
| P0-2 export of another org's portfolio → 404 | `but it was 200` |
| P0-2 override of another org's rating → 404 | `but it was 201` |
| P0-2 read another org's fit/gap → 404 | `but it was 200` |
| P1-3 every configured skill accounted for | `missing: ["Communication", "System Design"]` |
| P1-4 no half-written portfolio | 1 skill left behind after the failure |
| P1-4 overrides survive regeneration | `expected: 1, got: 0` |
| P1-5 invented quote dropped | quote kept |
| P1-6 one job while generating | `expected: 1, got: 2` |
| P1-7 passwords filtered from logs | `got: "correct-horse-battery"` |

Each pending failure was checked to fail **for the stated reason**, not because of a setup error (see AI
verification moment 5).

**Not covered yet:** the web app (no test runner; brief baseline), the audio WebSocket middleware and the Gemini Live
client (they need a live model; constraint C1), and the PDF export. The seeded fault test (break logic on a scratch
branch, show the suite catch it, revert) belongs to Step 5.

**Run:** see the "Running the API tests" section of the root `README.md`.

## Integration tests (API and web)

Unit tests check a piece alone; functional tests check a user's path with the network faked. Integration tests check
the joins to real infrastructure, and the contracts between the two services.

**API** (`api/spec/integration/`, 28 examples). Full suite: 195 examples, 0 failures, 17 pending.

| Spec | Runs against | What it pins down |
|---|---|---|
| `database_constraints_spec.rb` | Postgres | Levels kept in 1..5 and required even with validations skipped (no "not assessed" state: the schema side of P0-1); enum values; one portfolio per session, one override per skill, one report per portfolio and vacancy (why concurrent fit/gap jobs crash, P1-6), one coverage row per skill; unique invite tokens; cascading deletes |
| `coverage_channel_spec.rb` | Redis pub/sub | The exact `session_status` (start, end) and `coverage_update` messages on `coverage:<id>`, the contract the live monitor reads; nothing published on a second end |
| `request_pipeline_spec.rb` | Rack stack | Tenant from the signed token, not a header; no tenant leaking between requests; candidate link with no tenant; CORS preflight; WebSocket paths pass plain HTTP through; login and invite-link rate limits answer a JSON 429 |
| `job_pipeline_spec.rb` | Sidekiq inline, strict JSON args | One request carries through to the generated portfolio, the compiled prompt, or the rebuilt fit/gap report |

**Web** (`web/src/test/integration/`):

- `live-monitor.test.tsx` (5 passing, 2 `it.fails`): the real page, hook and services against REST and an MSW
  WebSocket sending the API's exact messages. Auth goes over the socket first; coverage and discovered skills
  update live; the end of the session shows with its reason; the transcript polls from the last turn; ending the
  session goes over REST and opens the portfolio.
- `api-contract.test.ts` (7 passing, opt-in): the web services against the running Rails API, with real HTTP and a
  real CORS preflight from the web origin. It checks the fields and types the screens read. It only creates an
  assessment without sessions and a vacancy, and deletes both; the API log shows the inserts and deletes, and none
  were left behind.

**Checked:** each new `it.fails` test was run as a normal test and fails on its final assertion. Deliberate faults
were caught: renaming a key in the end message and raising the login limit (API), and renaming the coverage
message type in the hook (web).

**Found by the integration tests** (added to Step 3 as P2-12, P2-13 and C7):

- **A session that ends while the monitor is reconnecting never shows as ended.** The end only reaches the monitor
  as the initial `coverage_update` (with `status: "ended"`) after it reconnects, and the hook only reacts to
  `session_status`. The assessor keeps watching a "live" interview that is over. P2.
- **The monitor gives up silently.** After three failed reconnects (1, 2 and 4 s) it stops trying, and the header
  says "Reconnecting..." forever, with no retry. P2.
- **CORS allows any origin.** `ALLOWED_ORIGINS` is `"*"` in the sample config, so any website can call the API
  from a signed-in assessor's browser if it gets a token. It has to be the web app's origin in production.
  Constraint signal.
- **Inside Docker, the web container can't reach the API by name**: Rails' development host check answers 403 for
  Host `api`. Only the contract test is affected; it runs from the host.

## Unit tests (API and web)

Unit tests check one piece on its own, with its edges spelled out. They're the fastest to run and the most precise
about *where* something broke.

**API** (75 new examples, 3 `pending`). Full suite: 167 examples, 0 failures, 17 pending.

| Area | What the specs pin down |
|---|---|
| `Assessments::SystemPromptCompiler` | Every skill and its five anchors in display order; scope lines only when written; the assessment's language, English when unset; PRD rules present; long multi-line anchors intact |
| `Sessions::EndHandler` | Reason, end time and duration recorded; one portfolio, one job; a second end changes nothing; `error` upgraded by a later manual end but never the reverse; unknown reason → `manual_assessor`; still ends when Redis is down |
| `Sessions::StartHandler` | Activates the session; one `not_yet` row per skill in order; a reconnect doesn't reset coverage |
| `JsonWebToken`, `AuthorizeApiRequest` | Round trip; default and caller-set expiry; expired, forged, `alg: none` and garbage tokens refused; role checks for `:assessor`, `:any` and exact roles |
| `AudioRingBuffer` | Order and size; evicts oldest past capacity; drops an oversized chunk; time slicing; stores a frozen copy |
| `Gemini::HttpClient` | Runs the real Faraday stack (retry included) with Faraday's test adapter: key in a header, not the URL; JSON, fenced JSON and prose answers; blocked prompt; 429, 500, timeout and connection errors mapped |
| `Exports::PdfGenerator` | Renders a PDF; fit/gap on its own page only when a report exists; empty portfolio; very long text flows over pages; Indonesian text and typed punctuation |
| Models, workers | Validations for every model with rules; an assessment with sessions can't be deleted; prompt and fit/gap workers skip missing records and re-raise real failures |

**Web** (57 new tests, 9 `it.fails`), next to their source files: `parseLevel` and labels, `cn`, browser and OS
detection, the speed test offline, token storage, the axios client (bearer token, envelope unwrapping, sign-out on
401 but not 500), `usePolling` with fake timers, and the level badge, confidence indicator, skill card, override
panel, comparison table, interview timer, connection status and error boundary. Full suite: 82 tests, 62 passing,
20 expected to fail.

**Checked:** every new `pending` and `it.fails` test was run as a normal test and fails on its assertion for the
stated reason. Deliberate faults were caught: the buffer's eviction bound and the prompt's skill order (API), the
timer's warning threshold and the polling hook's latest-function ref (web).

**Found by the unit tests** (added to Step 3 as P1-13 and two P3 notes):

- **The PDF export crashes for any portfolio with an override.** The generator's own text, `AI: L2 → Override: L4`,
  uses `→`, which Prawn's built-in fonts (Windows-1252 only) can't encode. Evidence quotes with emoji or non-Latin
  script crash it too. The assessor gets a 500 instead of the document they share with the hiring manager. Likely
  P1: overriding is the human-in-the-loop step, so the most-reviewed portfolios are the ones that can't be exported.
- **An offline connection is reported as 4 Mbps upload.** When every upload attempt fails, the speed test returns a
  "conservative fallback" of 0.5 MB/s, exactly the minimum, so the upload line shows green. P3: ping still fails the
  check overall.
- **Edge is shown as Chrome, Android as Linux** on the hardware check. P3: display only.


Unit and request specs check one piece at a time. Functional tests check a whole path the way a user takes it,
so they also catch breaks *between* pieces: the seam between `api/` and `web/`, and the hand-off between a request
and the background job it queues.

**API** (`api/spec/functional/`, 14 examples):

- `assessor_journey_spec.rb`: the PRD 02 journey in one example. Sign in through the real login endpoint, create
  an assessment, compile its prompt, invite, open the candidate link, run the interview, end it, generate the
  portfolio, review it, create a vacancy, run fit/gap, override a rating (the stale report is rebuilt with it),
  export JSON. The evidence quotes are verbatim candidate turns, so the journey stays valid once quotes are
  verified (P1-5).
- `failure_paths_spec.rb`: a model timeout marks the portfolio failed and a retry recovers it; a non-JSON answer
  fails cleanly; a failed narrative call still yields a report with the fallback text; an invalid time limit, an
  unknown end reason, a double end, a bad invite token and a missing auth token are all refused.
- `known_defects_journey_spec.rb` (`pending`): P0-1 and P1-1 through HTTP after a candidate ends at minute 6, and
  P1-10 (the invite link ends a never-started session as `all_covered`).
- Support: `scripted_gemini.rb` answers by what the prompt asks for (portfolio vs narrative), because each service
  builds its own client. `functional_helpers.rb` signs in, runs queued jobs, and stands in for the audio
  WebSocket by persisting what it would (start, turns, coverage).
- The live WebSocket interview itself is still out of reach (constraint C1).

**Web** (`web/src/test/`, 25 tests):

- Harness: Vitest 5, Testing Library, MSW 3, jsdom. `renderApp(url)` renders the whole app with the same error
  boundary as `main.tsx`. Only the network is faked. Fixtures mirror the Rails serializers' exact output.
- Tests: signing in and the route guard; the assessment list and its empty state; portfolio review (levels,
  evidence, discovered skills, generating then ready, failed then retry, saving an override, a failed save);
  fit/gap (comparison, narrative, discovered skills, generating then ready); the candidate page from an invite link.
- Known defects as `it.fails` (11): P0-1, P1-2, P1-6, P1-8, P1-9, P2-1, P2-4, P2-5, P2-6, plus two found by
  these tests (below).

**Checked:** every `pending` and `it.fails` test was run as a normal test and fails on its assertion for the
stated reason. A deliberate fault in each suite was caught: flipping the fit/gap verdict (API) and not saving the
login token (web). The web tests passed three runs in a row on the host and two inside the Docker container.

**Found by the functional tests** (added to Step 3 as P2-11, P1-11 and P1-12, in this order):

- **A null `ai_level` crashes the whole portfolio page.** `parseLevel(null)` calls `.replace` on `null`, and the
  page becomes "Something went wrong." So the API half of Option B can't ship before the web half.
- **A broken invite link says the interview "has been recorded".** `InterviewPage` treats any error loading the
  link as "interview complete".
- **The hardware check contacts third parties before the interview.** Unless `VITE_SPEED_TEST_*` is set, the
  candidate's browser fetches from google.com, cdn.jsdelivr.net and unpkg.com and uploads 0.5 MB to httpbin.org or
  postman-echo.com, several times (12 requests in the first 1.5 s in the test), with no notice. The API already
  has `/api/v1/speed_test`. That's a privacy issue (UU PDP Art. 5 and 21: the candidate isn't told who receives
  their data) and a reliability one (networks that block those hosts fail the check).
- **Under the production CSP, the same check blocks every candidate** (added 2026-10-16). `web/vercel.json`
  limits `connect-src` to our own origin and the API. Running the real module in headless Chrome with that header:
  all 30 third-party requests blocked, download 0 Mbps, ping 999 ms, `passed: false`, so Start stays disabled. With
  ping and upload pointed at our own origin it still fails, because the download test has no override. Pinned by
  an `it.fails` unit test; tracked as P1-12 (possibly P0) and constraint C8.

**Environment notes:** the dev image now uses Node 22 (Vitest 5, MSW 3 and jest-dom 7 need it; Node 20 is past end
of life). This machine's shell sets `NODE_ENV=production`, so `npm install` skips devDependencies unless given
`--include=dev`.

---

## Step 5: Implementation

### Sub-PR 1: tenant scoping (P0-2)

**What was wrong.** `Portfolio`, `PortfolioSkill` and `FitGapReport` have no `tenant_id`; they belong to a tenant
through their session. Five routes looked them up with a bare `find`: export, override, the fit/gap read, and two
that Step 3 hadn't pinned, `POST fitgap` and `POST regenerate_fitgap`. With its own vacancy, another company could
queue a fit/gap of someone else's candidate (202) and then read it, or delete and regenerate a report.

**Fix.** A `for_current_tenant` scope on `Portfolio` and `PortfolioSkill` that joins through the session and filters
on `sessions.tenant_id`; every controller lookup uses it. `Current.tenant_id` raises when no tenant is set, so a
lookup without one fails closed. No migration: adding and backfilling `tenant_id` on a database shared with
`rakamin-api` (C3) would be bigger and harder to reverse for the same guarantee. The fit/gap worker still uses
`Portfolio.find`; it runs outside a request, and its ids only come from the scoped controllers.

**Tests first.** Two new cross-tenant specs use company B's own vacancy, so the portfolio lookup is the only thing
that can stop them. Three owner specs make sure a fix that returns 404 for everyone can't pass. Against the unfixed
code (`d7e58ac`), the five cross-tenant examples failed on their status assertions (200, 201, 202, 202, 200) and the
owner's passed. After the fix (`ecd3124`): 11/11, and the full suite is 200 examples, 0 failures, 14 pending.

**Checked over HTTP** against the dev API, repeating the Step 3 reproduction with an Other Corp token:

| Request | Step 3 | Now |
|---|---|---|
| Other Corp `GET portfolios/1/export` | 200, full portfolio | 404 |
| Other Corp `POST portfolio_skills/1/override` | 201, level set to L5 | 404 |
| Other Corp `GET portfolios/1/fitgap/1` | 200 | 404 |
| Test Corp `GET portfolios/1/export` (owner) | 200 | 200 |

The L5 override still on skill 1 in the dev database is left over from the Step 3 reproduction (synthetic data).
Existing cross-tenant writes in a real database couldn't be told apart from legitimate ones: overrides store
`overridden_by` but not the tenant. That's worth raising if this ever ran with more than one real tenant.

### Sub-PR 2: the web tolerates a missing level (AC-23)

**Why before the API.** Sub-PR 3 lets the API send `ai_level: null`. Today the web would crash on it (P2-11), so
the screen has to survive a null level before one can arrive.

**What changed.** `parseLevel` returns a level only for a whole number from 1 to 5 (`3`, `"3"`, `"L3"`, `" l3 "`)
and `null` for anything else; it used to return 1 for anything unreadable and throw on `null`. Callers treat `null`
as not assessed:

- The skill card shows a neutral, dashed **Not assessed** badge (`NotAssessedBadge`), and no confidence line:
  confidence describes the AI's rating, so there's none without one.
- The override panel offers **Add rating** with no level preselected, and Save stays disabled until the assessor
  picks one. Once rated, the summary reads "Not assessed → L2".
- The fit/gap page's discovered skills read "L2 (low confidence)" or "not assessed", instead of a bare `2` or
  `null (confirmed)`.
- Types now match the API: `ai_level: number | string | null`; confidence and summary can be `null`.

The reasons ("not reached", "not enough evidence") and the summary line come with sub-PR 5, once the API sends
them.

**Tests first** (`8292c0a`): 20 unreadable inputs for `parseLevel`, 4 component tests, 1 fit/gap page test, all
as `it.fails`. Each was run as a normal test against the old code and failed for the stated reason (`expected 1 to
be null`, the `null.replace` crash, `(confirmed)`). After the fix (`9907398`) 29 markers come off, including the
older P0-1, P2-11 and P2-5 pins. Web: 104 passing, 19 expected to fail, 7 skipped without the API; `tsc` clean.
One of the new tests had a wrong expectation, fixed in its own commit (`79328eb`); see AI verification moment 9.

**Not yet checked in a browser.** The API can't store a null level until sub-PR 3, so the screenshot of this state
comes with sub-PR 3 or 5.

### Sub-PR 3: the generator stores "not assessed" (P0-1, AC-1..AC-12, AC-17..AC-21)

**Commits, in order.** Existing specs whose expectations the design changes, each with its reason (`4a4f5ca`);
new specs for every AC, pending (`69aebe4`); the migration (`8cb0a9d`); four more spec expectations, checked against
the old code with the implementation stashed (`841fb35`, 256 examples, 0 failures, 66 pending); the implementation
(`5192358`), where 46 pending specs flip to passing. API: 256 examples, 0 failures, 8 pending, all outside this change.

**How a skill is decided** (`Portfolios::SkillResolver`, pure Ruby): coverage first (never probed → `not_reached`,
whatever the model said); missing from the answer → `omitted_by_model`; only a whole level 1–5 counts, anything else
→ `insufficient_evidence`; quotes must be in the candidate's turns, and a rating left with none drops to low
confidence. The generator calls the model, then writes every row in one transaction, updating rows in place by
skill identity so overrides stay put. Failures get a category and a fixed message; the raw error is never stored,
sent or logged, and a non-JSON reply raises `InvalidResponse` because Sidekiq logs every failed job's message.

**Migration** (AC-17, AC-18): only relaxes `NOT NULL` and adds nullable columns, plus three check constraints that
keep "not assessed" whole. On the dev database a digest of every rating and override was identical before, after
`db:rollback` and after `db:migrate`. Rollback refuses, with counts, while any row has no level.

**Seeded fault** (`27f49f3`, reverted in `5b34128`, history kept on the branch): `value.to_i.clamp(1, 5)` put back
into the level parser. 13 specs failed, each on its assertion (`had attributes {:ai_level => 1}`): AC-1, AC-3 (`"L3"`,
`"l3"`), AC-4 (0, 6, -1, 2.5, `""`, `"N/A"`, `"high"`, `"L3.5"`), AC-12 and the discovered-skill case. The older P0-1
specs didn't fail: their unrated skill was also never probed, so the coverage rule caught it first. Two layers.

**Checked with the real model** (Gemini, dev database, synthetic session 1: the Step 3 scenario, React partial and
two skills never probed):

| | React | Communication | System Design |
|---|---|---|---|
| Stored by the old generator | L3, override L5 | **L1** (fabricated) | **L1** (fabricated) |
| What the model answered with the new prompt | 3, 2 quotes | `null` | `null` |
| Stored now | L3, 2 verified quotes, override L5 kept | not assessed, `not_reached` | not assessed, `not_reached` |

The model followed the new prompt, and the coverage rule reached the same answer. One attempt hit a real 503: the
portfolio was marked `failed`, category `model_unavailable`, message "The AI model was unavailable or rate-limited.",
and the previous skills stayed as they were.

**In the browser** (desktop): the two skills show the dashed "Not assessed" badge and "Add rating"; React shows
L3 → L5. At 375px the page overflows sideways (header, action buttons, the override panel): that predates this
change and is AC-29, in sub-PR 5.

**Not in this change:** `FitGap::Engine` still subtracts a nil level, so fit/gap fails for a portfolio with a
not-assessed skill until sub-PR 4. The two must land together.

### Sub-PR 4: fit/gap treats "not assessed" as an unknown (P1-1, AC-13..AC-16)

**What changed** (`FitGap::Engine`): no level means `not_assessed`, with no delta or confidence, and the reason
(the skill's own, or `not_in_assessment` when the vacancy asks for a skill the interview wasn't set up to assess).
An assessor's rating counts and is flagged `is_override`. Each comparison also sends `required_level` (same value
as `expected_level`) for the web until sub-PR 5. The fallback narrative counts not-assessed skills, the narrative
prompt says they are unknowns and not weaknesses, and an unreadable narrative reply is logged by class only.

**Tests:** specs first (`bb4b797`), most failing on the `nil - expected` crash; after the fix (`054c6b9`) 9 flip to
passing, including P1-1 in the engine and end to end. API: 263 examples, 0 failures, 6 pending.

**A privacy spec that couldn't fail** (`dedee56`, AI verification moment 11): the "no model text in logs" specs fed
a reply that didn't start with the personal data, and a JSON parser error only quotes the first token. A mutation
check (the parser message put back into the log) passed when it should have failed. Both specs now start the reply
with the name, and fail with the leak put back.

**Checked with the real model** (dev, synthetic session 1 against vacancy 1):

| | Step 3 (before) | Now |
|---|---|---|
| Communication (expected L3) | candidate L1, **gap** | not assessed, `not_reached` |
| System Design (expected L2) | candidate L1, **gap** | not assessed, `not_reached` |
| Narrative | "1 skill matches, 0 exceeds, and 2 gaps" | "…remain unassessed, the candidate should advance… The upcoming round should focus specifically on probing these open areas." |

(React shows an L5 override: that's the cross-tenant write left over from the Step 3 reproduction, synthetic data.)

### Sub-PR 5: the screens show "not assessed" as an unknown (AC-20, AC-22, AC-24..AC-30)

**What changed.** Portfolio: each unrated skill says why in plain language ("Not reached before the interview
ended", "Not enough evidence to rate", "Missing from the AI's output") and suggests probing it next; a summary
line counts them and says how the interview ended, without repeating `all_covered`, which anyone with the link can
send (P1-10). Rating an unrated skill asks where the rating comes from, as the API requires (AC-20). A load failure
shows an alert with Try again (P2-1); long quotes and summaries collapse behind Show more. Fit/gap: the Required
column reads `expected_level` (P1-2), unassessed rows say why, the summary counts them apart from gaps (P2-5),
generation is requested once per visit (P1-6, web side), and after two minutes of waiting an alert with Try again
replaces the spinner. At 375px cards, headers and comparison rows stack; the app header collapses to icons.

**Tests first** (`5e30533`): new `it.fails` tests for every AC above, each run as a normal test against the old code
and failing because the feature was missing. Two existing tests changed first, each in its own commit with the
reason: the add-rating test now types a note (`342adec`), and the comparison-row helper matches the start of the
skill cell, since the cell now also holds the reason (`c40c78d`). After the change (`8e0a650`) 29 markers come off.
Web: 146 tests, 126 passing, 13 expected to fail (all outside this change), 7 opt-in skipped; `tsc` clean. API
unchanged: 263 examples, 0 failures, 6 pending.

**In the browser** (dev stack, synthetic sessions 1 and 6 to 9, Playwright against Chrome): every state at 1280px,
and portfolio, fit/gap and long text at 375px. At 375px `scrollWidth` equals the viewport on all three pages, which
closes the check left open in `8e0a650` (the Docker daemon had stopped before the header change could be seen).
The screenshots are in `report/screenshots/`. The fit/gap "generating" state was captured with Sidekiq stopped,
then Sidekiq was started again.

**Seen, not changed:** a failed portfolio still offers PDF and JSON export. It predates this work; worth a look
with the export fixes (P1-13).

### Filling the test gaps (branch `test/fill-gaps`)

**Why.** A grep for source files no test mentions listed whole pages (assessment new/edit/invite, vacancies,
transcript) and API pieces (skill library, tenant resolver, coverage analyzer worker). Coverage was then measured
once by hand, without adding gems or packages: Ruby's built-in `Coverage` around `rspec` (a gitignored hook in
`api/tmp`), and `@vitest/coverage-v8` installed with `--no-save`. Lines: API 69.7%, web 50.6%.

**What was added.** API, 30 examples: `SkillTaxonomy` validations and endpoints; `TenantResolverMiddleware` (JWT
claim, then header, then Referer; an unknown scheme falls back to organization 0 when it exists); the coverage
analyzer worker (updates scoped to the session, discovered skills deduplicated and capped at ten, stale partials
auto-advanced unless touched this turn, the published message, ended sessions and failures). Web, 32 tests:
`LevelRadio`, `SkillPicker`, and functional tests for creating and editing an assessment, inviting candidates,
vacancies and the transcript. Every new test was checked against a fault: three faults put into the worker and
middleware were each caught, then reverted.

**What they found.** Nine new `it.fails` markers, each run as a normal test and failing on its own assertion:
P1-14 (removing a skill on an edit form keeps it; an API request spec shows `_destroy` would work), P2-14 (duplicate
`LevelRadio` ids), P2-15 (the picker drops `skill_id`), P2-16 (required fields fail silently), P2-17 (edit and invite
pages hide a load failure), and P2-6 again on the vacancy list. Not tested, recorded as P3: the half-built roles, the
unrouted `SignupPage`, the unmounted `AuthTokenMiddleware`.

**Result.** API 293 examples, 0 failures, 6 pending (71.6% of lines). Web 178 tests: 149 passing, 22 expected to
fail, 7 opt-in skipped (68.3% of lines). What's left uncovered is mostly the audio path, which needs a live model.

### Sub-PR 6: passwords and personal data out of the request log (P1-7)

**What changed.** `filter_parameter_logging.rb` adds Rails' default list (passwords, emails, secrets, tokens, keys)
plus `assessor_notes` and `candidate_name`, which are personal data under UU PDP. Matching is by partial name, so
`:token` also covers `invite_token` and `auth_token`.

**Tests first** (`1305216`): four request specs send a real request (login, override with notes, invite with a
candidate name, the invite link) and check `request.filtered_parameters`, the hash Rails writes to the log. All four
failed on their filter assertion before the fix. The fix (`4f844a1`) takes them and the older config spec off
`pending`.

**On the dev stack:** a login with a made-up password logs `[FILTERED]`, and the password appears nowhere in
`development.log`. Lines written before the fix are still there; the log is local and gitignored.

### Sub-PR 7: one fit/gap job per report (P1-6, server side)

**What changed.** A reversible migration adds `generation_status` (`generating` or `complete`, existing rows become
`complete`) and `requested_at` to `fit_gap_reports`. The first request inserts a `generating` row, then queues the
job; the unique index on (portfolio_id, vacancy_id), the one that made concurrent jobs crash, is now the lock, so a
second request finds the claim and queues nothing. A claim older than ten minutes (longer than a job and its two
retries) belongs to a job that died, and the next request takes it over with a conditional update only one caller
can win. Regenerate and a new override reuse the row instead of deleting it, so asking twice queues one job. Show,
JSON export and PDF only read complete reports, so the web still gets 404 while it polls: no web change.

**Tests.** The P1-6 spec, pending since Step 3 (`expected: 1, got: 2`), now passes. Four more were written with
the fix, not before it, so they were not checked against the old code: the claim stays hidden until the job writes
the report, a stale claim is taken over, repeated regeneration queues one job, and of two claims only one wins.
API: 301 examples, 0 failures, 4 pending (P1-10, P1-13 ×2, P2-3). Web unchanged.

**Seen, not changed:** if an override lands while a job is already running, the claim is held, so no second job is
queued and the running one may have read the skills before the override. The next override or a regenerate fixes
it; a version counter on the claim would close it.

**Disk full mid-change.** C: ran out of space while the migration was dumped, and `schema.rb` was written with a
garbled `sessions` table, plus a test-DB dump that rewrote an unrelated check constraint. The suite refused to load
it (`SyntaxError` in `schema.rb`). Rebuilt from the committed file plus the three fit/gap lines; the test DB
loads from it, and the dev DB was already migrated. Temp files older than a day were cleared to make room.

### Sub-PR 8: tenant isolation, route by route (branch `test/tenant-routes`)

**Why.** The isolation spec from sub-PR 1 pinned the routes P0-2 broke. Transcript, coverage, ending a session,
regenerating a portfolio, and editing or deleting assessments and vacancies weren't in it, and nothing would notice
a new route added without scoping.

**What was added.** `spec/requests/tenant_routes_spec.rb`, 30 examples. Company B calls each of the 19 routes that
take a company A record with A's ID in the URL or the body: each must answer 404 and leave A's rows (every column)
and the job queue as they were. Lists must leave A out; creates land in B even when the body sends A's `tenant_id`;
B's own assessment and vacancy can't reach A's nested skills, and B's portfolio can't be run against A's vacancy,
for fit/gap or the PDF. One example walks `Rails.application.routes`: a route with no case, or a case for a route
that's gone, fails it. Five routes are listed as open, each with its reason (login, the shared skill library, the
two candidate-link routes).

**Result.** No route leaks: every case passed on the first run, so there was nothing to fix. To show the spec can
see a leak, two faults were put in and reverted: an unscoped `Vacancy.find` failed show, update and destroy, and an
unlisted route failed the route check. API: 331 examples, 0 failures, 5 pending.

**Pinned, not fixed (C2).** Login takes the company from the `X-Tenant-Scheme` header, and a user belongs to no
company, so any admin can sign in to company A and read its data (the pending case gets 200 where it expects 404).
Fixing it needs a user-to-company link in a database shared with `rakamin-api` (C3): a data-model and product
decision for the Tech Lead, not a scoping fix.

### Sub-PR 9: production guards, and a login company set on the server (branch `fix/production-guards`)

**Why.** Two items from [07-next-steps.md](07-next-steps.md) need no one's decision: refusing the free model tier in
production (1.1), and a mitigation for C2 until users belong to a company.

**What changed.**
- **Login** (`authentication_controller.rb`): with `LOGIN_TENANT_SCHEME` set, the token always carries that company,
  and a login whose `X-Tenant-Scheme` names another one is refused with the same answer as a wrong password. Without
  it (development, tests), nothing changes.
- **`ProductionGuards`**: production refuses to boot unless `GEMINI_TIER=paid` and `LOGIN_TENANT_SCHEME` is set, and
  names every missing setting at once. The sample config documents both.
- **Production boots for the first time.** `config/environments/production.rb` set `config.active_job.queue_adapter`,
  but the app doesn't load Active Job. Since the initial import, `RAILS_ENV=production` crashed with `NoMethodError`
  before serving anything. Nothing uses Active Job (jobs are Sidekiq workers), so the line is gone.

**Tests.**
- Two login specs were pinned first (`beb7f12`) and checked to fail on their assertion.
  - The first draft of one of them passed against the old code: the server-set company happened to be the first
    organization, which the old fallback picks anyway. It now uses a later row.
- `production_guards_spec` (4 examples) was written with the code.
- `production_boot_spec` (2 examples) boots the app in production in a subprocess. Against the old config both
  examples fail on the `active_job` crash. Now the app boots with the settings, and refuses to boot without them.

**Still open.** C2 itself: users belong to no company, so a deployment serves one company. The tenant-routes C2 spec
stays pending. Where membership lives is a Tech Lead decision (next steps 1.3).

**Also found.** An exploratory command printed the local `api/config/application.yml`, including the Gemini key, into
the session's tool output. Nothing was committed or pushed; rotate the key if the transcript is shared.

### Sub-PR 10: E2E in a real browser, at 1280px and 375px (branch `test/e2e-playwright`)

**Why.** The screenshots in the report came from a Playwright script lost with an old scratchpad, using synthetic
data that existed in one local database. 375px was checked by eye, because jsdom has no layout.

**What was added.**
- **`rails e2e:seed`** (`api/lib/tasks/e2e.rake`): one assessment, one vacancy and a session for each screen state
  (mixed, all assessed, failed, generating, long text). The fit/gap report is generated by the real engine, with its
  counted fallback instead of a model call. It refuses to run in production; a second run changes nothing (checked
  by counting rows).
- **Playwright 1.63.0** (`web/e2e`), 7 tests run at 1280px and at 375px with phone emulation:
  - each test checks what the screen shows, and that nothing is wider than the screen;
  - sign-in happens once (`global-setup.ts`), because the API allows five logins a minute;
  - the endpoints are warmed up first, because the dev API's first request to a controller outlasted a test's wait;
  - the waiting fit/gap state answers its two API calls in the test, because asking for a real report would queue
    a model call.
- **`npm run e2e:screenshots`** regenerates the report's ten screenshots under their existing names.
- **CI job `e2e`:** the built web app (`vite build` + `preview`) against the API in development mode, with no
  Sidekiq. It uploads the Playwright report, the screenshots and the server logs.

**Tests.** 14 passed locally. The width check was shown to fail on a planted fault (a 600px table at 375px), after a
first version that couldn't fail (verification moment 14).

**On GitHub.** The `e2e` job passed on its first run. The same push showed the API job red since sub-PR 9:
`production_boot_spec` ran `bin/rails` directly, which is stored without its executable bit, so Linux refused it
("Permission denied"). It only ever ran in Docker, where the bind mount reports every file as executable, and the CI
result of sub-PR 9 wasn't checked after its push. Fixed on sub-PR 9's branch (`fd6f34a`, run through `Gem.ruby`)
and merged forward.

### Sub-PR 11: the login error shows, and the password can be revealed (branch `fix/login-feedback`)

**Why.** Signing in on the dev stack with a mistyped password only refreshed the form, with no message. The API was
fine: the right password got 200, a wrong one 401.

**What changed.**
- **`api.ts`**: the response interceptor sent every 401 to `/login` with a full reload, including a rejected login,
  so the form's "Invalid email or password." was gone before it rendered. The login request is now left to the form.
- **`LoginPage.tsx`**: an eye button (lucide `Eye`/`EyeOff`) shows or hides the password. It is a `type="button"`,
  so it doesn't submit, and carries "Show password"/"Hide password" plus `aria-pressed`.

**Tests.** The toggle test was committed first (`ea1300b`) and failed on the missing "Show password" button. The
reload has no test: jsdom doesn't navigate when `location.href` is set, which is why the existing wrong-password test
passed with the bug in place. Checked instead in headless Chrome against the dev stack: with a wrong password the
message shows and the page loads once (no reload), and the eye button switches the field to `type="text"`.

### Sub-PR 12: accessibility checks (branch `test/a11y-axe`)

**Why.** "Poor UI/UX" is a disqualifier, AC-30 (keyboard and screen reader) was checked by hand, and P2-8 (assessment
cards that can't be reached with a keyboard) was still open.

**What was added.**
- **axe** (`@axe-core/playwright` 4.13.0) on every E2E page at both widths, plus login, the assessment list, the
  invite page and the vacancy list. It fails on serious or critical WCAG 2.1 A/AA violations. A rule can only be
  skipped through `KNOWN_A11Y_DEFECTS`, each entry tied to a finding.
- **Keyboard specs:** Show more; an Add rating filled in up to Save, without pressing it (a save would queue a model
  call); and opening an assessment from the list.

**What it found, pinned first (`4a91b24`), then fixed.**
- **P2-18, contrast.** The primary teal, darkened from the brand `#01959f` to `#007780`: white on it goes from 3.55
  to 5.09:1, and it on its own tint from 3.28 to 4.61. Red becomes red 700 (3.76 to 6.47). The 12px green and amber
  status text moves to the 700 shades (3.18-3.29 to 5.02). The level labels lose their 70% opacity (2.82-3.47 to
  4.58-8.23). Every ratio was computed before the change, not guessed. Changing the brand teal is a design decision;
  the user approved it.
- **P2-19, no accessible name.** The vacancy picker, and the icon-only back arrows on nine pages, now have one.
- **P2-8.** The assessment card is a link: reachable with Tab, opened with Enter, announced as a link, and it can be
  opened in a new tab. Its `test.fail()` marker comes off in the same commit.

**A test that failed for the wrong reason.** At 375px the keyboard rating test failed on `toBeChecked`: with touch
emulation, arrow keys move focus in the level picker but don't select. It now presses Space, which selects a radio on
every device, and checks the focus first.

### Sub-PR 13: coverage and security scans in CI (branch `ci/coverage-security`)

**Why.** Coverage had been measured once by hand, and nothing scanned the code or the dependencies (gaps 6 and 7 in
[testing.md](testing.md)).

**Coverage.**
- **API:** SimpleCov 1.3.2 runs when `COVERAGE=1`: **62.1%** of lines.
  - This replaces the hand measurement (71.6%), which used Ruby's `Coverage` module over a narrower set of files, so
    the two don't compare directly.
- **Web:** `@vitest/coverage-v8`, newly declared in `package.json` (it had been installed with `--no-save`):
  **68.5%** of lines.
  - The first run left out 3 test files: their workers timed out on the busy machine. The figure is from a re-run
    with two workers, where all 24 files ran.
- **CI floors:** 61 and 67, a point under the measured coverage. They aren't targets: the suite fails if coverage
  drops.

**Security scans** (CI job `security`).
- **Brakeman 8.1.0:** no warnings in the code. Its one warning is that Rails 7.0 is end-of-life; it's ignored in
  `config/brakeman.ignore`, with the reason.
- **bundler-audit 0.9.3:** **147 advisories in 20 gems** (nokogiri alone has 88).
  - **Patch updates:** rack, nokogiri, loofah, crass, rails-html-sanitizer, websocket-driver, concurrent-ruby, faraday,
    json, mail, msgpack, net-imap.
  - **Minor updates:** jwt (3.1 → 3.3), and mcp, which only RuboCop uses.
  - **What's left:** 14 advisories, all needing a major upgrade (Rails 7.0, puma 5). Each is in `.bundler-audit.yml`
    with its reason; 9 can't be reached in this app.
  - **The first update overshot.** `bundle lock --conservative` moved json up a major version (2.19 → 3.1), faraday
    a minor version, and RuboCop too. Redone with `--patch --strict`, plus `--minor` for jwt and mcp only.
  - **Release dates:** net-imap 0.6.8 was 6 days old, so it's pinned to 0.6.7, the newest release at least two weeks
    old.
  - **No local advisory database:** the API container has no `git`, so bundle-audit couldn't fetch it there. It was
    cloned on the host into `api/tmp` (gitignored); CI fetches its own.
- **npm audit:** 0 vulnerabilities in production dependencies (CI fails on high or critical). Build and test tooling
  has 7, reported without failing.

**After the update.** API 340 examples, 0 failures, 5 pending, unchanged.

**One exception to the two-week rule.** `@vitest/coverage-v8` 5.0.5 is 3 days old, but it must match the installed
Vitest 5.0.5 exactly, and both are released together from the same repository.

**A flaky spec found later.** A full run failed once on the invite-link rate limit (31 lookups, expecting a 429).
The throttles count per clock minute, and on the slow machine the 31 requests crossed into the next minute, so the
count split. The rate-limit specs now run with the clock frozen (`f526833`).

### Sub-PR 14: the PDF export works for overridden portfolios (P1-13, branch `fix/pdf-export-encoding`)

**Why.** Download PDF failed on a portfolio in the dev stack with two overridden skills:
`Prawn::Errors::IncompatibleStringEncoding`. Prawn's built-in fonts only cover Windows-1252, and the override line
used `→`. A candidate quote with characters outside that set fails the same way.

**Pinned first (`990effd`).** Besides the two crash pins from Step 3, two more pending specs: the override line reads
`Level: L3 (AI: L2 -> Override: L3)  |  Confidence: Medium`, and a quote keeps its Windows-1252 punctuation (curly
quotes, dash) while only the characters the font can't show become `?`.

**The fix (`ae52a76`).** The override line uses `->`. Every string from people or the model (assessment and skill
names, summaries, quotes, notes, the vacancy title, fit/gap labels and narratives) goes through `plain()`, which
encodes to Windows-1252 with `?` for what doesn't fit. The JSON export is unchanged. An embedded UTF-8 font would show
everything; the user decided that isn't needed.

**Checked.** With the replacement changed to an empty string, the punctuation spec fails; reverted. The dev
portfolio now exports (a 10 KB PDF). API 342 examples, 0 failures, 3 pending.

**Found later.** The fix didn't reach the dev stack at first: the API container doesn't reload Ruby code changed
from the Windows checkout, so the next click still got a 500. A restart fixed it; checked over HTTP (portfolios 9 and
14, 200 `application/pdf`).

### Sub-PR 15: the audio proxy, under test (P2-20, branch `test/audio-websocket`)

**Why.** `AudioWebSocketMiddleware` (800 lines) sits between the candidate's browser and Gemini Live and decides who
may connect, what the model hears, how turns are saved and every way an interview ends. No test touched it; the
report listed "the audio path" as what's left.

**How it's tested (`faa77af`).** Two doubles in `spec/support/audio_socket_doubles.rb`: a browser socket that records
what it's sent, and a Gemini client whose callbacks the spec calls the way Gemini would. EventMachine timers are
collected instead of scheduled and fired by hand, and the background threads run inline, so a spec can say "two
minutes pass" and see the database. 40 examples:
- **Who may connect:** an invite link; an assessor's token for their company; refused with a message the page can
  show for an unknown link, no credentials, a link for another session, an ended session, and another company's
  assessor (as "not found").
- **The interview:** the AI opens a new interview but not a resumed one; the echo gate; transcripts saved,
  numbered on from the saved transcript, and kept free of the coverage map and time signals sent to Gemini; the
  coverage map sent once per change; End.
- **When things go wrong:** reconnects with backoff 1, 2, 4 seconds and the latest token, then the session ends as an
  error; GoAway; the time warnings (each sent again if Gemini didn't take it) and the ceiling; the two-minute grace
  after the browser leaves; the AI closing in Indonesian when Gemini never ends its turn.

**What it found: P2-20.** The proxy told microphone audio from control messages by the first byte: a frame starting
with `{` (0x7B) was parsed as JSON, failed, and was dropped without a log line, about one frame in 256. Pinned as
pending, failing on its assertion (`got: []`). Fixed in `a6273ad`: Faye gives binary frames as BINARY strings and text
frames as UTF-8, so the frame type decides. Checked first in the library source (websocket-driver 0.8.2 defaults to
BINARY strings).

**Checked.** API 382 examples, 0 failures, 3 pending. Line coverage 62.1% → 77.8% (the middleware alone: 83.6%), so
the CI floor goes from 61 to 76, a point under as before. A first measurement read 14.1% for the middleware: the
API container had been restarted mid-run, which killed it and left a partial result; re-run in full. A full run logs "Sidekiq connecting to Redis"; the existing
EndHandler spec logs the same, and jobs still go to the in-memory array (`Sidekiq::Testing.fake!`).

### Sub-PR 16: Rails 7.0 → 8.1 (branch `chore/rails-8-upgrade`)

**Why.** Rails 7.0 left support on 2025-04-01; twelve of the fourteen advisories sub-PR 13 had to skip were in Rails.
The plan in `07-next-steps.md` was one minor version at a time.

**How.** 7.0 → 7.1.6 → 7.2.3 → 8.0.5.1, the suite green before each commit; only 7.1 needed a code change
(`show_exceptions = false` became `:none`, the same setting). `load_defaults` moved last, in its own commit, after
checking the 7.1–8.0 default changes against the code: no app code loaded via `$LOAD_PATH`, no `Rails.cache`,
encryption, signed IDs or ActiveJob. Rack stays 2.2, so the WebSocket middlewares see the same hijack API. Dev server
checked: login 200, `/api/v1/assessments` 200, WebSocket upgrade 101.

**What CI found.** The first run failed two jobs, both for good reasons:
- **Brakeman:** 8.0's support ends 2026-11-07. Ignoring it would have swapped one end-of-life for another, so the
  upgrade went on to **8.1.4**, with `load_defaults 8.1` (the API has no redirects; JSON no longer escaping
  U+2028/2029 only matters for JSON inside HTML).
- **E2E: `e2e:seed` found no company.** The migrations put `organizations` in `public` (it's created before the
  `ai_interview` schema exists) and every other table in `ai_interview`, and `schema.rb` couldn't record that. The
  7.0 dump built every table in `public` on a fresh database; the 8.0 dump starts with `create_schema "ai_interview"`
  and built every table there. The seeds write `public.organizations`, `Organization` read the empty
  `ai_interview.organizations`. The specs didn't notice because factories go through the model. Rails 8.1 dumps
  schema-qualified names, so `schema.rb` (dumped from the dev database: same columns, indexes and foreign keys) now
  builds the migrated layout. Checked by running CI's E2E database step on a scratch database (`DATABASE_URL`,
  which also keeps Rails off the test database), then dropping it.

**Checked.** API 382 examples, 0 failures, 3 pending, no deprecation warnings; coverage 77.78%; `zeitwerk:check`;
Brakeman no warnings, empty ignore file; `bundle-audit` no vulnerabilities, two puma ignores left. CI green on all
four jobs. Left: puma 5 → 7 (`07-next-steps.md`).

### Sub-PR 17: invite links open the web app (P1-15, branch `fix/invite-url`)

**Found.** The user opened an invite link copied from the Invite page, `http://localhost:3001/interview/…`, and got a
404. Port 3001 is the API; the interview page is in the web app (5173). `Session#invite_url` builds the link from
`APP_BASE_URL` and falls back to the API's address, and `api/README.md` described the variable as the "backend base
URL", so a setup that follows the README breaks every link an assessor copies. CI never saw it: the E2E job sets
`APP_BASE_URL` to the web app. Production would boot without it and send every candidate to localhost.

**Pinned (`fab8560`).** Three pending specs, each failing on its assertion: the default (got `localhost:3001`), a
trailing slash (got `//interview/`), production guards (nothing raised). The guard and boot specs' "ready" settings
gained `APP_BASE_URL` in a commit of its own (`36f252a`); it was ignored until the fix, so they pass before and after.

**Fixed (`11681b6`).** The default is the web app (`http://localhost:5173`), a trailing slash is dropped, and ProductionGuards
refuses to boot without `APP_BASE_URL`. README corrected. The local `application.yml` (gitignored) now points at
5173; the dev link for session 16 checked after a restart.

**Checked.** API 386 examples, 0 failures, 3 pending; coverage 77.80%.

### Sub-PR 18: the login page, designed for phones first (branch `feat/login-mobile`)

**Why.** At 375px the login page was a plain centred form touching the screen edges; it's the first screen every
assessor sees.

**What.** A deep-teal header with five level bars (L1–L5: the rubric's levels, drawn like the interview's voice
meter, L5 in Rakamin yellow) that breathe unless reduced motion is asked for, and the form on a sheet over it; side
by side in one card from `md` up. 48px fields and button, 16px text (no zoom on iOS), the error in a
`role="alert"` box, and a line for candidates who land here. New token `--primary-deep` (#003F44): white on it 11.7:1,
the dimmest header text 5.2:1. No web font, so no third-party request. Labels and button names unchanged, so the tests
find the same elements. Checked at 375px (empty, with the error) and 1280px; CI green, axe included.

**A count to correct.** The commit message gives the web run as 137 passed, 19 expected fail: that local run had
silently skipped three test files (vitest on Windows sometimes collects nothing from a file and still reports
success). A full run is 150/22/7, as before; CI ran the full suite.

### Sub-PR 19: the hardware check shows every result (P2-21, branch `fix/hardware-check-order`)

**Found.** The user's invite page showed "Internet: Failed" (upload 2.17 Mbps, minimum 4) with Microphone and Audio
output stuck on "Waiting". The checks were a chain, each started only when the one before passed, so a candidate
with a failing connection couldn't learn whether their mic worked. A blocked mic likewise skipped audio output, which
doesn't need it.

**Pinned (`184f183`, `b9ba0f5`).** A component test with the speed test, `getUserMedia` and `AudioContext` faked: a
baseline (all pass, Start enabled) and two `it.fails` pins, each failing on its assertion (still "Waiting"). The
baseline first flaked: Start is enabled one render after the last "Passed" (the component sets "all passed" in an
effect), so it waits for the button; three runs in a row stable.

**Fixed (`bee010c`).** The device checks run whatever the connection result, and audio output whatever the mic
result; Start still needs every row. Checked in the dev stack with Chrome's fake microphone: Internet failed,
Microphone passed (the level meter moves), Audio output passed, Start disabled. Web 153 passed, 22 expected fail,
7 skipped.

**The upload minimum, 4 → 1 Mbps (the user's decision).** The 4 Mbps minimum was about 16 times what the interview
streams (16 kHz mono PCM, 256 kbps) and failed the user's 2.07 Mbps connection, so they couldn't reach the interview.
1 Mbps leaves about four times the stream. Pinned first (`it.fails`; unmarked: "expected 4 to be less than or equal
to 1"), then lowered. Still left: the upload test times a POST to httpbin.org (P1-12) while the download test runs,
so it measures that service and a shared line rather than the candidate's upload; and the 8 Mbps download minimum is
as generous against the 24 kHz playback stream (384 kbps). Tech Lead: measuring against our own server.

**Also found: page loads took 20+ seconds locally.** Not the app: Windows "Automatically detect settings" (WPAD) is
on and unanswered, so every new browser connection to localhost waited about 20 s before the request was sent.
With proxy detection skipped (`--no-proxy-server`) the invite page loads in 1.4 s from the Docker web container. A
first guess (the Docker bind mount) was wrong; running Vite on the host gave the same 26 s, and per-request timing
showed the delay sat before the request, even for the API's `/health`.

### Sub-PR 20: the live interview, redesigned (branch `feat/interview-room`)

One voice stage instead of "Listening..." and "You're speaking" shown at once (teal while the interviewer speaks,
yellow on the candidate's turn, `aria-live`), a deep-teal strip with role and timer, a transcript that fills the
height and follows the newest turn (it didn't), a 56px mute button, and one notice per reconnect instead of two.
Previewed with Playwright standing in for the API and the audio WebSocket (`routeWebSocket`), so no paid interview
was needed. CI green.

### Sub-PR 21: the portfolio page stops waiting (P2-22, branch `fix/portfolio-wait-timeout`)

**Found.** A portfolio page sat on "Generating portfolio..." for five hours. The Sidekiq container had exited: the
Rails upgrade (sub-PR 16) ran `bundle update` inside the running api container only, and Sidekiq, a second container
from the same image, couldn't find Rails 8.1.4 when it restarted. The gems live in the image, so the api would have
broken the same way on its next recreate. Fixed in the environment, not the code: `docker compose build api`, then
both containers recreated; Sidekiq worked off the five-hour backlog (three portfolios, one job failing on a Gemini
503, P2-3, while a duplicate succeeded). Lesson: after a `Gemfile.lock` change, rebuild the image.

**The product gap it showed.** The page polled every 5 s with no limit and promised "about 2 minutes", so a stalled
job meant a spinner forever. Pinned (`it.fails`; unmarked: no `role="alert"`), then fixed: past three minutes of
waiting the page stops polling and says it's taking longer than expected, with "Check again". Three, not the fit/gap
page's two, because generation took 61–69 s here and a 503 plus a Sidekiq retry can pass two. Web 155 passed,
22 expected fail, 7 skipped. Left: nothing on the server marks a job that never runs as failed.

**Checked and dropped: "the interviewer reads the coverage map aloud".** The dev log showed 23 AI turns whose
transcription began `[COVERAGE MAP: {"skills": ...`, and I first told the user candidates were hearing it. Audio per
word says otherwise: leaked turns carry 1.10 audio chunks per real word, normal turns 1.52; a spoken JSON blob would
push that far up. So the JSON is in Gemini's output transcription only, and the sanitizer from sub-PR 15 already
keeps it off the screen and out of the database (0 of 29 saved AI turns contain any). Left as cosmetic: the prompt
tells the model to ignore messages starting "[COVERAGE MAP" while the injector sends "[COVERAGE_MAP]".

**Also from the same interview, not fixed:** the candidate heard nothing although the proxy forwarded the AI's audio
(32 and 31 chunks); a Playwright probe with Chrome's normal autoplay policy plays it (context running, 32 sources
started), so the likely cause is the device (output device, muted tab), which the hardware check can't catch: its
audio-output test is a 0.1 s tone at 1% volume that passes whenever nothing throws. Gemini also heard almost nothing
from the candidate ("que"), so the proxy forced about 20 reconnects for silence.

### Sub-PR 22: proctored interview setup (branch `feat/proctoring-setup`)

**Asked for.** On the invite page: enable camera, screen share and microphone; a notice not to turn off camera or
screen sharing and to share the entire screen, not a tab or window; Chrome only.

**Decided with the user first** (each changed what gets built): camera and screen must stay on but are **not
recorded** (recording needs storage, retention and legal sign-off); if either stops, the interview **pauses** until
it's back (sub-PR 23); **Chrome on a computer only**, since phones can't share their screen; and it's a
**per-assessment setting**, off by default, so voice-only interviews on phones keep working.

**Built.** `assessments.proctoring_required` (reversible migration; returned to the candidate page). The forms get
the switch with its consequence spelled out. The invite page, when it's on: a Chrome-on-a-computer gate (brand list
from User-Agent Client Hints first, so Edge, Opera and Brave, whose user agent is Chrome's, are told apart; phones
refused); camera and entire-screen steps, refusing a tab or window from Chrome's `displaySurface`; the notice says
plainly that both are only checked, never recorded; an "I understand" box; Start held back until all are done. The
page holds the streams so they last into the interview. Found on the way: a page without `navigator.mediaDevices`
(served over plain http) threw in the hardware check's mic step and stayed "Checking..."; it now fails the mic.

**Checked.** API 388/0/3; web 170 passed, 22 expected fail, 7 skipped (27 files). In the dev stack with real Chrome
(fake camera, auto-selected entire screen): Start disabled until the box is ticked, then enabled; an emulated
Android phone gets the gate. A first script run said the phone wasn't gated: `isVisible()` doesn't wait, and it ran
before the page had loaded; the screenshot showed the gate.

**For Legal (UU PDP).** Camera and screen are personal data even unrecorded; the notice wording is engineering's
draft and belongs with the consent step (07, item 1.2).

### Sub-PR 23: a proctored interview pauses when the camera or screen share stops (branch `feat/proctoring-pause`)

**Built.** During a proctored interview the page watches the camera and screen-share tracks; when one ends (Chrome's
"Stop sharing" bar, a camera unplugged or its permission revoked) the interview pauses: the mic goes off, a dialog
says what stopped and offers to turn it back on, the timer keeps running. Every path that turns the mic on (the
candidate's turn, a reconnect, the mute button) now checks the pause, and resuming turns it on only if it's the
candidate's turn and they hadn't muted it themselves. The page reports each stop and resume once over the
interview socket; the server keeps only the four known events, at most 200 per session (the browser is the
candidate's), in `sessions.proctoring_events` (jsonb, reversible migration). The assessor's portfolio page says
whether both stayed on, or how often and how long each was off ("The camera was off twice (1 min 20 s in total)"),
and nothing for an assessment that didn't require it.

**Checked.** Specs first, red on the missing methods: model (known events only, the cap, the sums, a repeated stop
counted once, an unresumed stop running to the end), the proxy, the session endpoint. In the dev stack with real
Chrome and a fake server: ending the screen track during the candidate's turn paused the interview and sent
`screen_stopped` once; "Share your entire screen again" re-shared the entire screen, closed the dialog and sent
`screen_resumed`. API 395/0/3. Web 176 passed, 22 expected fail, 7 skipped (28 files); in one full run three
existing vacancy and invite tests timed out under load (15 s each) and passed on their own.

**Limits.** Only what the page sees: a candidate who covers the camera or switches windows on a shared screen
isn't caught, and a modified page could send nothing. The record says what the page reported, nothing more.

### Sub-PR 24: the hardware check and the timer, reviewed (P2-23, P2-24, P2-25, branch `fix/hardware-check-lifecycle`)

**Asked for.** A check of `HardwareCheck.tsx`, `hardwareUtils.ts`, `internetSpeedTest.ts` and `InterviewTimer.tsx`.

**Found and fixed** (each pinned with `it.fails` first, failing on its assertion):
- **P2-23, Retry stuck.** Proven with a throwaway test before reporting it: after Retry, "OS & browser" stayed
  "Checking..." and the speed test ran once. Each run now has a number; Retry stops the last run's streams and
  starts a new one, and late results from an older run are dropped.
- **P2-24, the mic left on.** The check's stream and its meter loop were never stopped. Now stopped when the check
  goes away or reruns; the tone's AudioContext closes after it plays. In Chrome: the check's stream is `ended` once
  the interview starts, and only the capture stays live.
- **P2-25, the timer stopped while reconnecting.** It now counts while reconnecting, as the server's ceiling does,
  and still stops while the interview wraps up.

**Found, not fixed** (in the PR): the timer restarts from the full time when an active interview is reopened (the
candidate endpoint has no `started_at`) and counts down tick by tick, so it drifts and slows in background tabs;
the download test can be served from cache on its second and third runs (`no-cache` revalidates; `no-store`
wouldn't); the upload test times httpbin echoing the payload back, so it counts a download too; "OS & browser"
always passes; "Audio output" can't tell whether anyone heard the tone.

Web: 180 passed, 22 expected fail, 7 skipped (29 files).

### Sub-PR 25: a portfolio fails only when Sidekiq stops retrying (P2-26, branch `fix/portfolio-retry-status`)

**Seen.** Session 18's portfolio page said "Portfolio generation failed. The AI model was unavailable or
rate-limited." The Sidekiq log showed Gemini answering 503 (overloaded, not a 429 rate limit), and **two** jobs for
the same session, 28 seconds apart, each retrying three times before Sidekiq gave up.

**Cause.** The generator marked the portfolio failed on the first error, while Sidekiq still had three retries
scheduled. The page then showed "failed" with Retry, and Retry queued a second job beside the first.

**Fixed** (pinned `pending` first; each pin was run unmarked and failed on its status assertion):
- The worker runs the generator with `mark_failed: false`: a failed attempt stays "generating" and records only the
  error category. The worker's retries-exhausted hook, which already wrote "failed" with a safe message, is now the
  only place a job's portfolio becomes "failed".
- `regenerate` claims the portfolio with one conditional UPDATE, so two Retry clicks queue one job.
- Two existing journeys expected "failed" straight after one attempt; they now play Sidekiq running out of retries
  (own commit, with the reason).

**Caught on the way.** The first version of the claim also set `updated_at`, which `portfolios` doesn't have: the
new specs got a 500, not a 422. The functional pin first read the status from the `portfolio` key, which a
generating portfolio doesn't return (202 with only `status`); corrected, and checked to still fail on the old code.

**Not done.** A 503 isn't retried inside `Gemini::HttpClient` with a short backoff, so a brief overload still costs
a Sidekiq retry (15 s or more). While retries run (about two minutes for quick 503s), the page shows "generating";
past three minutes it offers "Check again" (sub-PR 21).

API: 398 examples, 0 failures, 3 pending.

### Sub-PR 26: the interview ends honestly (P2-27, branch `feat/interview-complete-screen`)

**Redesigned first.** The closing screen was an emoji and two grey lines, in a different look from the live
interview. It now uses the same header, names the role and lists the three steps that follow: the AI drafts a skill
summary quoting the candidate, a person on the hiring team reviews and can correct it, and the team follows up. "The
interview has been recorded" became "Your answers have been saved": only the transcript is kept, and "recorded"
suggests a voice recording.

**Found while doing it (P2-27).** That screen was shown for four endings, and only one was a finished interview: a
link that doesn't exist (404), any failed load, an error the server can't recover from, and every reconnect failing.
And when the server ended the interview, the microphone stayed on: only the End button's path stopped it. Seen in
Chrome with a fake microphone and the audio socket faked (scratch Playwright run): the capture track was still
"live" under "Interview Complete".

**Fixed** (pinned with `it.fails` first; each pin was run as a normal test and failed on its assertion):
- A broken link says "This interview link doesn't work" and what to do; any other failed load says "We couldn't
  load your interview", with Try again.
- A new "interrupted" state, for a non-recoverable error or reconnects run out: "The interview was interrupted",
  with Rejoin. Rejoin reloads the page; the server keeps the interview open two minutes after the page leaves
  (`BROWSER_GRACE_PERIOD`). A non-recoverable error also stops the reconnect loop, since the server closes the
  socket after it.
- Whatever ends the interview, the microphone, playback, camera and screen share stop. Rechecked in Chrome: after
  `session_ended` and after a non-recoverable error, the track is "ended". At 375px no screen scrolls sideways.

**Not done.** Rejoin after the two-minute grace finds the interview ended and shows the closing screen, which is
true but says nothing about the interruption. A 404 means a mistyped link or a deleted assessment (invite links
don't expire); the page shows the same message for both.

Web: 189 passed, 22 expected fail, 7 skipped (32 files).

### Sub-PR 27: a proctored interview needs one screen (P2-28, P1-16, branch `feat/proctoring-second-screen`)

**Asked.** Does the proctoring catch an extended monitor? It didn't: the setup refuses a tab or a window, but a
candidate with two monitors could share one and use the other, and nothing recorded it.

**Built** (pinned first: `it.fails` on the web, `pending` on the API; each pin was run unmarked and failed on its
assertion):
- Chrome reports a second screen as `screen.isExtended` (Window Management API, no permission prompt) and fires
  `change` on `window.screen` when one is plugged in or out. The page listens, and checks every five seconds too.
- Setup: a "One screen" row and a line in the notice; Start stays disabled while a second screen is connected.
- During the interview a second screen pauses it like a stopped camera: no mic frames reach the server, the timer
  runs. There's no button; the pause lifts once the screen is unplugged. Both are reported over the interview
  socket (`second_screen_connected`, `_disconnected`).
- The API records the pair and sums it apart, as `second_screen: { connected, seconds }`; the assessor's line says
  "a second screen was connected N times (… in total)", or "Chrome saw no second screen".
- Tests of the live page with proctoring didn't exist; the device fakes moved from `interview-end.test.tsx` to
  `test/interview.ts`, with a camera, a screen share and screens added, and two tests of what already worked (the
  mic sent on one screen, the pause when the camera stops) came with the pins.

**Checked.** In Chromium 153, headless and headed: `isExtended` is there (false on this one-screen machine),
`window.screen` is an event target with `onchange`, and the `window-management` policy allows it. The setup at
1280px and 375px, with a second screen simulated (`Screen.prototype.isExtended`): the row's alert, Start disabled,
no sideways scroll. **Not checked with a real second monitor.**

**What it can't see.** A mirrored display (one screen to Chrome, and the same picture anyway), a second laptop or a
phone, another person in the room; and anyone who hides a monitor from the OS. It stops the casual case and tells
the assessor; it doesn't prove the candidate worked alone.

**Found on the way, and fixed (P1-16).** `web/vercel.json` sent `Permissions-Policy: camera=()`, which turns the
camera off for every origin: wherever that file is used, a proctored interview couldn't get past the camera step. A
test now reads `vercel.json` and checks each feature the candidate page uses (pinned first, failing on camera); the
header is `camera=(self)`. Checked in Chromium with the permission granted and a fake camera, the page served with
each header: `camera=()` gives `NotAllowedError`, `camera=(self)` a stream. Whether production serves this file at
all is still C8's open question.

**Caught on the way: P1-11 was already fixed.** Updating the report, its findings table still listed P1-11 (a broken
invite link says "The interview has been recorded") as open. Sub-PR 26 fixed it as part of P2-27, which partly
duplicates it; the duplicate was missed when P2-27 was logged. Its pin kept expected-failing only because its first
assertion guessed the wording (`/invalid|expired|not found/`); it now checks the real heading, keeps the "has been
recorded" check, and passes (own commit, with the reason).

**And P2-2.** Listing what's left showed a second duplicate: P2-2 (Step 3, "Retry while Sidekiq is still
retrying") is the defect sub-PR 25 fixed as P2-26. It had no pin, so nothing flagged it; both rows now say so. The
same pass struck CI and the migration test from testing.md's list of what's missing (both done long ago) and moved
the audio middleware out of "not testable yet".

API: 401 examples, 0 failures, 3 pending. Web: 206 passed, 21 expected fail, 7 skipped (34 files).

### Sub-PR 28: the invite link alone can't end the interview (P1-10, branch `fix/invite-link-end`)

**The gap.** `POST /sessions/:token/audio_complete` needs no login by design: the candidate page calls it with the
invite token once the closing words have played. But it ended any session as `all_covered`. Anyone holding the
link (forwarded by email or WhatsApp, links never expire: P2-10) could end a candidate's interview, live or not yet
started, recorded as fully covered, and start a model call over an empty transcript. Step 3 pinned the never-started
case; the live case, where a candidate is cut off mid-answer, got its own pin (unmarked: 200, ended `all_covered`).

**Fixed.** Only the server decides the interview is over. Before it sends `preparing_to_end`, the WebSocket
middleware records `sessions.ending_requested_at` (one helper now serves the three places that send it); the
endpoint ends only a session with that set, and otherwise answers 409 and changes nothing. A column rather than
process memory, because the HTTP call can reach a different Puma worker than the one holding the socket. If the
write fails, the page is still told and the existing poll ends the session after 30 s. The web page didn't change:
it retries on an error, and once the session has ended the endpoint answers 200.

**Checked.** The migration rolls back and re-applies on the test database. `schema.rb` carries only the new column
and the version; the dump also rewrote two unrelated check constraints (a local Postgres formatting difference),
left out. On the dev API, after a restart (it doesn't reload the changed code): a live session posted without a
request → 409, still `active`; with the request recorded → 200, ended `all_covered`. The first try, before the
restart, still ended the session and queued a portfolio job for that throwaway session; the job was removed. Not
checked: a whole interview ending by itself in the browser, since the model's daily quota was spent.

**Still open.** A link holder can still open the page, join a live interview's socket or end it as
`manual_candidate` from the page, as the candidate can; links never expire (P2-10). Closing that needs a
per-candidate secret or expiry, not just this check.

API: 404 examples, 0 failures, 2 pending. Web unchanged: 206 passed, 21 expected fail, 7 skipped.

## AI verification moments

Moments where an AI assistant's claim or reading turned out wrong or misleading, and how it was caught. These are
the raw material for the report's "AI verification moment" section.

1. **Predicted a failure that didn't happen.** Before starting the stack, the assistant predicted that `db:migrate` /
   `db:seed` would probably fail on an empty Postgres, because `database.yml` says the schema is shared with
   `rakamin-api`. **Checked:** the API logs and the seeds file. The seeds create `public.organizations` themselves,
   so the prediction was wrong. It was the Puma pid file that actually broke boot.
2. **"Up" doesn't mean running.** After the first `docker compose up`, `docker compose ps` reported the API as "Up",
   which reads as success. **Checked:** the API logs showed Puma had already crashed (finding 1.1). Lesson: verify
   with a real request, not container status.
3. **An empty queue read as "no duplicate jobs".** Checking for duplicate fit/gap jobs, the Sidekiq queue count came
   back 0. That would wrongly suggest no duplicates. **Checked:** the Sidekiq logs. All three jobs had already run,
   and two crashed with `PG::UniqueViolation` (finding P1-6). The queue is empty because the jobs were already
   consumed.
4. **Retry configuration that looks right but does nothing.** `Gemini::HttpClient` has a careful retry block for
   429/5xx. Reading the code suggests it works. **Checked:** at runtime, `Faraday::Retry::Middleware::IDEMPOTENT_METHODS`
   excludes `POST`, and every Gemini call is a POST, so the retries never fire (finding P2-3).
5. **AI-generated spec that would have "proved" a bug for the wrong reason.** *(code generation)* While writing
   the tenant-isolation specs, the assistant generated `create(:fit_gap_report_record, ...)`, a factory that
   didn't exist. The example was marked `pending`, so its failure would have been *expected*. It would have shown
   as a passing proof of the cross-tenant fit/gap leak, while actually failing on `KeyError: Factory not
   registered`. **Why it's risky:** a pending spec accepts *any* failure, so a broken setup looks exactly like
   evidence. **Caught by:** reviewing the generated code before the first run, then checking that every pending
   example fails on its assertion line with the expected values (`but it was 200`, `got: 1`, ...). **Fixed:** added a
   real `:fit_gap_report` factory, and now read each pending spec's failure message, not just the pending count.
6. **AI-generated factories that broke under `build`.** *(code generation)* The first full run had 2 failures:
   `please set Current.tenant_id`. The generated factories derived `tenant_id` from an associated organization,
   but FactoryBot's default `build` strategy doesn't save associations, so the organization had no `id`.
   **Caught by:** running the suite. **Fixed:** `FactoryBot.use_parent_strategy = false`, so associations are always
   saved, with a comment explaining why.
7. **Known-defect tests that "passed" for the wrong reason.** *(code generation)* The first web run reported 3
   expected failures, which reads as "the 3 defects are pinned". In fact every render was failing with `act(...) is
   not supported in production builds of React`: the shell's `NODE_ENV=production` made React load its production
   build. `it.fails`, like `pending`, accepts any failure. **Caught by:** reading the failure output instead of the
   summary line. **Fixed:** the Vitest config pins `NODE_ENV=test`, and each `it.fails` test was then run as a
   normal test to check its failure message.
8. **A safety check written from memory of an older library.** *(code generation)* The assistant wrote
   `server.listen({ onUnhandledRequest: "error" })`, the MSW 2 option, so that a test fails on any request it
   doesn't handle. MSW 3 renamed it to `onUnhandledFrame` and ignores the old name, so the check was off. Even with
   the right name, MSW only turns an unhandled request into a network error, which a page that swallows errors
   hides. **Caught by:** `tsc` flagging the unknown option, then a probe test showing the request was seen as
   unhandled while the test still passed. **Fixed:** the right option, plus collecting unhandled requests and
   failing the test after it. Turning the check on immediately exposed the hardware check's third-party requests.
9. **A test whose wrong expectation was hidden by the bug it pinned.** *(code generation)* For sub-PR 2 the assistant
   wrote "saves the level the assessor picked" expecting the request body `{ override_level: 2 }`. The API client
   actually sends `{ override: { ... } }`, as the existing override test already asserted. Against the old code the
   test failed earlier, on the `null.replace` crash, so the wrong expectation looked like a correctly pinned defect.
   **Caught by:** running the suite after the fix: the only test still failing was this one, on
   `expected { override: ... } to match object { override_level: 2 }`. **Fixed:** in its own commit, with the reason,
   using the existing test's stricter shape (`toEqual` on the whole body). **Lesson:** a test that fails on a crash
   hasn't had its assertions checked yet; check them again once the crash is gone.
10. **A confident comment about a testing library that was false.** *(code generation)* For the P1-4 write-failure
    spec the assistant wrote "any_instance blocks receive the record itself before the call's own arguments", and
    built the stub on it. The stub still worked, by luck: the "record" was always `nil`, and
    `raise ActiveRecord::RecordInvalid, nil` is valid. **Caught by:** a second stub written on the same belief, a spy
    on the PDF's `text` calls, which recorded `nil` for every line. **Checked:** a throwaway probe spec showed RSpec
    yields only the call's own arguments (`save!` none, `text` its string). **Fixed:** both stubs and the comment, in
    their own commit with the reason. **Lesson:** a passing test built on a wrong belief is still a wrong belief;
    probe the library when two observations disagree.
11. **Privacy specs that passed for the wrong reason.** *(code generation)* The specs that check a model's reply never
    reaches the logs fed replies like "Sure! Here is the portfolio for Budi Santoso…" and checked "Budi" wasn't logged.
    A JSON parser error only quotes the reply's first token ("unexpected character: 'Sure!'"), so the name was never in
    the message: the specs would pass with the leak in place. **Caught by:** a mutation check (put `e.message` back into
    the log, expect the spec to fail); it passed. **Fixed:** the replies now start with the personal data, and both
    specs fail with the leak put back. **Lesson:** for a "never X" assertion, show the test can see X at all.
12. **An install that broke the test suite.** *(tooling)* To measure web coverage without touching `package.json`, the
    assistant ran `npm i --no-save @vitest/coverage-v8`. The shell had `NODE_ENV=production`, so npm left out every
    devDependency and removed the ones already installed: Vitest and `@vitejs/plugin-react` were gone, and so was the
    test run. **Caught by:** the coverage run failing on `ERR_MODULE_NOT_FOUND`, and a one-file test run to confirm.
    `npm ci` alone didn't help, for the same reason. **Fixed:** `npm ci --include=dev`, with `git status` clean.
    **Lesson:** check the environment before installing anything, and run a test straight after.
13. **A failure blamed on the wrong test.** *(tests)* The full web run failed "shows the API's reason when the save is
    rejected" on an unhandled `GET /vacancies?page=1`, a request that test never makes. **Caught by:** running it alone
    (it passed). The test before it stopped at the list's heading while the list request was still in flight, so the
    request reached MSW after its handlers were reset. **Fixed:** the create and edit tests wait for the list's rows.
    **Lesson:** a test isn't done when the page appears, but when its requests have finished.
14. **A width check that couldn't fail.** *(code generation)* The first E2E check for "nothing is wider than the
    screen" compared the page's `scrollWidth` with `window.innerWidth`. A planted fault (the fit/gap table forced to
    600px) still passed at 375px. Measuring in the browser showed why: with phone emulation, Chrome zooms out to fit
    content that's too wide, so `innerWidth` grew to 634 with the page. On a real phone the user would see the whole
    screen shrunk. **Caught by:** seeding the fault before trusting the check. **Fixed:** the check compares against
    the configured viewport (375), and also flags any element that reaches past the screen's right edge, for a
    container that clips its child. The fault now fails with "the page is wider than the 375px screen: 634".
    **Lesson:** a layout check is only as good as its idea of the screen; plant the fault first.
15. **A column that doesn't exist, and a pin that read the wrong key.** *(code generation, tests)* In sub-PR 25 the
    assistant's conditional UPDATE for Retry also set `updated_at`, out of habit: `portfolios` has no such column, so
    Retry returned 500. Its new functional pin read the status from `portfolio.generation_status`, which a generating
    portfolio never returns (the API answers 202 with only `status`). **Caught by:** the full spec run (three 500s
    where 422 was expected), then reading the exception in a scratch spec, and the pin still failing after the fix.
    **Fixed:** the UPDATE sets only real columns; the pin checks 202 and `status`, and was re-run against the old
    code to confirm it still fails there on its assertion. **Lesson:** `update_all` skips the model, so check the
    schema; and a pin that fails before the fix proves only that something differs, not that it reads the right field.

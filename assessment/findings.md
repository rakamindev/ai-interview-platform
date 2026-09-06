# Review Findings — AI Interview Platform

Scope: local setup, manual walkthrough of the assessment → invite → interview →
portfolio flow, and source review of `api/` and `web/`. Each finding lists
where it lives, why it happens, what breaks, and what was changed to fix it.

Severity key: **P0** blocks a core flow for everyone, no workaround · **P1**
breaks a specific feature or blocks first-time setup · **P2** degrades the
experience but has a workaround · **P3** minor/cosmetic or dev-environment-only.

Status key: ✅ Fixed in this pass · 📝 Documented, not code-fixed (see notes).

---

## API findings

### F1 — Gemini HTTP client calls the wrong API version for preview models — P0 ✅

- **Where:** `api/app/clients/gemini/http_client.rb:5`
- **Root cause:** `BASE_URL` was hardcoded to
  `https://generativelanguage.googleapis.com/v1` (the stable API surface).
  Every Gemini model this app is configured to use
  (`gemini-3.6-flash`, `gemini-3.1-pro-preview`, …) is a *preview* release and
  only exists under `/v1beta`. Calling `/v1/models/<preview-model>:generateContent`
  returns `404 NOT_FOUND`. This was inconsistent with
  `api/app/clients/gemini/live_client.rb:10`, which already targets `v1beta`.
- **Impact:** Every feature that goes through `Gemini::HttpClient` failed —
  portfolio generation (`Portfolios::Generator`), coverage analysis
  (`Coverage::Analyzer`), and fit/gap reports (`FitGap::Engine`). Reproduced
  live: portfolio generation returned `"error": "API returned 404"`.
- **Fix:** Changed `BASE_URL` to `.../v1beta`, matching the live client.
- **Verification:** Direct `curl` to both versions confirmed `v1` 404s and
  `v1beta` 200s for the configured models; re-ran portfolio generation
  end-to-end after the fix and it completed successfully.

### F2 — Misleading default for `APP_BASE_URL` breaks every candidate invite link — P1 ✅ (config)

- **Where:** `api/app/models/session.rb:28-31` (consumer),
  `api/config/application.yml.sample:21` (misleading default/comment)
- **Root cause:** `Session#invite_url` builds
  `"#{ENV['APP_BASE_URL']}/interview/#{invite_token}"`. The route
  `/interview/:token` is a **React Router route in the web app**
  (`web/src/App.tsx:63`), not a Rails route. But the sample config comments
  it as *"App URL (for invite links)"* and defaults it to
  `http://localhost:3001` — the **API's own port**. Anyone following the
  sample literally gets invite links pointing at the Rails app, which has no
  such route (`Routing Error: No route matches [GET] "/interview/:token"`).
- **Impact:** The core recruiter-facing flow (inviting a candidate) is broken
  the moment a session is created, with no indication anything is
  misconfigured until a candidate clicks the link.
- **Fix:** Set `APP_BASE_URL=http://localhost:5173` (the frontend) in
  `config/application.yml`. `invite_url` is computed per-request from `ENV`,
  not persisted, so existing sessions self-correct — no data migration
  needed, only a redeploy/restart.
- **Note for a real PR:** the `.sample` file's comment and default should be
  corrected too (e.g. `APP_BASE_URL — the *frontend* origin, not this API`),
  since this is what a new engineer actually copies.

### F3 — Fresh database has no user that can log in — P1 ✅

- **Where:** `api/db/seeds.rb`
- **Root cause:** `User` has a real `email`/`password` login
  (`has_secure_password`, checked in
  `api/app/controllers/api/v1/authentication_controller.rb:10-14`), but
  `db:seed` only populated `organizations` and `skill_taxonomies` — zero rows
  in `users`. The seed file's own comments instructed dropping into
  `rails console` and hand-minting a JWT with `JsonWebToken.encode(...)` as
  the intended workflow, rather than provisioning a working login.
- **Impact:** A team member following the documented setup (`api/README.md`
  → `bundle install` → `db:create/migrate/seed` → `rails server`) cannot log
  into the web app at all without independently discovering the console
  workaround.
- **Fix:** `db:seed` now idempotently creates a default admin
  (`admin@test-corp.com` / `Password123!`) via `User.find_or_initialize_by`,
  and the seed's printed instructions were updated to show the `POST
  /api/v1/auth/login` call instead of the JWT-minting workaround.
- **Verification:** `rails db:seed` run twice — second run correctly prints
  "Admin user already exists (skipped)"; `POST /api/v1/auth/login` with the
  seeded credentials returns `200` with a valid token.

### F4 — Hardcoded fallback model names reference retired Gemini models — P2 ✅

- **Where:** `api/app/services/fit_gap/engine.rb:11`,
  `api/app/services/portfolios/generator.rb:11`,
  `api/app/services/coverage/analyzer.rb:13`
- **Root cause:** All three services read
  `ENV.fetch('GEMINI_*_MODEL', 'gemini-2.0-flash-001')` /
  `'gemini-2.0-pro-001'` — model IDs that no longer exist on the Gemini API.
  `config/initializers/gemini.rb:6` only enforces these env vars as
  *required* when `Rails.env.production?` — so in development and test, a
  missing env var silently falls through to a dead model name instead of
  failing fast.
- **Impact:** Any environment where the `GEMINI_*_MODEL` vars are unset
  (easy to miss — `application.yml.sample` doesn't flag them as
  security/functionality-critical) gets a working boot but broken AI
  features, with the failure surfacing only when a feature is used.
- **Fix:** Updated the fallback defaults to currently-live models
  (`gemini-3.6-flash` for flash/pro fallback, matching the "pro"-tier
  unavailability below). This doesn't replace setting the env vars
  explicitly — it just means an unset var degrades to "works with a lesser
  model" instead of "breaks silently."

### F5 — `generation_error` isn't cleared when a retried portfolio succeeds — P3 ✅ (+ test)

- **Where:** `api/app/services/portfolios/generator.rb`
- **Root cause:** The failure path
  (`rescue => e; portfolio&.update!(generation_status: 'failed',
  generation_error: e.message)`) sets `generation_error`, but the success
  path only updated `generation_status`/`generated_at` — never resetting
  `generation_error` back to `nil`.
- **Impact:** A portfolio that failed once and was later regenerated
  successfully still reported `"generation_status": "complete"` alongside a
  stale `"generation_error": "API returned 404"` in the API response —
  actively misleading for anything consuming this endpoint (frontend,
  support, a future automated retry policy).
- **Fix:** Success path now does
  `portfolio.update!(generation_status: 'complete', generated_at:
  Time.current, generation_error: nil)`.
- **Test:** `api/spec/services/portfolios/generator_spec.rb` — see
  "Seeded-fault proof" below.

### F6 — Gemini "pro"-tier models have zero free-tier quota — P2 📝 (config, not a code bug)

- **Where:** N/A — external API account limitation, surfaced via F1/F4
- **Root cause:** Even after fixing F1 (`v1beta`), `gemini-3.1-pro-preview`
  and its aliases (`gemini-pro-latest`) return
  `429 RESOURCE_EXHAUSTED` with `limit: 0` for this Google AI Studio
  project — the free tier grants **zero** requests/day for pro-class models;
  billing must be enabled to use them at all.
- **Impact:** `Portfolios::Generator` (the one service designed to use the
  "pro" tier for higher-quality reasoning) cannot use a pro model without
  billing enabled on the Google Cloud project behind the API key.
- **Resolution:** Per product decision, `GEMINI_PRO_MODEL` is set to
  `gemini-3.6-flash` for this environment so the feature works without
  billing. This is a quality/cost trade-off, not a bug fix — enabling
  billing and pointing `GEMINI_PRO_MODEL` back at a real pro model is the
  alternative path if reasoning quality matters more than cost here.

### F7 — No RSpec test scaffolding exists despite the gem being in the Gemfile — P1 📝 (partially addressed)

- **Where:** `api/.rspec` existed, but `spec/spec_helper.rb`,
  `spec/rails_helper.rb`, and every spec file were missing; `rakamin_test`
  database had no schema loaded.
- **Root cause:** `rspec-rails` is in the `Gemfile` but `rails generate
  rspec:install` was never run, and the test database was never migrated.
- **Impact:** Zero automated backend test coverage was possible in this
  repo's prior state — any "add a test for X" request had to first
  reconstruct the entire test harness.
- **Fix (this pass):** Ran `rails generate rspec:install`, loaded the schema
  into `rakamin_test` (`RAILS_ENV=test rails db:schema:load`), and added the
  first real spec (`spec/services/portfolios/generator_spec.rb`, 3 examples).
- **Still open:** only one service has coverage now. Controllers, models,
  and the other two Gemini-backed services (`Coverage::Analyzer`,
  `FitGap::Engine`) have none yet — flagging this explicitly so it isn't
  mistaken for "tests are set up now, done."

---

## Web findings

### F8 — Internet speed-test gate depends on unreliable third-party services — P1 ✅ (config)

- **Where:** `web/src/utils/internetSpeedTest.ts`
  (`measureUploadSpeed`, `measurePing`, `measureDownloadSpeed`)
- **Root cause:** Without `VITE_SPEED_TEST_*` env vars set, the hardware
  check measures upload speed by POSTing 0.5 MB to public third-party
  endpoints (`httpbin.org`, `postman-echo.com`) and ping/download via public
  CDNs (`jsdelivr`, `unpkg`, `google.com/favicon.ico`). These services are
  frequently slow or rate-limited independent of the candidate's actual
  connection. The result gates the "Start Interview" button
  (`minUploadMbps: 4` in `DEFAULT_THRESHOLDS`).
- **Impact:** Reproduced live — a connection independently verified at
  ~20 Mbps upload measured 2.41 Mbps through this check and failed,
  blocking the candidate from starting the interview on a perfectly good
  connection. This is a false negative on a feature positioned as a
  pre-interview gate, which is the worst place for one.
- **Fix:** The app already ships an escape hatch
  (`VITE_SPEED_TEST_PING_URL` / `VITE_SPEED_TEST_UPLOAD_URL`) and the API
  already exposes a same-origin endpoint for exactly this purpose
  (`POST /api/v1/speed_test`, `api/config/routes.rb:14`) — it just wasn't
  wired up by default. Set both vars to point at the local API
  (`http://localhost:3001/health` and `.../api/v1/speed_test`) in `.env`,
  and made this the **default** in `.env.example` rather than an opt-in,
  since relying on external services by default is the actual defect.

### F9 — `.env.example` pointed at the wrong API port — P3 ✅

- **Where:** `web/.env.example:2,5`
- **Root cause:** Example file used `http://localhost:3000`, but the Rails
  API serves on port **3001** by default (`api/config/puma.rb:19`,
  confirmed in `api/README.md`). Likely a leftover from a different backend
  template.
- **Impact:** Low on its own (obvious once you hit connection-refused
  errors), but compounds with F8 and F3 to make first-time setup feel
  broken in several small ways at once.
- **Fix:** Updated to `http://localhost:3001` / `ws://localhost:3001`.

### F10 — No frontend test runner configured — P1 ✅ (scaffolding + first tests added)

- **Where:** `web/package.json` — `scripts` had only `dev`, `build`,
  `preview`; no `vitest`/`jest` dependency, config, or `.test.`/`.spec.`
  files anywhere in `web/src`.
- **Impact:** No automated coverage was possible for the frontend at all
  without first standing up a test runner.
- **Fix:** Added Vitest + React Testing Library
  (`@testing-library/react`, `@testing-library/jest-dom`,
  `@testing-library/user-event`, `jsdom`). Wired into the existing
  `vite.config.ts` via its `test` block (jsdom environment, globals on,
  `src/test/setup.ts` for jest-dom matchers) so there's a single config
  file instead of a duplicate `vitest.config.ts`. Added `npm test` (single
  run) and `npm run test:watch`.
- **Tests added:**
  - `src/utils/internetSpeedTest.test.ts` (4 examples) — covers the F8 fix
    directly: asserts the module calls the local
    `VITE_SPEED_TEST_PING_URL`/`VITE_SPEED_TEST_UPLOAD_URL` endpoints when
    set and falls back to public services when unset, plus the pass/fail
    threshold logic under total network failure vs. total success.
  - `src/pages/auth/LoginPage.test.tsx` (2 examples) — happy path (valid
    login → token stored, navigates to `/assessments`) and failure path
    (rejected login → error message shown, no navigation, no token
    persisted).
  - Both suites: 6/6 passing (`npm test`).
- **Seeded-fault proof:** temporarily removed the `setError(...)` call in
  `LoginPage.tsx`'s catch block — the "shows an error message on invalid
  credentials" test failed exactly as expected
  (`findByText(/invalid email or password/i)` timed out with no match).
  Restored the line and the suite passed 6/6 again.
- **Still open:** only these two modules have coverage. `HardwareCheck.tsx`
  (the component consuming `internetSpeedTest.ts`), the axios interceptor
  in `services/api.ts`, and every other page/component remain untested —
  the harness now exists, so adding more is incremental from here.

---

## Seeded-fault proof (F5)

To confirm `spec/services/portfolios/generator_spec.rb` actually catches the
bug it targets — not just passes because it's shallow — the fix in
`generator.rb` (`generation_error: nil` on the success path) was temporarily
reverted and the suite re-run:

```
$ RAILS_ENV=test bundle exec rspec spec/services/portfolios/generator_spec.rb
.F.

1) Portfolios::Generator#call when generation succeeds
   clears a stale generation_error left over from a previous failed attempt
   Failure/Error: expect(portfolio.reload.generation_error).to be_nil
     expected: nil
          got: "API returned 404"

3 examples, 1 failure
```

The fix was then restored and the suite re-ran clean:

```
$ RAILS_ENV=test bundle exec rspec spec/services/portfolios/generator_spec.rb
...
3 examples, 0 failures
```

---

## Not codebase bugs (local environment friction, no code change warranted)

Documented here only so they aren't confused with the findings above if this
doc is reused as a review artifact:

- **DB port mismatch** — local Postgres ran on `5432`; `application.yml` was
  set to `5433` (an assumption about a shared instance that didn't apply to
  this machine). Environment-specific, not a code defect.
- **Ruby/bundler version mismatch** — the shell wasn't running `rbenv`'s
  shims by default, so `bundle` resolved to the system Ruby 2.6 / Bundler
  1.17 instead of the project's 3.3.2 / Bundler 2.5.x. Fixed by adding
  `rbenv init` to `~/.zshrc` — a machine setup issue, not a repo issue.
- **Puma cluster-mode crash on macOS** — forking 2 Puma workers
  (`api/config/puma.rb`) triggers an Objective-C runtime fork-safety crash
  on macOS dev machines (`OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES` works
  around it). Production runs this via Docker/Linux
  (`api/Dockerfile`, `api/k8s/`), where this doesn't occur — worth a README
  callout for macOS contributors, not a code fix.

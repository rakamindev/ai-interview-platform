# 03-backend-gemini-ws-seam-and-e2e-seeds

Status: resolved
Blocked by: none

## Context
Rails currently hardcodes `GEMINI_WS_URL = 'wss://generativelanguage.googleapis.com/...'` in `Gemini::LiveClient`, preventing the test environment from routing to the local Mock Gemini server. Furthermore, the test database lacks static seed data for E2E scenarios.

## Implementation Details
1. Update `api/app/clients/gemini/live_client.rb`:
   - Change `GEMINI_WS_URL` to `ENV.fetch('GEMINI_WS_URL', 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent')`.
   - In `connect`, append `?session_id=#{@session_id}` to `GEMINI_WS_URL` if `@session_id` is present, allowing mock servers to route scenarios.
2. Update `api/app/channels/audio_websocket_middleware.rb`:
   - Pass `session_id: session.id` when initializing `Gemini::LiveClient`.
3. Create `api/lib/tasks/e2e_seed.rake` (providing `rails db:seed:e2e`):
   - Clear existing E2E test data for tenant `e2e-corp`.
   - Create organization `e2e-corp` with tenant scheme `e2e-corp`.
   - Create assessment and technical vacancy with standardized B7 competencies.
   - Seed candidate sessions with dedicated tokens:
     - `e2e-token-happy-path` (status: `pending`)
     - `e2e-token-resumption` (status: `pending`)
     - `e2e-token-consent-decline` (status: `pending`)
     - `e2e-token-soft-bypass` (status: `pending`)
     - `e2e-token-live-gemini` (status: `pending`)
4. Wire `e2e/global-setup.ts` to execute `bundle exec rails db:seed:e2e` in `api/` before Playwright test execution.

## Verification
- `cd api && RAILS_ENV=test bundle exec rails db:seed:e2e`
- Verify database contains sessions for all 5 scenario tokens.

## Comments
- Updated `api/app/clients/gemini/live_client.rb` to fetch `GEMINI_WS_URL` from ENV with production default, support `session_id` and `token` parameters, and dynamically append query parameters on `#connect`.
- Updated `api/app/channels/audio_websocket_middleware.rb` to pass `session_id: session.id` and `token: session.invite_token` when instantiating `Gemini::LiveClient`.
- Implemented `api/lib/tasks/e2e_seed.rake` providing `rails db:seed:e2e` that idempotently resets and seeds `e2e-corp` organization, assessment, technical vacancy with standardized B7 competencies, and all 5 scenario candidate sessions in `pending` status.
- Created `e2e/global-setup.ts` and wired `globalSetup` and `GEMINI_WS_URL: 'ws://localhost:8080'` in `e2e/playwright.config.ts`.
- Verified via unit test suites (`live_client_spec.rb`, `e2e_seed_spec.rb`), full backend suite (29 examples, 0 failures), web Vitest suite (17 passed), and Playwright smoke execution with automated global seeding.

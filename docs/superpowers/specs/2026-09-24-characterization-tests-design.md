# Design Specification: Full-Stack Characterization Test Suite

**Date**: 2026-09-24  
**Status**: Approved  
**Topic**: Characterization Tests for AI Interview Platform  

---

## 1. Objective & Philosophy

The objective of this characterization test suite is to establish an automated, deterministic regression safety net across both the **Backend (`api/`)** and **Frontend (`web/`)** services of the AI Interview Platform.

Following Michael Feathers' characterization testing principles (*Working Effectively with Legacy Code*):
- Tests pin down the **actual existing behavior** of the system as it runs today.
- Known defects, schema splits, and contract mismatches documented in the Gap Analysis (`tech-docs/gap-analysis/GAP_ANALYSIS_AGY.md` and `FINDINGS_REGISTER_AGY.md`) are explicitly captured as baseline characterization assertions rather than papered over.
- Subsequent bug fixes, refactorings, and multi-tenant schema enhancements can proceed with immediate feedback on unintended regressions.

---

## 2. Test Infrastructure & Architecture

### 2.1 Backend (`api/` — Ruby on Rails 7.0 + RSpec 6.0)

The backend Gemfile already includes `rspec-rails`, `factory_bot_rails`, `faker`, `database_cleaner`, and `timecop`. We scaffold the test harness configuration and support files:

1. **`api/spec/spec_helper.rb`**:
   - Standard RSpec configuration, expectation matching, mock frameworks (`:rspec`), and output formatters.
2. **`api/spec/rails_helper.rb`**:
   - Boots Rails test environment (`ENV['RAILS_ENV'] ||= 'test'`).
   - Disables maintenance of test schema via migrations on fly (`ActiveRecord::Migration.maintain_test_schema!`).
   - Sets `use_transactional_fixtures = true`.
3. **`api/spec/support/`**:
   - `database_cleaner.rb`: Configures DatabaseCleaner truncation/transaction strategies.
   - `factory_bot.rb`: Injects `FactoryBot::Syntax::Methods`.
   - `request_spec_helper.rb`: Generates valid JWT tokens using `JsonWebToken.encode`, constructs auth headers (`Authorization: Bearer <jwt>`), and provides helper methods to simulate tenant contexts (`X-Tenant-Scheme`, subdomain).
4. **`api/spec/factories/`**:
   - `organizations.rb`: Valid organization records with `slug` and `scheme`.
   - `users.rb`: Admin and member users with BCrypt password digests.
   - `vacancies.rb`: Vacancy records with associated `vacancy_skills`.
   - `assessments.rb`: Assessment records with associated `assessment_skills`.
   - `sessions.rb`: Session records with generated invite tokens and statuses (`pending`, `active`, `ended`).
   - `transcript_turns.rb`: Turn records with speaker tags (`ai`, `candidate`), audio timing, and transcript text.
   - `portfolios.rb` & `portfolio_skills.rb`: Structured portfolio records and candidate evaluation skills.

### 2.2 Frontend (`web/` — React 18 + Vitest + Testing Library)

The frontend currently lacks a test runner. We install and configure Vitest:

1. **Dependencies (`web/package.json`)**:
   - `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`.
   - Script: `"test": "vitest run"`, `"test:watch": "vitest"`.
2. **Configuration (`web/vite.config.ts`)**:
   - Configure `test` block with `globals: true`, `environment: 'jsdom'`, and `setupFiles: ['./src/test/setup.ts']`.
3. **Setup File (`web/src/test/setup.ts`)**:
   - Imports `@testing-library/jest-dom`.
   - Polyfills browser APIs in JSDOM: `window.matchMedia`, `ResizeObserver`, `crypto.randomUUID`.
   - Cleans up DOM and resets mocks after each test.

---

## 3. Backend Test Suite (`api/spec/`)

### 3.1 Authentication & Tenant Scoping (`spec/requests/api/v1/authentication_spec.rb` & `spec/requests/api/v1/tenant_scoping_spec.rb`)
- **Authentication Controller (`POST /api/v1/auth/login`)**:
  - Successfully authenticates user with `role: 'admin'` and returns JWT token + user profile.
  - Returns `401 Unauthorized` for incorrect passwords.
  - **Quirk GAP P0-2**: Characterizes that authenticating a valid user with `role: 'member'` returns `401 Unauthorized` because the current code strictly requires `user.role == 'admin'`.
  - **Scheme Selection**: Resolves tenant scheme from `X-Tenant-Scheme` header if present, falling back to first organization scheme or `'test-corp'`.
- **Tenant Scoping & Unscoped Leaks**:
  - Standard resources scoped to `Current.tenant` / `current_tenant_id`.
  - **Quirk GAP P0-3**: Characterizes that `POST /api/v1/portfolios/:id/fitgap` and `POST /api/v1/portfolios/:id/regenerate_fitgap` use `Portfolio.find(params[:id])` directly without tenant scoping, permitting cross-tenant portfolio access.

### 3.2 Session Lifecycle & Candidate Access (`spec/requests/api/v1/sessions_spec.rb` & `spec/models/session_spec.rb`)
- **Model Baseline (`Session`)**:
  - Generates a 64-character hex invite token on creation.
  - Allowed statuses: `pending`, `active`, `ended`, `failed`.
  - **Quirk GAP P0-1**: Characterizes that `Session#invite_url` evaluates to `http://localhost:3001/interview/:token` (API host, port 3001) rather than the frontend web host.
- **Assessor Session End (`POST /api/v1/sessions/:id/end`)**:
  - Successfully transitions an active session to `status: 'ended'` with a valid `reason` (`manual_assessor`, `time_ceiling`, etc.).
  - Returns `422 Unprocessable Entity` if the session is already ended.
- **Candidate Endpoints (Unauthenticated)**:
  - `GET /sessions/:token/candidate`: Resolves session and returns candidate info without requiring a JWT.
  - **Quirk GAP P1-5**: `POST /sessions/:token/audio_complete` transitions the session to `ended` with `reason: 'all_covered'` immediately without verifying coverage completeness.

### 3.3 Fit/Gap Engine (`spec/services/fit_gap/engine_spec.rb`)
- **Skill Level Comparison Calculations**:
  - Matches candidate effective level with vacancy `expected_level`:
    - `match` if `delta == 0`
    - `exceed` if `delta > 0`
    - `gap` if `delta < 0`
    - `not_assessed` if the candidate was not evaluated on this skill.
  - Assessor override level takes precedence over `ai_level`.
- **Payload Contract Seam (GAP P1-1)**:
  - Characterizes that comparison entries emit the key `expected_level` (and omit `required_level`).
- **Narratives & Resiliency**:
  - Parses JSON response from Gemini client to extract `culture_narrative` and `overall_narrative`.
  - If Gemini call fails, falls back to deterministic summary string (`"Candidate shows X skill matches, Y exceeds, and Z gaps against role requirements."`).

### 3.4 Portfolio Generation (`spec/services/portfolios/generator_spec.rb`)
- **Skill Extraction & Rating**:
  - Parses Gemini JSON response to populate `PortfolioSkill` records with level (L1–L5), confidence, quotes, and summaries.
- **Empty Transcript Quirk (GAP P1-4)**:
  - Characterizes that `build_prompt` and `call` execute without raising an error even when `session.transcript_turns` is completely empty.

### 3.5 Assessment Management (`spec/requests/api/v1/assessments_spec.rb`)
- **Creation & Worker Dispatch (GAP P2-5 & P3-3)**:
  - Characterizes that `POST /api/v1/assessments` returns `{ system_prompt_generated: true }` synchronously upon queuing `SystemPromptGeneratorWorker`.
  - Characterizes that create response returns the raw assessment model attributes without nested skills.

---

## 4. Frontend Test Suite (`web/src/test/`)

### 4.1 API Client & Interceptors (`web/src/test/services/api.test.ts`)
- **Request Authorization**:
  - Automatically injects `Authorization: Bearer <storedToken>` when token exists.
- **Response Envelope Handling (GAP P3-2)**:
  - Unwraps `{ data: { ... } }` payload if `data` key exists.
  - Passes payload through unchanged if top-level keys are used (e.g. `{ session: ... }`).
- **401/403 Redirection**:
  - Clears stored token and triggers redirect to `/login`.

### 4.2 Fit/Gap Comparison Table (`web/src/test/components/fitgap/ComparisonTable.test.tsx`)
- **Table Rendering**:
  - Renders skill label, candidate level label, and result badges (`✅`, `⭐`, `⚠`, `—`).
  - Displays override pencil icon (`✏`) when `is_override` is true.
- **Required vs Expected Level Seam (GAP P1-1)**:
  - Characterizes that passing comparison objects with `expected_level: 3` (from API) leaves the "Required" column empty/blank because the component specifically indexes `c.required_level`.

### 4.3 Skill Picker (`web/src/test/components/assessment/SkillPicker.test.tsx`)
- **Selection Dispatch (GAP P1-2)**:
  - Fetches taxonomy list from `/skill_taxonomies`.
  - Selecting an item passes `skill_id: undefined` to `onSelect`, demonstrating that database `skill_id` is dropped at this UI seam.

### 4.4 Interview Page Candidate Entry (`web/src/test/pages/interview/InterviewPage.test.tsx`)
- **Candidate Session Resolution**:
  - Calls `sessionsApi.getCandidateInfo(token)` on mount.
  - Automatically transitions to `"complete"` if `session_status === 'ended'`.
- **Invalid Token Fallback Quirk (GAP P3-5)**:
  - Characterizes that when `getCandidateInfo` rejects (404/network error), the component catch block executes `setInterviewState("complete")`, displaying the "Interview Complete" screen to an invalid or unauthenticated link.

---

## 5. Verification & Execution Strategy

1. **Backend Verification**:
   - Run `bundle exec rspec` in `api/`.
   - All characterization specs must pass 100% green against the existing unchanged codebase.
2. **Frontend Verification**:
   - Run `npm test` (`vitest run`) in `web/`.
   - All frontend unit and component specs must pass 100% green.
3. **Commit & Traceability**:
   - Documented baselines provide verifiable reference points for any future refactoring or gap resolution.

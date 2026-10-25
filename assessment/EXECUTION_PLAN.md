# Step-by-Step Technical Execution Plan: Fullstack Product Engineer Case Study

**Repository:** [https://github.com/ferdianqbl/ai-interview-platform](https://github.com/ferdianqbl/ai-interview-platform) (Forked from `rakamindev/ai-interview-platform`)  
**Target Feature Branch:** `feature/monozukuri-portfolio-and-fitgap-revamp`  
**Evaluation Standard:** Monozukuri Product & Engineering Craftsmanship (50% Product + 50% Engineering)  
**Final Submission Deadline:** Wednesday 19 August, 13:00 WIB  

---

## 1. Overview & Architectural Strategy

This execution plan provides an end-to-end blueprint to take the **AI Interview Platform** from its baseline state to a production-grade, highly reliable, and aesthetically delightful product.

### Core Strategic Focus
1. **The High-Leverage Seam**: Candidate Assessment $\rightarrow$ Portfolio Generation $\rightarrow$ Assessor Overrides $\rightarrow$ Vacancy Fit/Gap Matching $\rightarrow$ PDF/JSON Export.
2. **Engineering Depth**:
   * **Backend Rigor**: Dynamic override synchronization in Fit/Gap, defensive unassessed skill handling, Gemini API fallback narratives, strict data constraints, and a complete RSpec test suite.
   * **Frontend Craftsmanship**: Complete coverage of all 6 interaction states (Loading skeletons, Empty, Error, Partial, Long text overflow, Responsive), modern UI hierarchy, and Vitest component tests.
3. **Mandatory Proofs**: Seeded fault test walkthrough and AI code generation verification case study.
4. **Indonesian UU PDP Compliance**: Strict candidate data privacy, zero PII logging, and human oversight audit trails.

---

## 2. Detailed Execution Roadmap (Phases 1 to 6)

```mermaid
graph TD
    P1[Phase 1: Git Remote Setup & Test Harness] --> P2[Phase 2: Codebase Audit & P0-P3 Gap Analysis]
    P2 --> P3[Phase 3: Backend Hardening & RSpec Specs]
    P3 --> P4[Phase 4: Frontend UI/UX Revamp & Vitest]
    P4 --> P5[Phase 5: Seeded Fault Test & AI Moment Documentation]
    P5 --> P6[Phase 6: PR Creation, Video Recording & PDF Report]
```

---

### Phase 1: Git Remote Setup & Test Harness Installation

#### 1.1 Git Remote & Branch Configuration
* Configure `origin` to point to the user's fork: `git@github.com:ferdianqbl/ai-interview-platform.git` (or HTTPS).
* Configure `upstream` to point to `git@github.com:rakamindev/ai-interview-platform.git`.
* Create and switch to the feature branch: `feature/monozukuri-portfolio-and-fitgap-revamp`.
* Ensure `main` branch remains untouched.

#### 1.2 Backend Test Harness Setup (`api/`)
* Verify RSpec configuration in `api/`:
  * Create `api/spec/rails_helper.rb` and `api/spec/spec_helper.rb`.
  * Configure `DatabaseCleaner`, `FactoryBot`, `Timecop`, and `Faker`.
  * Create factory definitions in `api/spec/factories/` for:
    - `users`
    - `assessments`
    - `assessment_skills`
    - `sessions`
    - `coverage_maps`
    - `transcript_turns`
    - `portfolios`
    - `portfolio_skills`
    - `assessor_overrides`
    - `vacancies`
    - `vacancy_skills`
    - `fit_gap_reports`

#### 1.3 Frontend Test Harness Setup (`web/`)
* Configure Vitest + `@testing-library/react` + `@testing-library/jest-dom` + `jsdom` in `web/`.
* Add test script to `web/package.json`: `"test": "vitest run"`.
* Configure `web/vitest.config.ts` and `web/src/test/setup.ts`.

---

### Phase 2: Deep Codebase Audit & Problem/Gap Definition

#### 2.1 Fullstack Workflow Walkthrough
* Run full local stack:
  * PostgreSQL database setup and seeds (`rails db:migrate db:seed`).
  * Rails API server on `http://localhost:3001`.
  * Sidekiq worker processing.
  * React Vite frontend on `http://localhost:5173`.
* Step through candidate session $\rightarrow$ portfolio $\rightarrow$ override $\rightarrow$ fit/gap $\rightarrow$ export flows.

#### 2.2 Severity-Ranked Gap Analysis (P0 to P3)
Document all discovered defects into a structured matrix:

| Severity | Category | Flaw / Problem Description | Real-World User Impact | Missing Spec vs. Defective Impl |
|---|---|---|---|---|
| **P0** | Security / Auth | Hardcoded JWT secret fallback in `JsonWebToken` when `SECRET_KEY_BASE` is unset. | Enables token forgery (`HS256`) and unauthorized tenant admin access (**Review #3**). | Defective Implementation |
| **P0** | Security / Tenancy | Unscoped `Vacancy` / `Portfolio` queries bypassing `TenantScoped` default scope. | Enables cross-tenant data leakage of job vacancies and candidate portfolios (**Review #4**). | Defective Implementation |
| **P0** | Backend/Security | Raw error stack traces or potential candidate PII logged during Gemini worker failures. | Violates Indonesian UU PDP law; security vulnerability. | Defective Implementation |
| **P1** | Backend/FitGap | `FitGap::Engine` does not recalculate or invalidate cached reports when assessor overrides are updated. | Recruiters make hiring decisions based on stale/outdated AI scores. | Missing Specification |
| **P1** | Backend/FitGap | Vacancy skills with no portfolio coverage throw nil delta or unhandled narrative generation failures. | Causes 500 crashes during fit/gap generation for mismatched roles. | Defective Implementation |
| **P1** | Fullstack Seam | Property name mismatch (`expected_level` vs `required_level`, `ai_level` int vs string). | Vacancy required levels rendered as `undefined` in the React comparison table. | Defective Implementation |
| **P2** | Frontend/UI | `PortfolioPage` and `FitGapReportPage` lack dedicated empty states, skeleton loading states, and error retry banners. | Poor user experience; confusing flash of unstyled content or blank page on load. | Missing Specification |
| **P2** | Frontend/UX | Candidate quote evidence with long text strings overflows card containers on tablet/mobile screens. | Unusable evaluation screen on mobile devices; breaks layout. | Defective Implementation |
| **P3** | Frontend/Visual | Color contrast of level badges and delta markers does not follow an intuitive design system hierarchy. | Inefficient cognitive scanning for hiring managers reviewing 50+ candidates. | Missing Specification |

#### 2.3 Constraint Signals (Tech Lead Escalations)
* **Signal 1: Gemini API Rate Limits & Latency**: LLM calls for portfolio and narrative generation can take up to 30–180s. Need robust timeout fallbacks and idempotent Sidekiq retries.
* **Signal 2: Token Management & Shared Secret**: JWT authentication between platform and interview app requires strict secret matching and fail-fast validation (`KeyError` on missing secret).
* **Signal 3: Multi-Tenant Worker Context**: Sidekiq background jobs run outside the HTTP request context and must explicitly bind `Current.using(tenant_id: session.tenant_id)`.

---

### Phase 3: Backend Hardening & Rigorous Testing (`api/`)

#### 3.1 Solution Option Evaluation & Trade-off Matrix

Both options assume clean, modular domain encapsulation within `FitGap::Engine`:

| Evaluation Dimension | Option A: Structured Dynamic On-The-Fly Engine (Stateless Compute-on-Read) | Option B: Event-Driven Materialized Reports (Compute-on-Write + Read-Through Cache) (Chosen) |
|---|---|---|
| **Product Impact vs. Operational Cost** | **Pros:** Zero idle DB storage or wasted background compute.<br>**Cons:** Every view triggers a synchronous Gemini Flash call ($1.5\text{ s}–15\text{ s}$ latency) and bills LLM tokens per read ($O(R)$ reads). | **Pros:** Immediate $<50\text{ ms}$ dashboard loads for recruiters; LLM token cost bounded to state writes ($O(W)$ writes).<br>**Costs & Risks:** Requires operating Redis + Sidekiq workers, PostgreSQL JSONB storage overhead, and managing write-amplification across vacancies. |
| **Long-Term Maintainability & Complexity** | **Pros:** 100% strong read consistency by construction; zero cache-invalidation code; instant formula evolution without DB backfills.<br>**Cons:** Couples read availability to upstream LLM latency. | **Pros:** Decouples heavy LLM calls from HTTP read path; preserves point-in-time audit snapshots.<br>**Complexity:** Multi-entity cache invalidation across `AssessorOverride`, `Vacancy`, and `Portfolio`; client/server dual-maintenance tax for optimistic UI delta calculation; JSONB schema versioning. |
| **Failure Modes** | Upstream LLM latency holds Puma threads; stochastic narrative drift across page reloads. | Eventual consistency lag ($2\text{ s}–15\text{ s}$) during async worker execution; risk of stale data if a mutation hook is missed; handled with read-through synthesis and deterministic fallback narratives. |
| **Contextual Fit** | Optimal for pure rule-based calculations, but synchronous LLM generation per view degrades committee review UX. | **Chosen Trade-Off**: Sub-100ms deterministic reads and point-in-time auditability justify the cache-invalidation and Sidekiq operational complexity. |

#### 3.2 Backend Code Modifications
1. **`app/lib/json_web_token.rb`**:
   * Enforce fail-fast secret verification via `ENV.fetch('SECRET_KEY_BASE')` raising `KeyError` on blank or missing secret, eliminating token forgery risks (**Review #3**).
2. **`app/controllers/api/v1/portfolios_controller.rb` & `portfolio_skills_controller.rb`**:
   * Replace all `Vacancy.unscoped` queries with tenant-scoped lookups (**Review #4**).
   * Scope `Portfolio` and `PortfolioSkill` lookups via `joins(:session)` to enforce `TenantScoped` default scope.
   * Add cache invalidation or automatic regeneration trigger on override save.
   * Add UU PDP sanitization: ensure no PII or raw secrets appear in JSON error envelopes.
3. **`app/workers/fit_gap_generator_worker.rb`**:
   * Wrap job execution in `Current.using(tenant_id: session.tenant_id) do ... end` so `Vacancy.find` in Sidekiq strictly respects tenant isolation (**Review #4**).
4. **`app/controllers/api/v1/vacancies_controller.rb`**:
   * Destroy stale dependent `FitGapReport` snapshots on vacancy rubric update (`@vacancy.fit_gap_reports.destroy_all`).
5. **`app/services/fit_gap/engine.rb`**:
   * Ensure `effective_portfolio_skills` accurately maps `assessor_overrides` over `ai_level` while keeping `ai_level` immutable.
   * Add safe handling for unassessed skills (`candidate_level = nil`, `result = 'not_assessed'`).
   * Provide deterministic, structured fallback narratives when Gemini LLM call fails or times out.
6. **`app/services/portfolios/generator.rb`**:
   * Wrap skill updates inside `ActiveRecord::Base.transaction`.
   * Add substance-aware rubric fallback evaluating speech volume and technical depth to prevent score inflation on low-effort answers.
7. **`app/clients/gemini/` & `app/channels/audio_websocket_middleware.rb`**:
   * Upgrade to Gemini `v1beta` with automatic 404 model fallback chain (`gemini-2.5-flash` → `gemini-3-flash-preview` → `gemini-flash-latest`).
   * Add interactive `MockLiveClient` with RMS silence detection (1.7s timer) and multimodal WAV buffering.
8. **`db/migrate/20260815000001_add_assessment_state_and_narrative_status.rb`**:
   * Add reversible database migration ensuring complete schema synchronization.

#### 3.3 Backend Automated Test Suite (`api/spec/`)
Execute **41 RSpec examples with 0 failures** across:
* **`spec/lib/json_web_token_spec.rb`**: JWT encoding, decoding, expiration, tampering rejection, and fail-fast `KeyError` verification.
* **`spec/workers/fit_gap_generator_worker_spec.rb`**: Multi-tenant isolation in Sidekiq, raising `RecordNotFound` on cross-tenant vacancies.
* **`spec/models/portfolio_skill_spec.rb` & `assessor_override_spec.rb` & `fit_gap_report_spec.rb`**: Model validations, constraints, and relations.
* **`spec/services/fit_gap/engine_spec.rb`**: Exact delta math, override priority, unassessed skill safety, and LLM fallback narratives.
* **`spec/requests/api/v1/portfolios_spec.rb` & `portfolio_skills_spec.rb`**: Controller authentication, cross-tenant isolation, PDF export, and override synchronization.

---

### Phase 4: Frontend Monozukuri Revamp & Component Testing (`web/`)

#### 4.1 UI/UX Enhancements Across All 6 Interaction States
1. **Loading State**:
   * Replace basic spinner with modular Skeleton cards that mirror the exact layout of the portfolio and comparison table.
2. **Empty State**:
   * Add clean illustrated cards when no skills were detected or no vacancies exist.
3. **Error State**:
   * Add actionable error alerts with a "Retry Generation" button and clear diagnostic messages.
   * Explicitly handle `404`/`422` error states in `useFitGapQuery.ts` and `FitGapReportPage.tsx`.
4. **Partial Data State**:
   * Add visual badges indicating in-progress skill evaluation or low-confidence AI probes.
5. **Long Text / Overflow State**:
   * Add accordion/expandable quotes with line clamping for candidate transcript excerpts.
6. **Responsive Layout**:
   * Responsive grid: 1 column on mobile (`<640px`), 2 columns on tablet (`<1024px`), 3 columns on desktop (`>=1024px`).

#### 4.2 Candidate Voice Interview & Real-Time Audio Pipeline
* **Remove Dictation Conflict**: Eliminate `webkitSpeechRecognition` to prevent macOS `"duk duk"` dictation error chimes.
* **Live Emerald Voice Bars (`VoiceBars.tsx`)**: Render dynamic 16-bit PCM RMS `micLevel` (`0–100`) providing candidate visual feedback.
* **Manual Turn Completion**: Add instant "Done Speaking — Send Answer" button alongside 1.75s automated silence detection.
* **Hardware Preflight**: Calibrate voice streaming thresholds and accelerate checks to $<3\text{ seconds}$ with local `/health` ping probes.

#### 4.3 Frontend Automated Test Suite (`web/src/`)
Execute **28 Vitest unit & component tests across 9 suites (0 failures)**:
* `useFitGapQuery.test.tsx` (3 tests): 404 propagation and polling states.
* `usePortfolioQuery.test.tsx` (4 tests): In-memory optimistic updates, cache rollback, and real-time Fit/Gap recalculation.
* `ComparisonTable.test.tsx` (4 tests): Delta badge formatting, unassessed fallback, and counters.
* `SkillPortfolioCard.test.tsx` (3 tests): Level badges, confidence tags, and quote accordions.
* `LoginPage.test.tsx` (5 tests): Authentication flow, token storage, and accessible error banners.
* `AssessmentListPage.test.tsx` (2 tests): Assessment table rendering and empty states.
* `navbar.test.tsx` (3 tests): Breadcrumbs, theme switcher, and mobile navigation.
* `api.test.ts` (2 tests): Axios bearer token injection and 401 redirect handling.
* `internetSpeedTest.test.ts` (2 tests): Audio network streaming threshold validation.
* **Playwright E2E Suite**: 6 full browser user flows passing in `web/e2e/auth-and-portfolio.spec.ts`.

---

### Phase 5: Seeded Fault Test & AI Verification Moment

#### 5.1 Seeded Fault Test Experiment
1. **Branch Out**: Create scratch branch `fault/seeded-delta-calculation-bug`.
2. **Inject Fault**: Invert the delta calculation in `FitGap::Engine` (`expected_level - candidate_level`).
3. **Execute Test Runner**: Run `bundle exec rspec spec/services/fit_gap/engine_spec.rb` and capture the explicit test failure output.
4. **Restore & Re-verify**: Switch back to feature branch, verify all specs pass green, and record the git diff/logs.

#### 5.2 AI Verification Moment Documentation
1. **Context**: Describe a real instance during development where AI code generation suggested directly updating the `ai_level` column on `portfolio_skills` during an override instead of creating an audit record in `assessor_overrides`.
2. **Detection & Risk**: Explain how this violates data immutability, destroys the AI baseline, and breaks auditability required by UU PDP regulations.
3. **Resolution**: Explain how the code was revised to maintain strict separation between immutable AI scores and human assessor overrides.

---

### Phase 6: Final Submission Deliverables (PR, Video, PDF Report)

#### 6.1 GitHub Pull Request
* Open a Pull Request from `feature/monozukuri-portfolio-and-fitgap-revamp` to `main` on `https://github.com/ferdianqbl/ai-interview-platform`.
* PR description includes:
  - Problem statement and user impact.
  - Architectural changes across API and Web.
  - Test coverage summary and execution commands.
  - Screenshots of revamped UI states.

#### 6.2 3 to 5-Minute Video Walkthrough Script
* **0:00 - 1:00**: Domain Context (Indonesian hiring challenges, candidate empathy, UU PDP compliance).
* **1:00 - 2:30**: Live Product Demonstration (Portfolio review, assessor override, fit/gap report, export).
* **2:30 - 3:45**: Engineering Craftsmanship (RSpec test harness, Vitest suite, Seeded Fault proof).
* **3:45 - 5:00**: Architecture trade-offs, failure resilience, and live defense summary.

#### 6.3 Single PDF Report Compilation
* Compile `assessment/EXECUTION_REPORT.md` into the final single PDF document containing:
  - PR link and Video Walkthrough URL.
  - Complete written execution narrative.
  - High-resolution visual screenshots.
  - Test outputs and Seeded Fault evidence.

---

## 3. Git Commit Discipline & Execution Sequence

We executed this roadmap using structured, readable commits following Conventional Commits:

1. `chore(git): configure remotes and create feature branch`
2. `test(api): setup rspec harness and test factories`
3. `test(web): setup vitest and component testing harness`
4. `feat(api): harden fit_gap engine with overrides sync and fallback narratives`
5. `test(api): add comprehensive rspec tests for models, engine, and controllers`
6. `feat(web): revamp portfolio and fitgap UI across all 6 interaction states`
7. `feat(web): integrate TanStack Query with optimistic mutations, caching, and auto-polling`
8. `feat(web): restructure folder architecture to vertical feature slices with modern shell`
9. `feat(web): add cross-feature real-time in-memory cache sync with optimistic mutations`
10. `fix(api): make Rack::Attack cache store fall back to memory store when Redis is offline`
11. `fix(puma): resolve macOS fork crash by setting single mode in dev and fork safety flag`
12. `fix(api): enforce fail-fast JWT secret, strict tenant scoping, and vacancy cache invalidation`
13. `feat(interview,web): add multimodal voice turn detection, live mic level bars, and 404 fitgap handling`
14. `docs(assessment): refine dynamic vs materialized trade-off matrix, operational costs, and PDF report`

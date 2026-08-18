# Initial Findings and Risk Scan Report

- **Date:** 2026-08-18
- **Branch:** `assessment/trustworthy-results`
- **Phase:** STEP 1 — Baseline Verification & Characterization Specs

---

## Confirmed Findings

### [SEC-01] Cross-Tenant Data Access in Portfolios and PortfolioSkills Controllers

- **Status:** Confirmed
- **Severity:** P0
- **Classification:** Security/privacy defect
- **Area:** API
- **User affected:** Assessors, Recruiters, Candidates
- **Evidence:**
  - `api/app/controllers/api/v1/portfolios_controller.rb:82, 104, 130, 156` (`Portfolio.find(params[:id])`)
  - `api/app/controllers/api/v1/portfolio_skills_controller.rb:51-53` (`PortfolioSkill.joins(:portfolio).find(params[:id])`)
  - `api/app/models/portfolio.rb:1-20` (`Portfolio` model lacks `TenantScoped` and `tenant_id`)
  - Executable test: `api/spec/requests/api/v1/portfolios_tenant_isolation_spec.rb` (demonstrates Tenant A exporting and overriding Tenant B candidate records)
- **Current behavior:**
  `Portfolio` and `PortfolioSkill` queries do not enforce tenant filtering. An authenticated assessor from Tenant A with a valid JWT can export candidate data (`GET /api/v1/portfolios/:id/export?format=json`) and submit overrides (`POST /api/v1/portfolio_skills/:id/override`) on candidate portfolios belonging to Tenant B.
- **Expected/ideal behavior:**
  All portfolio lookups must be scoped through `Session` (`where(tenant_id: Current.tenant_id)`), or `Portfolio` and child records must enforce tenant scoping to guarantee multi-tenant data isolation.
- **Product impact:** Cross-tenant data exposure and unauthorized candidate record modification across organizations.
- **Candidate impact:** Disclosure of candidate evaluation scores, notes, and evidence quotes to third-party organizations.
- **UU PDP/privacy impact:** Violates confidentiality and tenant data segregation requirements under UU PDP No. 27/2022.
- **Suggested verification:** Verified by `api/spec/requests/api/v1/portfolios_tenant_isolation_spec.rb`.
- **Possible solution direction:** Scope portfolio lookups via `@session.portfolio` where `@session` is strictly resolved under `Current.tenant_id`, and verify tenant ownership in `PortfolioSkill` actions.
- **In scope recommendation:** Yes

---

### [SEC-02] Fail-Open Default Scope Fallback in `TenantScoped` Concern

- **Status:** Confirmed
- **Severity:** P0 (Candidate for exploit verification)
- **Classification:** Architectural risk
- **Area:** Database
- **User affected:** All tenants, Candidates
- **Evidence:**
  - `api/app/models/concerns/tenant_scoped.rb:18-24`
- **Current behavior:**
  The `default_scope` in `TenantScoped` evaluates `if RequestStore.store.key?(:tenant_id)`. When `tenant_id` is unset in `RequestStore` (such as in background workers, unauthenticated contexts, or console tasks), the scope evaluates to `all` rather than failing safe (`none`).
- **Expected/ideal behavior:**
  When `tenant_id` is missing or unverified, queries on tenant-scoped models should fail safe (e.g. return `none` or raise an error), requiring explicit unscoping (`unscoped`) only for administrative tasks.
- **Product impact:** Fail-open architectural behavior across all queries when tenant context is omitted.
- **Candidate impact:** Potential accidental cross-tenant data mixing in background jobs or unauthenticated handlers.
- **UU PDP/privacy impact:** Fails to maintain technical isolation guarantees by default.
- **Suggested verification:** Execute queries on `Assessment` or `Session` in an unauthenticated or background job context without `RequestStore[:tenant_id]` set; observe that records across all tenants are returned.
- **Possible solution direction:** Refactor `TenantScoped` to return `none` or raise `TenantNotFound` when `RequestStore.store[:tenant_id]` is unset.
- **In scope recommendation:** Yes

---

### [AI-01] Missing or Null AI Skill Rating Silently Coerced to Level 1

- **Status:** Confirmed
- **Severity:** P1
- **Classification:** Defective implementation
- **Area:** Gemini
- **User affected:** Candidates, Assessors, Hiring Managers
- **Evidence:**
  - `api/app/services/portfolios/generator.rb:161, 173` (`ai_level: skill_data['level'].to_i.clamp(1, 5)`)
  - Executable test: `api/spec/services/portfolios/generator_level_default_spec.rb`
- **Current behavior:**
  When parsing Gemini Pro's portfolio evaluation JSON, `skill_data['level'].to_i` converts `nil`, `""`, or missing keys to `0`. Then `.clamp(1, 5)` coerces `0` to `1` (L1 proficiency).
- **Expected/ideal behavior:**
  If a skill was omitted or cannot be rated by the model, it should be flagged as unassessed or trigger a validation error rather than defaulting to the lowest possible proficiency score.
- **Product impact:** Generates inaccurate evaluation records with false low ratings.
- **Candidate impact:** Unfairly penalizes candidates by assigning an L1 score for skills that may not have been probed or demonstrated during the interview.
- **UU PDP/privacy impact:** Inaccurate automated data processing impacting candidate evaluations.
- **Suggested verification:** Verified by `api/spec/services/portfolios/generator_level_default_spec.rb`.
- **Possible solution direction:** Validate presence of `level` in `1..5`; if missing, mark the skill as unassessed or handle missing skill evaluations explicitly.
- **In scope recommendation:** Yes

---

### [AI-03] Non-Transactional Portfolio Skills Recreation During Regeneration

- **Status:** Confirmed
- **Severity:** P1
- **Classification:** Defective implementation
- **Area:** Database
- **User affected:** Assessors, Candidates
- **Evidence:**
  - `api/app/services/portfolios/generator.rb:150-179` (`save_skills`)
  - Executable test: `api/spec/services/portfolios/generator_transaction_spec.rb`
- **Current behavior:**
  `Portfolios::Generator#save_skills` executes `portfolio.portfolio_skills.destroy_all` before iterating through newly generated skills without an explicit database transaction wrapper (`ActiveRecord::Base.transaction`). If an invalid later skill triggers a validation error (`RecordInvalid`), the previous valid portfolio skills are permanently deleted and the portfolio is left in a failed, partially written state.
- **Expected/ideal behavior:**
  Skill destruction and recreation should be wrapped in an atomic database transaction so that any parsing or validation failure rolls back cleanly to preserve the previously valid evaluation.
- **Product impact:** Data loss of previously valid portfolio evaluations upon transient regeneration errors.
- **Candidate impact:** Loss of candidate evaluation records.
- **UU PDP/privacy impact:** Data integrity failure.
- **Suggested verification:** Verified by `api/spec/services/portfolios/generator_transaction_spec.rb`.
- **Possible solution direction:** Wrap `portfolio.portfolio_skills.destroy_all` and skill insertions inside `portfolio.transaction do ... end`.
- **In scope recommendation:** Yes

---

### [AI-04] Raw Exception Message Exposure in Portfolio Generation Error

- **Status:** Confirmed
- **Severity:** P2
- **Classification:** Security/privacy defect
- **Area:** API
- **User affected:** Candidates, Assessors
- **Evidence:**
  - `api/app/services/portfolios/generator.rb:34` (`portfolio&.update!(generation_status: 'failed', generation_error: e.message)`)
  - `api/app/controllers/api/v1/sessions_controller.rb:75` (`render json: { status: 'failed', error: portfolio.generation_error }`)
- **Current behavior:**
  `Generator` captures raw exception messages (`e.message`, which may include HTTP error responses, prompt content, API keys, or raw candidate transcript snippets) into `generation_error`, and `SessionsController#portfolio` returns this raw string directly to frontend consumers.
- **Expected/ideal behavior:**
  Internal exception details should be logged server-side, while user-facing API responses should return sanitized, standardized error codes.
- **Product impact:** Potential exposure of internal upstream details or candidate transcript excerpts in error responses.
- **Candidate impact:** Potential leakage of internal assessment context.
- **UU PDP/privacy impact:** Data protection and error sanitization gap.
- **Suggested verification:** Trigger a simulated upstream failure containing sensitive text; observe the raw text returned in `GET /api/v1/sessions/:id/portfolio`.
- **Possible solution direction:** Sanitize `generation_error` returned by the API or store internal error details separately from user-facing failure messages.
- **In scope recommendation:** Yes

---

### [PRD-01] Candidate Invite URL Points to API Port (3001) Instead of Frontend Web Port (5173)

- **Status:** Confirmed
- **Severity:** P1
- **Classification:** Setup/documentation issue
- **Area:** API
- **User affected:** Candidates, Assessors
- **Evidence:**
  - `api/app/models/session.rb:29-30` (`#{base}/interview/#{invite_token}`)
  - `api/config/application.yml.sample:21` (`APP_BASE_URL: "http://localhost:3001"`)
  - `web/README.md:41` (Frontend serves on `http://localhost:5173`)
  - Executable test: `api/spec/models/session_invite_url_spec.rb`
- **Current behavior:**
  `Session#invite_url` defaults to `APP_BASE_URL` (configured as Rails port 3001). Generated candidate invite links point to `http://localhost:3001/interview/:token`, which returns a Rails 404 routing error.
- **Expected/ideal behavior:**
  `invite_url` should point to the frontend web application URL (`FRONTEND_BASE_URL` / port 5173) where the React router `/interview/:token` route is mounted.
- **Product impact:** Candidates cannot access their interview sessions using generated invite links.
- **Candidate impact:** Immediate onboarding blocker.
- **UU PDP/privacy impact:** Low.
- **Suggested verification:** Verified by `api/spec/models/session_invite_url_spec.rb`.
- **Possible solution direction:** Separate `APP_BASE_URL` (API) and `FRONTEND_BASE_URL` (Web), referencing the frontend base URL when generating invite links.
- **In scope recommendation:** Yes

---

### [PDP-01] Privacy Transparency and Lawful-Basis Notice Gap for Candidate Evaluation

- **Status:** Confirmed
- **Severity:** P1
- **Classification:** Missing specification
- **Area:** Web
- **User affected:** Candidates
- **Evidence:**
  - `web/src/pages/interview/InterviewPage.tsx:203-225`
- **Current behavior:**
  The pre-interview check displays audio tips and proceeds directly into microphone capture upon hardware verification without providing a privacy notice, transparency on automated assessment scoring, data retention disclosures, or lawful basis documentation under applicable regulations (such as Indonesia's UU PDP No. 27/2022).
- **Expected/ideal behavior:**
  Candidates should be presented with a clear privacy notice detailing the purpose of data collection, recording retention, automated scoring mechanisms, and candidate rights prior to initiating microphone capture.
- **Product impact:** Compliance risk under data privacy frameworks.
- **Candidate impact:** Lack of transparency regarding interview audio processing and scoring retention.
- **UU PDP/privacy impact:** Statutory transparency and privacy notice gap under UU PDP Arts. 20-22.
- **Suggested verification:** Inspect `InterviewPage.tsx` component flow before `startCapture()` is triggered.
- **Possible solution direction:** Implement a pre-interview privacy disclosure component explaining data processing and retention terms.
- **In scope recommendation:** Yes

---

## Architectural Risks and Product Hypotheses

### [SEC-03] Unverified JWT Decoding in `TenantResolverMiddleware`

- **Status:** Architectural risk
- **Severity:** P1
- **Classification:** Security/privacy defect
- **Area:** API
- **User affected:** All tenants
- **Evidence:**
  - `api/app/middlewares/tenant_resolver_middleware.rb:47` (`JsonWebToken.decode_without_verification(token)`)
  - Executable test: `api/spec/requests/api/v1/jwt_unresolved_scheme_spec.rb` (shows controller layer halts unmapped tenants with 403)
- **Current behavior:**
  `TenantResolverMiddleware` decodes the JWT without cryptographic signature verification to extract the `scheme` claim and set `Current.organization`. While `AuthorizeApiRequest` validates signatures at the controller layer, intermediate Rack middleware operates under an unverified tenant context.
- **Suggested verification:** Trace middleware stack to determine if any pre-controller Rack middleware uses `Current.tenant_id`.
- **Possible solution direction:** Cryptographically verify JWT signatures in `TenantResolverMiddleware` before binding tenant globals.
- **In scope recommendation:** Yes

---

### [AI-02] Premature Auto-Advancement of Stale Partial Skills to "Covered"

- **Status:** Product hypothesis
- **Severity:** P2
- **Classification:** Defective implementation
- **Area:** Sidekiq
- **User affected:** Candidates, Assessors
- **Evidence:**
  - `api/app/workers/coverage_analyzer_worker.rb:91-101` (`advance_stale_partials`)
- **Current behavior:**
  Any skill in the `partial` state with `probe_count >= 4` that falls outside the sliding 6-turn context window is automatically upgraded to `covered` by the worker with the note `"Auto-advanced: outside context window with sufficient probes"`.
- **Risk:**
  High probe count alone may indicate repeated candidate struggle rather than demonstrated competence.
- **Suggested verification:** Verify live interview transcripts to assess whether probe count correlates reliably with competence demonstration or causes premature coverage completion.
- **Possible solution direction:** Gate `covered` transitions strictly on AI confidence analysis rather than blind numeric probe counts.
- **In scope recommendation:** Needs discussion

---

### [PERF-01] Redis Connection Churn Risk in Session Lifecycle Handlers

- **Status:** Architectural risk
- **Severity:** P2
- **Classification:** Architectural risk
- **Area:** Sidekiq
- **User affected:** Assessors
- **Evidence:**
  - `api/app/services/sessions/start_handler.rb:25-31` (`redis = ::Redis.new(...)`)
  - `api/app/services/sessions/end_handler.rb:49-55` (`redis = ::Redis.new(...)`)
- **Current behavior:**
  `StartHandler` and `EndHandler` instantiate new standalone `Redis.new` connections on every invocation. Although closed in `ensure`, opening and tearing down connections per lifecycle event creates unnecessary connection churn compared to connection pooling.
- **Suggested verification:** Benchmark connection creation latency under concurrent session events.
- **Possible solution direction:** Use connection pooling via `Sidekiq.redis { |c| c.publish(...) }`.
- **In scope recommendation:** Yes

---

### [WEB-01] Unhandled `/signup` Route and Orphaned `SignupPage`

- **Status:** Confirmed
- **Severity:** P3
- **Classification:** Defective implementation
- **Area:** Web
- **User affected:** Assessors
- **Evidence:**
  - `web/src/services/auth.ts:16-17` (`api.post("/signup", data)`)
  - `web/src/pages/auth/SignupPage.tsx:26`
  - `api/config/routes.rb:1-64` (no `/signup` route configured)
- **Current behavior:**
  `SignupPage.tsx` exists and calls `authApi.signup()`, but no `/signup` endpoint exists in Rails `routes.rb`. `SignupPage` is also unrouted in `App.tsx`.
- **Expected/ideal behavior:**
  Remove unused signup artifacts or implement backend registration according to multi-tenant provisioning specifications.
- **In scope recommendation:** Yes

---

### [ENV-01] Local Toolchain Ruby Version Configuration

- **Status:** Confirmed
- **Severity:** Local setup blocker (Resolved via rbenv)
- **Classification:** Setup/documentation issue
- **Area:** API
- **Evidence:**
  - `api/Gemfile:5` (`ruby '3.3.2'`)
  - `api/.ruby-version:1` (`3.3.2`)
- **Resolution:**
  Installed and activated `ruby 3.3.2` via `rbenv` without modifying repository Gemfile or `.ruby-version`.

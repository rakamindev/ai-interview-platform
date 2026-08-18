# Acceptance Criteria

- **Date:** 2026-08-18
- **Branch:** `assessment/trustworthy-results`
- **Total Acceptance Criteria Count:** 46
- **Format:** Gherkin Given / When / Then

---

## 1. Security & Multi-Tenant Isolation (10 Criteria)

### SEC-AC-01: Cross-Tenant Portfolio View Blocked
- **Given** an assessor authenticated under Tenant A
- **When** the assessor requests `GET /api/v1/sessions/:id/portfolio` for a session belonging to Tenant B
- **Then** the API responds with `404 Not Found` and exposes no candidate data.

### SEC-AC-02: Cross-Tenant Portfolio Export Blocked
- **Given** an assessor authenticated under Tenant A
- **When** the assessor requests `GET /api/v1/portfolios/:id/export?format=json` for a portfolio belonging to Tenant B
- **Then** the API responds with `404 Not Found` without disclosing portfolio existence or content.

### SEC-AC-03: Cross-Tenant Portfolio Skill Override Blocked
- **Given** an assessor authenticated under Tenant A
- **When** the assessor sends `POST /api/v1/portfolio_skills/:id/override` targeting a `PortfolioSkill` belonging to Tenant B
- **Then** the API responds with `404 Not Found` and the record remains unaltered.

### SEC-AC-04: Cross-Tenant Fit/Gap Generation Blocked
- **Given** an assessor authenticated under Tenant A
- **When** the assessor requests `POST /api/v1/portfolios/:id/fitgap` targeting a portfolio of Tenant B
- **Then** the API responds with `404 Not Found` and enqueues no background jobs.

### SEC-AC-05: Cross-Tenant Fit/Gap Retrieval Blocked
- **Given** an assessor authenticated under Tenant A
- **When** the assessor requests `GET /api/v1/portfolios/:id/fitgap/:vacancy_id` targeting a portfolio of Tenant B
- **Then** the API responds with `404 Not Found`.

### SEC-AC-06: Mismatched Tenant Portfolio and Vacancy Blocked
- **Given** a portfolio belonging to Tenant A and a vacancy belonging to Tenant B
- **When** an assessor requests Fit/Gap comparison between them
- **Then** the API rejects the request with `404 Not Found`.

### SEC-AC-07: ID Enumeration Prevention
- **Given** an unauthorized or cross-tenant query with an arbitrary resource ID
- **When** the server processes the request
- **Then** the response status and body are identical for nonexistent IDs and foreign tenant IDs (`404 Not Found`).

### SEC-AC-08: Authorized Same-Tenant Access Functional
- **Given** an assessor authenticated under Tenant A
- **When** the assessor accesses or modifies resources belonging to Tenant A
- **Then** the request succeeds normally with `200 OK` or `201 Created`.

### SEC-AC-09: Complete Route Coverage for Tenant Checks
- **Given** direct routes (`/api/v1/portfolios/:id/*`) and nested routes (`/api/v1/sessions/:id/*`)
- **When** requests are processed
- **Then** all controller actions explicitly enforce `Session.where(tenant_id: Current.tenant_id)`.

### SEC-AC-10: Vacancy Scope Enforcement
- **Given** vacancy endpoints (`/api/v1/vacancies/:id`) or vacancy-scoped exports (`/export?vacancy_id=...`)
- **When** requested by an assessor
- **Then** records are strictly scoped to the assessor's tenant.

---

## 2. AI Assessment & Data Integrity (15 Criteria)

### AI-AC-01: Rejection of Missing or Null Level
- **Given** an AI evaluation payload where a skill has `level: nil` or an omitted `level` key
- **When** parsed and validated by `Portfolios::Generator`
- **Then** it raises `ValidationError` and rejects the payload without persisting L1.

### AI-AC-02: Rejection of Non-Integer and Out-of-Range Levels
- **Given** an AI evaluation payload where a skill has `level: "L3"`, `3.5`, `true`, `0`, or `6`
- **When** parsed and validated
- **Then** it raises `ValidationError` and rejects the payload.

### AI-AC-03: Rejection of Incomplete Configured Skills
- **Given** an assessment with 4 configured skills and an AI response containing only 3
- **When** validated
- **Then** `Portfolios::Generator` raises `ValidationError` identifying missing skill IDs.

### AI-AC-04: Rejection of Duplicate Skill IDs
- **Given** an AI evaluation response returning duplicate entries for the same configured skill
- **When** validated
- **Then** it raises `ValidationError` and halts processing.

### AI-AC-05: Rejection of Unconfigured Skill IDs
- **Given** an AI evaluation response returning a skill ID not configured in the assessment
- **When** validated
- **Then** it raises `ValidationError` and halts processing.

### AI-AC-06: Malformed Output Error Handling
- **Given** an invalid or truncated JSON payload from Gemini
- **When** parsing fails
- **Then** the error is caught safely without leaving uncommitted database changes.

### AI-AC-07: Validated Confidence Enum
- **Given** a confidence field in the AI payload
- **When** validated
- **Then** it accepts only `high`, `medium`, or `low` (case-insensitive).

### AI-AC-08: Evidence Array Type Validation
- **Given** an evidence field containing non-string items or malformed arrays
- **When** validated
- **Then** `Portfolios::Generator` enforces that evidence is an array of non-empty strings.

### AI-AC-09: Atomic Rollback on Last Skill Failure
- **Given** a batch of 5 skills where the 5th skill fails database validation
- **When** the transaction executes
- **Then** skills 1 through 4 are rolled back cleanly, leaving 0 partial records.

### AI-AC-10: Complete-Result Regeneration Failure Preservation
- **Given** a portfolio with a valid published result (`generated_at.present? && portfolio_skills.exists?`)
- **When** a regeneration attempt fails
- **Then** the portfolio preserves `complete` status, retains all existing skills, and stores a safe regeneration warning.

### AI-AC-11: Atomic Visibility on Successful Generation
- **Given** a new generation in progress
- **When** skills are written
- **Then** the portfolio status transitions to `complete` only after all skills are committed.

### AI-AC-12: Idempotent Retries
- **Given** a retry of `PortfolioGeneratorWorker`
- **When** executed
- **Then** duplicate skill rows are not created.

### AI-AC-13: Consistent Numeric AI Level Contract
- **Given** `GET /api/v1/sessions/:id/portfolio`
- **When** serialized
- **Then** `ai_level` is serialized as an integer (`1..5`) matching frontend type definitions.

### AI-AC-14: Complete-Result Regeneration Route Reachability
- **Given** `POST /api/v1/sessions/:id/portfolio/regenerate`
- **When** called on a portfolio with status `complete`
- **Then** the controller permits regeneration and enqueues `PortfolioGeneratorWorker`.

### AI-AC-15: Assessor Override Bound to Evaluated Skills
- **Given** a portfolio skill
- **When** an assessor overrides the score
- **Then** the override requires an existing non-null `ai_level` and stores valid integer ratings (`1..5`).

---

## 3. Sidekiq Worker Tenant Context (4 Criteria)

### WORKER-AC-01: Root Record Tenant Derivation
- **Given** a background worker (`PortfolioGeneratorWorker`, `CoverageAnalyzerWorker`, `FitGapGeneratorWorker`)
- **When** invoked with a record ID
- **Then** it loads the persisted root record (`Session` / `Assessment`) and derives `tenant_id` from the database.

### WORKER-AC-02: Isolated Worker Execution Scope
- **Given** a worker executing a job
- **When** active
- **Then** `Current.using(tenant_id: session.tenant_id, organization: organization)` enters context for that job's scope.

### WORKER-AC-03: Context Cleanup on Success and Failure
- **Given** a worker execution completing successfully or raising an exception
- **When** execution terminates
- **Then** `Current.using` restores the pre-existing `Current` state in an `ensure` block.

### WORKER-AC-04: Cross-Tenant Resource Combination Rejection in Workers
- **Given** `FitGapGeneratorWorker` invoked with mismatched `portfolio_id` and `vacancy_id`
- **When** executed
- **Then** it detects tenant mismatch and aborts without processing.

---

## 4. Concurrency & Locking (3 Criteria)

### CONCUR-AC-01: Non-Blocking External LLM Calls
- **Given** `Portfolios::Generator` initiating a Gemini Pro API call
- **When** waiting for the HTTP response
- **Then** no database locks or open transactions are held.

### CONCUR-AC-02: Row-Level Locking During Persistence
- **Given** validated skill data ready for persistence
- **When** database writing begins
- **Then** `portfolio.with_lock` acquires an exclusive row lock for the duration of the skill replacement.

### CONCUR-AC-03: Atomic Regeneration Request Transition
- **Given** two regeneration requests for the same portfolio
- **When** both attempt the state transition
- **Then** the row lock permits only one transition to `generating` and at most one background job is enqueued.

---

## 5. Safe Error & Logging (3 Criteria)

### ERR-AC-01: User-Facing Generic Error Envelope
- **Given** an internal evaluation failure
- **When** returned to clients
- **Then** the API returns a stable error code `EVALUATION_FAILED` and a safe message.

### ERR-AC-02: Sensitive Exception Marker Suppression
- **Given** an LLM or database exception containing internal URLs or API keys
- **When** serialized
- **Then** all internal details are stripped from client-facing responses.

### ERR-AC-03: Confidential Log Scrubbing
- **Given** evaluation execution logging
- **When** logs are written
- **Then** no candidate transcripts, prompts, or candidate personal data are emitted.

---

## 6. Frontend Component & State Handling (10 Criteria)

### UI-AC-01: Accessible Generating State
- **Given** `portfolio.generation_status === 'generating'` and no prior result
- **When** rendered
- **Then** it displays an animated spinner with polite `aria-live` announcements.

### UI-AC-02: Honest Initial-Generation Failure State
- **Given** `portfolio.generation_status === 'failed'` with no published results
- **When** rendered
- **Then** it displays an error banner with a retry action and no empty/blank skill cards.

### UI-AC-03: Regeneration Failure Warning with Preserved Results
- **Given** a failed regeneration with prior published results
- **When** rendered
- **Then** it displays previous valid results alongside an alert banner explaining regeneration failed.

### UI-AC-04: Clear Empty / Unavailable State
- **Given** an interview session with no portfolio evaluation (`status: "unavailable"`)
- **When** rendered
- **Then** it displays an honest "No evaluation available" placeholder.

### UI-AC-05: Direct Numeric AI Level Presentation
- **Given** a skill with `ai_level` 1 through 5
- **When** rendered
- **Then** it renders the corresponding `L1` through `L5` badge without string-coercion fallbacks. Invalid levels render an explicit `"Rating unavailable"` badge.

### UI-AC-06: Defensive Long Text and Evidence Presentation
- **Given** an interview quote of arbitrary length
- **When** rendered
- **Then** it wraps cleanly within its card boundary without breaking layout.

### UI-AC-07: Disabled Actions During Invalid or Generating States
- **Given** an incomplete, failed, or generating portfolio
- **When** viewed
- **Then** Fit/Gap and Export actions are disabled.

### UI-AC-08: Color-Independent Status Signaling
- **Given** confidence badges, levels, and state banners
- **When** displayed
- **Then** all information is conveyed through text labels and icons, not color alone.

### UI-AC-09: Responsive Layout Resilience
- **Given** any viewport width from mobile (375px) to desktop (1440px)
- **When** viewed
- **Then** layouts adapt fluidly with appropriate wrapping and zero overflow clipping.

### UI-AC-10: Keyboard-Accessible Calibration
- **Given** the assessor override dialog / panel
- **When** navigated via keyboard (`Tab`, `Enter`, `Arrow keys`)
- **Then** all controls are focusable, actionable, and navigable.

---

## 7. Candidate Invite URL Configuration (1 Criterion)

### INVITE-AC-01: Candidate Invite URL Points to Frontend Port
- **Given** a candidate session invite link
- **When** generated by `Session#invite_url`
- **Then** it uses `FRONTEND_BASE_URL` (e.g. `http://localhost:5173`) instead of the backend API port.

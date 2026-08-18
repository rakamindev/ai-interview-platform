# Solution Options and Trade-Offs

- **Date:** 2026-08-18
- **Branch:** `assessment/trustworthy-results`
- **Scope:** Architectural Decisions for Security Hardening & Trustworthy Generation

---

## 1. Problem 1: Explicit Tenant Scoping Solutions

### Analysis of Current Model
`TenantScoped` concern provides a `default_scope` filtering on `RequestStore[:tenant_id]`. However, relying solely on `default_scope` is insufficient for security boundaries because:
1. Derived models (`Portfolio`, `PortfolioSkill`, `FitGapReport`) do not include `tenant_id` or `TenantScoped`.
2. Direct controller lookups (e.g., `Portfolio.find(params[:id])`) completely bypass tenant scoping.
3. If `RequestStore[:tenant_id]` is unset or bypassed, `default_scope` falls open to `all`.

### Solution Options Comparison

#### Option A: Explicit Association Scoping via Persisted `Session` (Recommended)
Enforce explicit tenant filtering in controllers by querying through `Session.where(tenant_id: Current.tenant_id)`:
- `PortfoliosController#show`: `@session = Session.where(tenant_id: Current.tenant_id).find(params[:id])`, `@portfolio = @session.portfolio`.
- `PortfoliosController#export`: `@session = Session.where(tenant_id: Current.tenant_id).joins(:portfolio).find_by!(portfolios: { id: params[:id] })`, `@portfolio = @session.portfolio`.
- `PortfoliosController#fitgap`: `@session = Session.where(tenant_id: Current.tenant_id).joins(:portfolio).find_by!(portfolios: { id: params[:id] })`. Verify `@vacancy = Vacancy.where(tenant_id: Current.tenant_id).find(params[:vacancy_id])`.
- `PortfolioSkillsController#override`: `@portfolio_skill = PortfolioSkill.joins(portfolio: :session).merge(Session.where(tenant_id: Current.tenant_id)).find(params[:id])`.

- **Security Guarantee:** Complete. Every derived entity lookup is explicitly anchored to the verified `Current.tenant_id` of the root `Session`. Foreign IDs return `404 Not Found`, preventing ID enumeration.
- **Migration Requirements:** **Zero (0 migrations).** Uses existing PostgreSQL foreign keys and associations.
- **Worker Impact:** Workers derive `tenant_id` from the persisted `Session` root record and set `RequestStore.store[:tenant_id]` within an `ensure` block.
- **Maintainability:** Standard Rails ActiveRecord association scoping.
- **Deadline Fit:** High confidence, immediate verification via request specs.

#### Option B: Add `tenant_id` Directly to All Derived Tables
Add `tenant_id` column to `portfolios`, `portfolio_skills`, `assessor_overrides`, and `fit_gap_reports`.

- **Assessment:** Rejected. Requires schema migrations, backfilling existing data, handling duplicate tenant fields across parent/child rows, and risks data inconsistency if `portfolio.tenant_id` differs from `session.tenant_id`.

#### Option C: Authorization Policy Abstraction Layer (Pundit)
Introduce explicit Policy classes for each resource.

- **Assessment:** Rejected. Introduces unnecessary boilerplate for a platform with a single assessor/admin role without providing additional security over explicit association scoping.

---

## 2. Problem 2: Trustworthy AI Portfolio Generation & Concurrency

### Concurrency and Transaction Sequence
A database transaction alone does not prevent race conditions during long-running external API calls. The generation sequence must be structured as follows:

```
[1. LLM Generation (External)]
    │ Execute Gemini Pro REST call WITHOUT holding any database lock (~5-30s).
    ▼
[2. In-Memory Validation]
    │ Parse response JSON and strictly validate all skills in memory.
    │ If invalid, reject immediately without database modification.
    ▼
[3. Atomic Database Persistence]
    │ Begin short database transaction:
    │ ┌─ Acquire pessimistic row lock on Portfolio (portfolio.with_lock / lock!)
    │ ├─ Replace/insert skills atomically
    │ ├─ Update status to 'complete' and clear generation_error
    │ └─ Commit transaction atomically
```

#### Documented Concurrency Model & Known Limitations
- **Atomic Request Transition:** In `PortfoliosController#regenerate`, `portfolio.with_lock` serializes the transition to `generating`. Duplicate HTTP regeneration requests enqueue at most one background job.
- **Pessimistic Row Locking:** `portfolio.with_lock` serializes database persistence during worker execution and ensures zero partial writes.
- **Documented Concurrency Limitation:** In the edge case where two background workers are manually created or already enqueued concurrently in Redis, both workers make independent non-blocking calls to the Gemini LLM API before acquiring the PostgreSQL row lock during persistence. Because generation version tokens are not implemented in the current single-version schema, the last worker to acquire the row lock persists its validated result. Introducing a `generation_version` column is planned as a future architectural enhancement.

---

## 3. Initial Failure vs. Complete-Result Regeneration Lifecycle

### State Machine Transitions

```
Scenario 1: Initial Generation (New Session)
    [pending] ──► [generating] ──► [complete] (All skills valid & persisted)
                    │
                    └──► [failed] (Validation/API error; 0 skills published; retry state)

Scenario 2: Regeneration of Existing Complete Result
    [complete] ──► [generating] (Previous valid skills preserved in DB & visible in UI)
                     │
                     ├──► [complete] (Atomic replacement of skills; error cleared)
                     │
                     └──► [complete + warning] (Restores complete status; preserves old skills;
                                                records safe failure indicator for banner)
```

### Controller Reachability Analysis for Complete Regeneration
- **Current Code (`PortfoliosController#regenerate` lines 35-37):**
  ```ruby
  unless portfolio.failed?
    return json_error("Portfolio can only be regenerated when status is 'failed'", :unprocessable_entity)
  end
  ```
- **Finding:** The existing controller explicitly blocks regeneration when `status == 'complete'`, returning HTTP 422.
- **Decision & Plan:** To support complete-result regeneration with fallback preservation, `PortfoliosController#regenerate` will be updated to allow regeneration when `portfolio.failed? || portfolio.complete?`.

---

## 4. Numeric `ai_level` Contract and API Error Sanitization

### Numeric Contract
- **Database:** Integer `1..5`.
- **API Payload:** `ai_level: 3` (Integer).
- **Frontend TypeScript (`types/index.ts`):** `ai_level: number` (`1 | 2 | 3 | 4 | 5`).
- **Frontend Utility (`constants.ts`):** Narrow `parseLevel` to validate numeric bounds (`1..5`) and remove silent fallback to `1`.

### Safe Error Contract
- **API Response:** Standard envelope with safe user-facing message and stable error code:
  ```json
  {
    "status": "failed",
    "error": "Evaluation generation encountered a temporary issue. Please retry.",
    "error_code": "EVALUATION_FAILED"
  }
  ```
- **Logging Policy:**
  - Log `session_id`, `portfolio_id`, and exception class (e.g. `Gemini::HttpClient::TimeoutError`).
  - Never log candidate transcripts, prompts, raw Gemini response payloads, or environment secrets.

---

## 5. Candidate Invite URL Scope Decision

- **Decision:** **Option A (Include as an independent candidate-workflow fix).**
- **Plan:** Configure `FRONTEND_BASE_URL` (defaulting to `http://localhost:5173`) in `api/config/application.yml` and update `Session#invite_url` to reference `FRONTEND_BASE_URL`. Include unit test verifying candidate route alignment.

# F-01 — IDOR: Portfolio, PortfolioSkill, FitGapReport Accessible Across Tenants

> **Finding:** F-01 (P0* — P2 if single-tenant) · **Classification:** Defective Implementation · **Area:** Security / Privacy / Multi-tenancy · **UU PDP:** Yes
> **Branch:** `fix/f01-idor-tenant-scope` · **Status:** ✅ Completed & verified

---

## 1. Summary

The `Portfolio`, `PortfolioSkill`, and `FitGapReport` models store candidate evaluation data (evidence quotes, AI ratings, assessor overrides) **without tenant scoping**: there is no `tenant_id` column, no `include TenantScoped`, and the controller uses `Portfolio.find(params[:id])` directly.

As a result, **an assessor from Organization A can access and manipulate Organization B's data** merely by guessing numeric IDs:

- `GET /api/v1/portfolios/:id/export` — view transcript evidence, AI level, summary
- `POST /api/v1/portfolios/:id/regenerate_fitgap` — trigger an expensive process on another org's data
- `POST /api/v1/portfolios/:id/fitgap` — read another org's fit/gap decisions
- `POST /api/v1/portfolio_skills/:id/override` — **modify** another org's candidate skill ratings

This exposes candidates' personal data across organizational boundaries — relevant to UU PDP (Law No. 27/2022).

## 2. Analysis & Gap to Ideal

**Root cause:** the tenant-scoping pattern ALREADY exists in the codebase (`Session`, `Assessment`, `Vacancy` → `include TenantScoped`), but it was **not applied** to these 3 models. So this is a defective implementation, not a missing specification.

| File | Evidence (before fix) |
|------|------------------------|
| `api/app/models/portfolio.rb` | No `include TenantScoped`, no `tenant_id` |
| `api/app/models/portfolio_skill.rb` | No `include TenantScoped` |
| `api/app/models/fit_gap_report.rb` | No `include TenantScoped` |
| `api/app/controllers/api/v1/portfolios_controller.rb` | `Portfolio.find(params[:id])` without tenant scope |
| `api/app/controllers/api/v1/portfolio_skills_controller.rb` | `PortfolioSkill.joins(:portfolio).find(params[:id])` without tenant scope |
| `api/db/schema.rb` | 3 tables without `tenant_id` column |

**Gap to ideal:** every model holding candidate data MUST (1) have a `tenant_id` column + FK to `organizations`, (2) `include TenantScoped` (auto-scope), (3) have the controller use relational scope from `current_tenant`.

## 3. Options & Trade-offs

| Option | Authority | Enforcement point | Relative cost | Contextual fit |
|---|---|---|---|---|
| **A — `tenant_id` + `TenantScoped`** ✅ **CHOSEN & IMPLEMENTED** | Tenant columns and model concern | Database, model, controller, and worker | High | Reuses the repository's existing tenancy convention |
| **B — Relation joins** ❌ Not selected | Existing parent relations | Every query callsite | Medium | Avoids migrations but depends on repeated manual scoping |
| **C — Controller authorization** ❌ Not selected | Request controller | Selected HTTP endpoints | Low | Useful only as defense in depth, not primary isolation |

### Option A — Full `tenant_id` column + `TenantScoped` ✅ **CHOSEN & IMPLEMENTED**

| Dimension | Assessment |
|---|---|
| **End-to-End Behavior** | The database stores tenant ownership, models apply `TenantScoped`, controllers inherit scoped lookup, and workers/services must establish tenant context. |
| **Product Impact** | Candidate data remains isolated across clients, directly protecting confidentiality and UU PDP obligations. |
| **Cost & Complexity** | High: three migrations, backfill validation, indexes/foreign keys, and worker/service context changes. |
| **Long-Term Maintainability** | One reusable model concern matches Session, Assessment, and Vacancy and reduces per-query security decisions. |
| **Failure Modes** | Missing tenant context rejects creation; an incorrect backfill can misassign rows; and an omitted model include can leave a path unscoped. |
| **Operational Risks** | Migration locks, backfill mistakes, and worker failures during rollout can affect availability or ownership correctness. |
| **Mitigations** | Use reversible migrations, verified backfills, constraints/indexes, explicit worker context, and isolation tests for every access path. |
| **Contextual Fit** | The codebase already uses this tenancy convention, so the higher one-time cost reduces long-term mental and security complexity. |

### Option B — Scope via joins on existing relations ❌ Not selected

| Dimension | Assessment |
|---|---|
| **End-to-End Behavior** | Controllers and services would join through session and assessment relations and add tenant predicates to every read or mutation. |
| **Product Impact** | Correctly scoped callsites protect data, but one missed query reintroduces cross-tenant exposure. |
| **Cost & Complexity** | Medium initially: no migration, but every query needs custom joins and tests. |
| **Long-Term Maintainability** | Poorer than A because tenancy remains implicit and new callsites repeat security-sensitive query logic. |
| **Failure Modes** | A forgotten join, changed association, or alternate worker/console path can bypass isolation; joins can also duplicate or omit rows. |
| **Operational Risks** | Query complexity and join overhead grow with traffic and schema evolution, while audit coverage becomes harder to prove. |
| **Mitigations** | Centralize scopes, require review checklists, add per-endpoint isolation tests, and monitor query plans—controls that still do not eliminate omission risk. |
| **Contextual Fit** | It avoids schema work but conflicts with the repository's established tenant-column pattern and the severity of an IDOR finding. |

### Option C — Controller-level authorization check ❌ Not selected

| Dimension | Assessment |
|---|---|
| **End-to-End Behavior** | A `before_action` would validate tenant access for selected HTTP endpoints while models, workers, console tasks, and future endpoints remain tenancy-unaware. |
| **Product Impact** | Covered routes reject unauthorized users, but uncovered paths can still leak or mutate candidate data. |
| **Cost & Complexity** | Low initially, with small controller changes and route tests. |
| **Long-Term Maintainability** | Weak because every new endpoint must remember the guard and non-controller execution needs a different mechanism. |
| **Failure Modes** | Skipped callbacks, alternate endpoints, background jobs, and direct model access bypass the check; N+1 authorization queries can appear. |
| **Operational Risks** | Protection can silently erode as routes and jobs are added, creating a false sense of complete tenant isolation. |
| **Mitigations** | Apply shared controller concerns, deny by default, add route coverage tests, and retain model/database enforcement as the primary layer. |
| **Contextual Fit** | Appropriate as an additional boundary check, but insufficient as the sole fix for a P0 cross-tenant data exposure. |

### Trade-offs accepted (Option A)

| Trade-off | Justification |
|-----------|-------------|
| Migration complexity (~7 hours of work, backfill critical path) | One-time cost for long-term safety |
| Breaking change (create outside the request cycle fails) | Fail-safe; only 3 callsites, documented |
| Storage (+8MB per 1M rows) | Negligible; indexed filtering is actually faster |

## 4. Solution Implemented

**Database layer (3 migrations + schema):**
1. `add_tenant_id_to_portfolios` — nullable column → **SQL backfill** from `sessions.tenant_id` → verify NULL = 0 → NOT NULL → FK `ON DELETE CASCADE` → index
2. `add_tenant_id_to_portfolio_skills` — backfill from `portfolios.tenant_id` → same
3. `add_tenant_id_to_fit_gap_reports` — backfill from `portfolios.tenant_id` → same

All migrations **reversible** (`down` = drop index/FK/column).

**Model layer:**
```ruby
class Portfolio < ApplicationRecord
  include TenantScoped   # ← automatic default_scope by Current.tenant_id
  # PortfolioSkill & FitGapReport same
end
```

**Context layer (worker/service — the often-forgotten part):**
- `PortfolioGeneratorWorker` → wrap `Current.using(tenant_id: session.tenant_id)`
- `FitGapGeneratorWorker` → wrap `Current.using(tenant_id: ...)`
- `Sessions::EndHandler#create_portfolio` → wrap (called from REST **and** WebSocket)

> **AI-Human Verification moment:** the initial generator proposed wrapping the worker with `Current.tenant_id` — **wrong**, because Sidekiq has no request context (nil). Verified via call-path trace → correct: the tenant must be derived from the `session.tenant_id` relation. This is what the brief teaches: *"AI tooling as leverage to be verified, not an oracle"*.

## 5. Acceptance Criteria & Edge Cases

| # | Criterion | Input | Expected Behavior | Edge Case |
|---|-----------|-------|-------------------|-----------|
| 1 | GET isolation | Assessor of tenant A accesses portfolio B | 404 (anti-enumeration) | ID doesn't exist → 404 |
| 2 | Override isolation | Assessor A overrides skill of portfolio B | 404, no data changes | — |
| 3 | Migration reversible | `up` → `down` | Column removed, data intact | Rollback with data present — safe |
| 4 | Backfill correct | Count `tenant_id IS NULL` | 0 rows | Data without org relation → flagged, not guessed |
| 5 | Worker context | Generate without `Current.using` | Validation fails (`tenant_id can't be blank`) | Fail-safe, not silent |

## 6. Tests & Verification

**RSpec (25 examples, all passing):**

| Area | File | Coverage |
|------|------|---------|
| Model | `spec/models/portfolio_spec.rb` | default_scope filtering, cross-tenant → RecordNotFound, auto-assign, validation without context |
| Model | `spec/models/portfolio_skill_spec.rb` | same |
| Model | `spec/models/fit_gap_report_spec.rb` | same |
| Request | `spec/requests/portfolios_spec.rb` | `GET /export` cross-tenant → 404; same-tenant → 200; `POST /regenerate_fitgap` & `/fitgap` cross-tenant → 404 |

**Seeded fault test** ✅ — temporarily removed `include TenantScoped` on a scratch branch → spec `cross-tenant access raises RecordNotFound` **FAILED** (test caught the regression) → reverted → green again. History visible on the branch.

**Manual:** IDOR repro (assessor Beta accesses portfolio Alpha → 404), backfill `tenant_id IS NULL` = 0, FK constraint active.

## 7. AI-Human Verification

| Moment | Detail |
|-------|--------|
| **AI mistake (risky)** | Proposal to wrap the worker with `Current.tenant_id` — wrong assumption, a Sidekiq worker has no request context |
| **How verified** | Trace call path `PortfolioGeneratorWorker` → no HTTP middleware → `Current.tenant_id` nil; confirm the validation error at runtime |
| **Correction** | `Current.using(tenant_id: session.tenant_id)` — derive from the relation, not the outer context. Same applied in `FitGapGeneratorWorker` & `Sessions::EndHandler` |
| **Lesson** | AI tooling = leverage that must be verified; patterns like `Current.using` require understanding their execution context (HTTP vs background job) |

---

*F-01 completed & verified: 25 RSpec passing, seeded fault proven, ready to merge to umbrella.*

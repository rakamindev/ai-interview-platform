# Implementation Plan

- **Date:** 2026-08-18
- **Branch:** `assessment/trustworthy-results`
- **Next Phase:** Step 5 — TDD Implementation & Pull Request
- **Scope:** Slice A (Tenant Isolation) & Slice B (Trustworthy AI Portfolio Persistence)

---

## 1. Architectural Strategy Summary

1. **Slice A (Tenant Isolation):** Option A — Session-anchored association scoping. Enforce explicit queries via `Session.where(tenant_id: Current.tenant_id)` across all portfolio and override controllers. Return 404 for all foreign tenant access.
2. **Slice B (Trustworthy Portfolio Persistence):** Option A — In-memory schema validation, non-blocking LLM execution, pessimistic row locking (`with_lock`), atomic skill replacement, result preservation during regeneration failure, error sanitization, and numeric `ai_level` contract.
3. **Frontend Test Harness:** Vitest + React Testing Library + @testing-library/jest-dom + jsdom.

---

## 2. Proposed Files to Modify and Create

### 2.1 Backend Production Files (`api/`)
- `api/app/controllers/api/v1/portfolios_controller.rb`:
  - Enforce explicit session tenant scoping on `show`, `export`, `fitgap`, `show_fitgap`, and `regenerate_fitgap`.
  - Update `regenerate` to allow regeneration when `portfolio.failed? || portfolio.complete?`.
  - Sanitize user-facing error response payloads.
- `api/app/controllers/api/v1/portfolio_skills_controller.rb`:
  - Enforce explicit session tenant scoping on `override` action.
- `api/app/services/portfolios/generator.rb`:
  - In-memory payload validator for complete/strict skill definitions.
  - Wrap database persistence inside `portfolio.with_lock` transaction.
  - Implement complete-result preservation on regeneration failure.
- `api/app/workers/portfolio_generator_worker.rb`:
  - Establish `tenant_id` context from persisted root `Session` and clear in `ensure`.
- `api/app/models/session.rb`:
  - Reference `FRONTEND_BASE_URL` (port 5173) for candidate `invite_url`.

### 2.2 Frontend Production & Test Files (`web/`)
- `web/package.json`: Add test scripts (`"test": "vitest"`) and dev dependencies (`vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`).
- `web/vite.config.ts`: Configure Vitest environment and setup files.
- `web/src/test/setup.ts`: Setup matchers for jest-dom.
- `web/src/types/index.ts`: Update `PortfolioSkill.ai_level` to `number` (`1 | 2 | 3 | 4 | 5`).
- `web/src/utils/constants.ts`: Narrow `parseLevel` to numeric validation without silent L1 fallback.
- `web/src/components/portfolio/SkillPortfolioCard.tsx`: Direct numeric level rendering and layout resilience.
- `web/src/pages/portfolio/PortfolioPage.tsx`: Handle generating, initial failure, regeneration failure with preserved results, and empty states.
- `web/src/components/portfolio/SkillPortfolioCard.test.tsx`: Component tests.
- `web/src/components/portfolio/OverridePanel.test.tsx`: Component tests.
- `web/src/pages/portfolio/PortfolioPage.test.tsx`: Page integration tests.

### 2.3 Backend Test Files (`api/spec/`)
- `api/spec/requests/api/v1/portfolios_tenant_isolation_spec.rb` (Inverted to 404s; covers both cross-tenant and same-tenant actions).
- `api/spec/services/portfolios/generator_validation_spec.rb` (Covers all invalid level, missing skill, and duplicate skill cases).
- `api/spec/services/portfolios/generator_transaction_spec.rb` (Covers rollback and complete-result preservation).
- `api/spec/workers/portfolio_generator_worker_spec.rb` (Covers tenant context setup and cleanup).
- `api/spec/models/session_invite_url_spec.rb` (Covers frontend URL mapping).

---

## 3. Database Migrations and Rollback Plan
- **Migrations Required:** **No (0 migrations).** Existing PostgreSQL tables and enums are fully sufficient.
- **Rollback Plan:** Standard Git branch reversion. Zero schema rollback required.

---

## 4. Ordered Commit Boundaries

```
Step / Commit Boundary                                    Scope & Deliverables                               Est. Effort
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
1. test: define tenant isolation expectations             Invert request specs to red 404 assertions          20 mins
                                                          for cross-tenant portfolio & override endpoints.

2. fix: enforce tenant-owned portfolio access             Update `PortfoliosController` and                   30 mins
                                                          `PortfolioSkillsController` with explicit scoping.

3. test: define AI portfolio validation & atomicity       Add comprehensive validation, transaction, and      25 mins
                                                          worker tenant context specs.

4. fix: validate and persist portfolio atomically         Implement in-memory validation, row-locked          35 mins
                                                          transactions, result preservation, and error
                                                          sanitization in `Portfolios::Generator`.

5. test: add frontend automated test harness              Add Vitest, React Testing Library, and component    30 mins
                                                          unit/integration specs.

6. feat: present trustworthy portfolio result states      Align TypeScript contracts and handle all           30 mins
                                                          lifecycle states in `PortfolioPage.tsx`.

7. docs: record verification and trade-offs               Update reports with final test suite execution logs. 15 mins
```

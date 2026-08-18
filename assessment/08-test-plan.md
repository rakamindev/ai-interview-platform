# Verification and Test Strategy Plan

- **Date:** 2026-08-18
- **Branch:** `assessment/trustworthy-results`
- **Scope:** Multi-Layer Test Strategy Across Backend, Frontend, and Workers

---

## 1. Characterization Test Inversion Matrix

The baseline characterization tests captured and proved defective behavior. During implementation, these assertions are inverted to define the target desired behavior:

```
Test File / Area                                  Baseline Assertion (Defective)                 Inverted Assertion (Target)
───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
1. spec/requests/api/v1/                          Tenant A gets 200 on Tenant B export and       Tenant A receives 404 Not Found on
   portfolios_tenant_isolation_spec.rb            201 on Tenant B override.                      export, override, and fit/gap.

2. spec/services/portfolios/                      level: nil is silently coerced to L1.          level: nil raises validation error
   generator_level_default_spec.rb                                                               and marks generation failed.

3. spec/services/portfolios/                      Validation error destroys valid skills and     Validation error executes rollback,
   generator_transaction_spec.rb                  writes partial rows.                           preserving previous skills.

4. spec/models/session_invite_url_spec.rb         Formats with API port 3001.                    Formats with FRONTEND_BASE_URL (5173).

5. spec/requests/api/v1/                          Rejects missing scheme with 403 Forbidden.     Unchanged (already validates security
   jwt_unresolved_scheme_spec.rb                                                                 boundary).
```

### Red-to-Green Transition Workflow
1. **Red Baseline:** Invert characterization assertions to assert target security and data integrity rules.
2. **Execute (Red):** Run `bundle exec rspec` to confirm all inverted tests fail against unpatched code.
3. **Implement Fixes:** Apply explicit association scoping, payload validation, atomic transactions, and frontend URL mapping.
4. **Execute (Green):** Run `bundle exec rspec` to verify all tests pass with 0 failures.

---

## 2. Backend Automated Test Suite (`api/spec/`)

### 2.1 Request Specifications (`spec/requests/api/v1/`)
- `portfolios_tenant_isolation_spec.rb`:
  - **Cross-Tenant Rejections:**
    - `GET /api/v1/portfolios/:id/export?format=json` for foreign tenant -> `404 Not Found`.
    - `POST /api/v1/portfolio_skills/:id/override` for foreign tenant -> `404 Not Found`.
    - `POST /api/v1/portfolios/:id/fitgap` for foreign tenant -> `404 Not Found`.
    - `GET /api/v1/portfolios/:id/fitgap/:vacancy_id` for foreign tenant -> `404 Not Found`.
    - `POST /api/v1/portfolios/:id/regenerate_fitgap` for foreign tenant -> `404 Not Found`.
  - **Same-Tenant Success:**
    - `GET /api/v1/sessions/:id/portfolio` for own tenant -> `200 OK`.
    - `GET /api/v1/portfolios/:id/export?format=json` for own tenant -> `200 OK`.
    - `POST /api/v1/portfolio_skills/:id/override` for own tenant -> `201 Created`.
    - `POST /api/v1/sessions/:id/portfolio/regenerate` for own tenant -> `200 OK`.
- `portfolios_error_sanitization_spec.rb`:
  - Verify that failed generation returns `{ status: "failed", error: "...", error_code: "..." }` and contains NO stack traces, internal URLs, or prompt fragments.

### 2.2 Service Specifications (`spec/services/portfolios/`)
- `generator_validation_spec.rb`:
  - Tests rejection for: missing `level`, `level: null`, `level: 0`, `level: 6`, `level: "L3"`, `level: 3.5`, `level: true`.
  - Tests rejection for: missing configured skills, duplicate skill IDs, invalid confidence values, empty evidence arrays.
- `generator_transaction_spec.rb`:
  - Tests atomic rollback: failure on skill $N$ rolls back skills $1 \dots N-1$.
  - Tests complete-result regeneration failure: existing valid skills remain intact in the database.

### 2.3 Worker Specifications (`spec/workers/`)
- `portfolio_generator_worker_spec.rb`:
  - Verifies that `tenant_id` is derived from the persisted root `Session`.
  - Verifies that `RequestStore.store[:tenant_id]` is set during job execution and cleared in `ensure`.
  - Verifies that cross-tenant session lookups abort safely.
- `fit_gap_generator_worker_spec.rb`:
  - Verifies that mismatched portfolio/vacancy tenants abort without processing.

---

## 3. Frontend Automated Test Suite (`web/src/`)

### 3.1 Test Harness Setup
- **Dependencies (Planned):** `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`.
- **Configuration Files:**
  - `web/vite.config.ts` (configured with `test: { environment: 'jsdom', setupFiles: './src/test/setup.ts' }`).
  - `web/src/test/setup.ts` (imports `@testing-library/jest-dom` matchers and mock server cleanup).

### 3.2 Automated Frontend Component & Page Specs
1. `web/src/components/portfolio/SkillPortfolioCard.test.tsx`:
   - Renders numeric `ai_level` (e.g. `ai_level: 3` renders `"L3"` and `"Proficient"`).
   - Renders high/medium/low confidence badges accurately.
   - Renders candidate evidence quotes with proper text wrapping.
   - Renders human assessor override badge when present.
2. `web/src/components/portfolio/OverridePanel.test.tsx`:
   - Validates level radio selection (1..5) and notes input.
   - Submits override payload to API.
   - Displays error banner upon save failure.
3. `web/src/pages/portfolio/PortfolioPage.test.tsx`:
   - **Loading State:** Displays skeleton loader while fetching initial data.
   - **Generating State:** Displays animated spinner with polite accessibility text.
   - **Successful Result:** Renders all portfolio skill cards and enables export actions.
   - **Initial Generation Failure:** Displays error banner with `"Retry Generation"` button.
   - **Regeneration Failure with Preserved Result:** Displays previous valid skill cards alongside failure alert banner.
   - **Empty / Unavailable State:** Displays honest empty state when no portfolio exists.
   - **Action Buttons Guard:** Verifies PDF Export and Fit/Gap buttons are disabled when portfolio is not `complete`.

---

## 4. Manual and Seeded Fault Verification Plan

```
Fault Scenario                          Injection Technique                         Expected Verified Outcome
─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
1. Malformed JSON from Gemini           Mock HttpClient returning invalid JSON      Portfolio marks 'failed',
                                                                                    previous valid skills preserved.

2. Null level in single skill           Mock HttpClient returning level: nil        Generation fails atomically,
                                                                                    0 partial rows written.

3. Cross-Tenant ID in URL               Navigate to /portfolio/:foreign_id          404 Not Found toast displayed;
                                                                                    no foreign data rendered.

4. 1000-char Evidence Quote             Inject synthetic long string                Text wraps cleanly without card
                                                                                    overflow across mobile & desktop.
```

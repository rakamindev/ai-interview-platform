# Final Problem Definition

- **Date:** 2026-08-18
- **Branch:** `assessment/trustworthy-results`
- **Scope:** Slice A (Tenant Isolation) & Slice B (Trustworthy AI Portfolio Persistence)

---

## Problem 1: Tenant Isolation Defects

### 1. Observed Behavior
The `Portfolio` model does not include the `TenantScoped` concern and lacks a `tenant_id` column. When controller actions look up a `Portfolio` or `PortfolioSkill` by direct ID, no tenant boundary check is performed against `Current.tenant_id`.

### 2. Executable Evidence
- `api/spec/requests/api/v1/portfolios_tenant_isolation_spec.rb`:
  - Demonstrates that an assessor authenticated under Organization A (`scheme: tenant-a`) successfully executes `GET /api/v1/portfolios/:portfolio_b_id/export?format=json` and receives private candidate quotes belonging to Organization B.
  - Demonstrates that Tenant A successfully executes `POST /api/v1/portfolio_skills/:skill_b_id/override` and modifies evaluation ratings for a candidate of Organization B.

### 3. Preconditions & Attacker Profile
- Any authenticated assessor or recruiter with a valid JWT issued for their own organization.
- By incrementing or guessing integer IDs (`params[:id]`), they can access or modify foreign tenant resources.

### 4. Exposed Resources
- Candidate skill portfolios (`Portfolio`).
- Candidate behavioral evidence quotes and AI ratings (`PortfolioSkill`).
- Assessor qualitative calibration notes and rating overrides (`AssessorOverride`).
- Fit/Gap comparative reports against vacancies (`FitGapReport`).
- Exported assessment documents in PDF and JSON formats (`GET /portfolios/:id/export`).

### 5. Severity Rationale
- **Severity: P0 (Critical Security & Compliance Defect).**
- Direct violation of multi-tenant confidentiality, enterprise trust, and data privacy legislation (UU PDP No. 27/2022 Art. 35).

### 6. Classification
- **Defective Implementation:** The platform architecture establishes tenant isolation for top-level entities (`Assessment`, `Session`, `Vacancy`), but fails to propagate tenant ownership and access checks to derived portfolio and override endpoints.

### 7. Exact In-Scope Endpoints
1. `GET /api/v1/portfolios/:id/export`
2. `POST /api/v1/portfolios/:id/fitgap`
3. `GET /api/v1/portfolios/:id/fitgap/:vacancy_id`
4. `POST /api/v1/portfolios/:id/regenerate_fitgap`
5. `POST /api/v1/portfolio_skills/:id/override`
6. `POST /api/v1/sessions/:id/portfolio/regenerate`

### 8. Non-Goals
- Re-architecting the PostgreSQL schema search path or Apartment multi-tenant model.
- Introducing complex cross-tenant collaboration or multi-organization user roles.

---

## Problem 2: Untrustworthy AI Portfolio Persistence

### 1. Missing or Null AI Rating Coerced to Level 1
- **Code:** `api/app/services/portfolios/generator.rb:161, 173` (`ai_level: skill_data['level'].to_i.clamp(1, 5)`).
- **Behavior:** When Gemini Pro returns `null`, empty string, or omits the `"level"` key, `.to_i` returns `0`, and `.clamp(1, 5)` coerces it to `1`.
- **Impact:** Candidates are branded with the lowest possible proficiency score (L1) for skills that were never assessed.
- **Evidence:** Verified by `api/spec/services/portfolios/generator_level_default_spec.rb`.

### 2. Destructive and Non-Transactional Regeneration
- **Code:** `api/app/services/portfolios/generator.rb:150-179` (`save_skills`).
- **Behavior:** `save_skills` executes `portfolio.portfolio_skills.destroy_all` before iterating through newly generated skills. Without an enclosing database transaction (`ActiveRecord::Base.transaction`), any validation or network failure on a later skill leaves previous valid skills deleted and new skills in a corrupted, partial state.
- **Impact:** Historical evaluation data is destroyed upon transient regeneration failure.
- **Evidence:** Verified by `api/spec/services/portfolios/generator_transaction_spec.rb`.

### 3. Raw Internal Exception Exposure
- **Code:** `api/app/services/portfolios/generator.rb:34`, `api/app/controllers/api/v1/sessions_controller.rb:75`.
- **Behavior:** Raw exception strings (`e.message`) are saved directly into `portfolio.generation_error` and rendered in the API response JSON (`render json: { status: 'failed', error: portfolio.generation_error }`).
- **Impact:** Upstream API errors, HTTP stack details, prompt instructions, or raw transcript fragments can leak to client browsers.

### 4. [WEB-02] Contract Mismatch: `ai_level` Types & `parseLevel` Runtime Effect
- **Observation:**
  - Backend database stores `ai_level` as an `integer` (`1..5`).
  - Backend controller serializes `ai_level: skill.ai_level` as an `integer` (`1..5`).
  - Frontend TypeScript interface `PortfolioSkill` in `web/src/types/index.ts` declares `ai_level: string` (`"L1" | "L2" | ...`).
  - Frontend components call `parseLevel(skill.ai_level)` defined in `web/src/utils/constants.ts`:
    ```typescript
    export function parseLevel(level: string | number): number {
      if (typeof level === "number") return level;
      const n = parseInt(level.replace(/\D/g, ""), 10);
      return isNaN(n) ? 1 : n;
    }
    ```
- **Verified Runtime Effect:**
  - When backend passes integer `3`, `typeof level === "number"` evaluates to true, returning `3` directly.
  - However, if `ai_level` is `undefined`, `null`, or an unexpected string, `parseLevel` silently falls back to `1` (`return isNaN(n) ? 1 : n`).
  - This frontend fallback masks backend data issues by silently turning unrated/corrupted skills into Level 1 in the UI!
  - Furthermore, `AssessorOverride` in `web/src/types/index.ts` declares `ai_level: number`, creating internal type incoherence.

### 5. Severity Rationale
- **Severity: P1 (High Product Integrity & Fairness Defect).**
- Corrupts scoring, risks unfair candidate rejection, and causes silent data loss.

### 6. Non-Goals
- Changing the underlying Gemini Prompt structure or replacing the LLM provider.
- Implementing real-time manual scoring editors during active calls.

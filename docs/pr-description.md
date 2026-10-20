# Pull Request: Comprehensive Post-Interview Candidate Evaluation & Vacancy Fit/Gap Workflow

- **PR Branch:** `feature/case-study-fullstack-irfan-aprilyana`
- **Target Base Branch:** `main` (commit `b836d02`)
- **Author:** `Irfanz8 <52303297+Irfanz8@users.noreply.github.com>`
- **Declared Engineering Depth:** **`FRONTEND-HEAVY`** (Pairing deep React/TypeScript UI architecture, state correctness, and accessibility with a rigorous multi-tenant backend contract)

---

## 1. Problem and Affected Users / Candidates

### The Core Problem
In the post-interview evaluation workflow, assessors, recruiters, and hiring managers review AI-synthesized competency assessments and evaluate candidate alignment against specific open vacancies. Previously, three systemic breakdowns crippled this workflow:
1. **Misleading Competency Attribution:**
   When an interview ended early or specific skills were never probed by the conversational AI, the platform defaulted those skills to `Level 1` ("Novice") with low confidence. This falsely penalized candidates who never had the chance to demonstrate proficiency, confusing assessors and distorting candidate ratings.
2. **Opaque Override Workflow & Loss of Evidence:**
   When human assessors reviewed candidate competency, overriding an AI rating lacked validation, provenance tracking, and accessible interaction patterns. In addition, the Fit/Gap report ignored manual overrides, continuing to compare against outdated AI ratings.
3. **Fragile Async Fit/Gap Contract & Broken Tenant Isolation:**
   When navigating to a Fit/Gap report, the UI treated any HTTP `404` as "report not generated yet" and automatically enqueued asynchronous AI generation jobs (`POST /fitgap`), causing infinite request loops and duplicate worker jobs on missing vacancies. Furthermore, portfolio and override endpoints lacked tenant scoping, allowing cross-tenant resource reads and modifications via IDOR.

### Affected Stakeholders
- **Candidates:** Unfairly marked down to Novice (L1) on skills that were never asked due to interview time limits or early drop-off.
- **Assessors:** Forced to use inaccessible, unvalidated forms with no clear evidence linkage, risking accidental overrides without rationale.
- **Hiring Managers & Recruiters:** Received distorted Fit/Gap vacancy recommendations that silently ignored assessor corrections or broke with unhandled 404 errors.

---

## 2. Evidence of Previous Behavior

Prior to this pull request, the platform exhibited the following verified behaviors:
1. **Unprobed Skills Persisted as L1 Novice:**
   In `Portfolios::Generator`, skills with zero interview turns were assigned `level: 1` and persisted into `portfolio_skills`. In the UI, assessors saw unprobed skills grouped alongside assessed skills as failing competencies.
2. **Infinite Job Spawning on HTTP 404:**
   In `FitGapReportPage.tsx`, catching an HTTP `404` from `GET /api/v1/portfolios/:id/fitgap/:vacancyId` triggered `portfoliosApi.triggerFitGap(...)`. When a vacancy ID did not exist or was deleted, every page render triggered duplicate Sidekiq `FitGapGeneratorWorker` jobs.
3. **Cross-Tenant IDOR:**
   In `PortfoliosController` and `PortfolioSkillsController`, queries like `Portfolio.find(params[:id])` and `PortfolioSkill.find(params[:id])` resolved records without verifying `session.tenant_id == current_tenant.id`. Requests with mismatched `X-Tenant-Scheme` headers returned `200 OK` and permitted unauthorized assessor overrides.
4. **Validation Failure Leaks `[object Object]`:**
   When submitting an invalid override note, `ApiController#json_error` returned an array of structured error objects (`{"errors":[{"status":422,"message":"..."}]}`). The frontend typed errors as `string[]`, stringifying the payload into `[object Object]` inside the error banner.

---

## 3. New End-to-End Behavior

With this pull request, the complete evaluation workflow operates reliably and truthfully end-to-end:
1. **Truthful 4-Tier Assessment Semantics:**
   - Skills are explicitly classified into 4 distinct states:
     - `not_probed`: 0 interview responses; isolated in `UnassessedSkillsSection` with clear explanatory copy.
     - `insufficient_evidence`: Exactly 1 turn; separated with an amber warning indicating insufficient interview depth.
     - `partial`: 2–3 turns with partial rubric evaluation; displayed with response counter.
     - `covered`: Complete transcript evidence evaluated against standard rubric.
2. **Accessible, Validated Assessor Overrides with Full Provenance:**
   - Assessors can override competency levels via [`OverridePanel.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/components/portfolio/OverridePanel.tsx) with mandatory $\ge 5$ character rationale validation.
   - The panel manages keyboard focus (`autofocus` on textarea, `Escape` to close, returns focus to trigger button) and uses React `useId()` for unique radio group DOM IDs.
   - When an override is saved, [`SkillPortfolioCard.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/components/portfolio/SkillPortfolioCard.tsx) displays an emerald callout showing `Latest Assessor Override: AI Lx → Assessor Ly` along with timestamp, assessor identity, and verbatim justification.
3. **Robust Fit/Gap Asynchronous State Contract:**
   - `GET /api/v1/portfolios/:id/fitgap/:vacancyId` returns an explicit contract:
     - HTTP `200 {"status":"ready","report":{...}}` when report is ready.
     - HTTP `200 {"status":"generating","report":null}` when Sidekiq worker is running.
     - HTTP `200 {"status":"not_generated","report":null}` when never generated.
     - HTTP `200 {"status":"failed","message":"..."}` when AI generation fails.
     - HTTP `404 Not Found` when parent portfolio or vacancy does not exist in the tenant's workspace.
   - [`FitGapReportPage.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/pages/fitgap/FitGapReportPage.tsx) treats `404` as terminal `not_found` and **never** auto-triggers generation on 404s.
   - Polling is bounded (`MAX_POLL_ATTEMPTS = 12` at 5s intervals = 60s) with options to **Check Status** (`GET`) or **Restart Generation** (`POST`).
4. **Scannable Comparison Table with Override Integrity:**
   - [`ComparisonTable.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/components/fitgap/ComparisonTable.tsx) uses effective skill ratings (incorporating assessor overrides) to calculate `Match`, `Exceeds`, and `Gap`.
   - Displays a 4-category summary strip, clear `Required` vs `Candidate` levels with descriptions, and explicit `AI Lx → Ly` provenance pills with assessor rationale.
   - Unassessed skills are clearly styled with dashed borders (`—`) and labeled `Not probed` or `Insufficient evidence`.

---

## 4. Declared Engineering Depth: FRONTEND-HEAVY

Engineering depth is centered on modern React architecture, asynchronous state machine design, component composition, web accessibility (WCAG 2.1 AA), responsive visual design, and behavioral test engineering:

### A. Component Boundaries and Information Architecture
- **Separation of Orchestration and Presentation:**
  - Container pages ([`PortfolioPage.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/pages/portfolio/PortfolioPage.tsx), [`FitGapReportPage.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/pages/fitgap/FitGapReportPage.tsx)) handle data fetching, stale-request cancellation (`latestRequestIdRef`), error banners, and polling state.
  - Presentation components ([`SkillPortfolioCard.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/components/portfolio/SkillPortfolioCard.tsx), [`ComparisonTable.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/components/fitgap/ComparisonTable.tsx), [`SessionCoverageBanner.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/components/portfolio/SessionCoverageBanner.tsx), [`UnassessedSkillsSection.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/components/portfolio/UnassessedSkillsSection.tsx)) remain modular, purely reactive, and independently testable.
- **Strict Reading Order & Card Hierarchy:**
  - Inside [`SkillPortfolioCard.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/components/portfolio/SkillPortfolioCard.tsx):
    1. Skill Name & Coverage Pill (`Assessed` vs `Partial`)
    2. Effective Level Badge (`LevelBadge.tsx`)
    3. Provenance & Confidence Pill (`ConfidenceIndicator.tsx` + override banner)
    4. AI Evaluation Summary
    5. Supporting Verbatim Transcript Excerpts (blockquote cards)
    6. Override Action Button

### B. Asynchronous State & Interaction Correctness
- **Race Condition Prevention:**
  - Managed via incremental request ID refs (`latestRequestIdRef`). Fast tab switching or vacancy changes ignore superseded network responses.
- **Duplicate Click & In-Flight Protection:**
  - Submit buttons disable immediately upon click and display loading spinners.
  - `triggeredGenerationRef` prevents duplicate `POST /fitgap` invocations when rendering ungenerated reports.
- **Preservation of User Input on Error:**
  - If backend override submission fails (e.g. 422 or 500), [`OverridePanel.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/components/portfolio/OverridePanel.tsx) maintains the user's selected radio rating and typed rationale, displaying a clear `role="alert"` notification.

### C. Web Accessibility (WCAG 2.1 AA) & Keyboard Navigation
- **Unique DOM IDs:** Implemented React `useId()` inside [`LevelRadio.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/components/assessment/LevelRadio.tsx) ensuring collision-free input IDs across cards.
- **Focus Trap & Traversal:** Opening [`OverridePanel.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/components/portfolio/OverridePanel.tsx) moves focus to the rationale textarea; `Escape` key closes the panel and returns focus to the trigger button (`aria-expanded`).
- **Semantic Live Regions & Progress:** Session completion renders `role="progressbar"` with `aria-valuenow` and `aria-valuemax`; errors and status changes render inside `role="alert"` and `aria-live="polite"` regions.

### D. Responsive Behavior & Visual Design
- Expanded page width from cramped `max-w-2xl` (`672px`) to `max-w-4xl mx-auto space-y-6 pb-10` (`896px`).
- Responsive table containers with `overflow-x-auto` (minimum table width `680px`), text wrapping (`break-words`), and responsive flex layouts for mobile screens (`375px`) up to desktop (`1280px`).

---

## 5. Supporting Backend and Data-Model Changes

The backend was modified strictly to support the frontend workflow truthfully and securely:
1. **Tenant Isolation:**
   - Added `current_tenant` extraction in [`ApplicationController`](file:///e:/New%20folder/ai-interview-platform/api/app/controllers/application_controller.rb#L4-L24) resolving trusted schema from session/JWT or authorized request headers.
   - Enforced tenant-scoped queries in `PortfoliosController`, `PortfolioSkillsController`, and `FitGapGeneratorWorker`.
2. **Explicit 4-Tier Assessment Calculation:**
   - Updated `Portfolios::Generator` to assign `assessment_status: :not_probed` (0 turns) and `assessment_status: :insufficient_evidence` (1 turn) without creating misleading `L1` ratings.
3. **Safe Fit/Gap Contract & Secret Sanitization:**
   - Modified `PortfoliosController#show_fitgap` to return HTTP `200 {"status":"not_generated"}` instead of `404` when the report has not been generated.
   - Added [`PortfoliosController#sanitize_generation_error`](file:///e:/New%20folder/ai-interview-platform/api/app/controllers/api/v1/portfolios_controller.rb#L353-L366) to strip internal stack traces, URLs, and API keys before sending error messages to the client.

---

## 6. Acceptance Criteria and Verification Matrix

| Criterion | Verification Method | Genuine Evidence | Status |
| :--- | :--- | :--- | :---: |
| **AC-01: Multi-Tenant Isolation** | RSpec + Live HTTP | [`evaluation_workflow_spec.rb`](file:///e:/New%20folder/ai-interview-platform/api/spec/requests/api/v1/evaluation_workflow_spec.rb#L1-L150) (`3 examples, 0 failures`) & Live HTTP call with mismatched `X-Tenant-Scheme` returns `403 Forbidden` (`{"errors":[{"status":403,"message":"Unauthorized request"}]}`). Zero `AssessorOverride` rows or Sidekiq jobs created. | **PASS** |
| **AC-02: 4-Tier Semantics** | RSpec + Live DB + Vitest | Live HTTP returns `not_probed` (0 turns) and `insufficient_evidence` (1 turn); Vitest verifies [`PortfolioPage`](file:///e:/New%20folder/ai-interview-platform/web/src/pages/portfolio/PortfolioPage.tsx) renders distinct visual indicators and explanations. | **PASS** |
| **AC-03: Coverage Banner** | Vitest + Accessibility check | [`SessionCoverageBanner.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/components/portfolio/SessionCoverageBanner.tsx) renders `2 of 4 configured skills assessed`, `Ended Early by Candidate`, `2m 0s`, and `role="progressbar"`. | **PASS** |
| **AC-04: Override Validation & Provenance** | RSpec + Live HTTP + Vitest | `POST /portfolio_skills/:id/override` rejects short note with HTTP `422`; accepts valid note with HTTP `201`. UI renders `Latest Assessor Override: AI L2 → Assessor L4` with timestamp and verbatim rationale. | **PASS** |
| **AC-05: Accessible Radio Group & Focus** | Vitest behavioral suite | [`LevelRadio.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/components/assessment/LevelRadio.tsx) generates unique IDs via `useId()`. Focus moves to textarea on open, restores to trigger button on `Escape`. | **PASS** |
| **AC-06: Safe Fit/Gap Contract & Deduplication** | RSpec + Live HTTP + Vitest + Seeded Fault | `GET /fitgap/:vacancyId` returns `200 {"status":"not_generated"}`; missing vacancy returns `404`. Frontend never auto-triggers generation on 404s and deduplicates in-flight requests. | **PASS** |
| **AC-07: Scannable Comparison Table** | Vitest + Build check | [`ComparisonTable.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/components/fitgap/ComparisonTable.tsx) renders 4-category summary strip, `Required` vs `Candidate` levels with descriptions, and `AI Lx → Ly` provenance callouts. | **PASS** |
| **AC-08: Sanitized Error Presentation** | RSpec + Vitest | Backend sanitizes internal errors/tokens; frontend displays sanitized alerts with bounded polling recovery (60s). | **PASS** |

---

## 7. Actual Test and Build Results

### Backend Suite (RSpec)
Command: `bundle exec rspec spec/requests/api/v1/evaluation_workflow_spec.rb --format documentation`
```text
Finished in 6.44 seconds (files took 15.26 seconds to load)
10 examples, 0 failures
```

### Frontend Behavioral Suite (Vitest)
Command: `npm test` (`vitest run`)
```text
 ✓ src/__tests__/authAndValidation.test.tsx (4 tests)
 ✓ src/__tests__/evaluationWorkflow.test.tsx (11 tests)
   ✓ Evaluation Workflow — Stage 5B Frontend Verification > PortfolioPage — Session Coverage, 4-Tier Semantics & Async States (5 tests)
   ✓ Evaluation Workflow — Stage 5B Frontend Verification > SkillPortfolioCard, OverridePanel & LevelRadio — Accessibility & Validation (2 tests)
   ✓ Evaluation Workflow — Stage 5B Frontend Verification > FitGapReportPage & ComparisonTable — Status Contract, Narratives & Table Columns (4 tests)

 Test Files  2 passed (2)
      Tests  15 passed (15)
```

### Frontend Production Build (TypeScript & Vite)
Command: `npm run build` (`tsc && vite build`)
```text
vite v6.4.4 building for production...
transforming...
✓ 1941 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                         0.64 kB │ gzip:  0.34 kB
dist/assets/index-CoTRE1FX.css         44.32 kB │ gzip:  8.35 kB
dist/assets/vendor-ui-DYhNZzle.js     104.61 kB │ gzip: 35.42 kB
dist/assets/vendor-misc-CXS76-aN.js   118.20 kB │ gzip: 41.33 kB
dist/assets/vendor-react-D3w9ihCe.js  181.45 kB │ gzip: 59.79 kB
dist/assets/index-rDLeXh7J.js         313.24 kB │ gzip: 87.89 kB
✓ built in 11.04s
```

---

## 8. Seeded Fault Proof

- **Protected Frontend Rule:**
  [`FitGapReportPage.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/pages/fitgap/FitGapReportPage.tsx) must treat HTTP `404` on `GET /api/v1/portfolios/:id/fitgap/:vacancyId` as a terminal `not_found` state and must **never** auto-trigger `POST /api/v1/portfolios/:id/fitgap` (`portfoliosApi.triggerFitGap`) when `GET` returns `404`.
- **Recorded Git Proof:**
  1. **Clean Baseline Commit:** `9ccdb66` on `feature/case-study-fullstack-irfan-aprilyana` (Pre-fault: `10 passed (10)`).
  2. **Scratch Branch Created:** `scratch/seeded-fault-test-irfan-aprilyana`.
  3. **Intentional Fault Committed:** Commit `c935c2b` (`test(fault): seed intentional 404 auto-trigger fault in FitGapReportPage`) replaced the terminal 404 alert with an auto-trigger call to `portfoliosApi.triggerFitGap`.
  4. **Captured Test Failure (`task-947`):**
     ```text
     FAIL src/__tests__/evaluationWorkflow.test.tsx > ... > treats HTTP 404 from getFitGap as terminal not_found and never calls triggerFitGap
     TestingLibraryElementError: Unable to find role="alert"
      ❯ src/__tests__/evaluationWorkflow.test.tsx:360:34
         360|       const alert = await screen.findByRole("alert");
         361|       expect(alert).toHaveTextContent(/not found in your workspace/i);
         362|       expect(portfoliosApi.triggerFitGap).not.toHaveBeenCalled();
     Test Files  1 failed (1)
          Tests  1 failed | 9 passed (10)
     ```
  5. **Revert Commit & Recovery (`task-953`):** Commit `f8f5ab5` (`Revert "test(fault): seed intentional 404 auto-trigger fault in FitGapReportPage"`). Test output recovered: `10 passed (10)` in `2834ms`.
  6. **Clean Return:** Returned to `feature/case-study-fullstack-irfan-aprilyana`. The scratch branch was kept isolated and never merged.

---

## 9. Genuine AI Verification Moment

- **Context:** Stage 5B/5C Frontend-to-Backend Error Contract Integration.
- **Original AI Suggestion:**
  During initial frontend scaffolding, the AI assumed Rails validation errors in `PortfolioSkillsController#override` returned an array of plain strings: `{ errors: ["..."] }`.
- **Risk if Unchecked:**
  Rails `ApiController#json_error` actually wraps errors as an array of objects: `{"errors":[{"status":422,"message":"Assessor notes is too short (minimum is 5 characters)"}]}`. Stringifying `errData.errors[0]` in JSX directly rendered `"[object Object] (Your changes have been preserved.)"` in the user-facing alert banner.
- **Independent Verification:**
  Executed a live HTTP call `POST /api/v1/portfolio_skills/:id/override` with `"ok"` against `http://127.0.0.1:3001` (`task-792`), capturing the raw JSON payload.
- **Correction Applied:**
  Updated [`OverridePanel.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/components/portfolio/OverridePanel.tsx#L106-L125) to parse `typeof firstErr === "string" ? firstErr : firstErr?.message` and updated Vitest mock fixtures in [`evaluationWorkflow.test.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/__tests__/evaluationWorkflow.test.tsx#L273-L284).

---

## 10. Screenshots and Visual Verification

- **Baseline UI State:** Captured during initial case study exploration (`media_1792345944493_d302e1d0.png` showing cramped portfolio cards with missing unassessed skill classifications).
- **Refined UI State & Manual Viewport Checklist (Pending Live Browser Screenshot Capture):**
  - Unified `max-w-5xl` layout across [`AssessorLayout.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/components/layout/AssessorLayout.tsx), [`PortfolioPage.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/pages/portfolio/PortfolioPage.tsx), and [`FitGapReportPage.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/pages/fitgap/FitGapReportPage.tsx) with `16px` mobile gutters (`px-4`) and `24–32px` desktop padding (`sm:px-6 lg:px-8`).
  - Full-width [`OverridePanel.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/components/portfolio/OverridePanel.tsx) mounted in the footer of [`SkillPortfolioCard.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/components/portfolio/SkillPortfolioCard.tsx) with responsive `grid-cols-2 sm:grid-cols-5` [`LevelRadio.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/components/assessment/LevelRadio.tsx) cards and live character counter.
  - 4-category visual summary strip (`Match`, `Exceeds`, `Gap`, `Not assessed`), `Low AI confidence` / `Partial coverage` indicators, and dashed `Not assessed` rows in [`ComparisonTable.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/components/fitgap/ComparisonTable.tsx), plus side-by-side `lg:grid-cols-2` overall and culture narrative cards on [`FitGapReportPage.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/pages/fitgap/FitGapReportPage.tsx).

---

## 11. Trade-offs, Limitations, and Rollback Considerations

### Trade-offs
- **Short-Polling vs WebSockets:** Used bounded HTTP polling (5-second intervals, 12 attempts) for Fit/Gap generation rather than ActionCable WebSockets. This avoids additional stateful connection infrastructure while providing clear, bounded recovery states.
- **Client Rationale Validation Floor:** Set minimum rationale length to 5 characters on both frontend and backend to prevent accidental single-character overrides (`"."`, `"ok"`), while keeping the barrier low for rapid assessor feedback.

### Known Limitations
- Visual regression tests rely on Vitest DOM component testing and build compilation rather than end-to-end Playwright screenshot pixel diffing.
- Multi-tenant query enforcement was focused on the post-interview evaluation workflow controllers (`PortfoliosController`, `PortfolioSkillsController`, `FitGapGeneratorWorker`).

### Rollback Strategy
- This branch introduces zero destructive database schema changes or data migrations.
- If rollback is required, reverting the PR merge commit completely restores previous frontend routes and backend controllers without data loss.

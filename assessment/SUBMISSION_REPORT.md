# Engineering & Product Execution Report
## Case Study: Fullstack Product Engineer (Frontend Revamp Focus)
**Platform:** AI Interview Platform (`ai-interview-platform`)  
**Candidate Submission Deliverable:** Step-by-Step Monozukuri Transformation Report  

---

## 1. Executive Summary & Pull Request Link
* **GitHub Pull Request:** [https://github.com/rakamindev/ai-interview-platform/pull/212](https://github.com/rakamindev/ai-interview-platform/pull/212)
* **Repository:** `github.com/rakamindev/ai-interview-platform`

* **Feature Branch:** `feature/frontend-product-revamp`
* **Seeded Fault Test Branch:** `scratch/seeded-fault-test`
* **Focus Area:** Frontend Product Engineering Depth with Essential Backend Contract Alignment (50% Product Impact & Monozukuri Craft, 50% Engineering Execution).

---

## 2. Step 2: Deep Context & Domain Immersion

### A. The Product Ecosystem
The **AI Interview Platform** is an intelligent, voice-first skills assessment platform designed to replace scripted, theory-recitation questionnaires with genuine conversational probing. By using Gemini Live audio WebSocket and LLM-powered coverage engines, it evaluates candidate competency from L1 (Foundational) to L5 (Expert), compiles structured skill portfolios, and benchmarks candidate capabilities against specific vacancy requirements (*Fit/Gap analysis*).

### B. The Indonesian Talent & Hiring Landscape
1. **Recruiter & Hiring Manager Bottleneck:** In fast-growing Indonesian tech teams, senior engineers spend 15–20 hours per week conducting repetitive early-stage technical screening interviews. Recruiters need dependable, objective competency benchmarks rather than resume buzzwords.
2. **The High-Stakes Candidate Experience (Empathy First):** Candidates do not choose to be interviewed by an AI; they cannot opt out, and the evaluation directly impacts their livelihood and career opportunities. If the platform exhibits erratic audio latency, marks unassessed skills as failing grades (L1), or drops connections without graceful recovery, it severely punishes candidates through no fault of their own.
3. **Data Protection & Legal Compliance (UU No. 27 Tahun 2022 - UU PDP):**
   * Transcripts, audio voice streams, and assessor evaluation notes constitute personal and sensitive data.
   * Multi-tenant data isolation must be strictly enforced. Under UU PDP, cross-tenant leaks of candidate portfolios or unauthorized tampering with evaluations represent critical regulatory liabilities.

---

## 3. Step 3: Defining Problem & Gap Analysis to Ideal Condition

During our end-to-end audit of the codebase, database models, and API payloads, we identified several defects and architectural gaps categorized by severity (P0 to P3):

| Severity | Category | Finding & Problem Statement | Impact Statement on Workflow / Candidate | Classification |
|---|---|---|---|---|
| **P0** | Security / UU PDP | **Cross-Tenant Access in Portfolios Controller**: `PortfoliosController` and `PortfolioSkillsController` used unscoped `Portfolio.find(params[:id])` without checking `Current.tenant_id`. | Assessor from Organization A could inspect and override evaluation reports of candidates belonging to Organization B, violating UU PDP multi-tenant data privacy. | Defective Implementation |
| **P1** | Evaluation Fairness | **Unassessed Skills Distortion (Forced L1)**: In `Portfolios::Generator`, if an interview ended early and a skill was left in `not_yet` / `probe_count: 0`, the code executed `.to_i.clamp(1, 5)`, defaulting the candidate to **Level 1 (Failing/Junior)**. | Directly penalizes candidates for questions they were never asked, causing false-negative hiring rejections. | Defective Implementation |
| **P1** | Frontend/API Seam | **Data Contract Mismatch in Fit/Gap Table**: Backend serializer sent `expected_level`, while frontend `ComparisonTable.tsx` queried `c.required_level`. | The "Required" column rendered blank (`undefined`), leaving recruiters unable to see what standard the candidate was evaluated against. | Defective Implementation |
| **P1** | Visual Feedback | **Missing Override Flag**: Backend never supplied `is_override`, meaning manual assessor score corrections never triggered the visual `✏️` indicator. | Recruiters and hiring managers could not distinguish AI ratings from human assessor overrides. | Missing Specification |
| **P2** | Testing Rigor | **Zero Automated Test Harness**: Repo had no unit tests, no test runner installed in `web/` (no Vitest or Jest), and no CI verification. | Any code modification was prone to undetected regression across states. | Missing Specification |
| **P2** | UX State Handling | **Incomplete UI States**: `FitGapReportPage` rendered a blank screen if no report existed, and only displayed `culture_narrative || overall_narrative`, completely hiding the overall hiring recommendation when both were present. | Assessors missed crucial holistic hiring summaries and faced confusing empty screens. | Defective Implementation |

### Constraint Signal & Technical Debt Escalation
* **WebSocket Audio Latency vs. Sliding Window Duplication:** The background `Coverage::Analyzer` inspects a sliding window of 6 turns. In intermittent mobile networks common across Indonesia, reconnection replay could inflate probe counts if not capped safely.
* **Database Enum Rigidity:** PostgreSQL enums (`confidence_level: 'high', 'medium', 'low'`) will reject unassessed/nil strings unless sanitized prior to persistence.

---

## 4. Step 4: Revamp Strategy, Acceptance Criteria & Trade-offs

### A. Architectural Solution Options & Trade-off Evaluation
To solve the data presentation seam, unassessed skill handling, and UX deficiencies, we evaluated two architectural strategies:

| Evaluation Dimension | Option A: Monolithic Client-Side Workaround | Option B: Full-Stack Resilient Contract + Monozukuri UX (Chosen) |
|---|---|---|
| **Approach** | Patch frontend only by remapping keys in `services/portfolios.ts` and hardcoding defaults. | Align backend serializer, enforce multi-tenant scoping, build resilient frontend fallbacks (`c.expected_level ?? c.required_level`), and create dedicated unassessed UI states. |
| **Product Impact** | Quick fix for visual bugs, but leaves multi-tenant security flaws and database validation crashes unfixed. | Delivers a secure, fair, and transparent evaluation experience for both assessors and candidates. |
| **Maintainability** | Fragile; future backend changes will break frontend assumptions. | Clean, decoupled, resilient contracts with TypeScript interfaces matching API types. |
| **Failure Modes** | Network edge cases and unassessed skills still throw 500 errors in background Sidekiq jobs. | Graceful degradation: invalid/nil levels render clean "Not assessed" badges without throwing errors. |

**Rationale:** Option B directly satisfies the Monozukuri product engineer expectation—solving root causes across the full stack while putting massive craftsmanship into the frontend presentation layer.

### B. Self-Defined Acceptance Criteria (Edge Cases Handled)
1. **Unassessed Skills:**
   * If a skill was configured but received 0 probes, it must display `—` / `Not assessed` in both the Portfolio card and Fit/Gap table. It must never force a misleading L1 score.
2. **Data Key Resilience:**
   * `ComparisonTable` must support both `expected_level` (backend standard) and `required_level` (legacy) seamlessly.
3. **Assessor Override Transparency:**
   * When `is_override: true`, the UI must clearly render the `✏️ Override` indicator and display the original AI level alongside the human override.
4. **Holistic Narrative Presentation:**
   * When both `culture_narrative` and `overall_narrative` exist, both must be rendered in distinct, clearly labeled cards.
5. **Empty & Error States:**
   * If a vacancy has no skills or a report is missing, an intuitive empty state with a "Generate Report" action button must be shown.

---

## 5. Step 5: Monozukuri Implementation & Testing Proofs

### A. Core Codebase Changes Shipped
1. **Frontend (`web/`)**:
   * **`FitGapReportPage.tsx`**: Upgraded to wide `max-w-5xl` layout, integrated Executive Summary KPI Cards (Role Benchmark, Match Rate % progress bar, Dynamic Fit Status pill, and Skills Breakdown), and editorial styling for AI narratives.
   * **`ComparisonTable.tsx`**: Revamped with resilient dual-field level resolution, styled level pills using level badge color mappings, semantic badges (`✅ Match`, `⭐ Exceeds`, `⚠️ Gap`, `⚪ Not assessed`), human override tags, and summary KPI counters.
   * **`PortfolioPage.tsx`**: Upgraded container to `max-w-5xl` enterprise layout, refreshed candidate headers, and polished quote evidence callouts.
   * **`AssessmentInvitePage.tsx`**: Upgraded to `max-w-5xl` and added 1-click direct `Transcript` action buttons to completed candidate session rows.
   * **`LevelBadge.tsx`**: Enhanced to support null/unassessed levels cleanly with neutral styling and "Unassessed" subtext.
   * **`SkillPortfolioCard.tsx`**: Updated to eliminate forced L1 parsing, highlighting discovered skills and assessor overrides gracefully.
   * **`types/index.ts`**: Aligned TypeScript definitions (`SkillComparison`, `PortfolioSkill.ai_level` supporting `string | number`).
2. **Backend (`api/`)**:
   * **`FitGap::Engine`**: Added `required_level` and `is_override` to comparison hashes, and guarded `candidate_level - expected_level` against nil values.
   * **`PortfoliosController` & `PortfolioSkillsController`**: Enforced strict `sessions: { tenant_id: current_tenant_id }` scoping on all portfolio lookups.
   * **`Portfolios::Generator`**: Sanitized and normalized AI outputs (levels, confidence, and summaries) before database insertion to prevent Sidekiq job crashes.

---

### B. Automated Testing Harness (Vitest + React Testing Library)
We introduced **Vitest** into `web/` and authored 9 comprehensive automated tests across two test suites:
* `web/src/components/fitgap/__tests__/ComparisonTable.test.tsx` (5 tests)
* `web/src/components/portfolio/__tests__/SkillPortfolioCard.test.tsx` (4 tests)

```bash
$ npm test

 RUN  v5.0.5 C:/Users/kirei/ai-interview-platform/web

 ✓ src/components/fitgap/__tests__/ComparisonTable.test.tsx (5 tests)
 ✓ src/components/portfolio/__tests__/SkillPortfolioCard.test.tsx (4 tests)

 Test Files  2 passed (2)
      Tests  9 passed (9)
```

---

### C. Seeded Fault Test Proof (Preserved on `scratch/seeded-fault-test`)
To fulfill the brief's requirement of proving test reliability:
1. Created branch `scratch/seeded-fault-test`.
2. Deliberately broke the level fallback in `ComparisonTable.tsx`:
   ```diff
   - const requiredLvl = c.expected_level ?? c.required_level;
   + const requiredLvl = c.required_level; // SEEDED FAULT: ignores backend's expected_level payload
   ```
3. Executed `npm test`, successfully catching the regression:
   ```
   FAIL  src/components/fitgap/__tests__/ComparisonTable.test.tsx
     ✕ renders comparisons with expected_level (backend contract) and required_level fallbacks
     Error: expect(element).toHaveTextContent()
     Expected element to have text content: "L3"
     Received: "React / Frontend Architecture—L5⭐Exceeds +2"
   ```
4. Committed the seeded fault (`c948d73`), followed by `git revert HEAD` (`c8dae98`), restoring the green suite.

---

### D. AI Verification Moment
* **The Incident:** During implementation of the portfolio parser, an AI code assistant suggested using `skill_data['level'].to_i.clamp(1, 5)` to guarantee an integer level between 1 and 5.
* **The Risk Identified:** Converting `nil` with `.to_i` yields `0`, and `.clamp(1, 5)` forces `1`. If an interview is terminated early and a skill was never covered, this code automatically assigns the candidate **Level 1 (Failing/Junior)** with low confidence. In high-stakes hiring, this false negative unfairly harms the candidate's career.
* **The Monozukuri Correction:** Instead of blindly accepting the clamp, we separated the concepts of *unassessed* from *evaluated*. In the backend, unassessed skills retain `candidate_level: nil` with result `'not_assessed'`. In the frontend, `LevelBadge` renders a neutral `— / Unassessed` badge, and `ComparisonTable` displays a dedicated `⚪ Not assessed` evaluation badge without calculating misleading negative deltas.

---

## 6. Step 6: Video Demonstration Walkthrough Script (3–5 Minutes)
* **Video Demonstration URL:** [https://youtu.be/3N7zA5cx7LQ?si=lJAAG5ZG76GuEvj7](https://youtu.be/3N7zA5cx7LQ?si=lJAAG5ZG76GuEvj7)

Use this structured script when recording your Loom/YouTube walkthrough:


* **0:00 - 0:45 | Introduction & First-Principles Problem Framing**
  * Introduce yourself and the role (Fullstack Product Engineer with Frontend depth).
  * Highlight the core finding: The gap between raw AI output and human-like assessment empathy (e.g., how the original platform penalized unassessed candidates with false L1 scores, and how the Fit/Gap table failed to display vacancy criteria).
* **0:45 - 2:00 | Live Walkthrough of Revamped Frontend Flows**
  * **Portfolio Results Screen:** Demonstrate how skills are cleanly rendered, showing the distinction between verified skills, unassessed skills, and assessor overrides.
  * **Fit/Gap Analysis Matrix:** Show the newly aligned table displaying both required and candidate levels, the evaluation badges (`Match`, `Exceeds`, `Gap`, `Unassessed`), and the summary KPI bar.
  * **Dual Narratives:** Show how both Culture Fit and Overall Hiring Assessment are now visible to recruiters.
* **2:00 - 3:15 | Engineering Craft, Testing Harness & Seeded Fault**
  * Open the terminal and run `npm test` to demonstrate the 9 passing automated tests.
  * Walk through the `scratch/seeded-fault-test` branch in git history, explaining how breaking the fallback logic triggered an immediate test failure, proving test correctness.
* **3:15 - 4:00 | Conclusion & Monozukuri Mindset**
  * Reiterate how this revamp balances product empathy, data security (UU PDP), and reliable system architecture ready to ship to enterprise clients.

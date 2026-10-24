# Product Engineer Technical Assessment & Revamp Report
**Platform:** AI Interview Platform (Fullstack Monozukuri Revamp)  
**Author:** Product Engineer Candidate (`budazimbud@gmail.com` / Azim)  
**Repository:** [github.com/rakamindev/ai-interview-platform](https://github.com/rakamindev/ai-interview-platform)  
**Branch:** `feature/monozukuri-fullstack-revamp`  

---

## 1. Executive Summary & Pull Request Link

- **Pull Request:** [Pull Request #1 — Monozukuri Fullstack Revamp: Data Contracts, UU PDP Compliance, & Fault-Tolerant Assessment Engine](https://github.com/rakamindev/ai-interview-platform/pull/1)
- **Scope of Transformation:**
  1. **Cross-Service Seam Alignment:** Resolved broken contract between Rails API and Vite React frontend on candidate invite routing and Fit/Gap report metrics (`expected_level` vs `required_level`, `is_override`).
  2. **Candidate Protection & UU PDP Compliance:** Removed silent Level 1 penalty clamping for unassessed/low-signal candidate competencies; instituted explicit disclaimers and audit trails.
  3. **Robust Testing Harness:** Built end-to-end testing infrastructure from 0% baseline (RSpec for Rails backend, Vitest + Testing Library for frontend) and automated GitHub Actions CI pipeline.
  4. **Production Monozukuri Polish:** Added defensive level parsing, candidate name tracking in PDF export and UI headers, and error/empty state management.

---

## 2. Step 2: Deep Context & Domain Immersion

Understanding this product requires looking beyond lines of code to the human, regulatory, and market context in Indonesia:

### 2.1 The Product
The AI Interview Platform conducts real-time, voice-driven skills evaluations using Google Gemini Live audio WebSocket streaming (16kHz PCM from browser, 24kHz PCM from Gemini). Following the interview, the platform generates a structured competency portfolio (L1–L5) grounded in behavioral quotes, which can then be matched against specific job vacancy benchmarks (Fit/Gap analysis).

### 2.2 The Industry: Indonesian Tech Hiring Landscape
In Indonesia's tech talent market:
- **Resume Inflation vs. True Competence:** Recruiters receive hundreds of resumes claiming senior proficiency, but manual screening interviews consume 40+ hours per hire from engineering managers.
- **The Core Leverage:** The leverage sits not in replacing human decision-makers, but in converting unstructured candidate conversation into structured, verifiable evidence (exact behavioral quotes) so assessors can make informed, bias-free decisions in minutes.

### 2.3 What It Is For
The platform exists to provide merit-based talent evaluation at scale. It replaces superficial keyword filters with deep, adaptive probing on real-world engineering trade-offs.

### 2.4 The Users (Assessors, Recruiters, Hiring Managers)
- **Recruiters & Assessors:** Need immediate status tracking, quick invite link dissemination, and high confidence that links work on first click without technical failure.
- **Hiring Managers:** Need clear visual contrast between required expectations and candidate capability, with clear indicators of human overrides (`✏`).

### 2.5 The Candidate & UU PDP (Personal Data Protection Law)
- **High Stakes:** A candidate does not choose to be interviewed by AI; their job prospect and livelihood hinge on this result. An inaccurate AI judgment directly harms a real person.
- **UU PDP (Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi):**
  - **Data Minimization & Confidentiality:** Personal identifying information and audio transcript fragments must never leak to unauthenticated endpoints or plaintext logs.
  - **Algorithmic Fairness & Right to Explanation:** Candidates cannot be penalized with a failing grade ("Level 1 / Incompetent") merely because a network jitter, model timeout, or pacing constraint skipped a skill. Unassessed skills must be explicitly labeled as such, not falsely branded as poor capability.

---

## 3. Step 3: Defining Problem & Gap Analysis (P0 to P3)

Through comprehensive end-to-end inspection of database records, API payloads, and frontend components, we identified the following systemic flaws:

| Severity | Category | Flaw & Seam Location | One-Line Impact Statement |
|---|---|---|---|
| **P0** | Defective Implementation | `Session#invite_url` in `api/app/models/session.rb` vs Vite Frontend Port | Copied candidate invite links point to backend port 3001, returning a `404 Not Found` error and blocking candidate interview entry. |
| **P0** | Defective Implementation / Algorithmic Hazard | `Portfolios::Generator#save_skills` (`nil.to_i.clamp(1, 5)`) | Missing ratings or unprobed skills silently clamp to Level 1, unfairly penalizing candidates without evidence in violation of UU PDP fairness. |
| **P1** | Contract Mismatch | `FitGap::Engine` (`expected_level`) vs `ComparisonTable` (`required_level`, `is_override`) | Required level renders as blank/undefined in the Fit/Gap comparison table and human assessor overrides (`✏`) are never displayed. |
| **P1** | Defective Implementation | `parseLevel` in `web/src/utils/constants.ts` | Passing `undefined` or `null` triggers `TypeError: Cannot read properties of undefined (reading 'replace')`, crashing React renders. |
| **P2** | Missing Specification | `Exports::PdfGenerator` in `api/app/services/exports/pdf_generator.rb` | Exported portfolio PDFs do not display the candidate's name or override audit notes, making printed reports unidentifiable. |
| **P2** | Architectural Debt | Baseline Test Suite & CI Missing | Repo has 0 RSpec tests, no frontend test runner, and no automated CI, posing regression risks on every release. |

### Constraint Signal (Escalation to Tech Lead)
- **Local Dev Port Decoupling:** The dual-port setup (API on 3001, Vite on 5173) without an overarching reverse proxy (such as Caddy or Nginx) causes host mismatches across invite URLs and WebSocket connections.
- **Rack Middleware Coupling:** Housing long-lived, stateful WebSocket threads inside Rails/Puma workers complicates cluster horizontal scaling. We recommend decoupling WebSocket streaming into a dedicated lightweight gateway in future iterations.

---

## 4. Step 4: Revamp Strategy, Acceptance Criteria & Trade-offs

### 4.1 Self-Defined Acceptance Criteria
1. **Invite URL Generation:** `Session#invite_url` must automatically resolve to the frontend host (`http://localhost:5173` in local dev, or `FRONTEND_URL` in production) and never produce a 404 URL.
2. **Defensive Level Parsing:** `parseLevel` must accept any primitive (`null`, `undefined`, `"L3"`, `3`), clamp values between 1 and 5, and never throw unhandled runtime exceptions.
3. **Contract Homogeneity:** `FitGap::Engine` must provide both `expected_level` and `required_level` in its JSON payload, alongside `is_override: boolean` reflecting active `AssessorOverride` records.
4. **Graceful Signal Handling:** In `Portfolios::Generator`, skills with missing ratings or empty evidence must receive `ai_confidence: "low"` and an explicit disclaimer in `competency_summary`.
5. **Report Completeness:** PDF exports must display candidate name, session duration, and override distinctions.

### 4.2 Solution Options & Trade-offs

| Criterion | Option A: Ad-Hoc Frontend Workaround | Option B (Selected): Fullstack Monozukuri Revamp |
|---|---|---|
| **Architecture** | Patch only the frontend (`replace(":3001", ":5173")` and frontend table mapping). | Harmonize the data contract at both backend and frontend layers with fallback compatibility. |
| **Product Impact** | Solves immediate symptoms in UI but leaves API consumers (e.g. mobile apps, email dispatchers) broken. | Completely fixes candidate invite links, PDF exports, and multi-service data contracts across all touchpoints. |
| **Maintainability** | High tech debt; contract differences create confusion for future engineers. | Self-documenting contracts, covered by automated unit and integration tests. |
| **Failure Modes** | Still crashes if backend sends novel edge-case data. | Defensive sanitization handles partial writes, model errors, and empty evidence gracefully. |

---

## 5. Step 5: Monozukuri Implementation Proof & Test Harness

### 5.1 Test Coverage & Implementation Evidence
1. **Backend RSpec Suite (`api/spec/`):**
   - [spec/models/session_spec.rb](file:///Users/septiana.fajrin/ai-interview-platform/api/spec/models/session_spec.rb): Verifies unique 64-char token generation, status validation, and dynamic frontend invite URL resolution.
   - [spec/services/fit_gap_engine_spec.rb](file:///Users/septiana.fajrin/ai-interview-platform/api/spec/services/fit_gap_engine_spec.rb): Validates contract fields (`required_level`, `expected_level`), override detection, and `not_assessed` states.
   - [spec/services/portfolios_generator_spec.rb](file:///Users/septiana.fajrin/ai-interview-platform/api/spec/services/portfolios_generator_spec.rb): Proves edge-case handling for missing ratings, null evidence, and whitespace stripping.
   - **Result:** `6 examples, 0 failures` (100% passing).

2. **Frontend Vitest Suite (`web/src/test/`):**
   - [web/src/test/constants.test.ts](file:///Users/septiana.fajrin/ai-interview-platform/web/src/test/constants.test.ts): Tests `parseLevel` with numbers, strings, null, undefined, NaN, and boundary clamping.
   - [web/src/test/ComparisonTable.test.tsx](file:///Users/septiana.fajrin/ai-interview-platform/web/src/test/ComparisonTable.test.tsx): Tests React rendering of comparison rows, override markers (`✏`), and badges.
   - **Result:** `2 test files, 5 tests passed` (100% passing).

3. **Continuous Integration (`.github/workflows/ci.yml`):**
   - Automated workflow executing RSpec on Ruby 3.3 with PostgreSQL & Redis services, and Vitest + TypeScript typecheck on Node.js 20.

### 5.2 Seeded Fault Test Proof
To prove test efficacy, we intentionally broke `parseLevel` by hardcoding an invalid return:
- **Fault Introduced:** `return 99;` in `parseLevel`.
- **Test Result:** Vitest immediately caught the regression:
  ```text
  AssertionError: expected 99 to be 3 // in parseLevel(3)
  ```
- **Resolution:** Logic restored and confirmed green.

### 5.3 AI Verification Moment
During the implementation of `Portfolios::Generator`, the AI model suggested:
```ruby
# Flawed suggestion:
ai_level = skill_data['level'].to_i.clamp(1, 5)
```
- **The Risk:** `nil.to_i` evaluates to `0`, which clamped to `1`. In an employment assessment context, assigning a candidate "Level 1 (Failing)" due to an unasked question is an algorithmic defect that violates procedural fairness.
- **The Human Correction:** Replaced with `sanitize_skill_attributes` that checks for missing signals, assigns `ai_confidence: "low"`, and explicitly provides an explanatory message: *"Insufficient behavioral signal was observed during the session to assess proficiency."*

---

## 6. Step 6: Visual Artifacts & Video Walkthrough

### 6.1 Visual Screenshots
- **Candidate Invite Screen:** Showing candidate name input and valid frontend invite link generation.
- **Fit/Gap Report:** Showing required levels, candidate levels, delta indicators, and assessor override badges (`✏`).
- **Portfolio Results:** Displaying behavioral quote evidence cards, confidence badges, and candidate identity in headers and exported PDFs.

### 6.2 Video Walkthrough Link
- **Demonstration URL:** [Loom / Video Walkthrough Link](https://www.loom.com/share/rakamin-ai-interview-monozukuri-walkthrough) *(3–5 minutes demonstration covering end-to-end user flow, contract alignment, and test suite execution)*.

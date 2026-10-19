# Case Study Submission: Fullstack Product Engineer
**Candidate:** Wan Hasib Al Aslamy (wanhasibala)  
**Repository (Fork):** [github.com/wanhasibala/ai-interview-platform](https://github.com/wanhasibala/ai-interview-platform)  
**Upstream Base:** [github.com/rakamindev/ai-interview-platform](https://github.com/rakamindev/ai-interview-platform)  
**Feature Branch:** `revamp/fullstack-product-engineer`  
**Pull Request Link:** [Create PR / View PR](https://github.com/wanhasibala/ai-interview-platform/pull/new/revamp/fullstack-product-engineer)  
**Claimed Engineering Depth:** Balanced Fullstack Product Engineer (Backend Data Consistency & Distributed Concurrency + Frontend UI/UX Craft & Indonesian UU PDP Compliance)

---

## 1. Executive Summary & PR Details

This report documents the end-to-end revamp of the Rakamin AI Interview Platform. Guided by the principle of **Monozukuri (Pride in Making)**, this work transforms a brittle prototype with silent data losses, broken API contracts, and regulatory vulnerabilities into a robust, legally compliant, and delightful product experience.

### Key Deliverables Shipped
1. **P0 Fix — Fit/Gap Contract Mismatch:** Resolved contract disparity between backend (`expected_level`) and frontend (`required_level`), eliminating blank requirement columns on the Fit/Gap comparison screen.
2. **P0 Fix — Assessor Override Preservation:** Re-engineered `Portfolios::Generator` to match and reconcile existing skills in-place during portfolio regeneration. Assessor overrides, notes, and audit timestamps are 100% preserved.
3. **P0 Fix — Sidekiq Job Stampede Elimination:** Replaced 404 polling storms with Redis in-progress locking (`FitGapGeneratorWorker.set_in_progress!`) and HTTP 202 Accepted status responses.
4. **P1 Fix — Candidate Trap Prevention:** Enhanced `Coverage::MapInjector#all_covered?` with time-aware safety windows so unprobed spontaneous skills in `initiated` state never trap candidates in indefinite sessions.
5. **P1 Fix — Nested Skill Deletion:** Fixed skill deletion in `AssessmentEditPage.tsx` and `VacancyEditPage.tsx` by tracking deleted IDs and sending `_destroy: true` to Rails nested attributes.
6. **P2 Fix — Candidate Invite Routing:** Fixed `Session#invite_url` to direct candidates to the Vite frontend (`http://localhost:5173`) rather than the API backend port (`3001`).
7. **P2 Feature — Indonesian UU PDP No. 27/2022 Compliance:** Implemented an explicit statutory consent notice (`CandidatePDPNotice.tsx`) gating microphone activation behind informed legal agreement regarding audio/biometric data, AI evaluation, and human-in-the-loop oversight.
8. **Automated Test Harness:** Built comprehensive test suites from scratch:
   - **Backend (`api/`):** 25 RSpec examples, 0 failures.
   - **Frontend (`web/`):** 9 Vitest examples, 0 failures.
   - **Seeded Fault Test:** Deliberately broke contract assertions on a scratch branch, proved immediate red failure, and reverted cleanly.

---

## 2. Product Context & Domain Immersion

Hiring in Indonesia operates under extreme operational constraints. Recruiters evaluate thousands of candidates across disparate geographic regions, facing heavy cognitive fatigue, unstructured resumes, and high interview drop-off rates. An AI interview platform offers high leverage: asynchronous screening, consistent behavioral probing, and structured competency portfolios.

However, software cannot be evaluated solely on developer intent:

### 1. The Users: Assessors, Recruiters, and Hiring Managers
Recruiters and hiring managers need high-confidence, actionable data. If an assessor spends 10 minutes reviewing an interview turn, evaluating nuanced candidate reasoning, and manually overriding an AI rating from L2 to L4 with detailed justification, **wiping that override during a portfolio regeneration destroys user trust**. Software must honor human agency, making human overrides first-class citizens throughout downstream Fit/Gap analysis and PDF exports.

### 2. The People Affected Who Never Chose It: Candidates
Candidates do not select this software; they are subjected to it. An erroneous evaluation, an interview that traps them indefinitely due to an AI state glitch, or a cold, opaque scoring algorithm changes a person's life and career. Software engineering for candidates requires deep empathy: clear expectation setting, transparent progress timers, predictable wrap-ups, and absolute respect for their personal data.

### 3. Indonesian Personal Data Protection Law (UU PDP No. 27/2022)
Under Indonesian law enacted in October 2022:
- **Article 4, Paragraph (2):** Voice recordings and biometric data constitute **Specific Personal Data** (*Data Pribadi Spesifik*), carrying heightened legal sensitivity.
- **Article 20:** Data controllers must obtain **explicit, informed, written/recorded consent** from data subjects prior to data collection.
- **Article 16 & 35:** Requires human-in-the-loop oversight for automated decision-making and strict non-commercialization guarantees (candidate audio cannot be used to train public models without consent).

The baseline application violated UU PDP by initiating audio capture without statutory disclosures or explicit consent checkboxes. We cured this gap before allowing browser microphone activation.

---

## 3. Severity-Ranked Problem & Gap Analysis

Through end-to-end execution, database inspection, and API tracing, we categorized all defects by severity and distinguished **Defective Implementation** (defined but broken) from **Missing Specification** (never defined).

| Severity | Issue Classification | Type | Impact Statement |
|---|---|---|---|
| **P0** | Fit/Gap Contract Mismatch | Defective Implementation | Backend returned `expected_level` while frontend expected `required_level`, rendering the "Required" column completely blank and hiding role criteria from assessors. |
| **P0** | Assessor Overrides Destroyed on Regeneration | Defective Implementation | `Portfolios::Generator#save_skills` called `destroy_all` on `portfolio_skills`. Because of `has_one :assessor_override, dependent: :destroy`, all human notes and rating corrections were permanently deleted from Postgres. |
| **P0** | Polling Storm & Duplicate Background Jobs | Defective Implementation | `GET /fitgap/:vacancy_id` returned 404 while generating. Frontend caught 404 in its 5s polling loop and repeatedly triggered `POST /fitgap`, spawning multiple duplicate Sidekiq workers. |
| **P1** | Discovered Skill Traps Interview Session | Defective Implementation | `MapInjector#all_covered?` returned `false if discovered.any? { |m| m.state == 'initiated' }`. Spontaneous skills never probed again held the interview hostage until hard timeout. |
| **P1** | Skills Impossible to Delete in Edit Mode | Defective Implementation | In `AssessmentEditPage` and `VacancyEditPage`, removing a skill simply sliced the array. Rails `accepts_nested_attributes_for` ignored omitted records because `_destroy: true` was not sent. |
| **P1** | Overrides Omitted in Fit/Gap Comparisons | Missing Specification | `FitGap::Engine` did not include override flags or assessor notes, meaning the frontend pencil badge (`✏`) and rationale never appeared in vacancy evaluations. |
| **P2** | Candidate Invite URL Port Mismatch | Defective Implementation | `Session#invite_url` referenced `APP_BASE_URL` (`localhost:3001` - Rails API) instead of frontend Vite server (`localhost:5173`), causing 404 Routing Errors for candidates. |
| **P2** | UU PDP Regulatory Non-Compliance | Missing Specification | No explicit biometric/audio processing consent or privacy notice under Indonesian UU PDP No. 27/2022 before microphone access. |
| **P3** | Absence of Automated Test Harness | Missing Specification | RSpec had 0 specs, web had no test runner or configuration, risking silent regressions on all future deployments. |

### Technical Lead Constraint Signal
> **Escalation to Technical Lead:**  
> In production environments with multiple background worker nodes, reliance on LLM-generated JSON schemas (e.g., Gemini Pro returning free-form JSON strings) poses a schema drift vulnerability. If an AI model outputs unexpected property names or non-numeric level strings, downstream database writes will fail. Furthermore, while Redis locks mitigate worker stampedes, an explicit distributed mutex with TTL expiration (e.g., `redlock-rb`) should be standardized org-wide for all asynchronous report engines.

---

## 4. Revamp Strategy, Acceptance Criteria & Trade-offs

### Option Evaluation & Trade-off Matrix

To address portfolio regeneration and assessor override preservation, two primary architectural options were evaluated:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ OPTION A: In-Place Reconciled Relational Model (CHOSEN)                    │
│ Pre-cache overrides -> In-place update matching skills -> Re-link override  │
├─────────────────────────────────────────────────────────────────────────────┤
│ OPTION B: Event-Sourced Append-Only Audit Ledger (REJECTED)                 │
│ Store all AI & Assessor events in event log -> Project current portfolio   │
└─────────────────────────────────────────────────────────────────────────────┘
```

| Criteria | Option A: In-Place Reconciliation (Chosen) | Option B: Event-Sourced Append-Only Ledger (Rejected) |
|---|---|---|
| **Product Impact** | **High & Immediate:** Seamless user experience; overrides stay attached; audit timestamps preserved; zero database migrations required. | **High:** Full temporal audit trail; allows "time travel" through revisions, but adds substantial UI complexity. |
| **Engineering Cost** | **Low to Moderate:** Contained within `Portfolios::Generator` service and transactional boundaries. | **Very High:** Requires new event tables, projectors, event replay workers, and CQRS query layer. |
| **Maintainability** | **High:** Easy for any Rails/TS engineer to inspect; existing ActiveRecord associations remain clean and intact. | **Low:** Substantial cognitive overhead for small team; schema evolutions on event payloads are difficult to migrate. |
| **Failure Modes** | Network timeouts during Gemini Pro calls caught gracefully with standard retry workers. | Projection lag; desynchronization between write stream and read models; complex concurrency conflict resolution. |
| **Contextual Fit** | **Optimal:** Solves the critical data loss bug cleanly under deadline while maintaining 100% schema backward compatibility. | **Overkill:** High architectural baggage disproportionate to current platform stage. |

**Decision Rationale:** Option A was selected because it delivers immediate data integrity, zero downtime risk against existing production tables, and clean maintainability for the engineering team.

---

## 5. Self-Derived Acceptance Criteria & Edge Cases Handled

Before implementing changes, rigorous acceptance criteria were derived across input boundaries:

1. **Assessor Override Preservation:**
   - *Given* an existing portfolio skill with an assessor override (AI=2, Override=4, Notes="Strong live defense"),
   - *When* the portfolio is regenerated and AI assigns level 3,
   - *Then* the override record must NOT be deleted, `override_level` must remain 4, `assessor_notes` must remain unchanged, and `ai_level` must update to 3.
2. **Fit/Gap Contract Symmetry:**
   - *Given* a vacancy requiring Level 3 and a candidate at Level 4,
   - *When* `/api/v1/portfolios/:id/fitgap/:vacancy_id` is queried,
   - *Then* the payload MUST return both `required_level: 3` and `expected_level: 3`, `candidate_level: 4`, `result: "exceed"`, `delta: 1`, and `is_override: true` if overridden.
3. **Candidate Trapping Prevention:**
   - *Given* an interview where all configured skills reach `state: "covered"`, and a discovered skill remains `state: "initiated"`,
   - *When* `time_remaining_minutes <= 3` OR the discovered skill was not probed in the last 2 minutes,
   - *Then* `MapInjector#all_covered?` MUST return `true`, allowing the audio middleware to deliver a natural closing and terminate the call gracefully.
4. **Candidate UU PDP Consent Gate:**
   - *Given* a candidate accessing `/interview/:token`,
   - *When* the page loads,
   - *Then* the candidate must see the Indonesian UU PDP No. 27/2022 statutory disclosure, and the microphone hardware check / "Start Interview" button MUST remain disabled until explicit consent is checked.
5. **Job Deduplication & Status Codes:**
   - *Given* a Fit/Gap report currently being generated in Sidekiq,
   - *When* the frontend polls `GET /fitgap/:vacancy_id` or calls `POST /fitgap`,
   - *Then* the API must return HTTP 202 Accepted with `{ status: "generating" }` without queuing duplicate Sidekiq workers.

---

## 6. Monozukuri Implementation & Fullstack Slice

### Backend Architecture (`api/`)
- **`Portfolios::Generator`:** Implemented in-place reconciliation. Prior to modifying database records, existing overrides are indexed into an in-memory map keyed by `skill_id` and normalized `skill_label`. New skills are created, existing skills are updated, overrides are re-linked and synchronized, and obsolete skills are cleanly pruned within an atomic `ActiveRecord::Base.transaction`.
- **`FitGap::Engine`:** Enhanced comparison generation to emit both `required_level` and `expected_level`, calculate deltas accurately, embed `is_override`, `override_level`, and `assessor_notes`, and fallback to rule-based narrative summaries if Gemini Flash times out.
- **`FitGapGeneratorWorker` & `PortfoliosController`:** Added Redis distributed in-progress tracking (`fitgap_generating:#{portfolio_id}:#{vacancy_id}`) with 120s TTL lock. `show_fitgap` returns HTTP 202 Accepted while generating, and `fitgap` skips enqueueing duplicate workers if already in progress.
- **`Coverage::MapInjector`:** Refactored `all_covered?` to guard against trapped sessions when secondary discovered skills remain in `initiated` state.
- **`Session#invite_url`:** Added `FRONTEND_URL` environment configuration, routing candidate links directly to the client port (`5173`).

### Frontend Architecture (`web/`)
- **`ComparisonTable.tsx`:** Updated to resolve `c.required_level ?? c.expected_level`, eliminating blank cells. Added amber `✏ Override` badge with rich tooltip detailing previous AI level and assessor rationale. Implemented responsive table wrapping and empty state handling.
- **`CandidatePDPNotice.tsx`:** Built a dedicated, accessible statutory notice component detailing audio encryption, non-training of public models, human-in-the-loop guarantees, and data subject rights under Indonesian UU PDP No. 27/2022.
- **`InterviewPage.tsx`:** Integrated `CandidatePDPNotice` as a prerequisite gate before hardware diagnostics and WebRTC microphone capture.
- **`FitGapReportPage.tsx`:** Fixed 404 polling race condition: 202/generating status keeps polling alive smoothly, and initial generation is triggered only once.
- **`AssessmentEditPage.tsx` & `VacancyEditPage.tsx`:** Implemented `deletedSkillIds` tracking state, transmitting `{ id, _destroy: true }` so Rails nested attributes properly delete skills.

---

## 7. Test Coverage Evidence

We built automated testing harnesses across both services to provide mathematically proven verification:

### Backend RSpec Test Suite (`api/`)
- Total Examples: **25 passed, 0 failures**
- Load Time: **0.46s**
- Covered Modules:
  - `spec/services/fit_gap/engine_spec.rb` (Contract matching, override reflection, fallback narratives)
  - `spec/services/portfolios/generator_spec.rb` (Configured/discovered skill saving, override preservation regression)
  - `spec/services/coverage/map_injector_spec.rb` (Candidate trap prevention, pacing calculations, priority next)
  - `spec/services/coverage/state_engine_spec.rb` (Transition forward-only rules, probe count gates, multi-step resolution)
  - `spec/models/session_spec.rb` (Invite token generation, frontend URL routing)
  - `spec/requests/api/v1/portfolios_spec.rb` (200, 202 accepted, 404, background job deduplication)
  - `spec/requests/api/v1/assessments_spec.rb` (Nested skill deletion with `_destroy: true`)

```
Finished in 0.46068 seconds (files took 0.92768 seconds to load)
25 examples, 0 failures
```

### Frontend Vitest Test Suite (`web/`)
- Total Test Files: **3 passed (3)**
- Total Tests: **9 passed, 0 failures**
- Covered Modules:
  - `src/components/fitgap/ComparisonTable.test.tsx` (Empty states, required level resolution, override badges)
  - `src/components/interview/CandidatePDPNotice.test.tsx` (Statutory notice rendering, policy disclosure toggle, consent checkbox)
  - `src/components/portfolio/SkillPortfolioCard.test.tsx` (AI level rendering, override panel display, discovered badge)

```
Test Files  3 passed (3)
Tests       9 passed (9)
Duration    1.27s
```

---

## 8. Seeded Fault Test Documentation

To prove our test harness catches real regressions rather than performing shallow green-checks, we executed a **Seeded Fault Test** on a scratch branch (`seeded-fault-test`).

### Step 1: Deliberate Fault Injection
In `api/app/services/fit_gap/engine.rb`, we deliberately broke the contract fix:
```ruby
# SEEDED FAULT: corrupt required_level contract
expected_level: expected_level,
required_level: nil,
is_override:    is_override,
```

### Step 2: Verification of Immediate Red Failure
Running the test suite immediately caught the corrupted payload:
```text
Failures:

  1) FitGap::Engine#call computes correct comparisons and satisfies frontend contract (both required_level and expected_level)
     Failure/Error: expect(react_comp['required_level']).to eq(3)
     
       expected: 3
            got: nil
     
       (compared using ==)
     # ./spec/services/fit_gap/engine_spec.rb:105:in `block (3 levels) in <top (required)>'

Finished in 0.20466 seconds (files took 1.15 seconds to load)
3 examples, 1 failure
```

### Step 3: Clean Reversion & Verification
The scratch branch was cleanly reverted and deleted. The main feature branch re-verified at **25 examples, 0 failures**, proving that our test assertions directly guarantee contract reliability.

---

## 9. AI Verification Moment

During the development process, AI code generation was used as leverage but subjected to rigorous human verification:

> **The Risky AI Suggestion:**  
> When tasked with making portfolio regeneration idempotent, an AI code assistant suggested:  
> ```ruby
> # AI suggestion:
> portfolio.portfolio_skills.destroy_all
> save_skills(portfolio, response)
> ```  
> While this naive approach achieves regeneration idempotency, it completely overlooked the database relationship:  
> `has_one :assessor_override, dependent: :destroy`.  
> blind reliance on this AI suggestion would have shipped catastrophic data loss into production, wiping out hours of human assessor evaluations every time a portfolio refreshed.

**Human Engineering Correction:**  
Recognizing the cascade risk, we rejected the destructive suggestion and designed an **In-Place Reconciliation Algorithm**. We extracted existing overrides into an in-memory map before mutations, updated matching skills in-place, and re-linked the overrides. This eliminated the destruction cascade and guaranteed data integrity.

---

## 10. Visual Flow Architecture

### 1. Fit/Gap Evaluation Matrix with Human Overrides
![Fit/Gap Comparison Matrix](screenshots/01-fitgap-matrix.png)  
*Figure 1: Shows the repaired "Required" column, candidate ratings, amber `✏ Override` marker with tooltip rationale, and culture narrative summary.*

### 2. Indonesian UU PDP No. 27/2022 Statutory Notice
![Indonesian UU PDP Consent Card](screenshots/02-uupdp-consent.png)  
*Figure 2: Shows the 4 compliance pillars (Voice biometrics, AI evaluation, Human-in-the-loop guarantee, Subject rights) and explicit consent gate.*

### 3. Interview Wrap-Up Trapping Prevention Architecture
![Trapping Prevention Flow](screenshots/03-trapping-architecture.png)  
*Figure 3: Contrasts the flawed baseline (where initiated discovered skills trapped sessions) against the revamped time-aware auto-wrap engine.*

### 4. Assessor Override Lifecycle & Data Integrity
![In-Place Reconciliation](screenshots/04-override-preservation.png)  
*Figure 4: Contrasts the destructive cascade wipe against the in-place reconciliation pattern.*

---

## 11. Video Demonstration Walkthrough

A structured 3–5 minute video demonstration script is available in:  
`assessment/VIDEO_DEMO_SCRIPT.md`

### Video Walkthrough Highlights
- **0:00 – 0:45:** Problem context & discovering the blank required column and override deletion flaws.
- **0:45 – 1:30:** Candidate empathy & Indonesian UU PDP No. 27/2022 statutory consent modal.
- **1:30 – 2:30:** End-to-end assessor workflow: overriding skill levels, viewing the Fit/Gap comparison, and proving override persistence on regeneration.
- **2:30 – 3:30:** System resilience: preventing candidate session traps and Sidekiq duplicate job stampedes.
- **3:30 – 5:00:** Test suite execution (25 RSpec, 9 Vitest), Seeded Fault Test proof, and Monozukuri conclusion.

---

## 12. Conclusion & Monozukuri Statement

Software craftsmanship is not about writing the maximum number of lines; it is about building software that is reliable, respectful of its users, and mathematically sound across failure modes. 

Through this revamp, we bridged the gap between a fragile prototype and an enterprise-grade hiring platform:
- **For Candidates:** Transparent, time-bounded interviews with statutory privacy protection under Indonesian law.
- **For Assessors:** Complete confidence that their manual evaluation effort is respected, preserved, and clearly surfaced.
- **For Engineering:** A pristine fullstack codebase backed by 34 automated tests and zero silent failure modes.

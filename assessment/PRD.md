# Product Requirements Document (PRD)
## AI Interview Platform: Monozukuri Portfolio & Fit/Gap Engine Revamp

**Author:** Fullstack Product Engineer  
**Status:** In Review / Approved for Execution  
**Target Milestone:** Production Release Candidate  
**Target Platforms:** Web (Desktop & Mobile Responsive), REST API, Real-Time Audio WebSocket  

---

## 1. Executive Summary & Vision

### 1.1 Product Vision
The **AI Interview Platform** exists to transform hiring from subjective, fatigue-prone resume screening and unstructured interviews into **objective, evidence-backed, and reproducible talent evaluations**.

By conducting conversational AI interviews with real-time skill probing, generating evidence-backed skill portfolios (anchored on strict L1–L5 behavioral rubrics), and providing instant Fit/Gap matching against open vacancies, the platform empowers hiring managers and recruiters to make defensible, high-confidence hiring decisions in minutes rather than weeks.

### 1.2 First-Principles Product Framing
1. **What is genuinely true?**
   * Resumes exaggerate; human interviewers exhibit cognitive bias and inconsistent standards; manual interviewing does not scale.
   * Algorithmic assessment is only trustworthy if every single claim is substantiated with verbatim candidate quotes (evidence) and can be audited/overridden by human assessors.
2. **What should this product be if built from scratch?**
   * A frictionless, transparent evaluation system where the candidate is treated with dignity, assessors have complete oversight, and recruiters receive deterministic, actionable hiring insights.
3. **What is the current reality & gap?**
   * The platform has a functional audio engine and basic LLM prompts, but suffers from seam mismatches (e.g., property name discrepancies between API and Web), missing interaction states (empty, error, loading), desynchronized assessor override caching, and zero test harness.
4. **The Monozukuri Standard**:
   * We treat the baseline as the floor. The revamp must deliver exceptional visual taste, uncompromised system reliability, and full compliance with Indonesian privacy regulations.

---

## 2. User Personas & User Journeys

```mermaid
journey
    title End-to-End Candidate & Assessor Experience
    section Candidate
      Receive Invite Link: 5: Candidate
      Complete Hardware Check: 4: Candidate
      Engage in Conversational AI Interview: 5: Candidate
      Session Auto-Ends on Completion: 5: Candidate
    section Assessor
      Review Real-Time Coverage Map: 4: Assessor
      Inspect Generated Skill Portfolio: 5: Assessor
      Verify Direct Quote Evidence: 5: Assessor
      Submit Score Override with Notes: 5: Assessor
    section Hiring Manager & Recruiter
      Select Target Vacancy: 5: Recruiter
      Review Match / Gap / Exceed Deltas: 5: Recruiter
      Read Culture & Executive Narratives: 5: Recruiter
      Export High-Res PDF / JSON Report: 5: Recruiter
```

### Persona 1: The Candidate (The Unrepresented User)
* **Context**: Applying for high-stakes roles in Indonesia. Does not choose the software, cannot opt out, and is vulnerable to algorithmic errors or technical glitches.
* **Goals**: Clear instructions, low-latency natural voice interaction without browser dictation noise, fair evaluation against explicit behavioral anchors, and absolute protection of personal data under **UU PDP No. 27/2022**.
* **Key Needs**: Seamless hardware check (< 3 seconds preflight), responsive microphone level indicator, dignified interview flow, zero algorithmic scoring without verbatim proof.

### Persona 2: The Assessor (The Quality Gatekeeper)
* **Context**: Senior engineering or HR lead responsible for candidate qualification.
* **Goals**: Quickly audit AI scores, inspect verbatim quotes demonstrating *how* the candidate thinks, adjust levels when AI under/over-evaluates, and maintain an audit trail with written rationale.
* **Key Needs**: Rich skill cards, clear L1–L5 definitions, confidence ratings, intuitive override modal, instant downstream calculation updates.

### Persona 3: The Recruiter & Hiring Manager (The Decision Maker)
* **Context**: Managing 10+ open job vacancies and hundreds of applicants.
* **Goals**: Instant clarity on whether a candidate meets, exceeds, or falls short of role requirements; high-level executive summaries; exportable reports for hiring committee meetings.
* **Key Needs**: Vacancy comparison matrix, color-coded delta indicators (`+1`, `-2`, `✓`), synthesized culture fit narratives, one-click PDF/JSON export.

---

## 3. Regulatory & Legal Framework (Indonesian UU PDP Compliance & Security)

In accordance with **Undang-Undang No. 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP)** and enterprise security standards:

1. **Principle of Data Minimization & Purpose Limitation**:
   * Assessment transcripts and audio streams must only be used for candidate evaluation for specified vacancies.
2. **Zero PII Leakage in Commits & Logs**:
   * Sensitive attributes (`candidate_name`, `email`, `invite_token`, `passw`, `secret`, `token`, `_key`, `crypt`, `salt`) are strictly redacted in Rails server logs via `config/initializers/filter_parameter_logging.rb`.
   * No candidate personal data, raw audio streams, or API credentials appear in Sidekiq argument dumps, error payloads, or Git commits.
3. **Right to Human Intervention & Auditability**:
   * Algorithmic AI ratings must not be final automated rejections without human oversight. The `AssessorOverride` system provides the required human-in-the-loop governance mechanism with timestamped notes.
4. **Strict Multi-Tenant Isolation & Cryptographic Integrity**:
   * Cross-tenant data access is strictly prevented via `TenantScoped` default scoping (`Current.tenant_id`) across all tenant models (`Vacancy`, `Session`, `Assessment`, `Portfolio`).
   * JWT tokens enforce fail-fast HMAC-SHA256 verification via `ENV.fetch('SECRET_KEY_BASE')` with zero hardcoded fallback secrets.

---

## 4. Functional Requirements & Feature Specifications

### 4.1 Skill Portfolio Engine (Backend & Frontend)
* **FR-PORT-01**: The system must extract candidate quotes and assign an AI Level (1–5) and Confidence (`high`, `medium`, `low`) for all configured and discovered skills post-interview.
* **FR-PORT-02**: The UI must display each skill with its effective level badge, confidence indicator, discovered badge (if applicable), competency summary, and expandable evidence quotes.
* **FR-PORT-03**: Assessors must be able to submit level overrides (1–5) with mandatory notes (`assessor_notes`). The original `ai_level` must remain immutable in the database for auditing.
* **FR-PORT-04**: When an override is submitted, the UI must optimistically update the effective level badge, display an "Assessor Adjusted" indicator, and immediately recalculate dependent cached Fit/Gap reports in-memory (deltas, match results, and summary counters) in real-time with zero server refetching.
* **FR-PORT-05**: When Gemini REST is unavailable or rate-limited, `Portfolios::Generator` must provide substance-aware fallback synthesis based on candidate speech volume and technical depth, assigning Level 2 baseline for low-effort transcripts to prevent score inflation.

### 4.2 Vacancy Fit/Gap Matching Engine (Backend & Frontend)
* **FR-FIT-01**: The system must calculate skill level deltas between the candidate's effective skill level (factoring in overrides) and the vacancy's `expected_level`.
* **FR-FIT-02**: Comparison results must be categorized into:
  * `match` ($\Delta = 0$): Candidate meets role expectation.
  * `exceed` ($\Delta > 0$): Candidate exceeds role expectation (e.g. $+1$, $+2$).
  * `gap` ($\Delta < 0$): Candidate falls short of expectation (e.g. $-1$, $-2$).
  * `not_assessed`: The vacancy requires a skill that was not probed or evaluated in this assessment session.
* **FR-FIT-03**: The backend must generate two AI narratives via Gemini Flash:
  * `culture_narrative`: 2–3 sentences assessing alignment with vacancy culture dimensions.
  * `overall_narrative`: 2–3 sentence executive hiring recommendation.
* **FR-FIT-04**: If Gemini narrative generation fails or times out, the backend must return a deterministic fallback narrative without raising a 500 error.
* **FR-FIT-05**: When an assessor override is created or updated, or a vacancy rubric is modified, existing `FitGapReport` records must be invalidated and regenerated to reflect current expectations.

### 4.3 Candidate Live Voice Interview Pipeline
* **FR-VOICE-01**: The candidate interview interface must capture clean 16kHz PCM audio via WebAudio `AudioWorklet`, streaming binary frames directly over WebSocket without browser dictation audio conflicts (no `"duk duk"` chimes).
* **FR-VOICE-02**: The UI must render real-time microphone volume activity (`micLevel` 0–100 RMS) via responsive emerald-green voice bars (`VoiceBars.tsx`).
* **FR-VOICE-03**: The system must detect end-of-turn silence via an asynchronous 1.7s timer in `MockLiveClient` while providing a manual "Done Speaking — Send Answer" button for instant turn completion.
* **FR-VOICE-04**: Multimodal voice transcription must wrap 16kHz PCM in 44-byte WAV headers and send to Gemini `v1beta` with automated fallback chaining (`gemini-2.5-flash` → `gemini-3-flash-preview` → `gemini-flash-latest`).
* **FR-VOICE-05**: Preflight hardware check must complete in $<3\text{ seconds}$ with local `/health` ping probes and calibrated voice streaming thresholds (1.5 Mbps down, 0.5 Mbps up, 600 ms ping).

### 4.4 Export & Reporting
* **FR-EXP-01**: Assessors and recruiters must be able to export the complete portfolio and fit/gap report as a formatted PDF (via Prawn) or structured JSON with full UTF-8 typographic character sanitization.

---

## 5. Non-Functional Requirements (NFRs)

| NFR Category | Requirement Specification | Measurement / Verification |
|---|---|---|
| **Aesthetics (Monozukuri)** | High-taste visual hierarchy, consistent typography, curated HSL color palette, no generic/cliché tropes. | Evaluated by Product Design review against all 6 interaction states. |
| **Performance** | Portfolio and Fit/Gap reads must respond in $<50\text{ ms}$ (cached reports). Background LLM jobs must complete in $<60\text{ s}$. Audio WebSocket preflight in $<3\text{ s}$. | API response benchmark; Sidekiq queue latency monitoring; Vitest speed test assertions. |
| **Resilience & Idempotency** | Sidekiq workers (`FitGapGeneratorWorker`, `PortfolioGeneratorWorker`) must be strictly idempotent and safe against duplicate job execution. | Seeded duplicate job execution tests in RSpec. |
| **Data Safety & Integrity** | Reversible database migrations; strict foreign key cascade/nullify rules; database check constraints on levels ($1 \le \text{level} \le 5$); fail-fast JWT validation with zero hardcoded secrets. | Migration rollback verification; PostgreSQL constraint checks; `JsonWebToken` specs. |
| **Multi-Tenant Security** | Strict data isolation across tenants without bypasses (`Vacancy.unscoped` eliminated; `Current.using` in workers). | RSpec cross-tenant isolation request & worker specs. |
| **Test Verification Rigor** | Fullstack automated test coverage across unit, request, integration, and E2E layers. | **41 passing RSpec backend specs**, **28 passing Vitest frontend tests across 9 suites**, **6 Playwright E2E browser flows**, 0 TypeScript build errors. |
| **Accessibility (a11y)** | Keyboard navigable modals, accessible contrast ratios (WCAG 2.1 AA), ARIA attributes on interactive elements. | Radix UI accessible primitives; automated a11y audit. |

---

## 6. Interaction States Matrix (The 6 Monozukuri States)

The frontend must explicitly handle all 6 interaction states across both `PortfolioPage` and `FitGapReportPage`:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        THE 6 MONOZUKURI STATES                         │
├────────────────────┬───────────────────────────────────────────────────┤
│ 1. Loading State   │ Skeleton loaders matching exact final layout.     │
│ 2. Empty State     │ Clean illustration & guidance when no data exists.│
│ 3. Error State     │ Actionable banner with retry action & clear copy. │
│ 4. Partial State   │ Clear badging for in-progress or low-conf skills. │
│ 5. Long Text State │ Accordions with line-clamping for lengthy quotes. │
│ 6. Responsive      │ Fluid grid: 1 col (mobile) → 2-3 col (desktop).   │
└────────────────────┴───────────────────────────────────────────────────┘
```

---

## 7. Scope Boundaries & Technical Trade-Offs

### 7.1 In Scope (Release Candidate)
* Fullstack revamp of `PortfolioPage` and `FitGapReportPage` across all 6 interaction states.
* Core domain hardening: `FitGap::Engine`, `Portfolios::Generator`, `PortfolioSkillsController`, and `VacanciesController`.
* Resolution of all 4 recruiter technical review points:
  1. Structured dynamic option evaluation assuming clean service encapsulation.
  2. Balanced cost and risk analysis for the event-driven materialized approach (multi-entity invalidation, eventual consistency, dual-logic maintenance, Sidekiq operational overhead).
  3. Removal of hardcoded JWT secret fallbacks; fail-fast cryptographic enforcement.
  4. Elimination of `Vacancy.unscoped`; strict multi-tenant scoping in controllers and Sidekiq workers.
* End-to-end AI Voice Interview experience: WebAudio 16kHz PCM streaming, removal of `webkitSpeechRecognition` conflict, real-time emerald RMS visualizer (`VoiceBars.tsx`), async 1.7s silence detection, and multimodal WAV transcription with Gemini `v1beta` model fallback chain.
* Reversible database migration `20260815000001_add_assessment_state_and_narrative_status.rb`.
* Complete automated test harnesses: **41 RSpec examples** + **28 Vitest tests** + **6 Playwright browser flows**.
* Seeded fault experiment and AI verification case study documentation.

### 7.2 Out of Scope (Future Milestones)
* Multi-language audio transcription (Indonesian speech-to-text beyond standard Whisper/Gemini models).
* Live candidate video proctoring / biometric analysis.

# Problem & Gap Analysis: AI Interview Platform
**Author:** Wisman Nur (Lead / Senior Staff Product Engineer)  
**Standard:** Monozukuri (Craftsmanship Beyond Minimum Baseline)  
**Date:** October 2026  
**Target Branch:** `feat/monozukuri-interview-revamp-wismannur`  

---

## 1. Product Context & Domain Immersion (5 Core Pillars)

### Pillar 1: The Product (Actual End-to-End Reality)
The AI Interview Platform automates technical and behavioral candidate assessments using generative AI:
- **Gemini Live (via WebSocket bridge)**: Real-time, bidirectional audio probing and dynamic question formulation.
- **Gemini Flash**: Async coverage analyzer and fit/gap calculation.
- **Gemini Pro**: Deep multi-turn transcript synthesis and comprehensive candidate skill portfolio generation.

Rather than asking static question lists, the platform dynamically analyzes candidate responses, challenges assumptions, tracks coverage across competency levels (L1–L5), and compiles a fit/gap report against specific vacancy profiles.

### Pillar 2: The Indonesian Hiring Industry Context
In Indonesia, high-growth technology companies, fintechs, and digital banking platforms process overwhelming volumes of candidate applications (500–1,500 applicants per junior-to-mid vacancy). Recruiters and hiring managers spend up to 70% of their screening bandwidth filtering surface-level CVs and conducting repetitive initial phone screens. 

Traditional automated screening (multiple-choice or static LeetCode quizzes) tests memorized algorithmic trivia rather than practical systems design, debugging, and production trade-offs. The AI Interview Platform provides breakthrough leverage by conducting conversational interviews that probe for reasoning depth while enforcing standardized rubrics (L1–L5).

### Pillar 3: What It Is For (Outcome & Akuntabilitas)
This platform exists to produce an objective, defensible, and actionable skill portfolio for every candidate. For it to remain trusted:
1. Every score must be grounded in verbatim transcript quotes (*evidence-grounded evaluation*).
2. The AI must remain impartial, avoiding hallucinated ratings or superficial affirmations.
3. Human assessors must retain final authority to calibrate and override AI recommendations without data loss.

### Pillar 4: The Users (Assessor, Recruiter, Hiring Manager)
- **Recruiters**: Need high-throughput batch invites, real-time live monitoring of interview status, and clear pass/fail fit indicators without technical jargon.
- **Assessors & Hiring Managers**: Need granular evidence breakdowns, the ability to compare candidate profiles directly against vacancy benchmarks via radar charts, and ergonomic calibration controls (popover-based overrides) that preserve dashboard geometry.

### Pillar 5: The People Affected Who Never Chose It (Candidates & UU PDP)
Candidates do not choose this software; they are evaluated by it, and an unfair or buggy assessment can derail their career trajectory.
Under **Undang-Undang No. 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP)**:
- **Pasal 20 & 21 (Explicit Consent & Transparency)**: Processing candidate voice data and algorithmic automated decision-making requires explicit, informed consent prior to recording.
- **Pasal 35 & 39 (Security & Confidentiality)**: Personal identifiable information (PII) including candidate names, voice transcripts, and evaluation ratings must never leak into server logs or public endpoints.
- **Pasal 8 (Right to Rectification & Explanation)**: Candidates are entitled to fair assessment and transparency on the criteria evaluated.

---

## 2. Severity-Ranked Problem & Gap Analysis (P0 - P3)

The following comprehensive severity matrix documents all architectural flaws, legal non-compliances, and real-world operational hazards identified during the Monozukuri audit, alongside their resolution status:

| ID | Sev | Finding Category | Root Cause & Code Location | Real-World Impact | Remediation Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **P0-1** | **P0** | **Defective Implementation** | `Portfolios::Generator#save_skills` executes `portfolio.portfolio_skills.destroy_all`. | **Data Loss**: Overwrites human assessor calibration overrides and notes on portfolio regeneration. | **RESOLVED**: Transactional snapshot & override re-linking implemented. |
| **P0-2** | **P0** | **Defective Implementation** | `Session#invite_url` defaults to `APP_BASE_URL` (`port 3001` Rails API). | **System Blocker**: Candidates opening invite links receive 404 Routing Error because route lives on React frontend (`port 5173`). | **RESOLVED**: Dynamic client host/port resolution based on environment. |
| **P0-3** | **P0** | **Defective Implementation** | `Gemini::HttpClient` lacks `responseMimeType: 'application/json'` and fence cleaning. | **Reliability Failure**: Markdown-wrapped JSON responses crash background workers, leaving portfolios stuck in `generating`. | **RESOLVED**: MIME negotiation + regex block stripping added. |
| **P0-4** | **P0** | **Missing Specification** | Absence of `filter_parameter_logging.rb` in `api/config/initializers/`. | **Legal & Privacy Breach**: Candidate names, JWT tokens, and interview transcripts logged in plain text, breaching UU PDP. | **RESOLVED**: Initializer deployed with strict PII parameter filters. |
| **P1-1** | **P1** | **Defective Implementation** | `AssessmentsController#destroy` does not verify deletion return value. | **Integrity Flaw**: Returns 200 "Assessment deleted" even when foreign-key sessions block deletion. | **RESOLVED**: HTTP 422 returned with clear dependency error message. |
| **P1-2** | **P1** | **Missing Specification** | `InterviewPage.tsx` lacks explicit UU PDP consent checkbox and audio recording notice. | **Compliance Risk**: Voice data recorded and evaluated without statutory candidate consent. | **RESOLVED**: `PrivacyConsentModal.tsx` gating hardware check deployed. |
| **P1-3** | **P1** | **Defective Implementation** | `FitGap::Engine` fallback narrative leaves `culture_narrative` as `nil` on model failure. | **Evaluation Flaw**: Assessors receive an empty culture fit section with no diagnostic alert. | **RESOLVED**: Structured fallback culture and gap narratives implemented. |
| **P1-4** | **P1** | **Missing Specification** | Absence of automated test suites (0 specs in `api/`, 0 tests in `web/`). | **Engineering Debt**: High risk of silent regressions on every pull request. | **RESOLVED**: 27 RSpec specs + 24 Vitest specs added (100% passing). |
| **P1-5** | **P1** | **Defective Lifecycle** | `HardwareCheck.tsx` left microphone audio tracks running when transitioning to interview. | **Hardware Stream Lock**: Causes `NotReadableError` / device busy on subsequent mic acquisition in live interview. | **RESOLVED**: Explicit `track.stop()` lifecycle teardown on unmount & step change. |
| **P1-6** | **P1** | **Resilience Flaw** | `AudioWebsocketMiddleware` crashed session on Gemini Live WebSocket 1008/1006 closures. | **Session Disruption**: Network blips or policy violations permanently aborted candidate interviews. | **RESOLVED**: Intelligent reconnect & conversational fallback state machine added. |
| **P2-1** | **P2** | **Defective Implementation** | `LiveMonitorPage.tsx` permanently sliced transcript to only 10 turns. | **UX Limitation**: Assessors in 45-min sessions cannot inspect earlier turns. | **RESOLVED**: Added toggle between Recent (10) and Full Transcript. |
| **P2-2** | **P2** | **Defective Implementation** | `AssessmentListPage.tsx` ignored Kaminari pagination metadata. | **Feature Blindness**: Assessments beyond page 1 are unreachable in UI. | **RESOLVED**: Next/Prev pagination controls and page indicator deployed. |
| **P2-3** | **P2** | **Defective Implementation** | Unhandled null/empty states for unassessed skills in `ComparisonTable.tsx`. | **Visual Confusion**: Rendered blank dashes without explaining "Not Assessed". | **RESOLVED**: Added distinct `⚪ Not Assessed` badge and summary counter. |
| **P2-4** | **P2** | **Operational Hazard** | Mobile and laptop displays sleep or dim during long (30–45 min) candidate interviews. | **Interview Interruption**: Screen sleep drops WebSocket or freezes video/audio worklet. | **RESOLVED**: Implemented Screen Wake Lock API with `visibilitychange` auto-recovery. |
| **P2-5** | **P2** | **UX Degradation** | Rating override editor expanded inline inside candidate skill cards. | **Layout Shift**: Disrupted the card grid geometry and forced vertical jumping across cards. | **RESOLVED**: Encapsulated override workflow in a Radix Popover portal anchored to trigger. |
| **P3-1** | **P3** | **Visual Limitation** | Multi-skill fit/gap analysis displayed purely in static tables without multi-axis visualization. | **Cognitive Burden**: Difficult for recruiters to quickly perceive candidate skill contours. | **RESOLVED**: Built `SkillRadarChart` visualizing candidate vs benchmark L1-L5 levels. |
| **P3-2** | **P3** | **Missing Feedback** | Lack of real-time audio reactivity during candidate speech and AI thinking states. | **Uncertainty**: Candidates unsure if the AI is actively listening or processing. | **RESOLVED**: Added `AiLiveOrb` real-time audio visualizer with reactive pulse glows. |

---

## 3. Constraint Signals & Technical Escalation

As a Senior Staff Engineer, the following architectural debts and operational constraints are escalated:

1. **Dual Schema Search Path & Multitenancy Scoping**:
   - The database uses `schema_search_path: "ai_interview,public"`. While `Organization` lives in `public`, all interview tables reside in `ai_interview`.
   - `TenantScoped` depends on `RequestStore.store.key?(:tenant_id)`. In background workers (Sidekiq) where RequestStore is uninitialized, calling `.find` without tenant scoping can accidentally leak cross-tenant records if not explicitly managed.
2. **WebSocket Audio Bridge & Resource Lifecycle**:
   - `AudioWebsocketMiddleware` uses EventMachine (`EM::Timer`) and Faye::WebSocket. Client disconnects and Gemini Live closures (1008/1006) must be actively reaped, and reconnect timers must be strictly cancelled upon browser unmount.
3. **Screen Wake Lock Lifecycle & Tab Visibility**:
   - The W3C Screen Wake Lock API standard automatically releases any active wake lock when the tab loses focus (`document.visibilityState === 'hidden'`). A resilient implementation must monitor `visibilitychange` and reacquire the lock automatically when the user returns.
4. **Synchronous vs Asynchronous LLM Generation**:
   - Gemini Pro portfolio generation takes 60–120 seconds. It is correctly offloaded to Sidekiq, and the frontend polling mechanism handles network blips, tab backgrounding, and retry limits gracefully with structured retry-after semantics.

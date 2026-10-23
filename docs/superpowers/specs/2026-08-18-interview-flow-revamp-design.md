# Design Specification: AI Interview Platform Revamp — Stage 1 (Interview & Live Audio/Transcript Flow)

- **Date:** 2026-08-18
- **Author:** Product Engineering Team
- **Status:** Approved
- **Target Branch:** `feature/monozukuri-revamp`
- **Scope:** Stage 1 of 3 (Interview Experience, Session Lifecycle, Data Safety & Test Harness)

---

## 1. Executive Summary & Product Context

### 1.1 The Mission
The **AI Interview Platform** conducts real-time talent assessments for candidates in Indonesia using Gemini AI. 

As a **Product Engineer**, we recognize that candidates do not choose to be assessed by this software; a wrong score, unexpected disconnection, or opaque failure disrupts real careers. Simultaneously, hiring managers and assessors require trustworthy, comprehensive data without operational hiccups or duplicate background jobs.

### 1.2 Monozukuri Standard
Beyond minimal code functionality, this revamp delivers:
1. **Uncompromised System Rigor:** Bulletproof session lifecycle, idempotent background job enqueuing, and proactive data protection compliant with Indonesia's Personal Data Protection Law (UU PDP).
2. **Exceptional UI/UX Taste:** A high-craftsmanship interview environment with responsive live audio waveforms, an expressive AI thought indicator (Cult UI inspired), transparent connection health monitoring, and graceful termination dialogs.
3. **Proven Correctness:** High-coverage RSpec request and service specs, Vitest component test harness, and seeded fault verification proofs.

---

## 2. Architecture & Data Flow

```
+-------------------------------------------------------------------------------+
|                                FRONTEND (React 18)                            |
|                                                                               |
|  +---------------------+   +---------------------+   +---------------------+  |
|  |  Device Check HUD   |   | Live Audio Waveform |   | End Session Dialog  |  |
|  |  (Mic & Permissions)|   |  & Cult UI Thought  |   |  (Double Confirm)   |  |
|  +----------+----------+   +----------+----------+   +----------+----------+  |
|             |                         |                         |             |
+-------------|-------------------------|-------------------------|-------------+
              | REST (Sessions API)     | WebSockets (Audio/Turns)| REST (audio_complete)
              v                         v                         v
+-------------------------------------------------------------------------------+
|                                BACKEND (Rails 7 API)                          |
|                                                                               |
|  +---------------------+   +---------------------+   +---------------------+  |
|  | SessionsController  |   |  Interview Channel  |   | Sessions::EndHandler|  |
|  | (Pre-req Validation)|   | (Turns & Coverage)  |   |  (Lock & Idempotent)|  |
|  +----------+----------+   +----------+----------+   +----------+----------+  |
|             |                         |                         |             |
|             +-------------------------+-------------------------+             |
|                                       |                                       |
|                                       v                                       |
|                         [PostgreSQL Session State]                            |
|                           pending -> active -> ended                          |
|                                       |                                       |
|                                       v                                       |
|                         [PortfolioGeneratorWorker]                            |
|                             (Sidekiq: N10 Job)                                |
+-------------------------------------------------------------------------------+
```

---

## 3. Detailed Component Specifications

### 3.1 Backend Module (`api/`)

#### A. Session Creation Guard (`Api::V1::SessionsController#create`)
- **Requirement:** A session must never be initiated against an assessment without configured skills.
- **Implementation:** Validate `assessment.assessment_skills.exists?`. If false, return HTTP `422 Unprocessable Entity` with `{ "error": "Assessment must have at least one configured skill before creating a session." }`.

#### B. Robust Session Termination & Idempotency (`Sessions::EndHandler`)
- **Requirement:** Prevent race conditions between WebSocket auto-termination (`all_covered`) and HTTP manual termination (`audio_complete` / `end_session`).
- **Implementation:**
  - Wrap termination inside a database transaction with row-level locking (`session.lock!`).
  - Check `session.ended?`. If already ended, return gracefully without triggering duplicate `PortfolioGeneratorWorker` jobs.
  - Calculate `duration_seconds` accurately based on `session.started_at` and `Time.current`.

#### C. Personal Data Protection (UU PDP Compliance)
- **Requirement:** Prevent leaks of Personally Identifiable Information (PII) in application logs or unsecured payload dumps.
- **Implementation:** Add parameter filtering in Rails configuration for sensitive keys (`candidate_name`, `email`, `phone_number`, `token`), and sanitize transcript logs.

---

### 3.2 Frontend Module (`web/`)

#### A. Interview Room HUD (`src/pages/interview/InterviewPage.tsx`)
- **Header Section:**
  - Role title with clear assessment branding.
  - Live Connection Status pill (Connected, Reconnecting, Disconnected) with visual status dot.
  - Time-Ceiling Countdown Timer: Displays remaining time with progressive warning thresholds (Yellow at 5m, Red pulsing at 1m).
- **Interactive Stage:**
  - **Live Audio Waveform Visualizer:** Animated SVG/Canvas responsive to audio stream activity.
  - **AI Thought State Indicator:** Cult UI inspired pulsing ripple showing AI status (*Listening*, *Thinking*, *Speaking*).
  - **Coverage Progress Pill Strip:** Discrete, non-distracting pill indicator showing current competency areas addressed.
- **Footer Controls:**
  - Microphone mute/unmute toggle.
  - "Akhiri Wawancara" button triggering the Graceful Termination Modal.

#### B. Graceful Termination Dialog
- Two-step confirmation preventing accidental quits.
- Explains to candidate that their progress is saved and evaluation will begin immediately.

#### C. Edge States & Failure Handling
- **Mic Permission Denied / Disconnected:** Clear recovery instructions and "Retry Connection" button.
- **WebSocket Reconnection Buffer:** Displays non-blocking reconnection banner while preserving existing transcript state.

---

## 4. Testing & Verification Strategy

### 4.1 Automated Backend Suite (RSpec)
- `spec/requests/api/v1/sessions_spec.rb`:
  - `POST /api/v1/assessments/:id/sessions`: Tests successful creation, 404 for missing assessment, and 422 when assessment has 0 skills.
  - `GET /sessions/:token/candidate`: Validates token lookups and status reporting.
- `spec/services/sessions/end_handler_spec.rb`:
  - Tests clean session status transition to `ended`.
  - Verifies exact-once execution of `PortfolioGeneratorWorker` under repeated calls (Idempotency).
  - Tests calculation of `duration_seconds`.

### 4.2 Automated Frontend Suite (Vitest)
- Unit tests for Countdown Timer, Audio Waveform Visualizer, and End Session Confirmation Dialog.

### 4.3 Seeded Fault Test (Monozukuri Proof)
- Deliberately introduce a regression in `Sessions::EndHandler` (e.g. bypassing the `ended?` guard).
- Verify the test suite catches the double worker enqueue error.
- Revert the fault cleanly with git commit evidence.

---

## 5. Definition of Done
1. All RSpec request and service specs pass.
2. Frontend builds without TypeScript or styling regressions.
3. End-to-end interview flow operates smoothly from start to portfolio enqueuing.
4. Clean, readable git commit history on `feature/monozukuri-revamp`.

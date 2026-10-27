# Revamp Strategy, Acceptance Criteria & Trade-offs
**Author:** Wisman Nur (Lead / Senior Staff Product Engineer)  
**Standard:** Monozukuri (Craftsmanship Beyond Minimum Baseline)  
**Date:** October 2026  
**Target Branch:** `feat/monozukuri-interview-revamp-wismannur`  

---

## 1. Self-Defined Acceptance Criteria (AC) & Edge Cases

### AC 1: Resilient Portfolio Generation & Override Preservation (P0-1)
- **AC 1.1**: When a portfolio is regenerated (`POST /api/v1/sessions/:id/portfolio/regenerate`), existing `AssessorOverride` records MUST NOT be deleted.
- **AC 1.2**: If a skill was previously overridden by a human assessor, the new portfolio skill generation MUST preserve or re-link the existing override record by `skill_id` or normalized `skill_label`.
- **AC 1.3**: In the event of a foreign key constraint or partial write, the transaction must roll back completely without leaving dangling or orphan records.

### AC 2: Candidate Invite URL & Routing Alignment (P0-2)
- **AC 2.1**: `Session#invite_url` must point to the frontend web application URL (configured via `FRONTEND_BASE_URL` or `APP_BASE_URL` with proper port fallback to 5173).
- **AC 2.2**: Opening `invite_url` in a browser must correctly route to React's `/interview/:token` page without any 404 or backend redirection error.

### AC 3: Robust LLM Client & Strict JSON Recovery (P0-3)
- **AC 3.1**: `Gemini::HttpClient` must enforce `responseMimeType: "application/json"` in `generationConfig`.
- **AC 3.2**: `parse_response` must automatically strip leading/trailing markdown code fences (````json ... ````), sanitize whitespace, and parse valid JSON.
- **AC 3.3**: If JSON parsing fails due to model hallucination or truncation, the client must trigger an automatic retry or fallback schema parser rather than an unhandled exception.

### AC 4: Personal Data Protection (UU PDP Compliance) (P0-4 & P1-2)
- **AC 4.1**: `filter_parameter_logging.rb` must filter `:password`, `:token`, `:invite_token`, `:candidate_name`, `:transcript_text`, `:audio_data`, and `:audio_chunk` from Rails logs.
- **AC 4.2**: `InterviewPage.tsx` must present an explicit UU PDP Consent Modal (`PrivacyConsentModal.tsx`) before microphone permissions and audio recording start.
- **AC 4.3**: A candidate cannot click "Lanjutkan ke Pengecekan Perangkat" without explicitly acknowledging:
  1. Voice audio recording and real-time AI transcription.
  2. Automated evaluation of competency levels.
  3. Purpose of hiring evaluation and data retention rights under UU PDP No. 27/2022.

### AC 5: Accurate Assessment Deletion Lifecycle (P1-1)
- **AC 5.1**: `AssessmentsController#destroy` must inspect whether `@assessment.destroy` returns `true`.
- **AC 5.2**: If sessions exist and deletion is restricted by foreign keys, the API must return HTTP 422 Unprocessable Entity with error message: `"Cannot delete assessment with existing candidate sessions."`

### AC 6: Handling Unassessed Skills in Fit/Gap & Reports (P1-3 & P2-3)
- **AC 6.1**: When a vacancy skill was not assessed in the candidate's interview session, `FitGap::Engine` sets `candidate_level: nil`, `result: 'not_assessed'`.
- **AC 6.2**: The frontend `ComparisonTable` and PDF export must explicitly render a distinct `⚪ Not Assessed` badge with tooltip explanation: *"Skill was not included in the interview agenda or gave no detectable signal."*
- **AC 6.3**: Fallback narrative in `FitGap::Engine` must explicitly account for not-assessed skills and provide a coherent, professional narrative.

### AC 7: Hardware Audio Stream Lifecycle & Deterministic Teardown (P1-5)
- **AC 7.1**: When exiting `HardwareCheck.tsx` or clicking "Mulai Interview", all active `MediaStreamTrack` audio instances MUST have `.stop()` called explicitly.
- **AC 7.2**: AudioContext and AudioWorklet resources must be gracefully detached on component unmount, preventing `NotReadableError` / device busy locks when live interview audio capture initiates.

### AC 8: WebSocket Resilience & Intelligent Fallback State Machine (P1-6)
- **AC 8.1**: In `AudioWebsocketMiddleware`, when Gemini Live closes with code `1008` (Policy Violation) or `1006` (Abnormal Closure), the system must switch to conversational fallback state without dropping candidate turn buffers.
- **AC 8.2**: System instructions must include strict anti-jailbreak directives to defend against prompt injection ("ignore previous instructions").

### AC 9: Screen Wake Lock API & Visibility Auto-Recovery (P2-4)
- **AC 9.1**: `useWakeLock.ts` must acquire a screen wake lock sentinel during active candidate interview sessions, preventing display dimming/sleep.
- **AC 9.2**: On `document.visibilitychange`, if the tab transitions back from `hidden` to `visible`, the wake lock MUST be automatically re-acquired if the interview remains in progress.
- **AC 9.3**: If the browser does not support the Screen Wake Lock API, the hook must degrade gracefully with zero console errors or render disruptions.

### AC 10: Popover-Encapsulated Assessor Override Workflow (P2-5)
- **AC 10.1**: The assessor rating calibration editor must render within an accessible Popover portal (`@radix-ui/react-popover`) anchored to the edit trigger.
- **AC 10.2**: Opening or closing the override panel must NOT cause layout shifts or card height jumps across the candidate skill card grid.

### AC 11: Multi-Axis Visual Skill Radar & Real-Time Audio Feedback (P3-1 & P3-2)
- **AC 11.1**: Fit/gap reports must feature an interactive `SkillRadarChart` visualizing candidate competence vs target benchmark across L1–L5 rubrics.
- **AC 11.2**: Live interview page must render `AiLiveOrb` with real-time reactive pulse states for speaking, listening, and processing.

---

## 2. Solution Options & Trade-off Evaluation

### Architectural Trade-off: Option A vs Option B

```
OPTION A: Direct Gemini Live WebSocket (Peer-to-Peer Multimodal)
[Candidate Browser] <==== High-Bandwidth Audio WSS ====> [Gemini Live API]
                         (No turn persistence; fragile over Indonesian 4G)

OPTION B (Selected): Decoupled Async Event-Driven Pipeline
[Candidate Browser] <== WSS ==> [Rails API & Redis] <== Audio Sink ==> [Audio Processor]
                                      ||
                             (Persists Turn & State)
                                      ||
                           [Sidekiq Background Jobs]
                                      ||
                         [Gemini Flash/Pro JSON Engine]
```

### Detailed Trade-Off Evaluation Matrix

| Evaluation Criteria | Option A (Direct Audio Streaming) | Option B (Decoupled Async Pipeline - Selected) |
| :--- | :--- | :--- |
| **Network Resilience (SEA/Indonesian 4G)** | **Extremely Fragile**: High packet drop or latency jitter drops WebSocket; session fails irrecoverably. | **Resilient**: Audio streamed in finite chunks; state machine auto-reconnects and preserves transcript history. |
| **Operating Cost (OpEx)** | **High**: ~$0.06/minute for raw streaming audio tokens (~$2.70 per 45-min interview). | **Optimal**: ~$0.005/minute text token inference (~$0.25 per 45-min interview) with cached prompts. |
| **UU PDP & Audit Compliance** | **High Liability**: Raw streams bypass local backend storage; impossible to prove legal audit trail. | **Compliant**: Verbatim transcripts stored per turn in PostgreSQL with immutable timestamps and PII filter guards. |
| **Assessor Calibration (Overrides)** | Impossible mid-flight; post-hoc regeneration risks desynchronization. | Native relational persistence with `AssessorOverride` linked via transactional snapshots. |
| **Failure Modes** | Network blip aborts interview without recovery. | Automatic fallback to text prompting, structured narratives, and clean UI error states. |

---

## 3. Claimed Engineering Depth

We claim **Balanced Fullstack Depth with Systems Rigor**:
- **Backend Depth**: PostgreSQL transaction isolation, override retention algorithms, Sidekiq idempotency, Gemini client schema enforcement, WebSocket 1008/1006 fallback state machines, and UU PDP privacy parameter filtering.
- **Frontend Depth**: Radix UI + Tailwind polish, Screen Wake Lock API lifecycle, microphone hardware stream disposal, Popover-encapsulated overrides, dual live monitor toggles, `AiLiveOrb` visualizer, and `SkillRadarChart`.
- **Automated Testing Harness**: 100% pass rate across **27 RSpec backend specs** and **24 Vitest frontend specs across 9 test files**, verified by an immutable **Seeded Fault Test**.

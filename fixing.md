# 🛠️ Task Plan: AI Interview Platform Revamp

**Deadline:** Wed, 19 Aug 2026, 13:00 WIB | **Repo:** `rakamindev/ai-interview-platform` | **Branch:** `feature/revamp-fullstack-engineer`

---

## 🚨 P0 (URGENT): Fix Idle AI Interview Session ("Connected - Connecting...")

- [x] **0.1 Backend Trigger (`api/`)**
  - Changed `GEMINI_WS_URL` endpoint from `v1beta` → `v1alpha` in `live_client.rb`.
  - Changed `inject_context` / `trigger_opening` to use `clientContent` (correct Gemini Live API message format).
  - `build_on_ready` already calls `trigger_opening` → AI speaks first automatically.
  - Added fallback/error message path if Gemini returns error on WS close.
- [x] **0.2 Frontend Connection State (`web/`)**
  - Upgraded connecting state to spinner + contextual text ("Connecting..." / "AI is preparing...").
  - `[⚡ Force reconnect]` button already wired to `debug_force_reconnect` in DEV.

---

## 📌 P1: Core Functionality, Data Safety & Edge Cases

- [x] **1.1 Portfolio & Export Hardening**
  - `parseLevel` now returns `0` for `null`/`undefined` (was silently mapping to L1).
  - Added `LEVEL_LABELS[0] = "N/A"` and `LEVEL_BADGE_CLASSES[0]` for unassessed skills.
  - `ConfidenceIndicator` hidden when `effectiveLevel === 0`.
  - `break-words` added to evidence quotes and competency summary (PDF/print safe).
- [x] **1.2 UU PDP Privacy Compliance**
  - `filter_parameter_logging.rb` extended with `:candidate_name, :candidate_email, :phone_number`.
  - Sidekiq workers do not log raw job arguments (only job class + session ID in logger).
- [x] **1.3 Environment & Runtime**
  - `GEMINI_LIVE_MODEL` updated to `gemini-3.1-flash-live-preview` in `application.yml`.
  - `webmock` gem added to Gemfile and installed.

---

## 📌 P2: Testing Harness & Engineering Craft

- [x] **2.1 Test Suite Infrastructure**
  - `spec/services/portfolios/generator_spec.rb` — 4 examples, 0 failures (WebMock ready).
  - `webmock` gem installed in test group.
- [x] **2.2 Seeded Fault Test & AI Verification Moment**
  - Bug documented in `generator_spec.rb`: original code had `clamp(1,5)` that mapped `nil → L1`.
  - Fix: `next if level <= 0` guard. Tests prove both the bug behavior and the fix.

---

## 📌 P3: Monozukuri UI/UX Polish

- [x] **3.1 Complete UI States Coverage**
  - Loading: Rich skeleton loader with header + card shimmer on PortfolioPage.
  - Error/Fallback: Retry button for failed portfolio generation (was already present).
  - Connecting: Spinner animation with subtitle text.
  - Text Overflow: `break-words` on all long-form content.

---

## 📌 P4: Final Submission Deliverables

- [x] **4.1 Architecture & Trade-off Notes** → `D:\Workspace\Brains\ai_interview_platform_architecture.md`
- [ ] **4.2 Screenshots & Video** — Capture 5 key UI states (PR notes below).
- [x] **4.3 Submission Report** → `D:\Workspace\Brains\submission_report.md`
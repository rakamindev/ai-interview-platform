# F-07 — Candidate UI Shows "Interview Complete" When the Interview Actually Failed

> **Finding:** F-07 (P1) · **Classification:** Defective Implementation · **Area:** Frontend / UX / State Machine · **UU PDP:** Not directly
> **Branch:** `feat/f07-interview-error-state` · **Status:** ✅ Completed & verified

---

## 1. Summary

The candidate interview page (`web/src/pages/interview/InterviewPage.tsx`) renders **"Interview Complete — The interview has been recorded"** on **every failure path**: the candidate-info fetch fails, the invite token is invalid/expired, the WebSocket emits a `no_system_prompt` error, the connection drops permanently, or authentication fails. The candidate believes the interview succeeded even though **no data was recorded** — a silent data loss with no retry and no pointer to the hiring contact.

This is a **defective implementation**, not a **missing specification** — the brief's dichotomy is "defined-but-broken" vs "not-defined", and F-07 sits squarely in the former. Failure handling was **not absent**: every failure path had explicit, defined behavior that routed to the wrong terminal state — `.catch(() => setInterviewState("complete"))` (candidate-info fetch fails), `case "error": if (!msg.recoverable) onStateChange("complete")` (non-recoverable WS error), and `ws.onclose` with exhausted reconnects → `onStateChange("complete")` (permanent connection loss). The interview state machine and its terminal states already existed; the defect is that every failure collapsed into `complete`, which renders a **false factual claim** — "Thank you. The interview has been recorded." — on every failure path. The missing `"error"` variant in the `InterviewState` type is the **type-level symptom** of that defect (the collapse was invisible at compile time), not the absence of a requirement. A true missing specification would be a failure scenario with **no** defined behavior at all (e.g., the UI frozen on "Connecting…" forever); here, every failure scenario was **defined — incorrectly**. The impact is direct on the **Candidate** (a non-user who cannot opt out): a lost or unrecorded interview can affect hiring outcomes without the candidate ever knowing something went wrong. No personal data was exposed, so UU PDP is not directly affected — but the integrity of the assessment process (and trust in it) is broken.

## 2. Analysis & Gap to Ideal

**Root cause:** the interview state machine did not distinguish a successful terminal state from a failed one. All failure paths pointed at `complete` — and because there was no `"error"` variant in the `InterviewState` type, the collapse was invisible even at the type level.

| File | Evidence (before fix) |
|------|--------------------------------------|
| `web/src/pages/interview/InterviewPage.tsx` | `.catch(() => setInterviewState("complete"))` — candidate info fetch fails → fake success |
| `web/src/hooks/useAudioWebSocket.ts` | `case "error": if (!msg.recoverable) onStateChange("complete")` — non-recoverable WS error → fake success |
| `web/src/hooks/useAudioWebSocket.ts` | `ws.onclose`, reconnects exhausted → `onStateChange("complete")` — permanent connection loss → fake success |
| `web/src/pages/interview/InterviewPage.tsx` | state `complete` renders "Thank you. The interview has been recorded." |
| `web/src/types/index.ts` | `InterviewState` had no `"error"` / `"failed"` variant |

**Gap to ideal:** the state machine must separate terminal states — an error state shows a specific message per cause, a **retry** button for recoverable errors, and a pointer to the hiring contact for non-recoverable errors; the TypeScript type must cover all states so a collapse like this fails at compile time.

> **Related finding — F-25 (scope-out):** F-25 addresses a broader API/frontend type contract. F-07 fixes the interview state machine & type for the interview flow only (Frontend Depth focus); F-25 remains scope-out in the findings list.

## 3. Options & Trade-offs

All three alternatives cover the complete failure path from backend signal to candidate-visible recovery. They differ in where workflow authority and recovery coordination live.

| Option | Workflow authority | Recovery unit | Relative delivery cost | Fit for this finding |
|---|---|---|---|---|
| **A — Client state machine + explicit backend failure contract** ✅ **CHOSEN & IMPLEMENTED** | Client owns presentation state; backend supplies typed HTTP/WebSocket failures | Current interview session and one active connection | Medium | Directly fixes the observed false-success paths with the existing architecture |
| **B — Server-authored persisted workflow state** | Server/database own authoritative interview status and transition version | Persisted interview session | High | Strong auditability, but adds persistence and concurrency machinery beyond the observed defect |
| **C — Addressable asynchronous operations + reconciliation** | Durable operation resources coordinate work independently of the page lifecycle | Operation ID | Very high | Strongest long-running recovery model, but disproportionate for the current synchronous/WebSocket flow |

### Option A — Client state machine + explicit backend failure contract ✅ **CHOSEN & IMPLEMENTED**

| Dimension | Assessment |
|---|---|
| **End-to-End Behavior** | The backend continues to return explicit HTTP failures and WebSocket error/reconnect signals. The frontend maps those signals into an exhaustive `InterviewState`, renders cause-specific accessible messaging, stops active media on fatal failure, and offers controlled retry only when recovery is valid. |
| **Product Impact** | Candidates no longer receive a false completion claim and can recover from eligible load or connection failures. Hiring stakeholders avoid treating an unrecorded session as completed. |
| **Cost & Complexity** | Medium. The change adds a typed state, error model, component, hook callback, retry paths, and focused tests without adding storage, queues, or a new workflow service. |
| **Long-Term Maintainability** | The discriminated state model makes terminal outcomes explicit, and backend failure codes can be mapped centrally as new cases appear. Its boundary remains understandable within the current React/Rails/WebSocket structure. |
| **Failure Modes** | Retry can trigger duplicate fetches or WebSocket connections; delayed callbacks can overwrite newer client state; frontend/backend contract drift can misclassify a failure; and a partial rollout can expose incompatible error or event shapes. |
| **Operational Risks** | Correctness depends on browser lifecycle behavior and coordinated frontend/backend deployment. Client-only state is not a durable audit record, and regressions may appear only under timing-sensitive reconnect conditions. |
| **Mitigations** | Use idempotent retry guards, exhaustive typed transitions, cleanup that enforces one active socket and cancels stale timers, backward-compatible parsing during rollout, contract tests, and seeded-fault/reconnect tests. |
| **Contextual Fit** | This is the best fit for the current product and assessment scope because it directly repairs the verified false-success behavior using existing boundaries. It delivers truthful UI and recovery without introducing workflow infrastructure whose operational cost is not justified by the present session model. |

### Option B — Server-authored persisted workflow state ❌ Not selected

| Dimension | Assessment |
|---|---|
| **End-to-End Behavior** | The backend would persist authoritative interview states, validate allowed transitions, attach monotonic versions and freshness timestamps, and accept idempotent recovery commands. The frontend would show immediate local waiting feedback, then render the latest server state after fetch or reconnect and ignore regressive versions. |
| **Product Impact** | Candidates could resume consistently across refreshes or devices, while support and hiring teams would gain a durable transition history. The first visible response could be slower while the initial state write completes. |
| **Cost & Complexity** | High. It requires schema and migration work, transition services, concurrency control, idempotency keys, recovery endpoints, frontend version reconciliation, and broader integration tests. |
| **Long-Term Maintainability** | Centralized transition rules and an audit trail help complex workflows, but every new state becomes a coordinated database/API/frontend change. Retention and migration compatibility become permanent concerns. |
| **Failure Modes** | Persisted status can be stale or delayed; concurrent workers can attempt competing or invalid transitions; duplicate recovery commands can replay work; and a slow first write can leave the UI apparently unresponsive. |
| **Operational Risks** | State writes amplify database load, hot session rows can contend, migrations carry rollout risk, and availability becomes more tightly coupled to the primary database. |
| **Mitigations** | Use transactions or optimistic locking, monotonic versions, idempotency keys, freshness indicators, immutable audit logs, immediate local pending feedback, and concurrency/replay tests. |
| **Contextual Fit** | Credible when cross-device resume, durable auditability, or server-controlled multi-step workflows are core requirements. Those benefits do not justify the added persistence and rollout burden for this narrowly verified client-state defect. |

### Option C — Addressable asynchronous operations + reconciliation ❌ Not selected

| Dimension | Assessment |
|---|---|
| **End-to-End Behavior** | The backend would create idempotent interview-operation resources for start, recovery, or finalization; persist durable status; and expose polling plus event delivery, retention, cancellation, and retry semantics. The frontend would retain operation IDs, resume polling/events after reconnect, deduplicate updates, and reconcile only monotonic operation states. |
| **Product Impact** | Candidates could recover from tab closure or prolonged disconnects without losing visibility into in-flight work, and support could trace each recovery attempt. Polling or event propagation may make feedback less immediate. |
| **Cost & Complexity** | Very high. It adds operation schemas/endpoints, background execution or event infrastructure, client reconciliation, retention cleanup, observability, and end-to-end failure testing. |
| **Long-Term Maintainability** | Durable operations scale well for genuinely asynchronous workflows, but introduce a second lifecycle alongside the interview session and require explicit policies for expiry, cancellation, and abandoned work. |
| **Failure Modes** | Events can be lost, duplicated, delayed, or arrive out of order; polling can lag or overload the API; operations can expire before reconciliation; and repeated retries can create duplicate operations or conflicting client/server views. |
| **Operational Risks** | Queue or event infrastructure adds capacity planning and incident modes; retention cleanup can remove needed evidence; abandoned operations can accumulate; and tracing across browser, API, worker, and event delivery becomes harder. |
| **Mitigations** | Keep a durable status endpoint as the source of truth, enforce sequence/version checks and deduplication, require idempotency keys, use bounded backoff with jitter, retain tombstones, propagate correlation IDs, monitor lag/abandonment metrics, and test reconciliation under reordered or missing events. |
| **Contextual Fit** | Appropriate if interview processing becomes long-running and independently resumable. For the current live WebSocket session, it creates substantial infrastructure and operational surface without improving the verified defect enough to offset that cost. |

### Trade-offs accepted for Option A

Option A accepts that recovery state is not durable across devices and that coordinated contract rollout is required. In return, it provides the needed candidate protection through a bounded change that matches the existing architecture and delivery window. The retry and contract risks are controlled through typed transitions, single-connection cleanup, compatibility handling, contract tests, and seeded-fault coverage.

## 4. Solution Implemented

- **`web/src/types/index.ts`:** `InterviewState` is now `idle | connecting | active | reconnecting | draining_audio | ending | complete | error`. Added `InterviewErrorKind` (`load_failed | auth_failed | ws_unrecoverable | ws_connection_lost`) and `InterviewErrorInfo { kind, code?, message?, recoverable }`.
- **`web/src/components/interview/InterviewError.tsx` (new):** terminal error screen with `role="alert"` + `aria-live="assertive"`, alert icon, per-kind title & body (`load_failed` → message + retry; `auth_failed` → invalid link, **no retry**; `ws_unrecoverable` → special `no_system_prompt` copy = "not ready yet"; `ws_connection_lost` → connection lost + retry). The **Try again** button appears only when `recoverable && onRetry`; **Reload page** is always available.
- **`web/src/hooks/useAudioWebSocket.ts`:** added `onFatalError?: (error: InterviewErrorInfo) => void` — invoked for non-recoverable WS errors (`{ kind: "ws_unrecoverable", code, message, recoverable: false }`) and exhausted reconnects (`{ kind: "ws_connection_lost", recoverable: true }`). Both transition state to `"error"` (previously `"complete"`). Recoverable WS errors (`recoverable: true`) do **not** trigger the fatal path.
- **`web/src/pages/interview/InterviewPage.tsx`:** the candidate-info fetch now distinguishes error causes — **401/404 → `auth_failed` (recoverable: false, no retry, contact assessor)**, network/5xx → `load_failed` (recoverable: true, retry). The `"error"` state renders `<InterviewError>`. Retry for `load_failed` increments `loadAttempt` (the fetch effect re-runs — no blink through `idle`); WS/connection retry resets transcript/speaker/error then returns to `idle` (full restart). `handleFatalError` stops capture & playback so the mic isn't left hot on a failed session. The `complete` flow is unchanged (success screen still uses the existing `CheckCircle` icon).
- **Frontend test harness (new, part of F-07 deliverables):** Vitest 3 + Testing Library (react/jest-dom/user-event/dom) + jsdom — `web/package.json` scripts `test`/`test:watch`, `web/vite.config.ts` test block, tsconfig types, `web/src/test/setup.ts`.

**Key technical decisions:** error mapping is mandatory — 401/404 must never enter `load_failed` (retry on an invalid link is pointless); `load_failed` retry must not blink through `idle` (avoids the pre-start flash); a fatal WS error triggers stop-capture/playback (privacy: mic not active on a failed session). This mapping is locked by tests (see section 6).

**Icons & visual consistency (complete vs error):** the `complete` success state originally used a plain checkmark emoji (✅), while the new error state introduced a styled circular `AlertTriangle` icon. To maintain visual consistency between the two terminal states, the success state has been updated to use a matching circular `CheckCircle` treatment. This keeps the icon family, sizing, container, and visual weight consistent while preserving the distinct success and error semantics. This is a UI polish change only; there is no behavioral change to the complete flow or success copy.

## 5. Acceptance Criteria & Edge Cases

| # | Criterion | Input | Expected Behavior | Edge Case |
|---|-----------|-------|-------------------|-----------|
| 1 | Fetch candidate info fails | network error | State `error` + "Couldn't load your interview" + retry button | Retry re-runs fetch, no idle blink |
| 2 | Token invalid/expired | 401/404 API | State `error`, "link isn't valid", **no retry** (contact assessor) | 401/404 never enters a kind that has retry |
| 3 | Transient WS drop | transient onclose | Auto-reconnect (existing) → exhausted → `error` + retry | Retry idempotent — single WS instance (reconnect timer cleared) |
| 4 | Error non-recoverable (`recoverable:false`) | WS `error` message | `error` + specific message (e.g. `no_system_prompt`) + contact assessor | `recoverable:true` does not trigger the fatal path |
| 5 | Successful session | normal flow | Still `complete` (original success copy) — no regression | `session_ended` → still `complete`, no reconnect |
| 6 | Type safety | — | `InterviewState` covers `error`; `InterviewErrorInfo` is structured | compile fails if a state is unhandled (`tsc --noEmit`) |

## 6. Tests & Verification

**Vitest — 3 test files, 13 tests, all passing (13/13 passing) (`npm test` in `web/`):**

| Area | File | Coverage |
|------|------|---------|
| Component | `web/src/components/interview/__tests__/InterviewError.test.tsx` (4) | per-kind copy; retry only on recoverable; reload always present; `no_system_prompt` copy |
| Hook | `web/src/hooks/__tests__/useAudioWebSocket.test.ts` (5) | non-recoverable WS error → `error` + `onFatalError`; recoverable error keeps session active; `session_ended` → `complete` with no reconnect; exhausted reconnects → `error` + `ws_connection_lost`; `disconnect()` stops scheduling |
| Page | `web/src/pages/interview/__tests__/InterviewPage.test.tsx` (4) | network fail → error + retry; 401/404 → auth error **without** retry; retry re-runs fetch → back to pre-start; fetch success → pre-start |

**Type check:** `npx tsc --noEmit` exit 0 (clean).

**Seeded fault test** ✅ — temporarily reverted the old behavior (`onStateChange("complete")` on the WS error path in `useAudioWebSocket`, and `.catch(() => setInterviewState("complete"))` in `InterviewPage`) → the hook test `maps an unrecoverable backend error message to state 'error'` and the page test `renders auth-failed error WITHOUT retry` **FAILED** (regression caught) → reverted → all 13 tests green again.

**Manual (verified by user):** the error mapping was verified against the live backend:

- **Valid token** → stays in `idle` (pre-start screen) → enters the internet/microphone/audio-output check. The normal flow is not disturbed.
- **Invalid token** → immediately renders the error screen **"This interview link isn't valid"** — **no "Try again" button** appears (only "Reload page").
- **Other variants** (typo token, random token) → all consistently land on `auth_failed` with no retry button.

Mapping verified: 401/404 from `GET /api/v1/sessions/<invalid-token>/candidate` (token invalid) → `auth_failed` without retry; network/5xx → `load_failed` with retry; success flow (session ended) → still shows the complete screen.

## 7. AI-Human Verification

| Moment | Detail |
|-------|--------|
| **AI mistake (risky)** | The initial error-mapping proposal mixed 401/404 into load\_failed (which has a retry button) — a candidate with an invalid link would press retry that can never succeed (loop with no way out) |
| **How verified** | Trace the actual status response from the backend ({"errors":[{"status":404,...}]} on an invalid invite token / from the live backend on an invalid invite token) vs network error; the page test renders auth-failed error WITHOUT retry locks this separation |
| **Correction** | 401/404 separated into auth\_failed (recoverable\:false) — retry only for load\_failed/ws\_connection\_lost |
| **Lesson** | Error mapping must be verified against real backend payloads & status codes, not assumptions; explicit per-kind tests prevent regression to the collapse behavior |

---

*F-07 completed & verified: 13 tests passing, seeded-fault proven, the fake "Complete" screen removed from all failure paths. Manual verification done: valid token → pre-start screen enters the device checks; invalid token → auth_failed error screen without a retry button.*

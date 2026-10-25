# F-26 — Inconsistent API Error Envelope & Silent Catches Across the Frontend

> **Finding:** F-26 (severity: P3) · **Classification:** Defective Implementation · **Area:** Fullstack — Backend error envelope + Frontend error handling · **UU PDP:** No
> **Branch:** `feat/f26-error-envelope` · **Status:** ✅ Completed & verified

---

## 1. Summary

Error responses across the API used two different shapes depending on where the error originated: `{ error: "string" }` for Rack::Attack 429s, and `{ errors: [{ status, message }] }` for every exception handler / controller path. Meanwhile, several frontend pages silently swallowed request failures with `.catch(() => {})`, and the invite-candidate dialog closed *before* the API call resolved (NEW-F-01) — so a failed creation left the assessor with no error at all.

User impact: the assessor clicks a button or opens a page and, on failure, gets an empty page, a dead button, or a silently closed dialog with zero feedback. Failures look like successes, so the assessor cannot tell whether an invite was sent, whether a portfolio was saved, or whether a page simply failed to load — leading to retries, duplicate invites, and lost confidence in the platform. The candidate on the receiving end may wait for an interview link that was never actually created.

## 2. Analysis & Gap to Ideal

Root cause: error handling was built opportunistically — each error origin (Rack::Attack, exception handler, middleware, controller) chose its own response shape, and each frontend page chose its own way to ignore or surface failures. There was no single contract for errors and no shared extraction layer, so a unified fix never had a natural place to live. This is a defective implementation: the product clearly intends to surface failures, but the plumbing is inconsistent and partially missing.

Code-level evidence:

| File | Evidence |
|------|----------|
| `api/config/initializers/rack_attack.rb` | 429 → `{ error: '...' }` (singular key, string) — not the same shape as every other error |
| `api/app/controllers/concerns/exception_handler.rb` + `response.rb` + `application_middleware.rb` | → `{ errors: [{ status, message }] }` (plural, array) — two mutually incompatible contracts |
| `web/src/pages/assessments/AssessmentInvitePage.tsx` | `.catch(() => {})` on page load — user sees an empty page ("—", "No candidates yet") with no message |
| `web/src/pages/portfolio/PortfolioPage.tsx` | `.catch(() => {})` on load; export had no error path — no feedback on failure |
| `web/src/pages/assessments/AssessmentEditPage.tsx` / `vacancies/VacancyEditPage.tsx` | `.catch(() => {})` on load; vacancy submit had **no catch at all** — unhandled rejection / silent empty form |
| `web/src/services/api.ts` | interceptor only handled 401/403 — no normalization, no 429 feedback |
| `AssessmentInvitePage` `handleInviteCandidate` | dialog closed before the API call (NEW-F-01) — failed creation is invisible to the assessor |

Gap to ideal condition:
- One error contract across the stack: `{ error: { code, message, details? } }`.
- A single normalization layer in the frontend so every error shape becomes one typed object.
- Every user-facing operation either succeeds visibly or fails visibly with a message and, when useful, a retry.

## 3. Options & Trade-offs

All three alternatives cover backend failure production and frontend presentation. They differ in whether failures are represented as request responses, persisted workflow state, or durable asynchronous operations.

| Option | Failure authority | Recovery unit | Relative delivery cost | Fit for this finding |
|---|---|---|---|---|
| **A — Unified error contract + frontend handling system** ✅ **CHOSEN & IMPLEMENTED** | Canonical API envelope, normalized at the frontend boundary | Individual request or live-session failure | Medium–high | Removes the verified inconsistency and silent catches within current Rails/React boundaries |
| **B — Server-authored persisted workflow state** | Server/database status and transition history | Domain workflow record | High | Adds durable auditability but requires state modeling across otherwise simple request/response flows |
| **C — Addressable asynchronous operations + reconciliation** | Durable operation status exposed by ID | Operation resource | Very high | Useful for long-running work, but excessive for most affected CRUD and load failures |

### Option A — Unified error contract + frontend handling system ✅ **CHOSEN & IMPLEMENTED**

| Dimension | Assessment |
|---|---|
| **End-to-End Behavior** | Every backend error producer returns `{ error: { code, message, details? } }`. The frontend normalizes canonical and legacy responses at one boundary, then renders inline Alerts or global toasts and offers retry where it is safe and useful. |
| **Product Impact** | Assessors receive visible, actionable feedback instead of empty pages, dead actions, or dialogs that look successful. Candidates are less likely to wait for invitations that were never created. |
| **Cost & Complexity** | Medium–high. The solution changes all backend renderers, adds a normalization/interceptor layer and reusable feedback primitives, and updates affected pages, but it uses the existing synchronous request architecture. |
| **Long-Term Maintainability** | One envelope and extraction helper establish an explicit cross-stack contract. Shared Alert/Toast components reduce page-specific handling, while legacy parsing can be removed after rollout confidence is established. |
| **Failure Modes** | Duplicate retries can repeat non-idempotent actions; stale page state can survive a failed request; frontend/backend contract drift can hide useful details; and partial rollout can expose incompatible envelope shapes. |
| **Operational Risks** | A malformed shared renderer or interceptor has a broad blast radius. Global 401/403/429 handling can produce redirect or toast storms, and compatibility parsing can mask lagging producers if retained indefinitely. |
| **Mitigations** | Guard non-idempotent retries, keep dialogs pending until confirmed success, clear stale state on failure, use backward-compatible normalization during rollout, enforce contract tests for every producer, seed malformed-envelope faults, deduplicate global notifications, and monitor error codes by origin. |
| **Contextual Fit** | This is the strongest fit for the current Rails API and React client because the verified defects occur at existing request boundaries. It removes the root inconsistency and silent UI behavior without adding persistence or asynchronous infrastructure unrelated to most affected operations. |

### Option B — Server-authored persisted workflow state ❌ Not selected

| Dimension | Assessment |
|---|---|
| **End-to-End Behavior** | The backend would persist authoritative success, failure, and recovery states for affected workflows, validate transitions, publish monotonic versions/freshness, and accept idempotent retry commands. The frontend would show immediate local pending feedback, fetch or subscribe to server state, and ignore older versions after reconnect or navigation. |
| **Product Impact** | Users could revisit a workflow and see its authoritative result, while support gains durable failure history. Simple validation and load errors would become easier to audit but potentially slower to display until the first state write succeeds. |
| **Cost & Complexity** | High. It requires workflow schemas, migrations, transition services, optimistic concurrency, idempotency keys, status endpoints, frontend reconciliation, and tests for each domain workflow. |
| **Long-Term Maintainability** | Centralized state transitions are valuable for complex business processes, but applying them across invites, portfolio exports, authentication, and page loads creates more models and coordinated changes than a shared error contract. |
| **Failure Modes** | Persisted status can be stale or delayed; competing requests can create invalid transitions; duplicate recovery commands can replay effects; and database failure can prevent both the operation and its error state from being recorded. |
| **Operational Risks** | Write amplification and hot-row contention increase database dependence; migrations and backfills complicate rollout; retention of detailed failures needs governance; and immediate feedback can regress if UI rendering waits on persistence. |
| **Mitigations** | Use transactions or optimistic locking, monotonic versions, idempotency keys, freshness indicators, minimal/redacted audit payloads, immediate local pending feedback, retryable outbox delivery where needed, and concurrency/replay tests. |
| **Contextual Fit** | Suitable when durable workflow history is a product requirement. It is not proportionate for this finding because most failures are synchronous request errors that need a consistent contract and visible UI, not a new persisted lifecycle. |

### Option C — Addressable asynchronous operations + reconciliation ❌ Not selected

| Dimension | Assessment |
|---|---|
| **End-to-End Behavior** | The backend would represent work such as invite creation or export as idempotent operation resources with durable status, polling/event delivery, retention, cancellation, and retry semantics. The frontend would retain operation IDs, resume observation after navigation, deduplicate notifications, and reconcile monotonic operation versions. |
| **Product Impact** | Long-running actions could survive disconnects and expose progress instead of failing silently. For ordinary page loads or validation errors, an operation lifecycle would add latency and interaction steps without a corresponding user benefit. |
| **Cost & Complexity** | Very high. It introduces operation endpoints and storage, workers or event infrastructure, frontend polling/subscriptions, cleanup policies, tracing, and reconciliation testing. |
| **Long-Term Maintainability** | A standard operation model can unify genuinely asynchronous work, but creates a second error and lifecycle protocol alongside normal HTTP responses. Expiry, cancellation, and abandoned-operation behavior require ongoing ownership. |
| **Failure Modes** | Events can be lost, duplicated, delayed, or reordered; polling can create load and stale feedback; operations can expire before clients reconcile; and retries can create duplicate operation resources or conflicting terminal states. |
| **Operational Risks** | Queues and event delivery add capacity and incident modes, retention cleanup can erase troubleshooting context, abandoned operations can accumulate, and end-to-end tracing becomes substantially more complex. |
| **Mitigations** | Preserve a durable status endpoint, use sequence/version checks and deduplication, require idempotency keys, apply bounded backoff with jitter, retain tombstones, propagate correlation IDs, monitor queue lag/poll volume/abandonment, and run reconciliation tests with missing or reordered events. |
| **Contextual Fit** | Appropriate for exports or future long-running workflows at greater scale, but not as the default error model for the current mix of CRUD, authentication, and load requests. Its infrastructure cost exceeds the verified need. |

### Trade-offs accepted for Option A

Option A changes a broad cross-stack surface and requires a compatibility window for older clients. That cost is accepted because the defect itself spans every error producer and multiple frontend consumers. Staged implementation, backward-compatible parsing, a six-case contract spec, seeded-fault testing, and shared UI primitives constrain the rollout risk while addressing the root cause inside the architecture already in use. NEW-F-01 remains included because the prematurely closing invite dialog is the same silent-failure pattern on an already affected page.

## 4. Solution Implemented

**Backend — unified envelope:**
- **`api/app/controllers/concerns/error_envelope.rb`** (new) — `ErrorEnvelope` module with a status→code map (`unauthorized`, `forbidden`, `not_found`, `conflict`, `validation_failed`, `rate_limited`, `internal_error`, plus explicit codes such as `tenant_not_found`).
- **`api/app/controllers/concerns/response.rb`, `exception_handler.rb`, `api/app/middlewares/application_middleware.rb`, `api/config/initializers/rack_attack.rb`** — all four error renderers now emit `{ error: { code, message, details? } }`: `Response#json_error`, every `rescue_from` + `render_exception`, `ApplicationMiddleware#error`, and the Rack::Attack 429 throttled responder.
- **`api/spec/requests/error_envelope_spec.rb`** (new, 6 examples) — contract spec asserting shape, codes and the 429 responder; 8 existing RSpec assertions updated.

**Frontend — foundation:**
- **`web/src/lib/apiErrors.ts`** — `extractApiError()` normalizes the canonical envelope, the legacy `{ errors: [...] }` array, the legacy singular 429 shape, and network failures into `NormalizedApiError { status, code, message }`; the interceptor attaches it as `error.apiError`.
- **`web/src/types/index.ts`** — `ApiErrorEnvelope` + `NormalizedApiError` types.
- **`web/src/stores/toastStore.ts`** — dependency-free jotai-backed toast store callable from anywhere (components, hooks, the axios interceptor); the shared store is explicitly passed to `<JotaiProvider>` so UI and helpers stay in sync.
- **`web/src/components/ui/toast.tsx`** — global `ToastViewport` (top-right stack, auto-dismiss 5s, dismiss button, optional retry action).
- **`web/src/components/ui/alert.tsx`** — reusable inline Alert (destructive/warning/info variants, icon, `role="alert"`), evolved from the F-03 draft that was parked for this finding.
- **`web/src/services/api.ts`** — interceptor normalizes every rejection; 401/403 (non-login) redirect to login with a "session expired" notice; 429 triggers a global rate-limit toast.

**Frontend — per page (silent catches removed):**
- **`AssessmentInvitePage`** — load-failure Alert + Retry; **NEW-F-01**: dialog stays open until the API call succeeds, inline error inside the dialog, success closes it with a confirmation toast.
- **`PortfolioPage`** — page-level error state (icon + message + Retry/Back); export failures surface as a toast with retry.
- **`AssessmentEditPage` / `VacancyEditPage`** — load-failure Alert + Retry; save errors shown in an Alert (vacancy save previously had no catch at all).
- **`LoginPage` / `SignupPage`** — unified error extraction; Login shows a session-expired banner and uses Alert; Signup refactored to react-hook-form with per-field validation (email pattern mirrors the backend `URI::MailTo::EMAIL_REGEXP`; password required-only — the backend defines no password policy) and `text-xs` inline field errors.
- **`AssessmentListPage` / `VacancyListPage` / `LiveMonitorPage`** — existing plain red banners migrated to the shared Alert for one visual language.

> **AI-Human Verification:** three correction moments during implementation — (1) the initial load-error banner wrapped the reusable Alert (which already ships its own destructive background) in a container repeating the same fill, producing a "red inside red" banner flagged during product review; fixed by removing the wrapper styling, then a repo-wide sweep migrated three pre-existing plain red banners to the shared component. (2) The Retry button sat beside the Alert visually mismatched; moved inside the Alert's content row (`items-center` flex). (3) The AI initially proposed a frontend-only password pattern on Signup; verified the backend defines no password policy and deliberately shipped required-only instead of a bypassable half-truth.

## 5. Acceptance Criteria & Edge Cases

| # | Criterion | Input | Expected Behavior | Edge Case |
|---|-----------|-------|-------------------|-----------|
| 1 | Unified envelope | Any API error | `{ error: { code, message } }` single format | Legacy formats still parsed (backward-compat) |
| 2 | No silent catch | Every former `.catch(() => {})` site | Visible feedback + retry where useful | Network failure → `network_error` message, not a generic lie |
| 3 | Invite dialog (NEW-F-01) | Create-link API fails | Dialog stays open, inline error, retry possible | Success closes dialog + toast |
| 4 | 429 rate limit | Rack::Attack throttle | Toast "Too many requests" with clear message | — |
| 5 | 401/403 | Non-login request | Redirect to login (existing behaviour, no regression) + session-expired notice | Login endpoint itself excluded (F-03 AC#8/9) |
| 6 | Type safety | Error responses | TS types for unified error | — |
| 7 | Signup field errors | Invalid/empty email & password | Inline `text-xs` messages under each field | Password pattern skipped (no backend policy) |

## 6. Tests & Verification

- **Backend RSpec: 82 examples, 0 failures** — includes the new 6-example contract spec (`error_envelope_spec.rb`) covering shape contract, 403 unauthenticated, 404, 422 and the 429 throttled responder.
- **Seeded fault (proven):** temporarily bypassing `ErrorEnvelope` inside `ExceptionHandler#render_error_envelope` to the legacy `{ errors: [...] }` shape made the contract spec fail (2 failures — unauthenticated paths); reverted, suite green again.
- **Frontend Vitest: 50 tests, 0 failures** — added `apiErrors` unit tests (7 cases across all envelope formats), `AssessmentInvitePage` tests (load-failure banner + retry, NEW-F-01 dialog stays open on failure, success closes dialog), Login/Signup validation tests; TypeScript `tsc --noEmit` clean.
- **Manual (browser, product review):** login failure shows destructive Alert with the backend message; signup shows per-field `text-xs` errors; load failure on `/assessments/<missing>/invite` shows Alert + Retry; curl login returns `{"error":{"code":"unauthorized","message":"Invalid email or password"}}`.

## 7. AI-Human Verification

Three moments where the AI was wrong or risky during implementation, all caught and corrected during product review: (1) the initial load-failure banner nested the reusable Alert inside a wrapper that repeated the same destructive background — a "red inside red" doubled box; fixed by removing the wrapper's styling and laying the Alert beside the action, then migrating three pre-existing plain red banners (AssessmentList, VacancyList, LiveMonitor) to the shared component for one visual language. (2) The Retry button sat next to the Alert visually mismatched; the action was moved inside the Alert's content row (`items-center` flex) so icon, text and actions share one vertical rhythm. (3) The AI proposed a frontend-only password validation pattern on Signup; after verifying the backend defines no password policy, it shipped required-only instead — a frontend-only rule would be bypassable via the API and is documented as future work rather than shipped as a fake claim. No data-integrity or information-leakage issues.

---

*F-26 completed: 82 RSpec passing (6 contract + 76 existing), seeded fault proven, tsc clean + 50 Vitest green, product review passed for login/signup/invite/portfolio flows.*

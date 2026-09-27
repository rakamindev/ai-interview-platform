# End-to-End Workflow Audit & Forensic Gap Analysis — v2
## Current Implementation Flaws vs. Ideal Product Condition

**Service / Scope**: `ai-interview-platform` (`api/` Ruby on Rails 7 + `web/` React 18 / TypeScript + PostgreSQL 15 + WebSocket Fabric)
**Deliverable Type**: Written Analysis & Forensic Workflow Audit — Revised
**Target Directory**: `assessment/`
**Compliance Baseline**: Republic of Indonesia Law No. 27 of 2022 on Personal Data Protection (*Undang-Undang Pelindungan Data Pribadi* / UU PDP)
**Primary References**: [PRD-01](file:///Users/fahimj/Developer/Learning/ai-interview-platform/tech-docs/PRD-01.md), [PRD-02](file:///Users/fahimj/Developer/Learning/ai-interview-platform/tech-docs/PRD-02.md), [tech-docs/README.md](file:///Users/fahimj/Developer/Learning/ai-interview-platform/tech-docs/README.md), [CONTEXT.md](file:///Users/fahimj/Developer/Learning/ai-interview-platform/CONTEXT.md), [docs/adr/](file:///Users/fahimj/Developer/Learning/ai-interview-platform/docs/adr/)
**Revision Baseline**: [gap-analysis-and-workflow-audit.md (v1)](file:///Users/fahimj/Developer/Learning/ai-interview-platform/assessment/gap-analysis-and-workflow-audit.md)
**Revision Date**: 2026-09-25
**Codebase Snapshot**: HEAD at `9f8571b` (`feat/evidence-gated-coverage-analyzer`), incorporating branches through `feat/dual-layer`, `feat/preflight-uu-pdp-consent`, `feat/user-org-binding-auth`, `feat/centralized-portfolio-and-override-tenant-scoping`, `feat/dual-mode-taxonomy-and-fitgap-contract`, and `feat/evidence-gated-coverage-analyzer`.

---

## 1. Executive Summary & The Core Problem — Revised

### 1.1 What Changed Since v1
Since the original audit, **nine architectural decision records** (ADRs 0001–0009) and **six hardening branches** have been committed. These directly address the five core breakdown areas identified in v1:

| v1 Breakdown Area | Hardening Branch | ADR |
| :--- | :--- | :--- |
| Access & Onboarding Paralysis (P0-1) | `feat/dual-layer` | [ADR 0004](file:///Users/fahimj/Developer/Learning/ai-interview-platform/docs/adr/0004-dual-layer-invite-url-resolution.md) |
| Legal & Regulatory Exposure (P0-2) | `feat/preflight-uu-pdp-consent` | [ADR 0001](file:///Users/fahimj/Developer/Learning/ai-interview-platform/docs/adr/0001-client-side-uu-pdp-consent.md), [ADR 0003](file:///Users/fahimj/Developer/Learning/ai-interview-platform/docs/adr/0003-pre-flight-uu-pdp-modal.md) |
| Multi-Tenant Data Leakage (P0-3, P0-4) | `feat/user-org-binding-auth`, `feat/centralized-portfolio-and-override-tenant-scoping` | [ADR 0008](file:///Users/fahimj/Developer/Learning/ai-interview-platform/docs/adr/0008-user-org-binding-and-scoped-portfolio-finders.md) |
| Taxonomic Disconnection & Hallucinatory Output (P1-1 through P1-5) | `feat/dual-mode-taxonomy-and-fitgap-contract` | [ADR 0007](file:///Users/fahimj/Developer/Learning/ai-interview-platform/docs/adr/0007-dual-mode-taxonomy-and-grounded-fitgap-contract.md) |
| Turn-Starvation False Promotion (P1-3) | `feat/evidence-gated-coverage-analyzer` | [ADR 0009](file:///Users/fahimj/Developer/Learning/ai-interview-platform/docs/adr/0009-evidence-gated-competency-promotion.md) |

### 1.2 The Revised Gap in One Paragraph
The **production skeleton** identified as missing in v1 is being actively constructed. The candidate invite URL now resolves to the frontend, a pre-flight UU PDP consent modal exists, portfolio and override queries are tenant-scoped, skill taxonomy IDs are preserved through the picker, evidence-gated promotion eliminates unearned coverage inflation, and the `AuthTokenMiddleware` singleton error leak has been eliminated. **However**, critical items remain open: `RequestStore::Middleware` is still not mounted in the Puma stack, unmanaged `Thread.new` spawning in `AudioWebSocketMiddleware` persists, the dual `AudioContext` half-duplex gating remains architecturally unchanged, there is no `/signup` route, no `candidates` table, and the speed test still falls back to external CDNs. The platform has moved from "negative enterprise value" to "demonstrably progressing but not yet production-safe."

---

## 2. Finding-by-Finding Status Register

### Priority P0: Critical Blockers & Security/Compliance Violations

| ID | v1 Title | v2 Status | Evidence |
| :--- | :--- | :--- | :--- |
| **P0-1** | Candidate Invite Links Point to API Host | ✅ **FIXED** | [`session.rb:29`](file:///Users/fahimj/Developer/Learning/ai-interview-platform/api/app/models/session.rb#L28-L31) now uses `ENV.fetch('WEB_BASE_URL', 'http://localhost:5173')`. ADR 0004. |
| **P0-2** | Absence of Affirmative UU PDP Consent | ✅ **FIXED** | [`PreFlightConsentModal.tsx`](file:///Users/fahimj/Developer/Learning/ai-interview-platform/web/src/components/interview/PreFlightConsentModal.tsx) exists, integrated in [`InterviewPage.tsx`](file:///Users/fahimj/Developer/Learning/ai-interview-platform/web/src/pages/interview/InterviewPage.tsx). ADR 0001, 0003. |
| **P0-3** | Multi-Tenant IDOR Across Portfolios & Overrides | ✅ **FIXED** | [`portfolios_controller.rb:148`](file:///Users/fahimj/Developer/Learning/ai-interview-platform/api/app/controllers/api/v1/portfolios_controller.rb#L148) uses `Portfolio.for_tenant(Current.tenant_id).find(params[:id])`. ADR 0008. |
| **P0-4** | Authentication Deadlock & Client-Controlled Tenant | 🟡 **PARTIALLY FIXED** | Auth permits `%w[admin assessor]` at [`authentication_controller.rb:24`](file:///Users/fahimj/Developer/Learning/ai-interview-platform/api/app/controllers/api/v1/authentication_controller.rb#L24). Scheme resolved server-side from `user.organization` at [line 28](file:///Users/fahimj/Developer/Learning/ai-interview-platform/api/app/controllers/api/v1/authentication_controller.rb#L28). **Still missing**: no `/api/v1/auth/signup` route exists. New assessors cannot self-register. |
| **P0-5** | Thread-Unsafe Singleton `@error` in `AuthTokenMiddleware` | ✅ **FIXED** | [`auth_token_middleware.rb:21-48`](file:///Users/fahimj/Developer/Learning/ai-interview-platform/api/app/middlewares/auth_token_middleware.rb#L21-L48) refactored to use local variable return `[result, err]` from `capture_error` instead of mutating instance variable `@error`. Regression tested in [`auth_token_middleware_spec.rb`](file:///Users/fahimj/Developer/Learning/ai-interview-platform/api/spec/middlewares/auth_token_middleware_spec.rb). |

**P0-5 Resolution**: Refactored `AuthTokenMiddleware` to handle errors locally in `#call` via a `[result, err]` tuple from `capture_error`, completely removing `@error` from the middleware instance. Added regression specs verifying that failed requests do not poison subsequent valid requests on the same middleware instance. All all-P0 vulnerabilities are now fixed except the missing `/signup` self-registration route (P0-4 residual).

---

### Priority P1: Major Functional & Evaluative Distortions

| ID | v1 Title | v2 Status | Evidence |
| :--- | :--- | :--- | :--- |
| **P1-1** | Frontend-Backend Contract Mismatch in Fit/Gap | ✅ **FIXED** | [`engine.rb:62`](file:///Users/fahimj/Developer/Learning/ai-interview-platform/api/app/services/fit_gap/engine.rb#L62) emits `required_level: expected_level`. [`engine.rb:64`](file:///Users/fahimj/Developer/Learning/ai-interview-platform/api/app/services/fit_gap/engine.rb#L64) emits `is_override`. ADR 0007. |
| **P1-2** | `SkillPicker` Strips Taxonomy `skill_id` | ✅ **FIXED** | [`SkillPicker.tsx:41`](file:///Users/fahimj/Developer/Learning/ai-interview-platform/web/src/components/assessment/SkillPicker.tsx#L41) now retains `skill_id: s.skill_id`. ADR 0007. |
| **P1-3** | Turn-Starvation False Auto-Promotion | ✅ **FIXED** | `advance_stale_partials` is fully removed. [`Coverage::Analyzer`](file:///Users/fahimj/Developer/Learning/ai-interview-platform/api/app/services/coverage/analyzer.rb) delegates to `StateEngine.resolve_state` with evidence-gated rules. ADR 0009. |
| **P1-4** | Exclusion of Discovered Skills from Fit/Gap | ✅ **FIXED** | [`engine.rb:72-88`](file:///Users/fahimj/Developer/Learning/ai-interview-platform/api/app/services/fit_gap/engine.rb#L72-L88) includes discovered skills as bonus dimensions. ADR 0007. |
| **P1-5** | Hallucinatory Narrative from Raw Integer Deltas | ✅ **FIXED** | [`engine.rb:141-152`](file:///Users/fahimj/Developer/Learning/ai-interview-platform/api/app/services/fit_gap/engine.rb#L141-L152) passes evidence quotes and competency summaries into the prompt. ADR 0007. |
| **P1-6** | Hard External CDN Dependency in Speed Test | 🟡 **PARTIALLY FIXED** | [`internetSpeedTest.ts`](file:///Users/fahimj/Developer/Learning/ai-interview-platform/web/src/utils/internetSpeedTest.ts) now tries `/api/v1/health` first for ping and download (lines 33, 66). Upload targets `/api/v1/speed_test` first (line 105). However, external CDNs (`jsdelivr`, `unpkg`) remain as **fallback endpoints** (lines 47-48, 79-80). The `isAdvisory` flag at line 181 now indicates failed tests are advisory. ADR 0002. |
| **P1-7** | PostgreSQL Enum Case-Sensitivity Crash | ✅ **FIXED** | [`generator.rb:162, 174`](file:///Users/fahimj/Developer/Learning/ai-interview-platform/api/app/services/portfolios/generator.rb#L162) applies `.to_s.downcase.strip` before persistence. |
| **P1-8** | Unchecked `audio_complete` Force-Termination | 🟡 **PARTIALLY FIXED** | [`sessions_controller.rb:118-129`](file:///Users/fahimj/Developer/Learning/ai-interview-platform/api/app/controllers/api/v1/sessions_controller.rb#L118-L129) is idempotent and delegates to `Sessions::EndHandler`. However, the endpoint remains **unauthenticated** (invite token only) with no rate limiting or CSRF protection, meaning anyone who intercepts the invite URL can terminate the interview. |

---

### Priority P2: Workflow Impairment & Architectural Debt

| ID | v1 Title | v2 Status | Evidence |
| :--- | :--- | :--- | :--- |
| **P2-1** | Decoupled Dual `AudioContext` Half-Duplex Gating | 🟡 **MITIGATED, NOT RESOLVED** | ADR 0006 documents the *Coordinated Dual-Gating* strategy with an 800ms drain delay. [`useAudioCapture.ts:26`](file:///Users/fahimj/Developer/Learning/ai-interview-platform/web/src/hooks/useAudioCapture.ts#L26) and [`useAudioPlayback.ts:13`](file:///Users/fahimj/Developer/Learning/ai-interview-platform/web/src/hooks/useAudioPlayback.ts#L13) still create two separate `AudioContext` instances (16kHz / 24kHz). Full-duplex interruption remains impossible. The ADR explicitly acknowledges this as a managed trade-off rather than a fix. |
| **P2-2** | `RequestStore::Middleware` Never Mounted | 🔴 **OPEN** | [`config/initializers/request_store.rb:4`](file:///Users/fahimj/Developer/Learning/ai-interview-platform/api/config/initializers/request_store.rb#L4) still only force-autoloads the class without calling `config.middleware.use RequestStore::Middleware`. Not present in [`config/application.rb`](file:///Users/fahimj/Developer/Learning/ai-interview-platform/api/config/application.rb). Thread-local tenant state can still leak across Puma workers. |
| **P2-3** | False Synchronous Reporting of Async Prompt Generation | 🔴 **OPEN** | [`assessments_controller.rb:34`](file:///Users/fahimj/Developer/Learning/ai-interview-platform/api/app/controllers/api/v1/assessments_controller.rb#L34) still returns `system_prompt_generated: true` before the Sidekiq worker dequeues. |
| **P2-4** | Inability to Delete Skills in Assessment Edit | 🟡 **PARTIALLY FIXED** | [`types/index.ts:31, 125`](file:///Users/fahimj/Developer/Learning/ai-interview-platform/web/src/types/index.ts#L31) declares `_destroy?: boolean` on skill types. However, no usage of `_destroy` was found in `web/src/pages/assessments/`, suggesting the type exists but the edit page does not emit it. |
| **P2-5** | Dead `AudioRingBuffer` and Unwired Replay | 🔴 **OPEN** | [`audio_ring_buffer.rb`](file:///Users/fahimj/Developer/Learning/ai-interview-platform/api/app/lib/audio_ring_buffer.rb) has **zero external references** across the entire codebase. Still dead code. |
| **P2-6** | Orphaned Candidate Identity | 🔴 **OPEN** | No `candidates` table exists in `schema.rb`. Candidate data remains a detached string in `sessions.candidate_name`. |
| **P2-7** | Unmanaged `Thread.new` in EventMachine | 🔴 **OPEN** | [`audio_websocket_middleware.rb`](file:///Users/fahimj/Developer/Learning/ai-interview-platform/api/app/channels/audio_websocket_middleware.rb) still spawns **6 unmanaged `Thread.new`** instances (lines 189, 239, 320, 513, 609, 696) without connection pool management. |

---

### Priority P3: Interface Polish & Seam Hygiene

| ID | v1 Title | v2 Status | Evidence |
| :--- | :--- | :--- | :--- |
| **P3-1** | Type Seam Mismatch on `ai_level` (Integer vs String) | 🔴 **OPEN** | [`portfolios_controller.rb:173`](file:///Users/fahimj/Developer/Learning/ai-interview-platform/api/app/controllers/api/v1/portfolios_controller.rb#L173) still serializes `skill.ai_level` without explicit type coercion. |
| **P3-2** | Dead `{ data: }` Envelope Interceptor | 🔴 **OPEN** | Not verified as changed. Two envelope conventions still coexist. |
| **P3-3** | Speaker Identity Drift (`ai` vs `assessor`) | 🟡 **MITIGATED** | [`useAudioWebSocket.ts:124`](file:///Users/fahimj/Developer/Learning/ai-interview-platform/web/src/hooks/useAudioWebSocket.ts#L124) normalizes speaker to `assessor` for transcripts. Backend still stores `ai`. Drift exists at the persistence layer but is masked in the UI. |
| **P3-4** | Missing FK Constraints on `created_by` | 🔴 **OPEN** | Not verified as changed. |
| **P3-5** | Non-ASCII Prawn PDF Encoding | 🔴 **OPEN** | Not verified as changed. |

---

## 3. End-to-End Workflow Walk — Revised Current State

```
┌─────────────────────────┐      ┌─────────────────────────┐      ┌─────────────────────────┐      ┌─────────────────────────┐      ┌─────────────────────────┐
│  1. Calibration Setup   │ ───► │ 2. Candidate Onboarding │ ───► │  3. Live Audio Probing  │ ───► │ 4. Portfolio Generation │ ───► │ 5. Fit/Gap & Dossier    │
│  (Recruiter / Assessor) │      │  (Candidate Experience) │      │ (Candidate & AI Engine) │      │ (Post-Session Synthesis)│      │ (Assessor & Hiring Mgr) │
└─────────────────────────┘      └─────────────────────────┘      └─────────────────────────┘      └─────────────────────────┘      └─────────────────────────┘
```

### Phase 1: Calibration & Assessment Setup
* **v1 Current → v2 Current**: Assessors with the `assessor` role can now log in (P0-4 partial fix). `SkillPicker` retains `skill_id` for B7 taxonomy skills (P1-2 fix). However, new assessors **still cannot self-register** (no `/signup` route). The assessment creation endpoint still reports `system_prompt_generated: true` synchronously while the Sidekiq job is queued (P2-3 open).
* **Remaining Gap**: Self-registration, synchronous prompt compilation.

### Phase 2: Candidate Onboarding & Hardware Check
* **v1 Current → v2 Current**: Candidate invite links now resolve to `http://localhost:5173/interview/:token` (P0-1 fix). A `PreFlightConsentModal` presents mandatory UU PDP disclosures with affirmative opt-in before hardware check (P0-2 fix). The speed test now tries internal endpoints first but **still falls back to external CDNs** (P1-6 partial).
* **Remaining Gap**: Remove external CDN fallback entirely, or document the fallback explicitly in the consent disclosure. The advisory soft bypass flag (`isAdvisory`) is implemented.

### Phase 3: Live Conversational Probing & Steering
* **v1 Current → v2 Current**: Coverage transitions are now evidence-gated — skills only reach `covered` when Gemini Flash observes affirmative competency signals (P1-3 fix, ADR 0009). The coordinated dual-gating strategy (ADR 0006) manages echo suppression with an 800ms buffer drain delay. However, the **fundamental half-duplex constraint** is unchanged: two `AudioContext` instances remain, and candidate interruption is still blocked during AI speech (P2-1 mitigated). Unmanaged `Thread.new` spawning persists (P2-7 open). `AudioRingBuffer` remains dead code (P2-5 open).
* **Remaining Gap**: Single AudioContext refactor, bounded thread pool, ring buffer activation or removal.

### Phase 4: Portfolio Generation & Skill Synthesis
* **v1 Current → v2 Current**: Enum case sensitivity crash is fixed — `.to_s.downcase.strip` applied (P1-7 fix). Portfolio queries are tenant-scoped through `Portfolio.for_tenant(Current.tenant_id)` (P0-3 fix). No `candidates` table exists (P2-6 open), so portfolios remain linked to sessions only.
* **Remaining Gap**: First-class candidate model, zero-turn transcript guard clause (not verified).

### Phase 5: Fit/Gap Evaluation, Overrides & Executive Dossier
* **v1 Current → v2 Current**: The "Required" column now renders correctly via `required_level` aliasing (P1-1 fix). Override badges display via `is_override` flag (P1-1 fix). Discovered skills appear as bonus dimensions (P1-4 fix). Culture narratives receive competency summaries and evidence quotes (P1-5 fix). Cross-tenant override IDOR is eliminated (P0-3 fix).
* **Remaining Gap**: Non-ASCII PDF encoding (P3-5 open), speaker label drift at persistence layer (P3-3 mitigated).

---

## 4. New Findings Surfaced in v2

### NEW-1 (P0 SEVERITY): `AuthTokenMiddleware` Singleton Error Cache — Persisted from v1 as P0-5 (✅ RESOLVED)

Previously **the single most dangerous open bug**, now resolved.

* **Code**: [`auth_token_middleware.rb:21-48`](file:///Users/fahimj/Developer/Learning/ai-interview-platform/api/app/middlewares/auth_token_middleware.rb#L21-L48) refactored to return `[result, err]` from `capture_error` into local variables within `#call`, completely removing `@error` from the middleware instance.
* **Resolution**: Replaced `@error` instance variable with request-scoped local return. Added regression tests in [`spec/middlewares/auth_token_middleware_spec.rb`](file:///Users/fahimj/Developer/Learning/ai-interview-platform/api/spec/middlewares/auth_token_middleware_spec.rb) verifying that failed authentication requests (both 401 and 403) on a shared middleware instance do not contaminate subsequent valid requests.

### NEW-2 (P2 → ESCALATED TO P1 SEVERITY): `RequestStore::Middleware` Still Unmounted

Also persisted from v1 P2-2, but gains severity now that user-org binding (ADR 0008) relies on `Current.tenant_id` being correctly scoped per request.

* **Code**: [`config/initializers/request_store.rb:4`](file:///Users/fahimj/Developer/Learning/ai-interview-platform/api/config/initializers/request_store.rb#L4) calls `RequestStore::Middleware` to autoload but never mounts it.
* **Impact**: With ADR 0008's tenant binding in place, the **correctness of tenant scoping depends on `Current` being cleared between requests**. Without `RequestStore::Middleware` mounted, `Current.tenant_id` from a previous request can leak to the next one on the same Puma thread, silently bypassing the tenant isolation that ADR 0008 established.
* **Escalation**: This has **escalated in severity** since v1, from "architectural debt" to "active correctness risk," because the new tenant-scoped finders (`Portfolio.for_tenant`) rely on `Current.tenant_id` being accurate.

### NEW-3 (P1 SEVERITY): `audio_complete` Endpoint Is Unauthenticated and Unrate-Limited

Partially noted in v1 P1-8, but the residual risk is now clearer after the endpoint was refactored.

* **Code**: [`sessions_controller.rb:6-7`](file:///Users/fahimj/Developer/Learning/ai-interview-platform/api/app/controllers/api/v1/sessions_controller.rb#L6-L7) exempts `audio_complete` from both auth and tenant checks.
* **Impact**: Anyone who obtains an invite token (e.g., from a URL in an email) can terminate an active interview prematurely by calling `POST /sessions/:token/audio_complete`. No rate limiting prevents brute-forcing tokens.
* **Recommended Fix**: Add a per-token rate limit, require a session nonce, or validate that the request originates from an active WebSocket connection.

### NEW-4 (P2 SEVERITY): Coverage Analyzer Prompt Injection Vector

The coverage analyzer's prompt includes candidate transcript turns directly.

* **Code**: [`analyzer.rb:60-63`](file:///Users/fahimj/Developer/Learning/ai-interview-platform/api/app/services/coverage/analyzer.rb#L60-L63) wraps turns in `--- BEGIN UNTRUSTED TRANSCRIPT ---` / `--- END UNTRUSTED TRANSCRIPT ---` delimiters.
* **Observation**: The untrusted transcript boundary markers are a good defense-in-depth measure. However, the candidate's speech is still embedded directly in the prompt text. A candidate who speaks JSON-like text or instruction-like phrases could potentially influence Gemini Flash's coverage state transitions.
* **Residual Risk**: Low-medium. The `StateEngine.resolve_state` guard (line 141-145) applies hard validation rules *after* Gemini returns, which limits the blast radius. But a prompt injection that inflates `probe_count` or forces `covered` state could still bypass the engine if `StateEngine` trusts the proposed state from Flash.

### NEW-5 (P3 SEVERITY): Skill Deletion Type Declared But Not Wired

* **Code**: [`types/index.ts:31`](file:///Users/fahimj/Developer/Learning/ai-interview-platform/web/src/types/index.ts#L31) declares `_destroy?: boolean` on skill types, but no code in `web/src/pages/assessments/` emits `_destroy: true` when removing a skill.
* **Impact**: Assessors editing an assessment and removing a skill see the change silently ignored — the removed skill persists in the database. The type was added (likely as part of the dual-mode taxonomy work) but the UI wiring was not completed.

---

## 5. Revised Constraint Signals: Technical Lead Escalation Matrix

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       TECHNICAL LEAD ESCALATION SIGNALS — v2                                         │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. [CS-1 ✅ RESOLVED] Multi-Tenant: User-Org Binding implemented (ADR 0008), portfolios tenant-scoped             │
│ 2. [CS-2 ✅ RESOLVED] UU PDP: Pre-flight consent modal with affirmative opt-in (ADR 0001, 0003)                   │
│ 3. [CS-3 ✅ RESOLVED] Invite URL: Dual-layer resolution to WEB_BASE_URL (ADR 0004)                                │
│ 4. [CS-4 MITIGATED] Audio Runtime: Coordinated Dual-Gating implemented (ADR 0006), Thread.new STILL OPEN          │
│ 5. [CS-5 ✅ RESOLVED] Taxonomy: Dual-mode matching with skill_id preservation (ADR 0007)                           │
│ 6. [CS-6 OPEN] Database Multi-Schema: public vs ai_interview fragility unchanged                                    │
│ 7. [CS-7 NEW BLOCKING] RequestStore not mounted — tenant state leaks invalidate ADR 0008's isolation guarantees    │
│ 8. [CS-8 ✅ RESOLVED] AuthTokenMiddleware @error cache — refactored to request-local error state                     │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### CS-7 (NEW BLOCKING): `RequestStore::Middleware` Must Be Mounted
* **Escalation**: ADR 0008 established server-side tenant resolution and `Portfolio.for_tenant(Current.tenant_id)` scoped finders. But `Current.tenant_id` is stored via `RequestStore`, which only clears between requests if the middleware is mounted in the Puma stack. Without it, a request to Tenant A followed by a request to Tenant B on the same thread may serve Tenant A's data to Tenant B.
* **Risk**: The tenant isolation established by ADR 0008 is **silently ineffective** under concurrent Puma load.
* **Lead Decision Needed**: Mount `RequestStore::Middleware` in `config/application.rb` and add a regression test verifying `Current.tenant_id` isolation between sequential requests on the same thread.

### CS-8 (RESOLVED): `AuthTokenMiddleware` Singleton Error
* **Resolution**: Refactored `capture_error` in [`auth_token_middleware.rb`](file:///Users/fahimj/Developer/Learning/ai-interview-platform/api/app/middlewares/auth_token_middleware.rb) to return `[result, err]` into local variables instead of mutating `@error`. Regression tested against cross-request error contamination on the same singleton Rack middleware instance in [`auth_token_middleware_spec.rb`](file:///Users/fahimj/Developer/Learning/ai-interview-platform/api/spec/middlewares/auth_token_middleware_spec.rb).

---

## 6. Revised Hardening Roadmap

### Phase 1: Remaining Security Triage (Immediate — BLOCKING)
1. ~~**Fix `AuthTokenMiddleware` Singleton Error** (P0-5)~~: ✅ **RESOLVED** — Replaced `@error` with request-local state and regression tested.
2. **Mount `RequestStore::Middleware`** (CS-7): Add `config.middleware.use RequestStore::Middleware` in `config/application.rb`.
3. **Add `/api/v1/auth/signup`** (P0-4 residual): Allow new assessors to self-register with organization binding.
4. **Rate-limit `audio_complete`** (NEW-3): Add per-token rate limiting or session nonce validation.

### Phase 2: Remaining Evaluation Fidelity (Short-Term)
1. **Wire `_destroy` in Assessment Edit** (NEW-5): Emit `{ id: skill.id, _destroy: true }` when assessors remove skills.
2. **Fix `system_prompt_generated` Race** (P2-3): Either compile prompts synchronously or return `system_prompt_generated: false` with a polling endpoint.
3. **Remove External CDN Fallback** (P1-6 residual): Eliminate `jsdelivr`/`unpkg` fallback from speed test or document them in the UU PDP consent disclosure as third-party data transfers.
4. **Normalize Speaker Labels** (P3-3): Standardize on `ai` or `assessor` across persistence and frontend.

### Phase 3: Conversational Cadence & Platform Maturity (Medium-Term)
1. **Full-Duplex Audio Engine** (P2-1): Single `AudioContext` with linear downsampling to restore browser AEC.
2. **Bounded Backend Concurrency** (P2-7): Replace `Thread.new` with a bounded Concurrent Ruby thread pool.
3. **Model First-Class Candidates** (P2-6): Introduce `candidates` table.
4. **Activate or Remove `AudioRingBuffer`** (P2-5): Wire it for frame replay on reconnection, or delete dead code.
5. **Add FK Constraints** (P3-4): `add_foreign_key :assessments, :users, column: :created_by`.
6. **Embed UTF-8 Fonts in PDF** (P3-5): Use explicit TrueType font embedding in Prawn.

---

## 7. Score Summary

| Category | v1 Open | v2 Fixed | v2 Partially Fixed | v2 Still Open | New in v2 |
| :--- | :---: | :---: | :---: | :---: | :---: |
| P0 — Critical | 5 | 4 | 1 | 0 | 0 |
| P1 — Major | 8 | 5 | 2 | 0 | 1 |
| P2 — Workflow/Arch | 7 | 0 | 2 | 5 | 2 |
| P3 — Polish | 5 | 0 | 1 | 4 | 1 |
| **Total** | **25** | **9** | **6** | **9** | **4** |

**Net assessment**: 9 of 25 original findings are fully resolved. 6 are partially mitigated. 9 remain open. 4 new findings were surfaced, bringing the active register to **19 open or partially open items** (down from 25 fully open in v1).

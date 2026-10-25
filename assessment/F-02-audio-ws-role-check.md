# F-02 — Audio WebSocket: Missing Role Check (Audio Injection into Candidate Sessions)

> **Finding:** F-02 (P0) · **Classification:** Defective Implementation · **Area:** Security / Privacy / Auth (WebSocket) · **UU PDP:** Yes
> **Branch:** `fix/f02-audio-ws-role-check` · **Status:** ✅ Completed & verified

---

## 1. Summary

`AudioWebSocketMiddleware` (path `/ws/sessions/:id/audio`) accepts anyone with a **valid JWT without any role check**. The REST path consistently uses `authorize_auth_token! :assessor` (`sessions_controller.rb:6`), but the WebSocket path only *decodes* the JWT and checks tenant — **not role**. As a result, a user with role `user` (not an assessor) can open an audio WS connection to any active session and **inject fake PCM audio** into Gemini Live, which transcribes it as the candidate's voice.

This is **injection**, not eavesdropping (other candidates do not "listen"; the attacker *writes* fake audio on behalf of the candidate). Impact: contaminated transcripts → biased AI ratings/evaluations → hiring decisions based on fake data → broken evidence integrity. Because voice recordings are personal data (UU PDP), processing fake voice on someone's behalf without authorization violates the *lawful & correct processing* principle.

## 2. Analysis & Gap to Ideal

**Root cause:** the authorization pattern is already defined on the REST path (`AuthorizeApiRequest` + `check_role!`, used via `authorize_auth_token! :assessor`), but the WS path **fails to apply it** — WS authz is ad-hoc and separate (Constraint Signal **CS-2**).

| File | Evidence (before fix) | Gap |
|------|------------------------|-----|
| `api/app/channels/audio_websocket_middleware.rb:733-761` | `authenticate_and_load` — decode JWT → `Organization.find_by(scheme:)` → `Session.unscoped.where(tenant_id:).find_by(id:)`. **No role check.** | Role `user` accepted |
| `api/app/channels/audio_websocket_middleware.rb:737-741` | Invite token path: `Session.unscoped.find_by(invite_token:)` — no active-status check | Non-active sessions can be injected |
| `api/app/controllers/api/v1/sessions_controller.rb:6` | REST: `authorize_auth_token! :assessor` | Consistent, serves as the reference |

**Gap to ideal:** WebSocket must verify the connector's identity before accepting binary frames — assessor (role `admin`/`assessor` + tenant ownership) and candidate (invite token + session `active`) — with an authz policy that is a **single source of truth** between REST and WS.

> **Related finding — F-12 (scope-out):** the *coverage* WebSocket channel (`coverage_websocket_middleware.rb:118-137`) suffers the **same root cause** — `authenticate_assessor_by_token` decodes JWT and checks tenant but **does not check role** (identical bug). Because the audio channel concerns voice data and transcript corruption, F-02 was fixed; F-12 (live status only leaks progress, not audio) is scoped out and fully listed in `assessment/README.md`. The shared-concern solution in F-02 still touches the coverage middleware, but F-12 is not formally claimed/fully verified within this scope.

## 3. Options & Trade-offs

| Option | Authority | Enforcement point | Relative cost | Contextual fit |
|---|---|---|---|---|
| **A — Shared REST/WS authorization** ✅ **CHOSEN & IMPLEMENTED** | Existing authorization source of truth | Shared WebSocket concern | Medium | Closes F-02 and prevents drift across channels |
| **B — Inline audio role check** ❌ Not selected | Audio middleware logic | One WebSocket channel | Low | Quick patch that leaves authorization fragmented |

### Option A — Shared Authz concern (REST + WS) ✅ **CHOSEN & IMPLEMENTED**

`WebSocketAuth` concern that *reuses* `AuthorizeApiRequest` (REST source of truth) for the role check; used by audio + coverage WS.

| Dimension | Assessment |
|---|---|
| **End-to-End Behavior** | The WebSocket concern reuses REST token and role validation, then both audio and coverage channels authorize the assessor and session relationship before accepting messages. |
| **Product Impact** | Blocks impersonation, transcript contamination, and cross-candidate access without changing legitimate interview behavior. |
| **Cost & Complexity** | Medium: refactor two middlewares around an existing authorization service and add channel-specific tests. |
| **Long-Term Maintainability** | One source of truth prevents REST/WS role drift, and new channels can adopt the same concern. |
| **Failure Modes** | A channel can omit the concern, token/session checks can be ordered incorrectly, or future REST authorization changes can break socket behavior. |
| **Operational Risks** | A defect in the shared concern affects multiple real-time channels and can reject all legitimate monitoring traffic. |
| **Mitigations** | Use deny-by-default concern APIs, per-channel role/ownership tests, shared contract tests, and explicit close codes/logging. |
| **Contextual Fit** | `check_role!` already exists and both WebSocket middlewares already have authentication structure, making reuse the lowest-drift design. |

### Option B — Inline role check in the audio middleware ❌ Rejected

| Dimension | Assessment |
|---|---|
| **End-to-End Behavior** | The audio middleware alone would compare the token role and reject non-assessors; coverage and future WebSocket channels would keep independent logic. |
| **Product Impact** | Closes the reported audio path but leaves equivalent real-time paths exposed to inconsistent authorization. |
| **Cost & Complexity** | Low: a local conditional and focused tests. |
| **Long-Term Maintainability** | Poor because role rules are duplicated and must be updated separately from REST and other channels. |
| **Failure Modes** | Coverage remains vulnerable, ownership checks can diverge, and copied checks can interpret roles differently. |
| **Operational Risks** | Security posture varies by channel and future refactors can silently reopen one path. |
| **Mitigations** | Add tests to every channel and centralize constants, though these controls still preserve duplicated authorization logic. |
| **Contextual Fit** | Useful as an emergency containment patch, but it does not resolve the repository's cross-channel authorization root cause. |

### Trade-offs accepted

| Trade-off | Justification |
|-----------|-------------|
| Refactor touches 2 middlewares at once (audio + coverage) | F-02 scope indeed covers the consistent shared concern; coverage also gets cleaned of local duplication. |
| No DB migration changes | Not needed — purely an application authz layer. |

## 4. Solution Implemented

- **New concern** `api/app/channels/websocket_auth.rb` (`WebSocketAuth`): two connectors.
  - **Assessor:** `authenticate_assessor_by_token` → `AuthorizeApiRequest.new(headers, [:assessor]).call` (reuse REST logic: decode JWT + role check `admin`/`assessor`) → tenant check → session check (exists, not ended, id match).
  - **Candidate:** `authenticate_websocket`/`authenticate_candidate` → invite token as credential + session must be `active`.
- **`audio_websocket_middleware.rb`:** `include WebSocketAuth`; `authenticate_and_load` now delegates to `authenticate_websocket` (auto-detects invite-token vs JWT).
- **`coverage_websocket_middleware.rb`:** `include WebSocketAuth`; removed local duplication `authenticate_assessor`/`authenticate_assessor_by_token` (without role check) → now uses the role-checked concern version.
- **`config/initializers/websocket.rb`:** `require_relative` the concern before the middlewares (so the `WebSocketAuth` constant is loaded at `include` time).

**Key technical decision:** not creating a new concern that refuses to use REST authz — instead *reusing* `AuthorizeApiRequest` as the only source of truth, so REST and WS cannot diverge.

> **AI-Human Verification (summary):** during the `coverage_websocket_middleware` refactor, a stub `def authenticate_assessor(env, session_id); env['HTTP_AUTHORIZATION']; end` was left behind, returning the header string instead of `[session, error]` — this broke the auth flow in the coverage WS `on :open` handler. Because the concern provides a method with the same name via `include WebSocketAuth`, the local stub *overrode* the correct concern version. Fixed by removing the stub → the role-checked concern version is used. Details in section 7.

## 5. Acceptance Criteria & Edge Cases

| # | Criterion | Input | Expected Behavior | Edge Case |
|---|-----------|-------|-------------------|-----------|
| 1 | Legitimate assessor can send audio | JWT role `assessor`/`admin` + session owned by tenant | Connect OK, frames forwarded | — |
| 2 | Role `user` rejected | JWT role `user`, correct scheme | **Reject** (`Assessor role required`), no frames processed | — |
| 3 | Candidate via invite token | Valid invite token, session `active` | Connect OK | Session `pending`/`ended` → reject |
| 4 | Eavesdrop another session | Assessor opens another tenant's session | **Reject** (`Session not found`) | — |
| 5 | REST+WS consistency | One authz policy | Concern used by REST (`AuthorizeApiRequest`) & WS; enforced by test | — |

## 6. Tests & Verification

**RSpec — `api/spec/middleware/websocket_auth_spec.rb` (10 examples, 0 failures):**
- ✅ Admin & assessor own session → accepted
- ✅ **Role `user` → rejected** (`Assessor role required`)
- ✅ Missing Authorization / invalid JWT → rejected
- ✅ Assessor tenant Beta → session tenant Alpha → rejected (tenant ownership)
- ✅ Session path id mismatch → rejected
- ✅ Candidate active invite token → accepted
- ✅ Candidate ended/pending invite token → rejected

**RSpec — REST regression gate `api/spec/requests/sessions_auth_regression_spec.rb` (3 examples, 0 failures):** assessor & admin → 200; role `user` → 401/403 (REST policy unchanged).

**Seeded fault test:** temporarily removed the role check in the concern (`AuthorizeApiRequest.new(..., [])`) → test "rejects role user" **FAILED** (expected `'Assessor role required'`, got `nil`) → proving the test truly catches F-02, not an empty test → **reverted**, all 38 examples pass again.

**Manual verification (Step 4):** step-by-step in `rails console` — see `.ai-audit/F-02-Result/verify_fix_steps.rb` (internal folder, not committed).

> **Status note:** tests pass (38/38) and **have been verified**.

## 7. AI-Human Verification

**AI mistake/risky moment:** during the `coverage_websocket_middleware` refactor, a stub `def authenticate_assessor(env, session_id); env['HTTP_AUTHORIZATION']; end` was left behind, returning the header string instead of `[session, error]` — this broke the auth flow in the coverage WS `on :open` handler.

**How verified & corrected:** because the concern already provides a method with the same name via `include WebSocketAuth`, the local stub *overrode* the correct concern version. The `session, error = authenticate_assessor(...)` contract was recognized and the stub removed so the role-checked concern version is used.

**Verification:** the entire RSpec suite passes (38/38) after the correction; the seeded fault test confirms the role check is truly active.

**Lesson:** when moving a method into a shared concern, always check whether a local method with the same name will override the concern version — remove duplicates, never leave a stub.

---

*F-02 completed & verified: 38 RSpec passing, seeded fault proven, ready to merge to umbrella.*

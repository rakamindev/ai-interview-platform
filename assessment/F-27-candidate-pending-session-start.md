# F-27 — Candidate Cannot Start an Interview on a Pending Session (WS Auth Chicken-and-Egg)

> **Finding:** F-27 (severity: P1) · **Classification:** Defective Implementation · **Area:** Backend — WebSocket authentication · **UU PDP:** No
> **Branch:** `fix/e2e-interview-findings` (PR #12) · **Status:** ✅ Completed & verified

---

## 1. Summary

A freshly created interview session (`status: pending` — the default when an assessor creates a session) could **never be started by the candidate**. The audio WebSocket rejected every connection attempt with `'Session is not active'`, so the candidate UI looped on "reconnecting" forever and the interview was impossible to begin.

Found during end-to-end testing as a candidate (2026-08-18): create session → open invite link → "Start Interview" → infinite reconnect loop. **100% of new sessions were blocked** — the core product flow (assessor invites → candidate interviews) was dead, even though REST endpoints reported the session as perfectly valid.

## 2. Analysis & Gap to Ideal

**Root cause:** a self-contradiction introduced by F-02 (`b390fa3`). The candidate connector of `WebSocketAuth#authenticate_candidate` requires `session.active?`, but the **only** code path that activates a session (`Sessions::StartHandler`, `pending → active`) runs **after** authentication, inside `connect_to_gemini`. A pending session therefore fails authentication before the activator is ever reached:

| File | Evidence |
|------|----------|
| `api/app/channels/websocket_auth.rb` | `return [nil, 'Session is not active'] unless session.active?` — rejects pending before any activation can happen |
| `api/app/channels/audio_websocket_middleware.rb` | `Sessions::StartHandler.new(session).call unless session.active?` — the only activator, reached only *after* auth passes |
| `api/spec/middleware/websocket_auth_spec.rb` | Spec (added with F-02) asserted pending sessions **must be rejected** — locked the broken behavior in |

F-02's intent was abuse prevention: a leaked invite token must not corrupt a *terminal* session (ended/failed). That intent is valid — but requiring `active` on a `pending` session blocks the legitimate first-connect activation that the product design relies on.

**Gap to ideal:** `pending` sessions must be connectable (activated on first connect by `StartHandler`); only terminal sessions (`ended`/`failed`) must reject audio injection.

## 3. Options & Trade-offs

| Option | Authority | UX change | Relative cost | Outcome |
|---|---|---|---|---|
| **A — Candidate connects from pending** ✅ **CHOSEN & IMPLEMENTED** | Invite/session rules | None | Low | Restores intended flow |
| **B — Assessor activation** ❌ Not selected | New assessor action | Extra step | High | Strands pending sessions |

### Option A — Allow `pending` to connect; reject only terminal states ✅ **CHOSEN & IMPLEMENTED**

| Dimension | Assessment |
|---|---|
| **End-to-End Behavior** | Valid invites connect pending/active sessions; terminal sessions are rejected. |
| **Product Impact** | Restores the intended candidate-start flow. |
| **Cost & Complexity** | Low: one condition and focused tests. |
| **Long-Term Maintainability** | Connectable and terminal semantics stay explicit. |
| **Failure Modes** | Leaked tokens can start pending sessions; new statuses can be misclassified. |
| **Operational Risks** | Token leakage remains credential leakage. |
| **Mitigations** | Unguessable tokens, centralized predicates, and status tests. |
| **Contextual Fit** | Matches product design and shared authorization. |

### Option B — Activate the session from the assessor side (new endpoint/UI) ❌ Rejected

| Dimension | Assessment |
|---|---|
| **End-to-End Behavior** | Assessors activate sessions before candidates connect. |
| **Product Impact** | Adds coordination and can strand candidates. |
| **Cost & Complexity** | High: endpoint, UI, transition contract, and tests. |
| **Long-Term Maintainability** | Adds a required workflow step. |
| **Failure Modes** | Forgotten or concurrent activation blocks starts. |
| **Operational Risks** | Candidate access depends on assessor availability. |
| **Mitigations** | Notifications, idempotency, migration, and timeouts. |
| **Contextual Fit** | Conflicts with candidate-first activation. |

### Trade-offs accepted (for the chosen option)

| Trade-off | Justification |
|-----------|---------------|
| `failed` sessions now explicitly share the `ended` rejection path | Correct: a failed session is terminal; no live audio may be injected into it. Aligned with F-22's `failed` status semantics |

## 4. Solution Diimplementasikan

- `api/app/channels/websocket_auth.rb` — `authenticate_candidate` now rejects only terminal states: `return [nil, 'Session has ended'] if session.status.in?(%w[ended failed])`. The `active?` gate was removed; `pending` sessions pass auth and are activated by `StartHandler` on first WS connect.
- `api/spec/middleware/websocket_auth_spec.rb` — replaced the "rejects pending" spec with "accepts a PENDING session (activated on first connect)"; added a `failed`-session rejection spec; `ended` rejection kept.

> **AI-Human Verification:** No AI mistakes found for this finding. (The initial suspicion during debugging — a Gemini API-key misconfiguration — was ruled out by evidence: the log showed the pending rejection path, not a Gemini error.)

## 5. Acceptance Criteria & Edge Cases

| # | Criterion | Input | Expected Behavior | Edge Case |
|---|-----------|-------|-------------------|-----------|
| 1 | Pending session connects | invite token of a `pending` session | auth succeeds, session returned | session must still be activated by StartHandler after auth |
| 2 | Active session connects | invite token of an `active` session | auth succeeds (no regression) | — |
| 3 | Ended session rejected | invite token of an `ended` session | `'Session has ended'` error | — |
| 4 | Failed session rejected | invite token of a `failed` session | `'Session has ended'` error | terminal state must not accept audio injection |
| 5 | Unknown token rejected | random token | `'Session not found'` | — |

## 6. Test & Verifikasi

- `api/spec/middleware/websocket_auth_spec.rb` — **11 examples, 0 failures** (was 9; +2 new/updated for pending/failed).
- **Manual (E2E as candidate):** session id=20 in `pending` state → invite link → "Start Interview" → WS connected, session auto-activated (`StartHandler` logged, coverage maps initialized), AI interview ran.

## 7. AI-Human Verification

None — see section 4.

---

*F-27 completed: pending-session start restored and locked by specs + manual E2E.*

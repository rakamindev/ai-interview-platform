# F-28 — "End Interview" Shows "Connection Lost" (WebSocket Close Race)

> **Finding:** F-28 (severity: P2) · **Classification:** Defective Implementation · **Area:** Frontend — audio WebSocket hook · **UU PDP:** No
> **Branch:** `fix/e2e-interview-findings` (PR #12) · **Status:** ✅ Completed & verified

---

## 1. Summary

When a candidate intentionally ended the interview (the "End Interview" button), the UI briefly showed the success state and then **flipped to a "Connection lost" error screen**. Reloading the page then showed "Interview Complete" — because the backend had actually ended the session correctly. The error was a frontend race, but the candidate experienced a scary failure right after completing the most stressful part of the process, undermining trust in whether their interview was recorded.

Found during end-to-end testing as a candidate (2026-08-18).

## 2. Analysis & Gap to Ideal

**Root cause:** `endInterview` sends `{ type: "end_session" }` and then **immediately** calls `disconnect()`, which closes the WebSocket. The backend's `session_ended` reply never arrives (the socket is already closing), so the hook's `sessionEndedRef` stays `false`. When the browser's async `onclose` event fires, the hook treats the intentional close as a lost connection: reconnection attempts are already exhausted (the hook pre-emptively marks them as done), so it raises `onFatalError({ kind: "ws_connection_lost" })` and sets state to `error` — overwriting the `complete` state set a few milliseconds earlier.

| File | Evidence |
|------|----------|
| `web/src/pages/interview/InterviewPage.tsx` | `endInterview`: `sendJson({type:"end_session"})` → `disconnect()` → `setInterviewState("complete")` — closes before the reply |
| `web/src/hooks/useAudioWebSocket.ts` | `onclose` → if `sessionEndedRef` false → exhausted attempts → `onFatalError(ws_connection_lost)` + `onStateChange("error")` |
| `web/src/hooks/useAudioWebSocket.ts` | `sessionEndedRef` only set when a `session_ended` message arrives — which cannot happen after `close()` |

**Gap to ideal:** closing the socket because the user *intentionally ended* the interview must be treated as a clean close — no reconnect, no fatal error. The `complete` state must survive.

## 3. Options & Trade-offs

| Option | Authority | Coordination | Relative cost | Outcome |
|---|---|---|---|---|
| **A — Intentional-close flag** ✅ **CHOSEN & IMPLEMENTED** | Client intent | None | Low | Prevents false failure |
| **B — Wait for server reply** ❌ Not selected | Server event | Reply + timeout | Medium | Adds delay and loss risk |

### Option A — Mark the close as intentional inside `disconnect()` ✅ **CHOSEN & IMPLEMENTED**

| Dimension | Assessment |
|---|---|
| **End-to-End Behavior** | `disconnect()` records intent before socket closure. |
| **Product Impact** | Candidates see truthful completion. |
| **Cost & Complexity** | Low: one flag and one test. |
| **Long-Term Maintainability** | Intent lives at the single close entry point. |
| **Failure Modes** | Future non-terminal callers could suppress real errors. |
| **Operational Risks** | Refactors can break the close invariant. |
| **Mitigations** | Connection-scoped state, documentation, and close-path tests. |
| **Contextual Fit** | Fits the existing hook without backend changes. |

### Option B — Wait for the backend `session_ended` reply before closing ❌ Rejected

| Dimension | Assessment |
|---|---|
| **End-to-End Behavior** | The client waits for acknowledgement or timeout before closing. |
| **Product Impact** | Confirms receipt but delays completion. |
| **Cost & Complexity** | Medium: deferred state, timer, and tests. |
| **Long-Term Maintainability** | Adds a second shutdown protocol. |
| **Failure Modes** | Lost replies, duplicate events, and slow servers stall UI. |
| **Operational Risks** | Network latency affects the completion experience. |
| **Mitigations** | Idempotency, bounded timeout, and monotonic states. |
| **Contextual Fit** | Excessive because backend termination is already independent. |

### Trade-offs accepted (for the chosen option)

| Trade-off | Justification |
|-----------|---------------|
| `disconnect()` now semantically means "end this session", not just "drop the socket" | Matches its only caller (`endInterview`); prevents the misleading fatal error on the happy path |

## 4. Solution Diimplementasikan

- `web/src/hooks/useAudioWebSocket.ts` — `disconnect()` now sets `sessionEndedRef.current = true` before closing the socket, so the async `onclose` takes the clean-exit branch (`if (sessionEndedRef.current) return;`) — no reconnect, no `ws_connection_lost` fatal error.
- `web/src/hooks/__tests__/useAudioWebSocket.test.ts` — added regression test: `disconnect()` after `sendJson({type:"end_session"})` must NOT surface connection lost (`onFatalError` not called, no `error`/`reconnecting` state).

> **AI-Human Verification:** No AI mistakes found for this finding.

## 5. Acceptance Criteria & Edge Cases

| # | Criterion | Input | Expected Behavior | Edge Case |
|---|-----------|-------|-------------------|-----------|
| 1 | Intentional end | click "End Interview" | state reaches `complete`; no `error` afterwards | async `onclose` arrives after `disconnect()` |
| 2 | End sends end_session | click "End Interview" | `{type:"end_session"}` sent over the WS | socket closes immediately after — backend still ends the session |
| 3 | No reconnect after intentional close | `onclose` post-`disconnect()` | no new WebSocket, no `reconnecting` state | — |
| 4 | Unintentional drops still recover | transient `onclose` mid-interview | reconnect attempts proceed as before | regression guard: existing "exhausted reconnects → error" test still passes |
| 5 | Backend-received `session_ended` path unaffected | server closes after `session_ended` | clean exit, no fatal error | — |

## 6. Test & Verifikasi

- `web/src/hooks/__tests__/useAudioWebSocket.test.ts` — **6 tests, 0 failures** (5 existing + 1 new regression).
- `web/src/pages/interview/__tests__/InterviewPage.test.tsx` — **4 tests, 0 failures** (no regression).
- **Manual (E2E as candidate):** started a real interview, clicked "End Interview" → landed directly on "Interview Complete" — no "Connection lost" flash.

## 7. AI-Human Verification

None — see section 4.

---

*F-28 completed: intentional end no longer surfaces a spurious connection-lost error; regression locked by test + manual E2E.*

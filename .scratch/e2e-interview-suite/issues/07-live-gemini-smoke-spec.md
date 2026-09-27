# 07-live-gemini-smoke-spec

Status: resolved
Blocked by: 05

## Context
While the Mock Gemini server enables deterministic CI testing, developers and release engineers need an automated on-demand smoke test to verify live protocol compatibility with Google's actual Gemini Live API endpoints before major releases.

## Implementation Details
1. Create `e2e/tests/live-gemini.spec.ts` tagged with `@live`.
2. Ensure the test skips gracefully if `GEMINI_API_KEY` is not present in the environment.
3. Configure the test to boot Rails with `GEMINI_WS_URL` targeting Google's production endpoint (`wss://generativelanguage.googleapis.com/...`).
4. Navigate to `/interview/e2e-token-live-gemini`.
5. Complete pre-flight consent and hardware check.
6. Verify semantic milestones:
   - WebSocket establishes connection with real Gemini service.
   - Initial AI spoken greeting arrives (audio chunks received and voice bars animate).
   - Non-empty AI transcript turns appear in DOM.
   - Candidate synthetic audio is accepted without disconnection.
   - Client successfully disconnects and completes without unhandled errors.
7. Add npm script in `e2e/package.json`: `"test:live": "playwright test tests/live-gemini.spec.ts --grep @live"`.

## Verification
- `cd e2e && GEMINI_API_KEY=<valid_key> npm run test:live`

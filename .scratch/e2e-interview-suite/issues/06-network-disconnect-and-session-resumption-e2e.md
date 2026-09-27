# 06-network-disconnect-and-session-resumption-e2e

Status: resolved
Blocked by: 05

## Context
Candidates on unreliable regional internet connections frequently experience page reloads, temporary Wi-Fi drops, or browser tab crashes. The platform relies on a 120-second backend grace period and Gemini Live Session Resumption Tokens to restore dialogue context without restarting the candidate's interview.

## Implementation Details
1. Create `e2e/tests/resumption.spec.ts`.
2. Scenario 1: **Browser Page Reload Mid-Interview**:
   - Navigate to `/interview/e2e-token-resumption`.
   - Complete pre-flight and initiate live dialogue.
   - Wait for AI to emit initial turn and receive Session Resumption Token.
   - Trigger a page reload: `await page.reload()`.
   - Assert candidate info re-fetches and detects active session (`session_status: "active"`).
   - Assert client reconnects WebSocket with the stored Session Resumption Token.
   - Assert conversation resumes without resetting turn count or re-prompting for hardware check.
3. Scenario 2: **Client Network Blip & Exponential Backoff**:
   - In active interview, toggle Playwright offline mode: `await context.setOffline(true)`.
   - Assert "Menghubungkan kembali..." (Reconnecting) status appears in UI.
   - Assert audio input is temporarily muted to avoid buffer overflow.
   - Toggle network back online: `await context.setOffline(false)`.
   - Assert reconnection succeeds within backoff window (`[1000, 2000, 4000]ms`).
   - Assert "Terhubung kembali" (Reconnected) banner appears briefly.

## Verification
- `cd e2e && npx playwright test tests/resumption.spec.ts`
- Verified: All assertions passed in 16.5s.
- Verified backend suite: `cd api && bundle exec rspec` (29 examples, 0 failures).
- Verified web unit/integration suite: `cd web && npm test` (17 tests, 0 failures).
- Verified TypeScript compilation: `tsc --noEmit` cleanly in `web/` and `e2e/`.

# 04-preflight-onboarding-and-consent-e2e

Status: resolved
Blocked by: 01, 03

## Context
Candidates entering an interview must navigate the statutory Pre-Flight Consent Modal under Indonesian Law No. 27/2022 (UU PDP), complete the Hardware Check, and handle the Advisory Connectivity Check before the live room opens.

## Implementation Details
1. Create `e2e/tests/onboarding.spec.ts`.
2. Scenario 1: **UU PDP Consent Opt-Out**:
   - Navigate to `/interview/e2e-token-consent-decline`.
   - Assert Pre-Flight Consent Modal is visible with UU PDP statutory notice.
   - Click "Tolak" (Decline).
   - Assert modal closes, interview terminates cleanly, informative decline message displays, and microphone is never captured.
3. Scenario 2: **Affirmative Consent & Hardware Check with Soft Bypass**:
   - Navigate to `/interview/e2e-token-soft-bypass`.
   - Click "Saya Setuju" (Affirmative Opt-In).
   - Assert transition to Hardware Check.
   - Assert synthetic microphone audio level registers on visualizer.
   - Simulate advisory connectivity warning (mock latency > 300ms) and assert Soft Bypass confirmation button appears.
   - Click Soft Bypass to confirm proceeding.
   - Click "Mulai Wawancara" (Start Interview) button.
   - Assert audio capture and playback contexts are activated within the user gesture.

## Verification
- `cd e2e && npx playwright test tests/onboarding.spec.ts`

## Comments
- Implemented `e2e/tests/onboarding.spec.ts` covering both UU PDP Consent Opt-Out (clean termination, zero GUM access) and Affirmative Consent + Hardware Check + Soft Bypass + user gesture audio context activation.
- Updated `PreFlightConsentModal.tsx` button label to "Saya Setuju" for parity with legal disclosures and E2E specifications while maintaining backwards compatibility with Vitest suites.
- Enhanced `HardwareCheck.tsx` with `data-testid` selectors, AudioContext resume handling, audio peak/average visualizer calculations, and bilingual labels for Soft Bypass and Start Interview.
- Updated `useAudioCapture.ts` to resume suspended AudioContexts upon candidate gesture initialization per ADR 0005.
- Updated `e2e/global-setup.ts` to seed both test and development databases to support seamless local runs against existing dev servers.
- Verified: All 3 Playwright tests pass (onboarding + smoke), Vitest suite passes (17 tests), RSpec backend suite passes (29 examples), and TypeScript checks pass with zero errors in both `web/` and `e2e/`.

# 04-preflight-uu-pdp-consent-and-advisory-connectivity

Status: done
Blocked by: none

## Context
1. `InterviewPage.tsx` lacks an explicit affirmative consent gate under Indonesian UU PDP No. 27/2022.
2. `HardwareCheck.tsx` and `internetSpeedTest.ts` rely on external third-party CDNs and httpbin.org, lacking internal endpoint measurement and soft bypass.
3. Media streams and AudioContext instances must be cleanly released prior to the user-gesture interview start (ADR 0005).

## Implementation Details
1. In `web/src/components/`, create or wire `PreFlightConsentModal.tsx` in `InterviewPage.tsx` requiring an affirmative opt-in checkbox explaining biometric voice processing before the hardware check is accessible.
2. Update `web/src/utils/internetSpeedTest.ts`:
   - Point ping/latency check to internal `/api/v1/health`.
   - Point upload check to internal `/api/v1/speed_test`.
   - Support `softBypass` in `HardwareCheck.tsx` allowing candidates with advisory warnings to proceed.
3. In `HardwareCheck.tsx`, cleanly stop all test tracks on completion; initialize live audio contexts in `startInterview` on `InterviewPage.tsx`.

## Verification
- `cd web && npm test src/test/pages/InterviewPage.test.tsx`

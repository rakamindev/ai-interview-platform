# 05-live-dialogue-and-dual-gating-e2e

Status: resolved
Blocked by: 01, 02, 03, 04

## Context
During live interviews, the web client streams 16kHz PCM audio to Rails at `/ws/sessions/:id/audio`, which proxies to Gemini Live. The platform must maintain low-latency dialogue, eliminate echo loops via Coordinated Dual-Gating (muting candidate mic while AI speaks and gating server ingestion), render real-time transcript bubbles, and complete cleanly on wrap-up signals.

## Implementation Details
1. Create `e2e/tests/dialogue.spec.ts`.
2. Scenario: **Full Conversational Cadence & Dual-Gating**:
   - Navigate to `/interview/e2e-token-happy-path`.
   - Accept consent and complete Hardware Check.
   - Click "Mulai Wawancara" to enter room.
   - Assert WebSocket connection state transitions from `connecting` to `connected`.
   - Turn 1 (AI Speaking):
     - Assert "AI Speaking" badge is visible and voice bars animate.
     - Assert client-side microphone mute is engaged (Coordinated Dual-Gating).
     - Assert AI transcript turn renders in DOM.
   - Turn 2 (Turn Handover & Candidate Speaking):
     - Mock Gemini finishes speaking and emits `turnComplete`.
     - Assert Rails delivers `speaker_changed: candidate`.
     - Assert client un-mutes microphone and displays "Candidate Speaking" badge.
     - Assert synthetic PCM frames stream from browser to Rails.
     - Assert candidate transcript bubble renders in DOM.
   - Wrap-Up & Completion:
     - Mock Gemini injects `WRAP_UP_SIGNAL`.
     - Assert room transitions to "Interview Complete" state.
     - Assert session status updates to `ended` in database.

## Verification
- `cd e2e && npx playwright test tests/dialogue.spec.ts`

# 02-mock-gemini-bidi-websocket-server

Status: completed
Blocked by: 01

## Context
In production, Rails connects to Google's Gemini Live WebSocket API (`wss://generativelanguage.googleapis.com/...`). Running E2E tests against the real API is slow, expensive, and non-deterministic. A local WebSocket server must emulate Google's BidiGenerateContent protocol to enable deterministic E2E testing.

## Implementation Details
1. Create `e2e/mock-gemini/server.ts` using `ws` on port 8080.
2. Emulate the Google Gemini Live Bidi protocol:
   - Handle incoming `setup` frame; respond with `{ setupComplete: {} }`.
   - Generate synthetic 24kHz PCM audio frames (packaged in base64 within `serverContent.modelTurn.parts`).
   - Emit `sessionResumption: { handle: "mock-resumption-handle-xyz" }` updates.
   - Emit candidate input transcription events and model output transcription events.
   - Emit `serverContent.turnComplete: true` to trigger turn handover.
   - Support wrap-up signal injection: `[TIME CONTROL:SYS-TC-7x9k] { "wrap_up": true, "all_skills_covered": true }`.
3. Dispatch scenarios based on the `session_id` query parameter or candidate token in the connection URL:
   - Happy Path: Initial greeting -> listen for candidate PCM -> follow-up question -> wrap-up signal -> clean close.
   - Resumption: Drops socket after turn 1; when reconnected with prior resumption handle, resumes seamlessly.
4. Add npm script in `e2e/package.json`: `"mock-gemini": "tsx mock-gemini/server.ts"`.

## Verification
- Unit test or verification script connecting a WebSocket client to `ws://localhost:8080` and verifying handshake and frame exchange.

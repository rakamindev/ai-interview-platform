# End-to-End Test Suite for AI Interview Behavior

Status: ready-for-agent

## Problem Statement

Engineers, product owners, and QA teams lack an automated, deterministic end-to-end verification harness for the conversational voice interview experience. While unit and request specs verify isolated Rails endpoints and Vitest renders isolated React components, the full reactive journey—navigating the candidate invite, passing statutory pre-flight consent, executing hardware media acquisition, establishing real-time binary audio WebSocket streaming, coordinating AI vs. candidate turn-taking gates, and recovering from network drops—has zero automated integration coverage.

As a result:
- Changes to audio capture hooks, playback queues, or WebSocket middlewares risk silent regressions in conversational cadence, acoustic echo gating, or token resumption.
- Manual verification requires setting up live microphone permissions, burning Google Gemini Live API quota, speaking into the browser, and subjectively listening for turn transitions.
- Testing network disconnections and edge-case session recovery cannot be reproduced reliably across developer machines or CI environments.

## Solution

A dedicated, automated End-to-End (E2E) testing framework housed in a top-level workspace that tests the real frontend and backend services working together in headless Chromium with synthetic media streams. 

From the developer's perspective:
- Running `npm test` inside the test suite automatically boots all required processes (the Vite frontend, the Rails test API server, and a local Mock Gemini Live WebSocket server) and seeds scenario-specific database records without manual intervention.
- Tests deterministically exercise the complete candidate interview journey: affirmative opt-in under Indonesian UU PDP No. 27/2022, microphone hardware check with soft bypass for advisory connectivity metrics, live bidirectional 16kHz/24kHz PCM audio streaming, Coordinated Dual-Gating to eliminate echo loops, transcript rendering, and Session Resumption Token reconnection upon network interruption.
- A dedicated `@live` test suite allows engineers on-demand to execute the exact same candidate journey against Google's real Gemini Live API using semantic protocol milestones.

## User Stories

1. As a candidate opening an interview invite link, I want the web application to load my assessment details and present the Pre-Flight Consent Modal, so that I can review required statutory disclosures before any media devices are accessed.
2. As a candidate reviewing the Pre-Flight Consent Modal, I want an explicit "Saya Setuju" (affirmative opt-in) button that advances to the Hardware Check, so that my biometric voice data is captured only after compliant consent under Indonesian UU PDP No. 27/2022.
3. As a candidate declining consent in the Pre-Flight Consent Modal, I want the interview to cleanly terminate with an informative status message and prevent microphone access, so that my decision to decline is respected.
4. As a candidate entering the Hardware Check, I want the browser to acquire my microphone using simulated media streams and verify audio responsiveness, so that I have visual confirmation that my audio input works.
5. As a candidate with high network latency or jitter, I want the Advisory Connectivity Check to present a Soft Bypass confirmation, so that I can choose to proceed with the interview rather than being locked out by network metrics.
6. As a candidate clicking "Start Interview", I want the application to initialize clean audio capture and playback contexts within a single user gesture, so that modern browser autoplay policies do not block subsequent voice output.
7. As a candidate entering the active interview, I want the web client to open a binary WebSocket connection to the audio streaming channel, so that voice frames begin flowing to the conversational backend.
8. As a candidate in a live session, I want the AI interviewer to speak first with an introductory greeting, so that I know what role and competency are being evaluated.
9. As a candidate listening to the AI interviewer, I want the platform to enforce Coordinated Dual-Gating by muting my local microphone and gating server audio ingestion, so that the AI's spoken words are not captured by my microphone and echoed back.
10. As a candidate listening to the AI interviewer, I want the UI to display an "AI Speaking" badge and animated voice bars, so that I have clear visual indication of speaker state.
11. As a candidate speaking my answer, I want the UI to display a "Candidate Speaking" badge, so that I know my voice is actively being streamed.
12. As a candidate conversing with the AI, I want transcript bubbles to render matching dialogue turns in real time, so that I can see the conversation history as it unfolds.
13. As a candidate experiencing a sudden browser page reload or network disconnection, I want the interview to reconnect within the grace period using my Session Resumption Token, so that I do not lose progress or have my session restarted.
14. As a candidate whose connection drops, I want to see a clear "Reconnecting" notification with automated exponential backoff retries, so that I know the system is attempting to restore my session.
15. As a candidate completing the interview dialogue, I want the AI wrap-up signal to transition the room to an "Interview Complete" state, so that I know my session has concluded and my evaluation dossier is being prepared.
16. As a test engineer running CI, I want the E2E test suite to execute against a local Mock Gemini Live WebSocket server by default, so that tests run rapidly, deterministically, and with zero external API costs.
17. As an engineer verifying model integration, I want to execute an on-demand `@live` test suite against the actual Google Gemini Live API, so that live protocol compatibility and voice streaming can be validated against production endpoints.
18. As a developer running tests locally, I want the test harness to automatically seed dedicated scenario tokens and database records before the suite runs, so that tests are idempotent and require no manual database resetting.

## Implementation Decisions

### 1. Dedicated Top-Level Test Workspace
- Establish a standalone top-level workspace (`e2e/`) with its own package configuration and Playwright runner.
- Decouple E2E dependencies from the production web bundle and API gems.
- Configure Chromium with browser launch arguments: `--use-fake-device-for-media-stream` and `--use-fake-ui-for-media-stream`. This instructs the browser to synthesize a continuous 16kHz audio input stream and automatically grant microphone permissions without prompting.

### 2. Multi-Process Orchestration via Playwright
- Utilize Playwright's native multi-server configuration to manage three concurrent processes:
  1. The Mock Gemini Live WebSocket service on a designated local port.
  2. The Rails test API server running in test environment mode on the backend port.
  3. The Vite development server running on a dedicated test port pointing to the Rails API backend.
- Support local developer workflows by allowing tests to reuse already-running servers outside of CI.

### 3. Mock Gemini Live WebSocket Server
- Build a lightweight Node.js/TypeScript WebSocket server in the test workspace that emulates Google's bidirectional `BidiGenerateContent` protocol.
- Emulate the Google Gemini Live protocol sequence:
  - Expect the initial `setup` frame containing model identifiers and system instructions, responding with `setupComplete`.
  - Receive candidate `realtimeInput` containing 16kHz PCM audio frames.
  - Return `serverContent` containing model turns with synthetic 24kHz PCM audio frames, textual parts, and turn completion signals.
  - Emit initial and updated `sessionResumption` handles for reconnection tracking.
  - Emit `turnComplete` signals to trigger candidate speaking turns and Coordinated Dual-Gating release.
- Dispatch scenarios based on the candidate session identifier:
  - Happy Path Scenario: Greets candidate, receives synthetic speech, poses a follow-up competency probe, and sends the time-control wrap-up signal.
  - Resumption Scenario: Simulates an upstream or network break and verifies reconnection with the prior resumption handle.
  - Soft Bypass Scenario: Standard progression following an advisory connectivity check bypass.

### 4. Configurable Backend Gemini Upstream Seam
- Update the Rails Gemini Live client module to fetch its WebSocket target URL from an environment variable (`GEMINI_WS_URL`), defaulting to Google's production endpoint (`wss://generativelanguage.googleapis.com/...`).
- When running under the E2E test harness, configure the Rails test process to point `GEMINI_WS_URL` to the local Mock Gemini server.
- Ensure that the connection URL preserves the session identifier as a query parameter or header so the mock server can route scenario-specific scripts.
- Make zero changes to production React components, business authorization gates, or database models.

### 5. Idempotent Database Seeding
- Create a dedicated database seeding task in the Rails backend (`rails db:seed:e2e`).
- Seed an isolated test organization, an active technical vacancy, calibrated competency skills, and specific candidate interview sessions mapped to deterministic scenario tokens:
  - `e2e-token-happy-path`: Full lifecycle candidate session.
  - `e2e-token-resumption`: Session reserved for disconnect and token recovery testing.
  - `e2e-token-consent-decline`: Session for testing opt-out termination.
  - `e2e-token-soft-bypass`: Session configured for latency warning and soft bypass verification.
  - `e2e-token-live-gemini`: Session reserved for live API execution.
- Invoke this seed automatically in Playwright's global setup hook before any test runs.

## Testing Decisions

### 1. Test Harness and Runners
- **Runner**: `@playwright/test` running headless Chromium with synthetic media stream flags.
- **Location**: Standalone `e2e/` directory at the project root.
- **Language**: TypeScript with strict type checking.

### 2. Testing Seams
- **Primary User Interface Seam**: Headless Chromium interacting with the web application DOM (`/interview/:token`), handling user gestures, consent modals, and buttons.
- **External Integration Seam**: A local WebSocket server acting as Google Gemini Live at the network boundary of the Rails API backend.
- **Database Seam**: Pre-seeded static scenario records in the PostgreSQL test database reset via a dedicated rake task.

### 3. Verification Criteria
- **Protocol Verification**: Assert WebSocket connection states (`connected`, `reconnecting`), binary audio frame exchanges, and speaker transition control messages (`speaker_changed: ai` vs `speaker_changed: candidate`).
- **DOM & UI Synchronization**: Assert visibility of the Pre-Flight Consent Modal, confirmation of UU PDP opt-in, completion of the Hardware Check, presence of the active voice bars visualizer, speaker status badges, and real-time transcript bubbles.
- **Resilience Verification**: Trigger browser reloads and offline states mid-interview, asserting that the client restores connection without restarting and that the session resumption token is accepted.
- **Live Smoke Suite**: A separately tagged spec file (`tests/live-gemini.spec.ts` with tag `@live`) executed on-demand with `npm run test:live`. Validates semantic protocol progression (handshake, first AI speech turn, transcript generation, clean shutdown) against the actual Google Gemini Live API.

### 4. What Will NOT Be Tested
- Raw audio frequency and spectral FFT analysis of PCM buffers (omitted to avoid brittle cross-platform audio driver flakes).
- Production Gemini Live API in regular CI runs (strictly isolated to manual/on-demand `@live` runs).
- Unit-level calculations of internal Fit/Gap scoring or PDF generation (already covered by backend RSpec suites).

# Repository Feature Inventory

This document describes the features currently implemented in the `api/` and `web/` applications. It is based on the repository source as of August 16, 2026.

## Product Overview

The repository contains an AI-assisted interview platform with two user experiences:

- **Assessors** configure assessments, invite candidates, monitor interviews, review AI-generated competency portfolios, override ratings, and compare candidates against vacancies.
- **Candidates** open a tokenized invitation link, complete device checks, and take a live voice interview conducted by Gemini.

The two applications work together over REST and WebSocket connections:

```text
React web app
  |-- REST API --------------------> Rails API / PostgreSQL
  |-- interview audio WebSocket ---> Gemini Live API
  |-- coverage WebSocket ----------> Redis pub/sub
                                      |
                                      +--> Sidekiq background workers
                                           (coverage, portfolio, fit-gap)
```

## End-to-End Workflow

1. An assessor logs in and creates an assessment for a role.
2. The assessor selects taxonomy skills or defines custom skills, proficiency anchors, expected levels, interview language, and time limit.
3. The API compiles an AI interviewer system prompt in the background.
4. The assessor creates a candidate session and shares its unique invite URL.
5. The candidate completes browser, network, microphone, audio, and optional camera checks.
6. The browser streams microphone audio to the API, which connects the session to Gemini Live.
7. Gemini conducts the interview while the API stores transcripts and analyzes skill coverage after candidate turns.
8. The assessor can monitor the transcript and coverage map in real time or end the session manually.
9. When the interview ends, a background worker generates a competency portfolio with levels, confidence, evidence, and summaries.
10. The assessor can override AI ratings, export results, or compare the portfolio against a vacancy in a fit/gap report.

## API Features (`api/`)

### Technology and Runtime

- Ruby on Rails 7 API-only application.
- PostgreSQL persistence in the `ai_interview` schema.
- Redis for Sidekiq, rate limiting, caching, and WebSocket pub/sub.
- Sidekiq workers for system prompts, coverage analysis, portfolios, and fit/gap reports.
- Gemini Live for real-time voice interviews.
- Gemini HTTP models for transcript analysis, portfolio generation, and report narratives.
- Faye WebSocket and EventMachine for audio and coverage channels.
- Prawn for PDF exports.
- Docker and Kubernetes deployment definitions, including separate API and Sidekiq workloads and long-lived WebSocket ingress settings.

### Authentication and Tenant Context

- Email/password login backed by bcrypt users.
- Signed JWT access tokens for assessor API requests.
- `admin` and `assessor` authorization for protected API controllers.
- Organization resolution from tenant scheme/host context.
- Tenant-scoped assessments, sessions, and vacancies.
- Invite-token authentication for candidate session information and interview audio.
- Login rate limiting and candidate HTTP request throttling through Rack Attack.

### Assessment Management

- Create, list, view, update, and delete assessments.
- Configure 10, 30, 45, 60, or 90 minute interview limits.
- Configure interviews in English or Bahasa Indonesia.
- Attach ordered skills with:
  - taxonomy or custom identity;
  - included and excluded scope;
  - behavioral anchors for levels L1 through L5;
  - expected proficiency level.
- Compile a detailed Gemini interviewer prompt after assessment creation or update.
- The generated prompt includes adaptive probing rules, language constraints, time pacing, off-agenda skill discovery, anti-prompt-injection instructions, and controlled wrap-up behavior.
- Paginated assessment listing with latest-session status.

### Skill Taxonomy

- Read-only skill taxonomy listing, optionally filtered by category.
- Individual skill lookup by `skill_id`.
- Taxonomy records contain scope and behavioral anchors for L1 through L5.
- Seed data provides engineering, product/process, and soft-skill definitions.

### Candidate Sessions and Invitations

- Create multiple candidate sessions for an assessment.
- Store an optional candidate name and external candidate ID.
- Generate a unique, high-entropy invite token and candidate invite URL.
- Track session states: pending, active, ended, and failed.
- Track start/end time, duration, and end reason.
- End reasons cover candidate action, assessor action, complete coverage, time ceiling, and errors.
- Public candidate-info lookup using the invite token.
- Idempotent interview completion endpoint after final AI audio playback.

### Live AI Voice Interview

- Audio WebSocket at `WS /ws/sessions/:id/audio`.
- Candidate access with an invite token and assessor access with a JWT.
- Browser-to-server raw mono PCM audio streaming at 16 kHz.
- Gemini-to-browser PCM response audio streaming at 24 kHz.
- Input and output transcription from Gemini Live.
- Persisted candidate and AI transcript turns with turn ordering.
- Server events for session start/end, transcription, speaker changes, reconnecting, errors, and interview wrap-up.
- Candidate audio suppression while the AI is speaking to reduce feedback and overlapping turns.
- Gemini session resumption-token persistence and proactive reconnect handling for long sessions.
- Automatic session activation and coverage-map initialization when the interview starts.
- Disconnect grace period before ending a session as an error.
- Time-aware wrap-up instructions and a hard limit beyond the configured interview duration.

### Coverage Analysis and Monitoring

- A coverage row is initialized for every configured assessment skill.
- Coverage progresses through `not_yet`, `initiated`, `partial`, and `covered` states.
- Candidate transcript turns enqueue asynchronous Gemini-based coverage analysis.
- Analysis records probe count and the latest supporting signal.
- Forward-only coverage transitions prevent later analysis from reducing an achieved state.
- Off-agenda skills mentioned by the candidate can be discovered and tracked separately.
- Coverage context, remaining time, pacing, and next-skill priority are injected into the live AI conversation.
- Automatic wrap-up can begin when all configured skills are covered and discovered probes are complete.
- Coverage WebSocket at `WS /ws/sessions/:id/coverage` publishes live updates through Redis.
- REST coverage and incremental transcript endpoints support monitoring and fallback clients.

### Portfolio Generation

- Ending a session creates and queues one candidate portfolio.
- Gemini analyzes the full transcript, coverage state, and behavioral anchors.
- Each configured or discovered skill receives:
  - an L1 through L5 AI rating;
  - high, medium, or low confidence;
  - candidate evidence quotes;
  - a competency summary.
- Portfolio generation states: pending, generating, complete, and failed.
- Failed portfolio generation can be retried.
- API responses expose generated skills and assessor overrides.

### Assessor Overrides

- Assessors can replace the AI level for an individual portfolio skill.
- Optional assessor notes and override metadata are stored.
- One current override is maintained per portfolio skill.
- Saving an override invalidates and regenerates cached fit/gap reports that depend on the portfolio.
- Fit/gap calculations use the overridden level as the candidate's effective level.

### Vacancy Management

- Create, list, view, update, and delete vacancies.
- Configure a role title, expected skills, and expected L1 through L5 levels.
- Store free-text culture dimensions and competency expectations.
- Enrich recognized vacancy skills with taxonomy anchors in detailed API responses.

### Fit/Gap Analysis

- Compare a completed portfolio with a vacancy.
- Match skills by taxonomy ID first and case-insensitive label second.
- Classify each vacancy skill as `match`, `gap`, `exceed`, or `not_assessed`.
- Report candidate level, expected level, delta, and confidence.
- Apply assessor overrides before comparison.
- Use Gemini to generate culture/competency and overall recommendation narratives.
- Fall back to a deterministic summary if narrative generation fails.
- Cache reports by portfolio and vacancy.
- Support explicit report regeneration.

### Transcript and Export Features

- Retrieve the complete ordered transcript or request turns from a specific turn number.
- Export a completed portfolio as JSON or PDF.
- Optionally include an existing vacancy fit/gap report in the export.
- PDF output includes assessment/session metadata, effective skill levels, confidence, evidence, summaries, assessor overrides, and fit/gap details.

### Health and Utility Endpoints

- Public `GET /health` and `GET /api/v1/health` endpoints.
- Public upload-size response endpoint used by browser internet-speed checks.

## API Endpoint Summary

All REST endpoints below are under `/api/v1` unless shown otherwise.

| Method | Path | Purpose | Access |
|---|---|---|---|
| `GET` | `/health` | Basic application health | Public |
| `GET` | `/api/v1/health` | Versioned basic health | Public |
| `POST` | `/speed_test` | Upload speed-test response | Public |
| `POST` | `/auth/login` | Assessor/admin login | Public |
| `GET`, `POST` | `/assessments` | List or create assessments | Assessor |
| `GET`, `PUT`, `PATCH`, `DELETE` | `/assessments/:id` | Assessment detail and maintenance | Assessor |
| `GET`, `POST` | `/assessments/:assessment_id/sessions` | List sessions or create an invite | Assessor |
| `GET` | `/sessions/:id` | Session detail | Assessor |
| `POST` | `/sessions/:id/end_session` | Manually end an interview | Assessor |
| `GET` | `/sessions/:id/coverage` | Current coverage map | Assessor |
| `GET` | `/sessions/:id/transcript` | Full or incremental transcript | Assessor |
| `GET` | `/sessions/:id/portfolio` | Portfolio status and result | Assessor |
| `POST` | `/sessions/:id/portfolio/regenerate` | Retry failed portfolio generation | Assessor |
| `GET` | `/sessions/:token/candidate` | Candidate session information | Invite token |
| `POST` | `/sessions/:token/audio_complete` | Complete after final audio drains | Invite token |
| `GET` | `/skill_taxonomies` | List taxonomy skills | Assessor |
| `GET` | `/skill_taxonomies/:skill_id` | Taxonomy skill detail | Assessor |
| CRUD | `/vacancies` | Vacancy management | Assessor |
| `POST` | `/portfolio_skills/:id/override` | Save an assessor rating override | Assessor |
| `POST` | `/portfolios/:id/fitgap` | Fetch or queue fit/gap generation | Assessor |
| `GET` | `/portfolios/:id/fitgap/:vacancy_id` | Read a fit/gap report | Assessor |
| `POST` | `/portfolios/:id/regenerate_fitgap` | Rebuild a fit/gap report | Assessor |
| `GET` | `/portfolios/:id/export` | Download JSON or PDF | Assessor |

## Web Features (`web/`)

### Technology and Application Structure

- React 18 and TypeScript single-page application built with Vite.
- React Router for assessor and candidate routes.
- Tailwind CSS and shadcn-style Radix UI primitives.
- Jotai for authentication and tenant display state.
- Axios for REST requests.
- React Hook Form for form state and validation.
- dnd-kit for assessment skill ordering.
- Lucide icons and reusable UI components.
- Global error boundary with a page-refresh recovery action.

### Assessor Authentication and Layout

- Email/password login screen.
- JWT persistence in browser local storage.
- Automatic Bearer token attachment to REST requests.
- Protected assessor routes that redirect unauthenticated users to login.
- Automatic credential clearing and login redirect after REST `401` or `403` responses.
- Assessor navigation for assessments and vacancies.
- Tenant name display from development environment configuration.
- Logout action that clears browser and Jotai authentication state.

### Assessment Screens

- Assessment list with role, time limit, creation date, and latest-session status.
- New-assessment form with role title, time limit, and interview language.
- Searchable taxonomy skill picker.
- Custom skill form with scope, exclusions, expected level, and L1-L5 anchors.
- Editable skill cards with expected-level controls.
- Drag-and-drop skill ordering.
- Assessment edit screen for title, time limit, and skills.
- Assessment details/invitation screen showing configured skills and expected levels.

### Candidate Invitation and Session Tracking

- Create candidate invite links with an optional candidate name.
- Copy a newly generated or pending session link to the clipboard.
- List all sessions for an assessment.
- Distinguish awaiting, live, completed, and failed sessions.
- Poll session statuses every five seconds while work is active.
- Open live monitoring for active sessions.
- Open portfolio results for completed sessions.

### Candidate Pre-Interview Checks

- Public interview entry by invite token.
- Display role title and interview duration returned by the API.
- Sequential checks for:
  - browser and operating-system detection;
  - download speed, upload speed, and latency;
  - microphone access and live input level;
  - audio-output API availability;
  - camera access and preview when `VITE_REQUIRE_CAMERA=true`.
- Retry action after a failed check.
- Interview start remains disabled until required checks pass.

### Candidate Live Interview Experience

- Capture microphone audio through `getUserMedia` and an AudioWorklet.
- Convert audio to mono signed PCM16 and suppress sustained silence before transmission.
- Stream microphone frames over the interview WebSocket.
- Play Gemini PCM responses continuously through the Web Audio API.
- Display AI/candidate speaking indicators.
- Show the latest ten transcript messages.
- Show interview countdown and WebSocket connection state.
- Mute/unmute microphone control.
- Confirm before manually ending the interview.
- Temporarily stop microphone transmission during AI speech.
- Reconnect with short backoff delays and show outage/reconnected notices.
- Drain queued AI audio before notifying the API that automatic wrap-up is complete.
- Show a final completion screen after the session ends.

### Assessor Live Monitor

- Subscribe to coverage updates over an authenticated WebSocket.
- Display configured and discovered skills separately.
- Show coverage state, progress bar, probe count, and latest evidence signal.
- Poll incremental transcript turns every three seconds.
- Display the latest ten live transcript turns.
- Show elapsed interview time and connection status.
- Receive a session-ended event and navigate to results.
- End an active interview manually after confirmation.

### Portfolio Results

- Poll portfolio generation every five seconds until complete.
- Show a progress state while AI analysis runs.
- Show retry controls after failed generation.
- Separate configured skills from AI-discovered skills.
- Display AI level, confidence, evidence quotes, competency summary, and low-confidence indicators.
- Add or edit assessor level overrides and notes.
- Open the full transcript.
- Select a vacancy and run fit/gap analysis.
- Download portfolio results as PDF or JSON.

### Transcript Screen

- Load and display the complete interview transcript.
- Distinguish AI and candidate turns visually.
- Download the transcript as a plain-text file.

### Vacancy Screens

- List configured vacancies and their expected skill counts.
- Create a vacancy with role title, taxonomy skills, expected levels, culture dimensions, and competency expectations.
- Edit existing vacancy details and required skills.
- Open vacancy creation and editing from the assessor navigation.

### Fit/Gap Report Screen

- Trigger report generation when no cached report exists.
- Poll while a report is being generated.
- Display required and candidate levels for every vacancy skill.
- Visually distinguish matches, gaps, exceeds, and unassessed skills.
- Show AI-generated culture/competency narrative.
- List discovered candidate skills not required by the vacancy.
- Regenerate a report after changes.
- Export vacancy-aware results as PDF or JSON.

## Web Route Summary

| Route | Experience |
|---|---|
| `/login` | Assessor login |
| `/` | Redirect to assessments |
| `/assessments` | Assessment list |
| `/assessments/new` | Create assessment |
| `/assessments/:id/edit` | Edit assessment |
| `/assessments/:id/invite` | Assessment details, sessions, and invitations |
| `/assessments/:id/sessions/:sessionId/monitor` | Live assessor monitor |
| `/assessments/:id/sessions/:sessionId/portfolio` | Portfolio results and exports |
| `/assessments/:id/sessions/:sessionId/transcript` | Full transcript |
| `/assessments/:id/sessions/:sessionId/fitgap/:vacancyId` | Fit/gap report |
| `/vacancies` | Vacancy list |
| `/vacancies/new` | Create vacancy |
| `/vacancies/:id/edit` | Edit vacancy |
| `/interview/:token` | Public candidate interview |

## Current Limitations and Partially Connected Features

These items exist in source or are implied by the UI, but are incomplete, disconnected, or should not be treated as fully shipped behavior:

- There are no API or web automated tests in the repository, and the web package has no test or lint script.
- The health endpoints return a static status and do not verify PostgreSQL, Redis, Sidekiq, or Gemini.
- Candidate invite tokens do not currently have expiry, rotation, or revocation behavior.
- Raw interview audio is streamed but not recorded or stored. The completion screen's “recorded” wording refers to interview results/transcript, not an audio recording.
- Reconnection support does not replay client audio received while the Gemini connection is unavailable; an `AudioRingBuffer` exists but is not wired into the interview flow.
- Session time enforcement depends partly on live transcription activity rather than an independent scheduled timeout.
- REST endpoints enforce assessor/admin roles, while the WebSocket JWT paths validate identity and tenant ownership without equivalent role checks.
- Several portfolio and fit/gap records are not directly tenant-scoped, so their direct-ID authorization should be hardened before production use.
- Signup source code exists in the web application, but no signup route is registered and the Rails API has no matching signup endpoint.
- Assessment and vacancy delete API methods exist, but the current web screens do not expose delete controls.
- API pagination exists for assessment and vacancy lists, but the web UI only displays the first response page and has no pagination controls.
- Assessment creation supports interview language, but the edit screen does not expose language editing.
- The taxonomy picker copies taxonomy content but does not retain the selected taxonomy `skill_id`, which weakens ID-based matching later.
- The web tenant atom is development-oriented display state; it does not send a tenant header itself.
- The browser/OS preflight detects environment information but does not enforce a supported-browser matrix.
- Audio output preflight checks whether the browser can start audio, not whether the user confirms hearing it.
- Camera checking is optional and is not used for recording or proctoring after interview start.
- Several API error paths in vacancy, portfolio, and fit/gap screens are swallowed and can result in sparse blank states.
- No wildcard/404 page is registered in the web router.
- The API Docker Ruby version, Gemfile Ruby version, and Sidekiq Kubernetes environment settings currently need alignment before relying on the supplied deployment manifests.

## Main Source Locations

- API routes: `api/config/routes.rb`
- API controllers: `api/app/controllers/api/v1/`
- Interview WebSockets: `api/app/channels/`
- Gemini clients: `api/app/clients/gemini/`
- Domain services: `api/app/services/`
- Background workers: `api/app/workers/`
- Database schema: `api/db/schema.rb`
- Web routes: `web/src/App.tsx`
- Web pages: `web/src/pages/`
- Web API clients: `web/src/services/`
- Audio and WebSocket hooks: `web/src/hooks/`
- Shared frontend types: `web/src/types/index.ts`

# Platform Hardening: Multi-Tenant Security, Conversational Cadence & Evaluative Integrity

Status: ready-for-agent

## Problem Statement

Recruiters, assessors, and hiring managers are unable to evaluate technical candidates using the AI Interview Platform due to critical operational blockades, security vulnerabilities, and rubric calculation errors across both the web and API services. 

Specifically:
- Assessors cannot register or log in because non-admin accounts are rejected with 401 Unauthorized, and the user database contains zero seeded accounts.
- Candidates receiving interview links hit an immediate 404 Routing Error because invite links point to the API host rather than the web application.
- Candidates are subjected to un-bypassed third-party speed test failures, are barred from natural conversation and interruptions due to half-duplex mute gating, and have their biometric voice streams captured without statutory affirmative consent under Indonesian Law No. 27 of 2022 (UU PDP).
- Enterprise customer data is insecure: authenticated assessors in one tenant can inspect, override, and download candidate portfolios belonging to other organizations due to unscoped database queries (IDOR) and client-manipulated tenant headers.
- Evaluative integrity is compromised: taxonomy identifiers are stripped to null in the frontend, the Fit/Gap comparison table renders blank requirement columns due to payload key mismatches, candidate competencies are falsely auto-promoted to "covered" based on question count rather than demonstrated competence, and culture narratives are hallucinated from bare integer numbers without verbatim evidence quotes.

## Solution

A hardened, secure, and legally compliant end-to-end interview delivery platform that guarantees multi-tenant isolation, respects candidate privacy, provides natural voice conversational cadence, and delivers defensible, evidence-grounded skill evaluations.

From the user's perspective:
- Assessors and recruiters can seamlessly authenticate into their organization's tenant workspace and calibrate role evaluations with canonical taxonomy competencies.
- Candidates receive working interview links that open directly into a clean onboarding flow featuring mandatory UU PDP affirmative consent disclosures and an advisory connectivity health check with a soft bypass.
- During the interview, coordinated dual-gating prevents acoustic feedback loops while maintaining low-latency conversational cadence and clean audio transitions.
- Evaluators review defensible, evidence-grounded Fit/Gap reports where required levels display accurately, assessor overrides are visibly badged, discovered off-agenda skills are celebrated, and AI narratives quote actual candidate answers directly from the transcript.
- All candidate evaluations, transcripts, and overrides are cryptographically and query-isolated to the owning organization, eliminating cross-tenant data leakage.

## User Stories

1. As an assessor, I want to log in using my email and password with the `assessor` role, so that I can access my organization's dashboard without being blocked by admin-only restrictions.
2. As a platform administrator, I want authenticated users to be bound to a specific organization in the database, so that clients cannot spoof tenant schemes via request headers.
3. As a recruiter, I want generated candidate invite links to resolve directly to the frontend web application URL, so that candidates never encounter a 404 error when clicking their invitation.
4. As a candidate with an older or misdirected invite link pointing to the API port, I want the server to redirect me to the web application, so that my interview access is not broken.
5. As an Indonesian candidate, I want to be presented with a clear pre-flight consent modal detailing biometric voice processing, Gemini Live data usage, and my statutory rights under UU PDP No. 27/2022, so that I can provide informed, affirmative opt-in consent before my microphone is accessed.
6. As a candidate on a restricted corporate VPN or regional ISP, I want the pre-interview network test to verify latency against internal platform endpoints and provide a soft bypass, so that external CDN ping failures do not permanently lock me out of my interview.
7. As a candidate, I want the pre-interview hardware check to cleanly release all test media streams before the live interview begins, so that my browser does not suffer from audio deadlocks or autoplay policy blocks.
8. As a candidate, I want to click an explicit "Start Interview" button that initializes fresh live audio capture and playback contexts within a single user gesture, so that voice playback is unblocked on modern browsers.
9. As a candidate, I want the platform to use coordinated dual-gating during the interview, so that the AI's spoken words are not picked up by my microphone and looped back as echo.
10. As a candidate, I want the microphone gate to reopen promptly after the AI finishes speaking, so that I can answer questions without having my initial words cut off.
11. As an assessor monitoring a live interview, I want network hiccups during the voice session to recover transparently using session resumption tokens, so that candidates are not forced to restart their interview mid-session.
12. As an assessor configuring an assessment, I want to select skills from the standardized B7 taxonomy and have their canonical skill IDs preserved, so that role rubrics maintain taxonomic consistency.
13. As an assessor creating custom skills, I want to define role-specific competencies without taxonomy IDs, so that unique team requirements can be evaluated alongside standardized skills.
14. As an assessor reviewing an assessment, I want to delete unwanted skills from the edit page and have those deletions persist in the database, so that discarded competencies do not appear in candidate interviews.
15. As a candidate demonstrating competency, I want my skill coverage to advance to "covered" only when I provide affirmative proof of capability, so that my evaluation reflects actual merit rather than interviewer probe count.
16. As an assessor reviewing a candidate portfolio, I want portfolios generated from completed interviews to succeed reliably even if the AI model capitalizes confidence strings, so that enum mismatch database crashes do not destroy evaluation records.
17. As a hiring manager inspecting a Fit/Gap report, I want the "Required" column to display the calibrated target level for every skill, so that I can clearly evaluate whether the candidate meets role expectations.
18. As a hiring manager reading a Fit/Gap report, I want human assessor overrides to be prominently displayed with an override badge, so that I know when a human expert adjusted the AI's preliminary score.
19. As a candidate who demonstrates unprompted expertise in an off-agenda domain, I want my discovered skills to be included in the Fit/Gap report as bonus exceed dimensions, so that my full capability is recognized.
20. As a hiring manager reading the culture and overall narratives, I want the summary to cite specific verbatim quotes and competency summaries from the interview, so that hiring decisions are defensible and free from generic model hallucinations.
21. As an assessor, I want to submit score overrides with notes on individual candidate skills, so that human judgment remains authoritative over automated grading.
22. As an assessor exporting a candidate portfolio to PDF, I want candidate names with Indonesian diacritics and formatting to export cleanly, so that PDF generation never crashes on non-ASCII characters.
23. As an enterprise client administrator, I want candidate portfolios, transcripts, and Fit/Gap reports to be accessible strictly by authenticated assessors within my organization, so that competing companies cannot inspect our candidate records.
24. As an assessor, I want the system prompt for an assessment to be generated synchronously or verified before a session starts, so that candidates never start an interview with an empty instruction prompt.

## Implementation Decisions

### 1. Multi-Tenant Partitioning and Access Control
- **User Organization Binding**: The user model is updated to belong optionally to an organization. Allowed roles are expanded to include `admin`, `assessor`, and `user`. During authentication, the user's organization scheme is resolved directly from the authenticated record, ignoring client-provided tenant headers to eliminate cross-tenant impersonation.
- **Centralized Scoped Portfolio Finders**: All portfolio member actions across API controllers are scoped strictly through a tenant filter linked via session records (`Portfolio.for_tenant(Current.tenant_id)`). Direct unscoped finds by bare record ID are eliminated across all endpoints, ensuring IDOR safety.
- **Portfolio Skill Overrides Scoping**: Portfolio skill lookups in override controllers are scoped by joining through the parent portfolio and session to enforce tenant matching.
- **Assessor Role Authorization**: Authentication and API controllers allow the `assessor` role across all evaluation and management actions. Default assessor and administrator accounts are provided in development seeds.

### 2. Candidate Onboarding, Statutory Consent & Invite Resolution
- **Dual-Layer Invite URL Resolution**: Session invite URL generation is separated into dedicated web application origin configuration (`WEB_BASE_URL`), pointing candidates to the web application route. A server-side redirect fallback route is registered on the API host to transparently forward legacy links.
- **Pre-Flight UU PDP Affirmative Consent**: The candidate interview page renders a mandatory pre-flight disclosure modal before the hardware check. Candidates must check an affirmative opt-in confirming biometric voice streaming to cloud endpoints under Indonesian UU PDP No. 27/2022 before hardware access or network streaming is initialized.
- **Advisory Connectivity Check & Soft Bypass**: The hardware check network test measures latency and connectivity against internal platform health endpoints. When connection metrics fall below ideal thresholds, the candidate is presented with an advisory warning and a soft bypass option enabling them to proceed at their discretion.
- **Clean Audio Lifecycle Teardown**: All media streams and test audio context instances created during the hardware check are cleanly stopped and closed upon check completion. Fresh audio contexts are initialized inside the click handler of the "Start Interview" button with explicit resumption.

### 3. Audio Streaming, Gating & Upstream Resilience
- **Coordinated Dual-Gating**: Client microphone streaming is actively muted upon detecting AI audio output or receiving speaker change notifications. The backend delays opening the mic gate by a fixed buffer drain interval (0.8s) after model playback completes. The server-side audio forwarder drops incoming audio frames while the model is speaking, acting as an authoritative echo firestop.
- **Token Handshake Hygiene**: The candidate WebSocket URL retains the invite token query parameter for initial connection validation, while redundant post-connection authentication text frames are eliminated.
- **Session Resumption for Upstream Spikes**: The audio WebSocket connection persists the Gemini Live session resumption token. When network drops or upstream service spikes (503s) occur, the backend initiates reconnection with exponential backoff while notifying the client to maintain connection state.

### 4. Taxonomy Keying, Evidence Grounding & Rubric Integrity
- **Dual-Mode Skill Keying**: The skill picker retains canonical taxonomy identifiers (`skill_id`) when selecting standardized competencies from the B7 taxonomy. Custom user-defined skills retain a null identifier. The Fit/Gap comparison engine matches primarily on canonical skill IDs, falling back to case-insensitive label matching when evaluating custom skills.
- **Fit/Gap Payload Contract Alignment**: The Fit/Gap engine returns comparison records containing both `required_level` (for the web table) and `expected_level` (for API compatibility). Each comparison explicitly includes an `is_override` boolean flag. Discovered off-agenda skills are included in the comparison payload with exceed status.
- **Verbatim Evidence Grounding in Narratives**: The Fit/Gap narrative generator passes the candidate's top verbatim evidence quotes and competency summaries from the portfolio into the narrative prompt, instructing the model to ground culture and hiring summaries in observed facts.
- **Evidence-Gated Coverage Promotion**: The automatic advancement of partial skills based on probe count (`advance_stale_partials`) is removed. Coverage maps transition to "covered" strictly when the analyzer observes affirmative competency proof.
- **Portfolio Generation Enum Normalization**: Confidence strings returned by the evaluation model are lowercased and stripped before saving to PostgreSQL, preventing enum case-sensitivity crashes.

## Testing Decisions

### What Makes a Good Test
Tests must verify observable external behavior and contracts rather than internal implementation details:
- API tests must verify HTTP status codes, JSON payload keys, database state changes, and tenant isolation barriers without mocking internal controller private methods.
- Frontend tests must render components within their real contexts, simulate user clicks and form submissions, and assert visible DOM elements, error states, and network payloads.
- Integration tests must verify the seam between services: ensuring payload keys emitted by the backend exactly match the keys expected by frontend components.

### Modules to Test & Seams
1. **API Authentication & Tenant Boundary (Highest HTTP Seam)**:
   - Request spec verifying login with `assessor` role succeeds and returns valid JWT.
   - Request spec verifying that an authenticated assessor in Tenant A receives a 404 when attempting to fetch, override, or export a portfolio belonging to Tenant B.
   - Request spec verifying that passing an arbitrary `X-Tenant-Scheme` header during login does not grant access to another tenant's schema.
2. **Fit/Gap Contract & Rubric Engine (Service & Request Seam)**:
   - Engine spec verifying that skill comparisons return both `required_level` and `expected_level`, include `is_override`, and surface discovered skills.
   - Request spec verifying that `GET /api/v1/portfolios/:id/fitgap/:vacancy_id` returns the aligned JSON payload.
   - Worker spec verifying that `CoverageAnalyzerWorker` never auto-advances partial skills based on probe count alone.
3. **Frontend Fit/Gap Table & Skill Picker (Component DOM Seam)**:
   - Component test verifying that `ComparisonTable` renders non-empty level badges in the "Required" column and displays override indicators when `is_override` is true.
   - Component test verifying that `SkillPicker` preserves `s.skill_id` upon selecting standard B7 competencies.
4. **Onboarding & Audio Lifecycle (Integration Seam)**:
   - Component test verifying that the pre-flight consent modal requires an affirmative checkbox before enabling the Hardware Check.
   - Utility test verifying that the internet speed test measures latency against internal endpoints and allows a soft bypass on slow connections.

### Prior Art in Codebase
- Backend request specs in `api/spec/requests/api/v1/authentication_spec.rb` and `api/spec/requests/api/v1/portfolios_spec.rb`.
- Frontend characterization tests in `web/src/test/components/fitgap/ComparisonTable.test.tsx` and `web/src/test/components/assessment/SkillPicker.test.tsx`.

## Out of Scope

- Video recording or camera proctoring (the platform is strictly voice-to-voice audio).
- Multi-region database replication or cross-datacenter failover.
- Third-party applicant tracking system (ATS) bi-directional synchronization (e.g. Greenhouse, Workday).
- Full candidate portal authentication and password management (candidate access is managed via secure single-use invite tokens).

## Further Notes

- All changes adhere strictly to the project domain vocabulary codified in `CONTEXT.md` and ratified Architectural Decision Records (`ADR 0001` through `ADR 0009`).
- Database migrations must be tested for rollback safety and compatibility with PostgreSQL 15 multi-schema search paths (`public` and `ai_interview`).

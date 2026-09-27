# End-to-End Workflow Audit & Forensic Gap Analysis
## Current Implementation Flaws vs. Ideal Product Condition

**Service / Scope**: `ai-interview-platform` (`api/` Ruby on Rails 7 + `web/` React 18 / TypeScript + PostgreSQL 15 + WebSocket Fabric)  
**Deliverable Type**: Written Analysis & Forensic Workflow Audit  
**Target Directory**: `assessment/`  
**Compliance Baseline**: Republic of Indonesia Law No. 27 of 2022 on Personal Data Protection (*Undang-Undang Pelindungan Data Pribadi* / UU PDP)  
**Primary References**: [PRD-01](file:///Users/fahimj/Developer/Learning/ai-interview-platform/tech-docs/PRD-01.md), [PRD-02](file:///Users/fahimj/Developer/Learning/ai-interview-platform/tech-docs/PRD-02.md), [tech-docs/README.md](file:///Users/fahimj/Developer/Learning/ai-interview-platform/tech-docs/README.md), [CONTEXT.md](file:///Users/fahimj/Developer/Learning/ai-interview-platform/CONTEXT.md), [docs/adr/](file:///Users/fahimj/Developer/Learning/ai-interview-platform/docs/adr/)

---

## 1. Executive Summary & The Core Problem

### 1.1 The Core Problem
The product exists to deliver **objective, high-fidelity, defensible skill evaluations at scale**, resolving the acute talent bottleneck in Southeast Asia’s digital economy. In Indonesia, hiring teams are overwhelmed by hundreds of unvetted, bootcamp-templated CVs, while senior engineering leads lose 15–20 hours every week conducting repetitive, low-signal initial screening calls. 

The core algorithmic differentiator of the platform—the real-time adaptive coverage loop (`N7` analyzer → `N8` contextual injection → `StateEngine` hard-gates)—is technically capable. **However, that value can never reach real users, and even if an interview were manually forced through, the surrounding system would leak confidential data, fabricate unearned competency ratings, misrender hiring rubrics, and operate in direct violation of Indonesian federal privacy laws.**

Concretely, the platform suffers from an **end-to-end breakdown across all five core workflows**:
1. **Access & Onboarding Paralysis**: An assessor cannot register, default users do not exist in the database, and any invite link generated for a candidate points to the backend API (`http://localhost:3001`), handing candidates an immediate HTTP 404 Routing Error instead of the interview web app.
2. **Critical Legal & Regulatory Exposure (UU PDP No. 27/2022)**: The platform captures, transmits, and processes Indonesian citizens' biometric voice data via US-based cloud endpoints without statutory affirmative opt-in consent, clear purpose disclosures, retention bounds, or candidate erasure rights.
3. **Severe Multi-Tenant Data Leakage (IDOR)**: Portfolio, skill evaluation, override, and PDF export endpoints lack tenant authorization scopes. Any authenticated user in Tenant A can inspect, override, and download candidate evaluations and transcripts from Tenant B.
4. **Compromised Conversational Cadence (Half-Duplex Gating)**: Decoupled browser `AudioContext` instances break native Acoustic Echo Cancellation (AEC), forcing an artificial server/client mute gate that makes candidate interruptions impossible and converts what should be an organic conversation into an unnatural, turn-taking interrogation.
5. **Taxonomic Disconnection & Hallucinatory Output**: Candidate skills lose their taxonomic IDs (`skill_id`) in the UI picker; Fit/Gap comparisons render blank requirement levels due to a contract mismatch (`required_level` vs `expected_level`); discovered off-agenda skills are dropped from evaluation; and Fit/Gap narrative generation receives zero competency summaries or quotes from the portfolio, inventing culture narratives purely from raw integer deltas.

### 1.2 The Gap in One Paragraph
The gap is not a missing feature; it is a **missing production skeleton around an AI engine**. While the adaptive dialogue model and Gemini WebSocket proxies are wired, the surrounding infrastructure—*user onboarding, candidate delivery, multi-tenant isolation, statutory privacy governance, and rubric presentation*—is either absent, inverted, or silently corrupted. Until P0 blockers are resolved, the platform delivers **negative enterprise value**: it captures protected personal data it is not legally entitled to hold and cannot demonstrate a single completed, defensible evaluation.

---

## 2. Live Database & API Payload Verification

Direct forensic inspection of the live PostgreSQL database (`rakamin_development`) and API endpoints reveals conclusive evidence of a system that has never survived first contact with a real user:

| Table (`ai_interview` schema) | Live Count | Inspection Signal & Forensic Reality |
| :--- | :---: | :--- |
| `users` | **1** | Only 1 user exists (`audit@example.com`, role `admin`). Non-admin assessors and recruiters cannot log in. No `tenant_id` column exists on the `users` table. |
| `organizations` (`public`) | **1** | Single tenant (`Test Corp`, id=1). Tenant schema resolution is client-controlled via arbitrary headers. |
| `skill_taxonomies` | **22** | B7 taxonomy reference data is seeded correctly with standardized anchors (L1–L5). |
| `assessments` | **1** | ID 1 (`senior frontend engineer`, tenant_id=1). References `created_by=1` with **no foreign key constraint**. |
| `assessment_skills` | **1** | **`skill_id` is literally `NULL`** despite `is_custom=false`, proving that the frontend `SkillPicker` stripped the taxonomy identifier upon selection. |
| `sessions` | **1** | ID 1 (`candidate_name='budi'`) stuck in `pending` status. `candidate_id` is `NULL` (no `candidates` table exists). Invite URL points to port 3001. |
| `coverage_maps` | **0** | `StartHandler` never ran; session was never activated over WebSockets. |
| `transcript_turns` | **0** | Zero dialogue turns recorded; no interview has ever occurred. |
| `portfolios` / `portfolio_skills` | **0 / 0** | No candidate evaluation portfolio has ever been synthesized. |
| `vacancies` / `vacancy_skills` | **0 / 0** | No vacancies exist; Fit/Gap comparisons cannot be executed out of the box. |
| `fit_gap_reports` | **0** | No role-candidate comparison report has ever been produced. |

**Database Verdict**: The database proves that the installed platform has never completed—or even started—a real interview. The only assessment references a non-existent user, its skill identifier was stripped to `NULL`, and the single candidate session is stranded in `pending`.

---

## 3. End-to-End Workflow Walk: Intended vs. Current vs. Ideal State

```
┌─────────────────────────┐      ┌─────────────────────────┐      ┌─────────────────────────┐      ┌─────────────────────────┐      ┌─────────────────────────┐
│  1. Calibration Setup   │ ───► │ 2. Candidate Onboarding │ ───► │  3. Live Audio Probing  │ ───► │ 4. Portfolio Generation │ ───► │ 5. Fit/Gap & Dossier    │
│  (Recruiter / Assessor) │      │  (Candidate Experience) │      │ (Candidate & AI Engine) │      │ (Post-Session Synthesis)│      │ (Assessor & Hiring Mgr) │
└─────────────────────────┘      └─────────────────────────┘      └─────────────────────────┘      └─────────────────────────┘      └─────────────────────────┘
```

### Phase 1: Calibration & Assessment Setup
* **Intended**: Recruiter or Assessor logs in, selects a role profile from calibrated vacancies, selects target skills from the B7 taxonomy (which retains `skill_id`), sets expected levels (L1–L5), and generates an assessment. Sidekiq compiles the Gemini Live system instructions, and an invite link pointing to the candidate web portal is generated.
* **Current**: Non-admins cannot log in (401 Unauthorized); new orgs cannot register (404 on `/signup`); `SkillPicker` explicitly strips `skill_id` to `undefined`; assessment creation claims `system_prompt_generated: true` while the Sidekiq job is still queued; vacancies and assessments are completely disconnected; and the generated invite link points to `http://localhost:3001/interview/:token` (the Rails API).
* **Ideal**: Seamless registration and role-based access; 1-click vacancy-to-assessment calibration; immutable B7 skill taxonomy IDs preserved; synchronous prompt generation (<5ms); and dual-layer invite URL resolution pointing to the web origin (`WEB_APP_BASE_URL`).

### Phase 2: Candidate Onboarding & Hardware Check
* **Intended**: Candidate opens the invite link on their mobile or desktop browser. A non-punitive hardware check verifies mic input, PCM levels, and network connectivity against internal endpoints. A mandatory, unobstructed UU PDP consent disclosure informs the candidate of biometric voice processing and AI evaluation, requiring affirmative opt-in before proceeding.
* **Current**: Candidate opens link and hits a Rails 404 RoutingError. If manually rewritten to port 5173, the candidate is subjected to a hardware check that pings external CDNs (`jsdelivr`, `unpkg`, `google.com`) and attempts an upload to `httpbin.org`. If firewall/VPN blocks these, the candidate is permanently locked out with no bypass. If they pass, they are presented with 4 passive bullet points with **zero affirmative consent**, capturing biometric audio in direct violation of Indonesian law.
* **Ideal**: Instant frontend page load; non-blocking advisory connectivity check measuring latency and jitter against `/api/v1/health` with a soft bypass; explicit affirmative UU PDP opt-in checkbox logging IP, timestamp, and policy version; and clean AudioContext initialization.

### Phase 3: Live Conversational Probing & Steering
* **Intended**: Bidirectional, full-duplex 16kHz audio dialogue over WebSockets. Gemini Live and the candidate speak naturally with sub-1.5s latency. The candidate can interrupt the AI at any time. The adaptive coverage engine (`N7`) tracks competency evidence across 6-turn windows, injecting steering instructions (`N8`) without abruptly cutting off the candidate.
* **Current**: Audio capture and playback are split into two separate `AudioContext` instances (16kHz capture, 24kHz playback), breaking browser AEC and forcing a strict half-duplex mute gate. The candidate is muted while the AI speaks and cannot interrupt. If a skill has 4 probes and slides outside the 6-turn context window, `advance_stale_partials` unconditionally marks it "covered" regardless of candidate performance. If network drops, `AudioRingBuffer` is dead and unreferenced, dropping frames permanently.
* **Ideal**: Single unified `AudioContext` with native Acoustic Echo Cancellation (AEC); full-duplex conversational flow with organic candidate interruption; evidence-based promotion requiring demonstrated competency; and persistent session resumption with ring-buffer frame replay.

### Phase 4: Portfolio Generation & Skill Synthesis
* **Intended**: Post-interview background job (`N10`) passes the complete transcript and coverage signals to Gemini Pro, producing an evidence-backed skill portfolio with L1–L5 ratings, 2–3 verbatim quote citations per skill, confidence ratings, and unprompted off-agenda discoveries.
* **Current**: If a candidate joins but says nothing, the generator executes against an empty transcript, hallucinating ratings from thin air. If Gemini returns `"High"` instead of `"high"`, PostgreSQL throws an unhandled enum type crash (`invalid input value for enum confidence_level`). Generated portfolio records carry no `tenant_id`, and `set_portfolio` queries `Portfolio.find(params[:id])` with zero tenant scoping.
* **Ideal**: Guard clause rejecting zero-turn transcripts; robust enum normalization (`.to_s.downcase.strip`); strict tenant scoping on all portfolio queries; and verified quotation validation linking evidence directly to turn timestamps.

### Phase 5: Fit/Gap Evaluation, Overrides & Executive Dossier
* **Intended**: Hiring managers review the candidate portfolio matched against the target vacancy. A comparison table displays required vs demonstrated levels with visual gap/exceed badges and human override markers. Gemini generates an executive narrative citing specific interview evidence and quotes. Assessors can override ratings with written notes. A defensible PDF dossier can be exported for executive review.
* **Current**: The "Required" column renders completely **BLANK** because the API emits `expected_level` while the React component expects `required_level`. Assessor override pencil icons never display because `is_override` is omitted from the API payload. Discovered off-agenda skills are completely dropped from the report. Gemini writes culture narratives from bare integer deltas without receiving a single quote or competency summary. Overrides can be applied cross-tenant via IDOR. Non-ASCII Indonesian candidate names crash the Prawn PDF generator.
* **Ideal**: Flawless payload contract alignment; prominent representation of discovered competencies; evidence-grounded culture narratives; cryptographically isolated tenant authorization; and localized UTF-8 PDF exports.

---

## 4. Comprehensive Findings Register (P0 to P3)

### Priority P0: Critical Blockers & Security/Compliance Violations
*Flaws that immediately halt real-world operations, leak protected candidate data, or violate federal statutes.*

| ID | Service Area | Type | Title & One-Line Impact Statement | Key Evidence & Root Cause |
| :--- | :--- | :--- | :--- | :--- |
| **P0-1** | `api/` -> `web/` | **DEFECTIVE IMPL** | **Candidate Invite Links Point to API Host Causing 404 Routing Error.**<br>*Impact*: Candidates receiving an assessment link click into an immediate Rails 404 RoutingError, completely blocking the interview before onboarding begins. | `api/app/models/session.rb:28-31`, `api/config/application.yml:18`, `api/config/routes.rb`, `web/src/App.tsx:57`. `Session#invite_url` defaults to `APP_BASE_URL` (`http://localhost:3001`), which has no `/interview/:token` route. |
| **P0-2** | `api/` & `web/` | **MISSING SPEC + DEFECTIVE IMPL** | **Total Absence of Affirmative Consent for Biometric Audio (UU PDP Violation).**<br>*Impact*: Capturing and streaming candidate voice biometrics to US cloud endpoints without lawful affirmative consent violates Indonesian Law No. 27/2022 (Arts. 20, 22, 27), exposing the company to regulatory shutdown and criminal liability. | `web/src/pages/interview/InterviewPage.tsx:203-210`, `web/src/components/HardwareCheck.tsx`, DB schema. The UI shows passive informational bullets with no opt-in checkbox, no privacy disclosure, and no audit trail. |
| **P0-3** | `api/` | **DEFECTIVE IMPL** | **Multi-Tenant IDOR and Data Leakage Across Portfolios, Overrides, and Exports.**<br>*Impact*: An authenticated assessor in Tenant A can inspect, override, and download confidential candidate evaluations and transcripts belonging to Tenant B by simply altering the record ID in the API URL. | `api/app/controllers/api/v1/portfolios_controller.rb:82, 104, 156`, `api/app/controllers/api/v1/portfolio_skills_controller.rb:51`, `api/app/models/portfolio.rb`. Models lack `TenantScoped`, tables lack `tenant_id`, and controllers call unscoped `find(params[:id])`. |
| **P0-4** | `api/` & `web/` | **MISSING SPEC + DEFECTIVE IMPL** | **Authentication Deadlock: Missing `/signup` Route, Admin-Only Login, and Client-Controlled Tenant Scheme.**<br>*Impact*: New assessors cannot register (404 on `/signup`), non-admin staff are rejected with 401 Unauthorized, and tenant scheme is client-controlled via arbitrary headers. | `web/src/services/auth.ts:16`, `api/config/routes.rb`, `api/app/controllers/api/v1/authentication_controller.rb:14, 24-28`, `api/app/auth/authorize_api_request.rb:33`. Line 14 strictly requires `role == 'admin'`, and `users` has 0 seeded assessors. |
| **P0-5** | `api/` | **DEFECTIVE IMPL** | **Thread-Unsafe Singleton Error Caching in `AuthTokenMiddleware`.**<br>*Impact*: A single failed authentication attempt permanently poisons the Rack middleware instance with `@error`, persistently rejecting all subsequent requests handled by that worker thread. | `api/app/middlewares/auth_token_middleware.rb:21-27, 40-48`. `capture_error` assigns to instance variable `@error` on a singleton Rack middleware without ever clearing it between requests. |

---

### Priority P1: Major Functional & Evaluative Distortions
*Flaws that permit the system to run but compromise evaluation validity, corrupt rubric data, or lock out valid candidates.*

| ID | Service Area | Type | Title & One-Line Impact Statement | Key Evidence & Root Cause |
| :--- | :--- | :--- | :--- | :--- |
| **P1-1** | `api/` <-> `web/` | **DEFECTIVE IMPL** | **Frontend-Backend Contract Mismatch in Fit/Gap Table Payload.**<br>*Impact*: The Fit/Gap report renders the "Required" column completely blank and never displays human override badges because the frontend expects `required_level` and `is_override` while the API emits `expected_level` and omits the override flag. | `api/app/services/fit_gap/engine.rb:58-66` vs `web/src/components/fitgap/ComparisonTable.tsx:50, 56` and `web/src/types/index.ts:130-137`. Frontend evaluates `LEVEL_LABELS[c.required_level]` which is `undefined`. |
| **P1-2** | `web/` -> `api/` | **DEFECTIVE IMPL** | **`SkillPicker` Explicitly Strips Taxonomy `skill_id` to `undefined`.**<br>*Impact*: Standardized B7 taxonomy identifiers (`SK-ENG-001`) are destroyed upon selection and saved as `NULL` in the database, forcing the entire platform to rely on fragile string matching across vacancies and assessments. | `web/src/components/assessment/SkillPicker.tsx:41`, `web/src/pages/vacancies/VacancyNewPage.tsx:142`, `web/src/pages/assessments/AssessmentNewPage.tsx:95-98`, DB `ai_interview.assessment_skills.skill_id`. |
| **P1-3** | `api/` | **DEFECTIVE IMPL** | **Turn-Starvation False Auto-Promotion (`advance_stale_partials`).**<br>*Impact*: Candidates receive unearned "covered" ratings because skills with >= 4 probes that slide outside the 6-turn context window are auto-promoted without checking whether the candidate demonstrated competence. | `api/app/workers/coverage_analyzer_worker.rb:84-101`. Auto-promotion is based purely on probe count (>4) when older turns fall outside `TURNS_CONTEXT = 6`. |
| **P1-4** | `api/` & `web/` | **MISSING SPEC + DEFECTIVE IMPL** | **Complete Exclusion of Discovered (Off-Agenda) Skills from Fit/Gap Reports.**<br>*Impact*: High-leverage unprompted skills demonstrated by candidates (e.g., distributed caching, micro-frontends) receive zero credit in the final Fit/Gap analysis and PDF summary. | `api/app/services/fit_gap/engine.rb:40-44`. `build_skill_comparisons` strictly maps over `vacancy_skills`, completely omitting `portfolio_skills.select { |s| s[:is_discovered] }`. |
| **P1-5** | `api/` | **DEFECTIVE IMPL** | **Hallucinatory Culture & Fit Narrative Generation from Raw Integer Deltas.**<br>*Impact*: Hiring managers make critical hiring decisions based on an AI narrative fabricated from bare integer numbers without the model ever receiving candidate competency summaries or verbatim evidence quotes. | `api/app/services/fit_gap/engine.rb:111-139`. `build_narrative_prompt` passes only raw delta counts and level numbers (`React (L3)`, `delta -2`), passing 0 quotes and 0 interview summaries. |
| **P1-6** | `web/` | **DEFECTIVE IMPL** | **Hard External Dependency on Third-Party CDNs in Speed Test Gate.**<br>*Impact*: Candidates with corporate VPNs, firewall restrictions, or regional Indonesian bandwidth constraints fail the hardware check and are permanently locked out without a bypass option. | `web/src/utils/internetSpeedTest.ts:38-53`, `web/src/components/HardwareCheck.tsx:55`. Relies on `jsdelivr`, `unpkg`, and `httpbin.org` rather than internal endpoints, while `/api/v1/speed_test` sits unused. |
| **P1-7** | `api/` | **DEFECTIVE IMPL** | **PostgreSQL Enum Case-Sensitivity Crash in Portfolio Generation.**<br>*Impact*: An entire completed candidate interview fails portfolio creation with a fatal database exception if Gemini returns a capitalized confidence string (`"High"` instead of `"high"`). | `api/app/services/portfolios/generator.rb:162`, DB `ai_interview.confidence_level`. PostgreSQL enum requires exact lowercase strings `{high,medium,low}` and lacks normalization before `create!`. |
| **P1-8** | `api/` | **DEFECTIVE IMPL** | **Unchecked `audio_complete` Force-Termination Without State Revalidation.**<br>*Impact*: Any holder of an invite token can terminate an active interview prematurely via an unauthenticated HTTP POST, bypassing WebSocket state machine safeguards. | `api/app/controllers/api/v1/sessions_controller.rb:118-129`. `audio_complete` immediately transitions `session.update!(status: 'ended')` without validating active audio stream state. |

---

### Priority P2: Workflow Impairment & Architectural Debt
*Flaws that cause operational friction, create data sync problems, or degrade conversational naturalness.*

| ID | Service Area | Type | Title & One-Line Impact Statement | Key Evidence & Root Cause |
| :--- | :--- | :--- | :--- | :--- |
| **P2-1** | `web/` & `api/` | **DEFECTIVE IMPL + ARCH DEBT** | **Decoupled Dual `AudioContext` Enforcing Artificial Half-Duplex Mute Gating.**<br>*Impact*: Candidates are strictly barred from interrupting the AI interviewer because separate audio capture (16kHz) and playback (24kHz) contexts break browser AEC, forcing an artificial mute gate. | `web/src/hooks/useAudioCapture.ts:26`, `web/src/hooks/useAudioPlayback.ts:13`, `web/src/pages/interview/InterviewPage.tsx:167-170`. Mute gate starts muted and only un-mutes upon server speaker event. |
| **P2-2** | `api/` | **DEFECTIVE IMPL + ARCH DEBT** | **`RequestStore::Middleware` Never Mounted in Puma Stack.**<br>*Impact*: Multi-tenant request state (`Current.tenant_id`) leaks across requests on pooled Puma worker threads, causing silent cross-tenant data contamination. | `api/config/initializers/request_store.rb:4`, `api/config/application.rb:49-51`. Autoload statement in initializer does not insert middleware into `config.middleware.use`. |
| **P2-3** | `api/` | **DEFECTIVE IMPL** | **False Synchronous Reporting of Asynchronous System Prompt Generation.**<br>*Impact*: The assessment creation endpoint immediately reports `system_prompt_generated: true` while the background Sidekiq job is still queued, creating a race condition for immediate candidate launches. | `api/app/controllers/api/v1/assessments_controller.rb:33-34`. Returns `system_prompt_generated: true` before `SystemPromptGeneratorWorker` has even dequeued. |
| **P2-4** | `web/` -> `api/` | **DEFECTIVE IMPL** | **Inability to Delete Skills in Assessment Edit Screen.**<br>*Impact*: Assessors attempting to delete a skill in the edit UI find that changes are silently ignored because array removal fails to pass the required `_destroy: true` nested attribute to Rails. | `web/src/pages/assessments/AssessmentEditPage.tsx:72-88`. Omitting skills from array does not delete existing database records in `accepts_nested_attributes_for`. |
| **P2-5** | `api/` | **MISSING IMPL** | **Dead `AudioRingBuffer` and Unwired Session Replay.**<br>*Impact*: Audio frames dropped during network jitter are permanently lost, and the advertised reconnection replay capability is non-existent. | `api/app/lib/audio_ring_buffer.rb`. 0 references across the entire repository. Ring buffer exists as dead code. |
| **P2-6** | `api/` & `web/` | **MISSING SPEC** | **Orphaned Candidate Identity and Disconnected Vacancy Models.**<br>*Impact*: Recruiters cannot track candidate email addresses, resumes, or historical performance across vacancies because candidate data is stored only as a detached string in `sessions`. | `api/db/schema.rb:136`, `api/app/models/session.rb`. No `candidates` table; assessments and vacancies are completely disconnected entities. |
| **P2-7** | `api/` | **ARCH DEBT** | **Unmanaged Thread Spawning (`Thread.new`) for Database Writes inside EventMachine.**<br>*Impact*: Under concurrent interview load, unmanaged threads rapidly exhaust the PostgreSQL connection pool, dropping active WebSocket sessions. | `api/app/channels/audio_websocket_middleware.rb:184, 234, 314, 505, 601, 688`. Raw threads spawned without connection pool management or transaction safety. |

---

### Priority P3: Interface Polish & Seam Hygiene
*Minor inconsistencies, styling flaws, or lack of automated testing infrastructure.*

| ID | Service Area | Type | Title & One-Line Impact Statement | Key Evidence & Root Cause |
| :--- | :--- | :--- | :--- | :--- |
| **P3-1** | `api/` <-> `web/` | **DEFECTIVE IMPL** | **Type Seam Mismatch on `ai_level` (Integer vs String).**<br>*Impact*: Fragile runtime parsing is required in UI components (`parseInt(skill.ai_level)`) to prevent `NaN` badge rendering. | `web/src/types/index.ts:93`, `api/app/controllers/api/v1/portfolios_controller.rb:181`. Serialization formats fluctuate between integer and string across endpoints. |
| **P3-2** | `web/` | **DEFECTIVE IMPL** | **Dead `{ data: }` Envelope Interceptor in Axios Client.**<br>*Impact*: Two response envelope conventions coexist, creating maintenance confusion and type brittleness. | `web/src/services/api.ts:24`, `api/app/controllers/concerns/response.rb:17`. Unwrapping interceptor fails on raw non-enveloped responses. |
| **P3-3** | `api/` <-> `web/` | **DEFECTIVE IMPL** | **Speaker Identity Drift (`ai` vs `assessor`).**<br>*Impact*: Transcripts and coverage logs alternate between `ai` and `assessor`, risking UI rendering glitches in live monitors. | `web/src/hooks/useAudioWebSocket.ts:73`, `api/app/models/transcript_turn.rb`. Labels drift across WebSocket and REST endpoints. |
| **P3-4** | `api/` | **ARCH DEBT** | **Missing Foreign Key Constraints on `created_by` Columns.**<br>*Impact*: Orphaned records are permitted in `assessments` and `vacancies`, as seen in the seeded database with dangling `created_by=1`. | `api/db/schema.rb:25, 175`. Columns are bare `bigint` without `add_foreign_key :assessments, :users, column: :created_by`. |
| **P3-5** | `api/` | **DEFECTIVE IMPL** | **Non-ASCII / Indonesian Idiom Prawn PDF Encoding Exceptions.**<br>*Impact*: Executive PDF exports crash when encountering candidates with Indonesian accented names or local formatting. | `api/app/services/exports/pdf_generator.rb`. Built-in Prawn fonts lack full UTF-8 glyph support; requires explicit TrueType font embedding. |

---

## 5. Constraint Signals: Technical Lead Escalation Matrix

The following items represent **critical architectural debt, legal vulnerabilities, or blocking risks** that must be escalated immediately to a Technical Lead prior to production hardening:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       TECHNICAL LEAD ESCALATION SIGNALS                                              │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. [CS-1 BLOCKING] Multi-Tenant Architecture: Missing User-Org Binding & Unscoped Child Entities                    │
│ 2. [CS-2 BLOCKING] Regulatory Exposure: Non-Compliance with Indonesian UU PDP No. 27/2022 Biometric Consent        │
│ 3. [CS-3 AMBIGUITY] Protocol Architecture: Broken Candidate URL Resolution & Session Start Ownership                 │
│ 4. [CS-4 DEBT] Audio Runtime: Decoupled Dual AudioContext & Unmanaged DB Threads in EventMachine                      │
│ 5. [CS-5 AMBIGUITY] Evaluation Integrity: Dropped Canonical Taxonomy Keys vs. Free-Form Text Matching                │
│ 6. [CS-6 DEBT] Database Multi-Tenancy: Fragility of Public vs ai_interview Schema Separation                          │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### CS-1 (BLOCKING): Multi-Tenant Isolation & User-Org Membership
* **Escalation**: Multi-tenant data isolation is not enforceable in the current data model. `users` has no `organization_id` or `tenant_id`; the tenant scheme is accepted from an untrusted client header (`X-Tenant-Scheme`); and child entities (`portfolios`, `fit_gap_reports`, `assessor_overrides`) lack tenant scoping.
* **Risk**: Enterprise B2B customers cannot legally or commercially adopt a platform where Company A can scrape Company B’s candidate evaluations. Patching individual controllers with manual joins is fragile and error-prone.
* **Lead Decision Needed**: Approve formal data model migration adding `tenant_id` to all child tables, establishing a strict `users_organizations` membership join table, and enforcing tenant scoping via `TenantScoped` default scopes or PostgreSQL Row-Level Security (RLS).

### CS-2 (BLOCKING): Statutory Indonesian UU PDP No. 27/2022 Compliance
* **Escalation**: The platform streams biometric voice data to Google Gemini Live (US cloud infrastructure) without affirmative consent, purpose specification, retention bounds, or erasure mechanisms. Under UU PDP Arts. 20, 22, 27, and 67, processing biometric data without explicit affirmative opt-in constitutes an administrative and criminal offense punishable by fines up to 2% of annual revenue and operational shutdown.
* **Risk**: High-profile regulatory audit or candidate complaint to the Indonesian Data Protection Authority (*Lembaga Pengawas PDP*) resulting in platform suspension.
* **Lead Decision Needed**: Sign off on a mandatory, client-side pre-flight affirmative consent modal (`ADR 0001` / `ADR 0003`), a backend consent audit table (`consent_logs`), and a data retention / erasure policy.

### CS-3 (AMBIGUITY): Dual-Layer Invite URL Resolution & Session Activation Ownership
* **Escalation**: `Session#invite_url` points to `APP_BASE_URL` (`localhost:3001`), returning 404. Furthermore, session lifecycle ownership is ambiguous: PRD-02 specifies that sessions transition to `active` upon WebSocket connection, but `sessions_controller.rb` also defines an unauthenticated `audio_complete` HTTP endpoint that can force-terminate an interview.
* **Risk**: Candidate onboarding fails completely; race conditions occur between WebSocket audio streams and out-of-band HTTP termination calls.
* **Lead Decision Needed**: Mandate architectural separation of `API_BASE_URL` from `WEB_APP_BASE_URL` (`ADR 0004`), implement a Rails redirect fallback for legacy links, and establish the WebSocket connection as the single source of truth for session activation and termination.

### CS-4 (ARCHITECTURAL DEBT): Audio Runtime & Unmanaged Concurrency
* **Escalation**: Browser audio capture (16kHz) and playback (24kHz) run on separate `AudioContext` instances, destroying Acoustic Echo Cancellation (AEC) and forcing half-duplex mute gating (`ADR 0005`). On the backend, `AudioWebSocketMiddleware` spawns unmanaged `Thread.new` instances for database writes inside the EventMachine reactor.
* **Risk**: The core value proposition—natural, adaptive conversational dialogue with interruption capability—is technically impossible under half-duplex gating. Under production concurrency (e.g. 50 simultaneous interviews), unmanaged threads will exhaust the database connection pool, crashing active sessions.
* **Lead Decision Needed**: Authorize refactoring `useAudioCapture` and `useAudioPlayback` to share a single `AudioContext` with linear downsampling, and replace unmanaged backend threads with a bounded Concurrent Ruby thread pool or asynchronous Redis batch writer.

### CS-5 (AMBIGUITY): Canonical Taxonomy Keys vs. Fragile String Matching
* **Escalation**: `SkillPicker` explicitly strips `s.skill_id` upon selection, setting it to `undefined` and saving `NULL` to PostgreSQL. Downstream services (Fit/Gap engine, PDF generator, and coverage analyzer) fall back to case-insensitive string matching on `skill_label`.
* **Risk**: Assessors cannot rename or tweak skill labels without severing historical comparisons. Minor typos or variations between vacancies and assessments break Fit/Gap calculations and result in phantom "not_assessed" ratings.
* **Lead Decision Needed**: Enforce immutable canonical taxonomy keys (`SK-ENG-001`) as mandatory foreign keys across `assessment_skills`, `vacancy_skills`, and `portfolio_skills`, treating `skill_label` strictly as a mutable display label.

### CS-6 (ARCHITECTURAL DEBT): Multi-Schema Separation (`public` vs `ai_interview`)
* **Escalation**: `organizations` lives in the `public` schema, while all other entities live in the `ai_interview` schema. When running `db:schema:load` or setting up automated CI test environments, schema search paths fail unless manually configured.
* **Risk**: Fragile migrations, broken CI/CD pipelines, and unpredictable search path errors on fresh container deployments.
* **Lead Decision Needed**: Consolidate database migrations under a unified schema management strategy or formalize the multi-schema search path in `database.yml`.

---

## 6. Actionable Hardening Roadmap

### Phase 1: Operational Unblockers & Security Triage (Immediate)
1. **Fix Candidate Route**: Update `Session#invite_url` to use `WEB_BASE_URL` (`http://localhost:5173`), and add a Rails redirect route on `/interview/:token` to forward legacy links to the frontend.
2. **Implement UU PDP Consent**: Add the mandatory pre-flight affirmative consent modal in `InterviewPage.tsx` before hardware initialization, logging opt-in metadata to the backend.
3. **Enforce Tenant Scoping**: Scope all portfolio, override, and fit/gap queries via `Session.joins(:portfolio).where(sessions: { tenant_id: Current.tenant_id })`.
4. **Fix Authentication & Seed Data**: Add `/api/v1/auth/signup`, permit `role: 'assessor'` in `AuthenticationController`, seed default assessor accounts, and remove singleton `@error` mutation in `AuthTokenMiddleware`.

### Phase 2: Rubric Integrity & Evaluation Fidelity (Short-Term)
1. **Preserve Taxonomy IDs**: Fix `SkillPicker.tsx` to retain `skill_id: s.skill_id`, ensuring non-null foreign keys in `assessment_skills` and `vacancy_skills`.
2. **Align Fit/Gap Contracts**: Harmonize the backend payload to return `required_level` (aliasing `expected_level`) and explicitly include `is_override: override.present?`.
3. **Incorporate Evidence into Narratives**: Pass candidate competency summaries and verbatim transcript quotes into `FitGap::Engine#build_narrative_prompt` to eliminate LLM hallucinations.
4. **Include Discovered Skills**: Update `FitGap::Engine#build_skill_comparisons` to include discovered competencies as bonus evaluation dimensions.
5. **Fix Starvation Promotion**: Remove unconditional auto-advance in `CoverageAnalyzerWorker#advance_stale_partials`, requiring explicit evidence of competency before promoting to `covered`.
6. **Normalize Enums**: Lowercase and validate all `ai_confidence` strings before persistence in `Portfolios::Generator`.

### Phase 3: Conversational Cadence & Platform Refinement (Medium-Term)
1. **Full-Duplex Audio Engine**: Refactor Web Audio to a single `AudioContext`, restoring browser Acoustic Echo Cancellation and enabling natural candidate interruptions.
2. **Internalize Speed Test**: Point `internetSpeedTest.ts` to `/api/v1/speed_test` and implement an advisory soft bypass for bandwidth constraints.
3. **Model First-Class Candidates**: Introduce a `candidates` table linking application history, email addresses, and consent audit records across vacancies.
4. **Bounded Backend Concurrency**: Replace unmanaged `Thread.new` database writes in `AudioWebSocketMiddleware` with a pooled batch processor.
5. **Synchronous Prompt Generation**: Compile Gemini system prompts synchronously (<5ms) during assessment creation to eliminate Sidekiq race conditions.
6. **Support Skill Deletions**: Emit `{ id: skill.id, _destroy: true }` in `AssessmentEditPage.tsx` to ensure removed skills are purged from the database.

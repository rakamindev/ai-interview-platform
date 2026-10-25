# Fullstack Product Engineer - Case Study Report

**Candidate:** [Your Name]
**Date:** August 21, 2026

## Overview
This report outlines the end-to-end execution of the Rakamin AI Interview Platform revamp. By taking a first-principles approach, I identified gaps that actively harmed the users (privacy leaks) and product fidelity (malicious early terminations), prioritizing those over vanity refactors.

## 1. Deep Context & Domain Immersion
- **The Users:** Assessors handling candidates must trust that the output portfolio genuinely reflects a complete interview. The AI acts as a proxy for the organization.
- **The Candidates:** Interacting with an AI can be stressful. If their data is mishandled or their connection fails abruptly ending the session before they have shown their skills, it dramatically impacts their likelihood of being hired.
- **UU PDP (Data Privacy):** The platform logs the direct voice transcription of the candidates. When this reaches system logs in production (which are often pushed to Datadog or ELK), it creates a dangerous PII sprawl.

## 2. Defining Problem & Gap to Ideal Condition

| Severity | Component | Issue | Impact |
| -------- | --------- | ----- | ------ |
| **P0** | Backend (`LiveClient`) | PII Transcription Log Leak | Raw candidate transcripts were emitted to `Rails.logger`, violating UU PDP compliance. |
| **P0** | Fullstack (`sessions_controller` & frontend) | Insecure Session Termination Boundary | `audio_complete` trusted the client to end the session. An attacker with a token could bypass coverage checks completely. |
| **P1** | Backend (`EndHandler`) | Portfolio Generation Race Condition | Duplicate calls (Timeout + Manual abort) simultaneously bypassed `portfolio.present?` checks, crashing transactions. |

## 3. Revamp Strategy & Trade-offs (Fixing `audio_complete`)

### Evaluated Options
**Option A: Enforce Boundary Validation on REST + UI Graceful Fallback (Chosen)**
We maintain the REST endpoint but independently enforce `coverage_maps.all?(covered)`. If the user hits it prematurely, return `422`. The frontend is updated to break out of infinite retries on `422` and prompt the user gracefully.
- *Pros:* Highly secure. Safely maintains the intended architecture (draining audio queues before end).
- *Cons:* Timing micro-gap between WS and REST requires careful handling to avoid false 422s.

**Option B: Terminate at the WebSocket Edge**
The moment the backend WS detects `all_covered`, it closes the DB session and closes the socket.
- *Pros:* Impossible to spoof from the frontend.
- *Cons:* Poor UI/UX. Cuts off the AI's "Thank you" wrap-up message and causes harsh client drops.

**Option C: Two-Phase Commit via a Dedicated End-Session Token**
Generate a short-lived signed token upon `all_covered` and include it in the `preparing_to_end` WebSocket message. The `audio_complete` endpoint only accepts requests bearing this token.
- *Pros:* Eliminates the coverage re-check race entirely; the token is proof of server-side coverage verification.
- *Cons:* Additional token management complexity; requires a token store (Redis) and expiry logic.

## 4. Monozukuri Implementation

I executed the following changes across the full stack:
1. **PII Sanitization:** Cleaned up `live_client.rb` to redact `[inputTx]` strings before logging. We still retain critical observability (`turnComplete`, `has_audio`).
2. **Secure Session Boundary:** Updated `audio_complete` to block termination if `CoverageMap` states are insufficient. Added negative RSpec edge cases to prove.
3. **Atomic Safety:** Overhauled `Sessions::EndHandler` to use Rails native `Portfolio.create_or_find_by!` ensuring robust Postgres `UNIQUE` constraint handling natively without full transaction aborts.
4. **Resilient UI (Vite+React):** Modded the `useAudioComplete` infinite retry loop in `InterviewPage.tsx` to detect `422` rejections and revert to `active` state gracefully, preventing absolute UI locking.

## GitHub Submission
All changes are cleanly decoupled and committed off the feature branch:
**Branch:** `danibik-feat/assesment-backend-depth` (Pending PR).

## 5. Feature Extension: Recruiter Workflows (Vacancy & Email Invites)

### 5.1. Database & Models — Vacancy-Assessment Connection (Design Trade-offs)
- Added `vacancy_id` as a nullable reference to `assessments` to ensure legacy standalone assessments remain functional.
- Injected `candidate_email`, `invitation_status` (default: `pending`), `invitation_sent_at`, and `invitation_error` to `sessions`. Added native strict email Regex validation.

**Alternatif desain yang dievaluasi:**

**Option A: Nullable `vacancy_id` FK on `assessments` with auto-prefill (Chosen)**
A single nullable foreign key on `assessments` pointing to `vacancies`. When provided, skills are prefilled from `VacancySkill`.
- *Pros:* Minimal schema change; fully backward-compatible; zero extra queries for standalone assessments.
- *Cons:* One-to-one mapping — one vacancy can only link to one assessment at a time.

**Option B: Separate `vacancy_assessments` Join Table (Many-to-Many)**
A dedicated join table allows one vacancy to have multiple assessment versions (e.g., different language or seniority variants).
- *Pros:* Maximum flexibility; supports A/B testing of assessment designs per vacancy.
- *Cons:* Over-engineered for the current single-assessment-per-role use case; adds query complexity.

**Option C: Denormalized Skills on Vacancy (No Assessment Skill Entity)**
Vacancy skills act directly as assessment skills; the separate `assessment_skills` table is removed.
- *Pros:* Single source of truth; no prefill step needed.
- *Cons:* Loses the ability to override or extend skills per-assessment; couples assessment to vacancy lifecycle.

### 5.2. API & Email Delivery — Candidate Invitation (Design Trade-offs)
- Extended `POST /assessments/:id/sessions` to capture emails organically.
- Added `POST /sessions/:id/invitation` to queue invitations. Prevents duplicate sends natively by verifying `invitation_status == 'sent'`.
- Deployed `CandidateMailer` supported by `InvitationSenderWorker` inside existing Sidekiq orchestration. This handles unhandled SMTP failures by bounded retries (3) and safely records final fail states on the session (`invitation_status: 'failed'`).

**Alternatif desain yang dievaluasi:**

**Option A: Sidekiq Background Worker + CandidateMailer (Chosen)**
Email delivery is offloaded to a Sidekiq worker with `retry: 3`. Failures are recorded on the session; the final failed state is set only after all retries are exhausted.
- *Pros:* Non-blocking HTTP response; isolated failure handling; retry is automatic; good observability via Sidekiq UI.
- *Cons:* Requires Redis and a running Sidekiq process; delivery is eventually consistent (not instant).

**Option B: Synchronous SMTP in the Request Thread**
Call `deliver_now` directly inside the controller action before responding.
- *Pros:* Immediate feedback on success/failure; no background infrastructure needed.
- *Cons:* Blocks the Puma thread for the full SMTP round-trip (can be 2–5s); timeouts cause HTTP 500s; poor UX under slow SMTP.

**Option C: Third-Party Transactional Email API (e.g., SendGrid, Postmark)**
Replace ActionMailer SMTP with a vendor HTTP API. Delivery status returned via webhook.
- *Pros:* High deliverability, bounce/open tracking, no SMTP server management.
- *Cons:* Vendor lock-in; webhook endpoint needed; per-email cost; adds external service dependency.

**Email Pipeline — Cost & Failure Conditions:**

| Category | Details |
|----------|---------|
| **Implementation cost** | Worker class, mailer class, 2 DB columns, controller action, test suite |
| **Maintenance cost** | Monitor Sidekiq dead queue for permanently failed jobs; rotate SMTP credentials periodically; update mailer HTML template per branding changes; ensure Redis uptime for Sidekiq |
| **Failure: SMTP down/timeout** | Worker raises → Sidekiq retries up to 3×; after exhaustion, `invitation_status` set to `failed` + error saved |
| **Failure: Invalid recipient (bounce)** | SMTP accepts the message but bounce arrives out-of-band; not currently captured — future improvement: integrate bounce webhooks |
| **Failure: SMTP rate limiting** | Same retry path as SMTP down; exponential backoff provides natural spacing |
| **Failure: Redis unavailable** | `perform_async` raises at enqueue time → HTTP 500; Sidekiq cannot process any jobs until Redis recovers |
| **Failure: Expired/invalid credentials** | `Net::SMTPAuthenticationError` raised in worker → retry path triggered; after exhaustion, `failed` state recorded |

### 5.3. Predictable React UI
- **Vacancy Handoff:** Added context-aware *Create Assessment* routing (`useLocation().state`) in `VacancyEditPage.tsx` to prefill role titles and core skills into `AssessmentNewPage.tsx` seamlessly.
- **Invitations:** Upgraded `AssessmentInvitePage.tsx` modal to ask for email. Realtime status badges immediately reveal *Wait/Send/Sent/Failed*. Added a *Retry Invite* conditional render that surfaces `invitation_error`.

### 5.4. Focused Test Verifications
Implemented `spec/requests/api/v1/vacancy_invitation_workflow_spec.rb`. Validates 12 specific assertions including:
- Legacy assessment validity.
- 422 triggers for malformed candidate emails.
- SMTP exception handling -> `failed` transition.
- Redundant send blocks.
- Vacancy -> Assessment data propagation.

### 5.5. Local Email Debugging (Mailcatcher)
To ensure reliable email delivery testing without affecting live servers, Mailcatcher was integrated into the local development environment. This provides a local SMTP sink and Web UI to inspect actual email payloads, verifying that invitation links are generated correctly using `APP_BASE_URL` and ensuring Sidekiq workers can successfully dispatch emails.

## Remaining Risks
1. **Production SMTP Configuration:** `CandidateMailer.deliver_now` requires valid Downstream SMTP config within Rails environment secrets. If unavailable, it correctly falls to `failed` and allows retrying later.
2. **Long Polling Overhead:** UI currently polls aggressively. Future revisions of scaling architecture should migrate session listening to ActionCable.

*End of Report.*

# 14 — Backlog

**Provenance: `[CODE]`.**

What was deliberately not done, and why. A change that found 56 problems and silently fixed 30 has misrepresented the other 26.

---

## Distribution

| Category | Count |
|----------|-------|
| Fixed | 30 |
| Escalated — blocked on a decision, not effort | 5 |
| Product backlog | 5 |
| Engineering backlog | 10 |
| Hygiene backlog | 10 |
| Suspected, unverified | 4 |

---

## 1. Fixed (30)

These were addressed in Waves 0-3. See [03-findings-register.md](03-findings-register.md) for each finding's details.

Wave 0 (Infrastructure):
- P1-29: Demo fixtures
- P2-36: CI pipeline
- P2-37: Docker Compose
- P2-38: GEMINI_STUB mode
- P2-39: RSpec harness
- P2-40: Vitest harness
- P2-41: RuboCop
- P2-42: Brakeman
- P2-43: Migration round-trip test
- P2-44: Tenant isolation tests

Wave 1 (Tenant Isolation):
- P0-1: Client-supplied tenant header
- P0-2: Portfolio.find without tenant scope
- P0-4: Tenant fallback to unrecognised scheme
- P0-15: No invite expiry
- P0-17: No membership model (mitigation)
- P1-35: No WebSocket role checks

Wave 2 (Defensible Ratings):
- P0-9: Required level key mismatch
- P0-10: Confidence absent renders as LOW
- P0-11: Low confidence ignored in verdict
- P0-12: Regeneration silently deletes overrides
- P0-13: Override has no audit trail
- P0-14: Rating state missing — unrated as L1
- P1-25: No narrative source tracking
- P1-26: No additional strengths in report
- P1-27: Empty transcript regen deletes all skills
- P1-28: No fit-gap report status field
- P1-32: No Zod validation on fitgap response
- P1-33: Confidence enum not normalised
- P2-45: No override lifecycle tests
- P2-46: No fit-gap engine tests

Wave 3 (Reliability):
- P1-18: No duplicate job guard
- P1-19: PDF export fails on Indonesian quotes
- P1-20: No graceful degradation on Gemini timeout
- P1-22: N+1 on portfolio skills

---

## 2. Escalated (5) — Blocked on a decision, not effort

### C1: No User-Organization Membership Model

**Status:** Mitigated (scheme cross-check + fail-closed), not resolved.

The likely right answer — make `rakamin-api` the sole token issuer and delete this service's `/auth/login` — is a cross-service decision. Anyone reading this change should know that before they trust the tenant boundary.

### C2: The Role Model Is Aspirational

**Status:** Every logged-in user is an admin.

The three personas the brief names are one permission level in the code. Fixing this requires a product decision about role definitions, not just code.

### C3: Nothing Serves the Candidate

**Status:** No consent, no retention, no access, no contest.

This is a product/legal decision. The code can support it, but the product must define what "candidate access" means.

### C4: The "Gap" Verdict Is Unspecified

**Status:** Proposed threshold in TO-7, flagged for ratification.

Nobody defined what a level difference means when the evidence is one probe. That belongs to the CTO, not to a service object.

### P0-16: WebSocket Data-Loss Bug

**Status:** Untested, unverified.

The 803-line WebSocket middleware is the most complex code in the repo. Changing the live interview flow without a test harness for it would be reckless. This is deliberately left.

---

## 3. Product Backlog (5)

### PB-1: Candidate Consent Flow

No consent mechanism for AI-assisted assessment. Required for UU PDP compliance.

### PB-2: Candidate Portfolio Access

Candidates cannot view their own portfolio. Required for data subject access rights.

### PB-3: Rating Contest Mechanism

No way for candidates to challenge a rating. Required for Art. 10 compliance.

### PB-4: Data Retention Policy

No retention/deletion schedule. Data kept indefinitely.

### PB-5: Data Export

No mechanism for candidates to export their data. Required for right to portability.

---

## 4. Engineering Backlog (10)

### EB-1: WebSocket Test Harness

Build a test harness for the 803-line `audio_websocket_middleware.rb`. This is prerequisite for touching the interview flow.

### EB-2: Full Tenant Isolation Repair

Replace the mitigation (scheme cross-check) with a real membership model. Depends on C1 decision.

### EB-3: Role-Based Access Control

Implement distinct roles (assessor, recruiter, hiring manager). Depends on C2 decision.

### EB-4: OpenAPI Spec

Generate OpenAPI spec from Rails routes. Enables contract testing and client generation.

### EB-5: Performance Testing

Load test the WebSocket endpoint and portfolio generation pipeline.

### EB-6: Integration Tests

End-to-end tests covering the full interview → portfolio → fit/gap → PDF flow.

### EB-7: Monitoring and Alerting

Set up Datadog/New Relic for APM, error tracking, and alerting.

### EB-8: Log Aggregation

Centralize logs from API, Sidekiq, and WebSocket processes.

### EB-9: Database Backups

Automated PostgreSQL backups with point-in-time recovery.

### EB-10: CI/CD Pipeline

Automated deployment to GKE on merge to main.

---

## 5. Hygiene Backlog (10)

### HB-1: Remove Dead Code

Unused controllers, services, and helpers accumulated during development.

### HB-2: Consolidate Validators

Multiple overlapping validations across models (e.g., `ai_level` validated in both model and service).

### HB-3: Standardize Error Responses

Inconsistent error response format across controllers.

### HB-4: Add Missing Indexes

Several queries could benefit from additional indexes.

### HB-5: Update Gemfile.lock

Dependencies not updated in 3+ months.

### HB-6: Fix RuboCop Warnings

Minor style violations accumulated during rapid development.

### HB-7: Add Missing Factory Defaults

Some FactoryBot factories use minimal defaults.

### HB-8: Document API Endpoints

No API documentation beyond route file.

### HB-9: Add Request ID Logging

Correlation IDs generated but not consistently logged.

### HB-10: Clean Up Migration History

Several migrations could be squashed for cleaner history.

---

## 6. Suspected, Unverified (4)

These items could not be verified exhaustively. The 529 Overloaded failures (see [11-ai-verification-log.md](11-ai-verification-log.md)) prevented full investigation. Labelled **suspected, not confirmed** — precisely the claims that would have been easiest to state confidently and hardest for a reviewer to check.

### SV-1: WebSocket Memory Leak

Suspected: long-running WebSocket connections may leak memory due to EventMachine buffer management. Not verified under load.

### SV-2: Sidekiq Job Ordering

Suspected: portfolio generation and coverage analysis jobs may execute out of order under high load. Not verified with concurrent jobs.

### SV-3: PostgreSQL Connection Pool Exhaustion

Suspected: under high WebSocket connection count, the database connection pool may exhaustion. Pool size configured as `RAILS_MAX_THREADS + 10` but not load-tested.

### SV-4: Gemini Rate Limiting

Suspected: concurrent interviews may hit Gemini API rate limits. No backoff or queuing strategy implemented.

---

## Three Worth Naming

1. **InterviewPage is untouched** — the only screen a candidate ever sees, which by my own argument makes it important out of proportion to its complexity. Changing the live interview flow without a test harness for the 803-line WebSocket middleware would be reckless.

2. **The live interview WebSocket remains untested.** The most complex code in the repo, the least covered, and it contains a data-loss bug (P0-16).

3. **C1 is a mitigation, not a repair.** Anyone reading this change should know that before they trust the tenant boundary.

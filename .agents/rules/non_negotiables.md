# Project Rules & Non-Negotiable Disqualifiers

This document defines the strict, non-negotiable rules for the **AI Interview Platform** project. All AI agents, subagents, and developers working on this codebase MUST strictly adhere to these rules. Any violation will result in immediate disqualification.

## 1. Non-Negotiable Disqualifiers

*   **No Weakening or Removing Test Assertions**: Never weaken, disable, or remove any test assertions to make a check or test suite pass. If a test fails, you must fix the root cause of the bug in the implementation code, not alter the test to hide it.
*   **No Committing Secrets or PII**: Never commit secrets, API keys, private keys, passwords, credentials, or real personal data (PII) to the repository. Use environment variables (e.g., config via `application.yml` or `.env`) for all configuration keys.
*   **No Happy-Path-Only Testing**: You must NOT submit a change that is only tested on the happy path. You must explicitly test and handle:
    *   Designed failure paths (e.g., timeouts, partial database writes, AI model errors, duplicate jobs).
    *   Edge-case input/data types.
    *   Error states, loading states, empty states, and long text states.
*   **No Unattributed Work**: Do not copy or reproduce another candidate's visible work without proper attribution.
*   **Maintain Premium UI/UX Design Quality**: Poor or neglected UI/UX design is a disqualifier. The frontend interface must look premium, modern, responsive, and visually polished (paying close attention to layouts, animations, transitions, and states).
*   **Understand & Explain Every Line**: Do not generate or submit any code that cannot be fully explained and defended from first principles.

## 2. Monozukuri & Engineering Craft Standards

*   **Proven Correctness**: Write automated tests (RSpec for backend, appropriate test runner/scripts for frontend). A test is only proven when you have watched it fail first before making it pass.
*   **Designed Failure Paths**: Handle external failures gracefully:
    *   API timeouts and retry policies.
    *   Partial database writes (use database transactions where appropriate).
    *   External AI Model / LLM service errors or rate limits.
    *   Idempotency for background jobs (Sidekiq).
*   **Data Protection & Security**:
    *   Fully comply with Indonesia's Personal Data Protection Law (UU PDP).
    *   Never log sensitive personal data.
    *   Ensure all API endpoints are properly authorized and validated.
*   **Reversible Migrations**: All PostgreSQL database migrations must be fully reversible (`down` method or standard Rails `change` that can roll back cleanly) and safe against existing database rows.
*   **Seeded Fault Test**: To prove the reliability of tests, break the logic on a scratch branch to show that the tests fail, then revert it.

## 3. Communication and Implementation Workflow

*   **Planning First**: Always write an implementation plan (`implementation_plan.md`) and get approval before executing non-trivial changes.
*   **Small, Readable Commits**: Keep commits logical, small, and descriptive. Never commit directly to `main`.

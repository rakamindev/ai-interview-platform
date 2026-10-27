# AI Interview Platform — Fullstack Product Engineer Case Study
**Deliverable:** Product and Engineering Assessment
**Repository:** AI Interview Platform
**Branch:** `feat/fitgap-report-reliability`
**Pull Request:** [#208 — Fix: preserve existing fit-gap report during regeneration](https://github.com/rakamindev/ai-interview-platform/pull/208)
**Status:** Targeted implementation completed; backend and end-to-end verification pending
**Last updated:** 27 October 2026

---

## 1. Executive Summary

The AI Interview Platform supports interview and assessment workflows, candidate portfolios, and AI-assisted fit/gap reporting. Its architecture combines a React and TypeScript frontend with a Rails API, PostgreSQL, Redis, Sidekiq background jobs, and Gemini-powered narrative generation.

The initial code review identified a reliability risk in fit/gap report regeneration. The previous implementation deleted the existing report before the replacement had completed successfully. The frontend also removed the displayed report after a regeneration request was accepted, potentially leaving users without access to the previous result while the new report was being generated.

A targeted reliability improvement has been implemented across the backend controller and frontend. The controller no longer deliberately deletes the existing report before enqueueing regeneration. The frontend retains the existing report in component state and displays a dismissible error message if the regeneration request fails.

The frontend production build passes, the changes have been committed and pushed, and pull request #208 is open for review. Backend automated tests and end-to-end behavior remain unverified because local Puma dependency installation failed on Windows.

## 2. Product Context and User Journey

### Primary users

- **Recruiters and hiring managers:** Review candidate evidence and compare it with role requirements.
- **Assessors:** Contribute skill assessments and professional judgment.
- **Candidates:** Provide information and participate in an evaluation process.

### End-to-end journey

1. A recruiter or hiring manager selects an assessment or vacancy.
2. The candidate participates in the interview and assessment process.
3. The platform generates or updates the candidate portfolio.
4. The system compares assessed skills with vacancy expectations.
5. The recruiter reviews matches, gaps, exceeding skills, and skills that have not been assessed.
6. The report supports the recruiter's review alongside human judgment.
7. The report may be regenerated when relevant assessment inputs change.

### Product principles

- Assessment outputs should be traceable to their underlying evidence.
- Missing information should be represented as unknown or not assessed, rather than silently interpreted as a skill gap.
- AI-generated narratives should support, not replace, human decision-making.
- A transient service failure should not unnecessarily remove previously available assessment information.
- Candidate information should be protected through appropriate access controls and data minimization.

## 3. Repository and Architecture Review

The repository documentation identifies the following components:

| Component | Responsibility |
|---|---|
| React 18, TypeScript, Vite | Frontend and client-side interactions |
| Rails API | Application endpoints and business logic |
| PostgreSQL | Persistent application and assessment data |
| Redis and Sidekiq | Background job processing |
| Gemini API | AI-assisted narrative generation |

The documented local setup requires Ruby, Node.js, PostgreSQL, Redis, application configuration, and a Gemini API key for AI-backed functionality.

### Files reviewed

- `api/app/controllers/api/v1/portfolios_controller.rb`
- `api/app/services/fit_gap/engine.rb`
- `api/app/workers/fit_gap_generator_worker.rb`
- `web/src/pages/fitgap/FitGapReportPage.tsx`
- `api/README.md`
- `web/README.md`

The assessment combines static code inspection with frontend build verification. A complete runtime assessment has not yet been performed.

## 4. Problem and Gap Analysis

### Finding A — Existing report could be lost during regeneration

**Location:** `api/app/controllers/api/v1/portfolios_controller.rb`, `regenerate_fitgap`

The original controller deleted the existing `FitGapReport` before enqueueing `FitGapGeneratorWorker`. The endpoint then returned HTTP 202 to indicate that the regeneration request had been accepted.

**Potential impact:** If regeneration failed or did not finish, the previous report could become unavailable.

**Initial severity:** P1 — high-priority reliability risk, subject to confirmation against product requirements and runtime behavior.

**Acceptance criteria:**

- The last successful report remains available until a replacement is successfully persisted.
- A failed replacement does not deliberately remove the previous successful result.
- Repeated regeneration requests are handled safely.
- The endpoint's response accurately reflects whether the job was accepted.
- Regression tests cover failure and retry behavior.

**Implementation update:** The controller statement that deliberately deleted the existing report before enqueueing the worker was removed. This reduces the identified risk, but safe replacement behavior and worker-failure scenarios still require backend verification.

### Finding B — Frontend report preservation and error handling

**Location:** `web/src/pages/fitgap/FitGapReportPage.tsx`, `handleRegenerate`

The original frontend cleared the displayed report after a regeneration request was accepted and did not provide a dedicated user-facing error message for request failure.

**Potential impact:** Users could lose access to the current report during regeneration and receive insufficient feedback if the request failed.

**Acceptance criteria:**

- The existing report remains available when a regeneration request fails.
- The interface communicates the regeneration state.
- Request failures produce a useful error message.
- Users can retry after a request failure.
- Repeated submissions are prevented while regeneration is already in progress.

**Implementation update:** The frontend no longer clears the existing report when the regeneration request is accepted. It now includes regeneration-error state, request failure handling, and a dismissible error message. Background-job failure and polling behavior remain to be verified.

### Finding C — AI narrative fallback and partial results

**Location:** `api/app/services/fit_gap/engine.rb`

The engine derives skill comparisons from vacancy requirements and portfolio skills. It recognizes `not_assessed` skills and contains a fallback path for narrative-generation errors, including a fallback overall narrative and a `nil` culture narrative.

**Potential impact:** Users may misunderstand the completeness of a report if narrative content is missing or only partially generated.

**Recommended follow-up:**

- Confirm that rule-based skill comparisons remain available when Gemini is unavailable.
- Make missing AI narrative content clear in the interface.
- Handle malformed model responses without exposing internal details.
- Avoid logging secrets or unnecessary candidate information.
- Test timeouts, malformed responses, missing narrative fields, and provider errors.

These behaviors have not yet been fully verified at runtime.

### Finding D — Asynchronous job and retry behavior

The worker uses Sidekiq retry behavior and re-raises general errors. The frontend polls for report availability after generation is initiated.

**Potential impact:** Failures across the request, queue, worker, or polling layers may leave the interface without a clear completion or failure state.

**Recommended follow-up:**

- Confirm that retries do not corrupt a previously successful report.
- Review duplicate and concurrent regeneration requests.
- Verify handling of missing portfolios and vacancies.
- Ensure polling can stop or transition to an appropriate error state.
- Keep operational logs free of API keys, tokens, and unnecessary candidate data.

## 5. Product and Engineering Constraints

1. **Asynchronous processing:** An accepted request does not mean that report generation has succeeded.
2. **Data integrity:** A previous successful result should not be deliberately removed before a replacement is ready.
3. **AI dependency:** Gemini may time out, return malformed output, or become unavailable.
4. **Partial assessments:** `not_assessed` is distinct from a confirmed skill gap.
5. **Candidate privacy:** Assessment data should only be accessible to authorized users.
6. **Human oversight:** AI-generated narratives should not be presented as definitive hiring decisions.
7. **Development environment:** A native Puma dependency build failed during Windows setup. Backend runtime verification is therefore pending. This setup failure is not, by itself, evidence of an application defect.

## 6. Remediation Options

### Option A — Frontend-only improvement

Keep the current report visible while regeneration is pending and provide request error handling.

**Advantages:** Small, fast user-experience improvement.

**Trade-off:** Does not address backend deletion of the previous report.

### Option B — Backend-safe regeneration and improved frontend

Preserve the previous report during regeneration and improve the frontend's handling of pending and failed requests.

**Advantages:** Addresses both data availability and user experience.

**Trade-off:** Requires verification of concurrent jobs, replacement behavior, and background-job failure states.

### Option C — Report versioning

Store immutable report versions and track the current version, generation status, and error metadata.

**Advantages:** Provides stronger historical traceability and auditability.

**Trade-off:** Requires broader schema, migration, and interface changes.

### Recommendation

Option B is the preferred immediate direction. Option C may be appropriate later if historical comparisons or formal audit requirements become necessary.

The targeted changes for Option B have been pushed to the feature branch. Regression tests and end-to-end verification remain outstanding.

## 7. Cross-Layer Follow-up Plan

### Backend

- Define and verify the lifecycle of queued, successful, and failed regeneration.
- Confirm that a failed replacement does not destroy a previous successful report.
- Review duplicate and concurrent job behavior.
- Validate endpoint inputs and authorization using the application's existing conventions.
- Preserve the existing fallback for rule-based comparisons when AI narrative generation fails.
- Avoid logging secrets or unnecessary candidate data.

### Frontend

- Keep the current report visible during request submission and failure.
- Communicate pending, completed, and failed states clearly.
- Provide a useful error message and safe retry path.
- Verify loading, empty, error, and long-text states.
- Make missing AI narrative and unassessed skills clear to users.

### Recommended regression coverage

- Successful regeneration.
- Background worker failure and retry.
- Preservation of the existing report after failure.
- Duplicate or concurrent regeneration requests.
- Missing or invalid vacancy identifiers.
- `not_assessed` skills.
- Gemini timeout, malformed response, and partial narrative.
- Frontend loading, error, retry, and report-preservation states.

These are recommended tests; they should not be interpreted as tests that have already passed.

## 8. Privacy, Security, and Responsible AI

Because the platform processes information that may affect employment opportunities, implementation should follow data minimization, access control, secure logging, and appropriate retention practices.

For an Indonesian deployment, applicable requirements under Indonesia's Personal Data Protection Law (UU No. 27 Tahun 2022) should be reviewed, including lawful processing, transparency, security safeguards, and data-subject rights. The organization's legal or privacy reviewer should confirm the obligations that apply to the specific deployment.

AI-generated text should summarize evidence and uncertainty rather than infer unsupported personal characteristics. Recruiters should retain responsibility for hiring decisions, and missing data should not be converted into negative evidence.

## 9. Verification Plan and Current Limitations

### Verified through static inspection

- The original regeneration controller deleted the existing report before enqueuing the background worker.
- The fit/gap engine uses `find_or_initialize_by` and updates report data after generating comparisons and narratives.
- The worker is configured for retries and re-raises general exceptions.
- The original frontend cleared the displayed report after a regeneration request was accepted.
- The engine contains a fallback path for narrative-generation errors.
- The local development documentation identifies Rails, PostgreSQL, Redis, Sidekiq, and the frontend as required components.

### Verified after implementation

- The frontend TypeScript compilation and Vite production build completed successfully.
- `git diff --check` completed without reported whitespace errors.
- Changes were committed and pushed to `feat/fitgap-report-reliability`.
- Pull request #208 was opened and is awaiting review.

### Not yet verified

- Backend boot and API behavior in a running local environment.
- Database migrations and seed execution.
- Automated backend regression tests.
- End-to-end behavior when background regeneration fails.
- Gemini timeout and malformed-response behavior.
- Polling timeout, concurrent regeneration, and authorization edge cases.
- Screenshots and a recorded demonstration.
- Pull-request approval and merge.

### Local environment limitation

A native Puma dependency build failed during Windows setup, blocking complete backend runtime verification. No successful backend test run is claimed.

## 10. Evidence and Submission Checklist

- [x] Implement the targeted backend regeneration reliability improvement.
- [x] Preserve the displayed frontend report when the regeneration request is accepted or fails.
- [x] Add frontend request-error handling and a dismissible error message.
- [x] Run the frontend production build successfully.
- [x] Run `git diff --check` successfully.
- [x] Commit and push the changes to the feature branch.
- [x] Open pull request #208.
- [ ] Add regression tests for successful and failed regeneration.
- [ ] Run backend tests and verify runtime behavior.
- [ ] Verify background-job failure, polling timeout, concurrency, and authorization behavior.
- [ ] Capture appropriate screenshots of the report and relevant loading/error states.
- [ ] Obtain pull-request review and address feedback.
- [ ] Record a 3–5 minute demonstration and provide an accessible video link.
- [ ] Confirm that no secrets, tokens, or real candidate personal data appear in submission evidence.
- [ ] Export the final assessment as a polished PDF and upload it to the hiring platform.

## 11. Final Status

A targeted reliability improvement has been implemented for fit/gap report regeneration. The backend controller no longer deliberately deletes the existing report before enqueueing the replacement job. The frontend retains the existing report in component state and provides a dismissible error message when the regeneration request fails.

The frontend production build passes, and the changes have been committed and pushed. [Pull request #208 is open for review](https://github.com/rakamindev/ai-interview-platform/pull/208).

Backend tests, end-to-end runtime behavior, screenshots, and the demonstration video remain outstanding. This work should therefore be considered a targeted improvement awaiting further verification, not a fully tested release.

## 12. Implementation Progress and Verification Update

**Update date:** 27 October 2026

### Changes implemented

1. **Backend regeneration reliability:** Removed the controller statement that deleted the existing fit/gap report before the background regeneration job was enqueued.
2. **Frontend report preservation:** Removed the statement that cleared the displayed report after a regeneration request was accepted.
3. **Frontend error handling:** Added regeneration-error state, request failure handling, and a dismissible error message. The regeneration action also prevents another submission while regeneration is already in progress.
4. **Submission documentation:** Added this assessment report to the feature branch.

### Verification evidence

- `npm.cmd run build` — passed. TypeScript compilation and the Vite production build completed successfully.
- Latest recorded build — 1,841 modules transformed; completed in 2.64 seconds.
- `git diff --check` — passed with no reported whitespace errors.
- Commit `f4ac20e` — `fix: handle fit-gap regeneration request failures`.
- [Pull request #208](https://github.com/rakamindev/ai-interview-platform/pull/208) — open for review.
- Backend automated tests and runtime behavior remain unverified because the local Puma dependency installation failed on Windows.

### Remaining limitations

- Add regression coverage for failed regeneration and preservation of an existing report.
- Verify background-job failure and frontend polling behavior.
- Review concurrent regeneration and authorization behavior.
- Capture suitable screenshots and record the required demonstration.
- Obtain pull-request review and address feedback.
- Export and submit the final PDF.

**Current status:** The targeted code changes are pushed, the frontend production build passes, and the pull request is open. Backend and end-to-end verification remain incomplete.

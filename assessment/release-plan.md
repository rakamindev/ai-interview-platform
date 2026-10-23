# Release Plan

## Before Review
- [ ] Review all source and test diffs.
- [ ] Confirm package-lock.json is included and reproducible.
- [ ] Triage dependency audit findings.
- [ ] Run backend tests, frontend tests, frontend build, and git diff --check.
- [ ] Verify seeded-fault and revert history.
- [ ] Ensure no secrets or local environment files are staged.

## Proposed Pull Request
Title: `Harden coverage payload processing across backend and frontend`

Explain the malformed discovered-skill failure mode, backend validation, frontend payload validation, test results, seeded-fault evidence, and remaining risks.

## Demo Video (3–5 minutes)
1. Explain the coverage update flow and malformed-input risk.
2. Show the backend validation and worker regression test.
3. Show the frontend validators and unit tests.
4. Show the seeded-fault commit, failing test, and revert.
5. Run final tests/build and summarize unresolved risks.

## Release Decision
Do not describe this change as production-ready until the dependency audit has been triaged and relevant integration behavior has been reviewed.

# Assessment Improvement: Safe Assessment Deletion

## Problem and impact

The assessment DELETE action previously ignored the result of `destroy` and
always returned `200 OK` with `"Assessment deleted"`. However, an assessment
with associated sessions is protected by `dependent: :restrict_with_error`.

This can mislead API consumers into believing a destructive operation succeeded
when the record remains in the database.

**Severity: P2 (functional correctness).** The issue produces an incorrect
success response and can confuse assessors or administrators, but does not by
itself establish data loss or unauthorized access.

## Decision and trade-offs

Options considered:

1. Keep the existing response: smallest code change, but preserves misleading
   behavior.
2. Return a conflict response when deletion is restricted: accurately reports
   that the operation could not be completed and preserves existing data.
3. Cascade-delete sessions: simplifies deletion, but risks destroying interview
   history and is not appropriate for this focused fix.

Selected option: 2. A restricted deletion returns `409 Conflict`; successful
deletion retains the existing `200 OK` response and message.

## Acceptance criteria

- An assessment without sessions can be deleted.
- An assessment with sessions remains in the database.
- A restricted deletion returns `409 Conflict`, not a success response.
- Existing success response shape remains unchanged.
- Regression tests cover both scenarios.

## Validation

Run the focused regression tests and the full API test suite. Verify the diff
before committing. If the test environment is unavailable, report that as a
limitation rather than claiming the tests passed.

## Security, privacy, and data integrity

The change does not expose candidate data or add new personal-data collection.
It preserves session records by refusing a restricted deletion. No database
migration is required, making rollback straightforward.

## AI-assisted implementation verification

AI-assisted code must be checked against actual framework behavior. In
particular, verify how `destroy!` behaves with `dependent: :restrict_with_error`
in the Rails version used by this project. The regression test must confirm
the HTTP status, response message, and persisted assessment state. Do not
accept a passing happy-path test alone.

## Limitations and follow-up

This is a narrow fix, not a complete assessment-platform review. Run the full
test suite and frontend build, inspect the final diff, and verify the assessment
API contract before merging.

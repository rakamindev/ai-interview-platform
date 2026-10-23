# Architecture and Risk Review

## Flow
1. The AI coverage analyzer returns skill updates and discovered skills.
2. The backend worker processes discovered skills and persists coverage maps.
3. The backend broadcasts coverage updates over WebSocket.
4. The frontend validates incoming messages before updating React state.

## Changes
The backend skips discovered labels that are not strings, are blank after trimming, or exceed 255 characters. Valid labels are trimmed before duplicate detection and persistence.

The frontend validates the structure and fields of coverage-update messages and validates allowed session statuses and end reasons. The skill_id type is string or null, matching the backend payload contract.

## Risks and Limitations
- One malformed skill causes the entire coverage update to be rejected, including otherwise valid entries.
- Frontend tests cover pure validators, not a live WebSocket or React hook lifecycle.
- The worker test uses doubles and does not verify persistence against a real database.
- The dependency audit reported 11 vulnerabilities: 4 moderate, 5 high, and 2 critical. The affected packages and exploitability have not yet been triaged.
- Passing tests and a successful build do not establish production readiness.

## Follow-up
1. Triage dependency audit findings.
2. Add hook-level tests for malformed frames, valid updates, and session end.
3. Consider partial acceptance of valid skills in a malformed update.
4. Add integration tests for persistence and broadcast behavior.

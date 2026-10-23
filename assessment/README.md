# Engineering Assessment

## Scope
This submission hardens the coverage-update path across the Rails backend and React frontend.

## Implementation
- Backend rejects discovered skill labels that are not strings, are blank after trimming, or exceed 255 characters.
- Frontend validates coverage-update and session-status WebSocket payloads before updating state.
- CoverageSkill.skill_id now reflects the backend contract: string or null.

## Verification
- Backend RSpec: 4 examples, 0 failures.
- Frontend Vitest: 13 tests passed.
- Frontend production build: passed.
- git diff --check: passed.

These results are local verification, not proof of end-to-end correctness or production security.

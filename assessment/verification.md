# Verification Evidence

## Automated Checks

| Check | Result |
|---|---|
| `cd api && bundle exec rspec` | 4 examples, 0 failures |
| `cd web && npm test` | 2 test files, 13 tests passed |
| `cd web && npm run build` | Passed |
| `git diff --check` | Passed |

## Frontend Tests

`coveragePayload.test.ts` covers valid updates, null skill IDs for discovered skills, malformed arrays, blank labels, invalid states, and wrong message types.

`sessionStatusPayload.test.ts` covers valid active/ended statuses, unknown statuses, unknown end reasons, missing end reason, wrong message type, and malformed values.

## Seeded-Fault Demonstration

The Git history contains:

1. `9559153 fix: validate discovered skill labels` — implementation and tests.
2. `e6e67a3 test: seed discovered skill validation regression` — temporarily restores the faulty implementation.
3. `0364a9d Revert "test: seed discovered skill validation regression"` — restores the fix.

With the faulty implementation active, the worker spec failed because an empty label reached `create!`. After reverting the fault, the backend suite passed.

Inspect the commits with:

```bash
git show --stat 9559153
git show --stat e6e67a3
git show --stat 0364a9d
```

These results are local unit-test and build evidence, not end-to-end or production security certification.

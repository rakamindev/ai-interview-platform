# AI-Generated Code Risk Review

## Failure Modes and Mitigations

### Incorrect payload assumptions
Generated code may assume all skill IDs are numeric or non-null. Verify the implementation against backend serialization and test both string and null IDs.

### Missing runtime validation
Parsed WebSocket JSON is untrusted input. Treat it as unknown, validate its structure and allowed values, and test malformed payloads.

### Broad exception handling
A malformed item can interrupt processing of later valid items. Test a sequence with invalid entries followed by a valid entry.

### Tests that prove too little
Unit tests may not exercise database persistence, WebSocket lifecycle, or full UI behavior. Clearly distinguish unit tests from integration and end-to-end tests.

### Unsafe dependency fixes
Automatic upgrades may introduce breaking changes without resolving the relevant vulnerability. Inspect the audit report and dependency paths before changing versions.

## Review Policy
- Treat generated code as a proposal, not authoritative output.
- Verify assumptions against the existing implementation and requirements.
- Prefer small, reviewable changes.
- Add regression tests for reproduced failures.
- Run tests and production builds after changes.
- Document unresolved risks honestly.

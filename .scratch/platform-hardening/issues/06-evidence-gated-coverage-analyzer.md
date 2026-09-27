# 06-evidence-gated-coverage-analyzer

Status: complete
Blocked by: none

## Context
In `CoverageAnalyzerWorker#advance_stale_partials`, skills with `probe_count >= 4` that slide past the 6-turn context window are unconditionally marked `covered` regardless of candidate performance, falsely inflating candidate scores.

## Implementation Details
1. In `api/app/workers/coverage_analyzer_worker.rb`:
   - Remove lines 18-21 calling `advance_stale_partials`.
   - Remove the `advance_stale_partials` method definition (lines 84-101).
   - Skills transition to `covered` strictly when the Gemini Flash analyzer returns explicit coverage updates.
2. In `api/spec/workers/coverage_analyzer_worker_spec.rb`:
   - Add/update spec verifying that a partial skill with 4 probes outside the context window remains `partial` unless explicit coverage proof is returned.

## Verification
- `cd api && bundle exec rspec spec/workers/coverage_analyzer_worker_spec.rb`

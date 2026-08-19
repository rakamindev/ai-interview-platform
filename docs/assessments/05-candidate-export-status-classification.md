# Candidate Export: Distinguish "Not Found" from "Actually Failed"

Severity: P1 · Type: Defective implementation → Fixed

## Summary

Bulk-exporting candidates (transcript, JSON, or PDF) returned only two outcomes per candidate: `ok` or `error`. A candidate whose session was simply deleted looked identical, in the response and in the toast, to a candidate whose PDF generation genuinely crashed. An assessor exporting fifty candidates couldn't tell "nothing to worry about, this one's gone" from "something is broken and needs attention."

## Analysis

`CandidatesController#export` iterated the requested candidate IDs and rescued any failure into a flat `error` bucket alongside a simple `RecordNotFound`. Both cases produced the same shape in the response payload, so the frontend toast (`exportToast.ts`) had no signal to group them separately, and a real generation failure could hide inside a pile of expected not-founds.

## Options & Trade-off

**Option A — Leave it binary, improve only the error message text.**
Cheaper, but doesn't solve the actual problem: an assessor still can't tell at a glance whether 12 failures need investigation or are just stale candidate IDs. Rejected.

**Option B — Three-way classification: `ok` / `failed` / `not_found` (chosen).**
`RecordNotFound` is rescued into its own `not_found` status distinct from any other exception, which lands in `failed`. Costs one more rescue branch and one more status string — small change, meaningfully different signal.

**Option C — Separate endpoints for "export" and "validate IDs first."**
Over-engineered for what's fundamentally a classification problem inside one export loop; adds a round trip for no real benefit.

## Solution

`CandidatesController#export` classifies each candidate's result as `ok`, `failed`, or `not_found` instead of `ok`/`error`. The frontend's `toastExportSummary()` groups by this status and shows counts and names per group, capped with a "+N more" for long lists.

## Acceptance Criteria

- A missing candidate ID reports `not_found`, never `failed`.
- A candidate whose PDF/transcript generation actually throws reports `failed`, never silently merged with `not_found`.
- The export toast shows separate counts for each of the three outcomes when they're mixed in one batch.
- A fully successful batch still shows a clean success toast with no extra noise.

## Tests & Verification

- RSpec: `candidates_spec.rb` covers all three status outcomes in a single mixed-batch export request, across `transcript`, `json`, and `pdf` formats.
- Vitest: export toast tests confirm the grouped-by-reason rendering with line breaks between groups (see `06-export-toast-wording.md` for the toast-specific detail).
- Seeded fault: merged the `not_found` rescue back into the generic `failed` branch, reran the request spec, watched the status-count assertion fail, reverted, reran green.

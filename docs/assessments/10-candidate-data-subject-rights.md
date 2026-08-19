# Candidate Self-Service Data Access and Deletion

Severity: P1 · Type: Missing specification → Adds

## Summary

A candidate had no way to see what the platform holds about them, or ask for it to be deleted, without contacting the hiring team directly. UU PDP grants a right to access and a right to erasure. This adds both, reachable straight from the post-interview screen, authenticated by the same invite token a candidate already holds — no login system needed.

## Analysis

Every existing candidate-facing endpoint (`candidate_info`, `audio_complete`, `consent`) already uses the invite token as identity proof, since candidates never create an account. The gap was that nothing let a candidate look at their own data or ask for its removal — only assessors, via a JWT-authenticated export endpoint, could see a candidate's transcript and verdict.

## Options & Trade-off

**Option A — Require candidates to email the hiring team for any data request.**
Technically satisfies the law's letter but not its intent: a manual, unscoped process that depends on someone remembering to act on an email, with no audit trail of what was actually deleted or when.

**Option B — Token-authenticated self-service endpoints, reusing the invite token as identity (chosen).**
The token already proves "this is the person this session belongs to" for three other endpoints. Extending that same proof to a read and a delete action costs no new auth mechanism and matches how the rest of the candidate-facing API already works.

**Option C — Require a fresh one-time code sent to the candidate's email before allowing access/deletion.**
More conservative, but this app never collects candidate email — only a name and the interview data itself. Adding an email-verification step would mean collecting a new piece of PII just to protect other PII, which runs against data minimization.

## Solution

- `GET /sessions/:token/my_data` — returns candidate name, full transcript, verdict, and skills, mirroring what an assessor can already see about this candidate.
- `POST /sessions/:token/my_data/delete` — calls `Session#purge_personal_data!` (the same method the retention task uses — one definition of "what gets deleted," see `11-retention-policy.md`).
- `MyDataDialog.tsx` on the interview-complete screen: fetches and displays the data, gates deletion behind an `AlertDialog` confirmation (same destructive-action pattern as "End Interview"), and reflects the purged state in place after deletion rather than closing the dialog.

## Acceptance Criteria

- A candidate can view their own name, transcript, verdict, and skills using only their invite token.
- An unknown or invalid token returns 404, not a silent empty response.
- Requesting deletion purges `candidate_name` and every transcript turn's text, matching the retention task's purge behavior exactly.
- Deletion requires an explicit confirmation step — no single click deletes data.
- Calling delete twice does not error or double-purge.
- After deletion, viewing "my data" again reflects the purged state rather than the original data.

## Tests & Verification

- RSpec: `sessions_my_data_spec.rb` covers fetch (including verdict/skills when a portfolio exists), 404 for unknown tokens, deletion, idempotent repeated deletion, and that a subsequent fetch reflects `data_purged: true`.
- Vitest: `MyDataDialog.test.tsx` (loads and displays name/transcript, shows an error state on fetch failure, requires confirmation before calling delete, reflects the purged state without re-fetching, skips fetching entirely while closed), `InterviewPage.myData.test.tsx` (the link appears on the complete screen and opens the dialog with the correct token).
- Seeded fault: removed the `purge_personal_data!` call from the delete action, reran the request spec, watched the purge assertion fail, restored, reran the full suite green.

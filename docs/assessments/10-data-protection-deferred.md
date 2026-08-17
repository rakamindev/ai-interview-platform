# Deferred: Data Subject Rights, Retention Policy, Encryption at Rest

Severity: P1 (rights, retention) / P2 (encryption) · Type: Missing specification → Documented, not built

## Summary

While closing the consent gap (see `01-candidate-consent-uu-pdp.md`), a codebase survey turned up three related UU PDP gaps that this PR documents but does not implement: candidates have no way to access or delete their own data, no retention or expiry policy governs how long transcripts and sessions persist, and candidate name plus transcript text are stored in plaintext. Each deserves its own review rather than riding along inside the consent change.

## Analysis

- **Data subject rights.** `CandidatesController#export` exists, but only for assessors, authenticated with a JWT. Candidates never log in and have no session-token-based equivalent — a real "request my data" or "delete my data" flow needs its own auth model question answered first (how does a candidate prove which session is theirs, weeks after the interview ended, without a login system?).
- **Retention policy.** No table has an `expires_at`, `deleted_at`, or equivalent column. No Sidekiq cron job or scheduled task touches old sessions. A candidate's transcript and portfolio live forever by default.
- **Encryption at rest.** No `attr_encrypted`, no `pgcrypto`, no encrypted column anywhere in the schema. `sessions.candidate_name` and `transcript_turns.text` are both plain columns.

## Options & Trade-off

**Option A — Build all three in this PR alongside consent.**
Each is a meaningfully sized feature on its own: candidate data rights need an auth mechanism for a user type that currently has none; retention needs a policy decision (how long is "long enough" for a hiring record?) plus a background job; encryption touches key management and potentially every read path that currently queries these columns directly. Bundling all three into the consent PR would make it too large to review properly and would force policy decisions (retention length, in particular) that are a business call, not an engineering one.

**Option B — Document each as a specific, actionable finding; build none this slice (chosen).**
Keeps this PR reviewable and keeps the actual UU PDP blocker (consent) shipping on time, while making sure these three gaps are visible and specific rather than silently absent from the report.

**Option C — Build a minimal proof-of-concept for one of the three (e.g., encrypt just `candidate_name`).**
Considered, but a partial encryption implementation (one field encrypted, transcript text still plaintext) risks reading as "handled" when it isn't, and doesn't resolve the harder question of key management. Better to document the full scope than ship a partial fix that looks more complete than it is.

## Solution (proposed, not built)

- **Data subject rights:** a token-based candidate self-service endpoint, reusing the same invite-token authentication pattern already used for `candidate_info`/`audio_complete`/`consent` — a candidate's invite token doubles as proof of identity for their own session, scoped to read-only export and a delete-my-data action that soft-deletes the session and hard-deletes the transcript text.
- **Retention:** an `expires_at` column on `sessions`, set at creation to some policy-defined window (e.g., 90 days post-interview), plus a daily Sidekiq job that purges transcript text and audio-adjacent data past that date while keeping the portfolio verdict/skill scores for historical hiring records.
- **Encryption:** Rails 7's built-in `encrypts` attribute API on `candidate_name` and `transcript_turns.text`, backed by Rails' credential-derived keys — no new infrastructure dependency, and it's the path of least resistance given the app is already on Rails 7.

## Acceptance Criteria (for when this is built)

- A candidate can prove ownership of their own session via their invite token and request an export or deletion without needing a login system.
- Deleted transcript text is unrecoverable, but the aggregate verdict/skill scores survive for the hiring team's records unless the candidate requests full deletion.
- Sessions past the retention window are purged automatically, without manual intervention, and the purge is logged.
- `candidate_name` and transcript text are unreadable from a raw database dump or backup without the application's encryption key.

## Tests & Verification

Not applicable — no code shipped for this item in this PR. Flagging here so it's tracked as a specific, scoped finding rather than an omission discovered later.

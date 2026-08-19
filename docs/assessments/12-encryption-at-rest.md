# Encryption at Rest for Transcript Text

Severity: P2 · Type: Missing specification → Adds (partial — see scope note)

## Summary

Transcript text sat in the database as plain text, readable directly from a database dump or backup with no application-layer protection. This encrypts `transcript_turns.text` using Rails 7's built-in ActiveRecord Encryption. `candidate_name` deliberately stays plaintext this round — see the scope note below for why.

## Analysis

`Candidates::Query#call` runs `sessions.candidate_name ILIKE ?` for the candidate search feature (`app/services/candidates/query.rb:60`). Rails' encryption supports either non-deterministic mode (strongest, no equality queries at all) or deterministic mode (exact-match only, via a blind index). Neither supports a partial substring `ILIKE '%term%'` query. Encrypting `candidate_name` as-is would silently break candidate search — the query would either error or, worse, quietly return nothing, since the ciphertext bytes never match `LIKE '%plaintext%'`.

`transcript_turns.text`, by contrast, is never queried by content anywhere in the codebase — confirmed by tracing every reference to `transcript_turns`: coverage analysis, portfolio generation, transcript display, and export all load full records, never filter by text content. It was the safe, immediate encryption target.

This project has no Rails credentials file — secrets live in `config/application.yml` via Figaro, loaded into `ENV`. Wiring ActiveRecord Encryption's keys from `ENV` instead of credentials required a `config.before_initialize` hook in `config/application.rb`, not a `config/initializers/*.rb` file — the framework's own `active_record.encryption` initializer reads these config values earlier than app-level initializers run, so a late assignment is silently ignored.

## Options & Trade-off

**Option A — Encrypt both `candidate_name` and `transcript_turns.text` now, rebuild search around a blind index.**
The complete fix, but a blind-index (deterministic, hashed, indexed) column for prefix/substring search is a second feature in its own right — schema change, reindexing existing data, and a decision about whether prefix-only search is an acceptable trade-off versus today's full substring `ILIKE`. Too large to fold into "encrypt this column."

**Option B — Encrypt `transcript_turns.text` now; document `candidate_name` as a scoped follow-up (chosen).**
Ships the encryption that has zero functional trade-off today, and states the `candidate_name` gap explicitly rather than either silently leaving it unencrypted with no explanation, or breaking search to force the issue.

**Option C — Leave both plaintext until the search feature can be redesigned.**
Leaves transcript text — arguably the more sensitive of the two, since it's what the candidate actually said — unprotected for no compensating benefit. Rejected.

## Solution

- Rails 7 ActiveRecord Encryption keys generated via `bin/rails db:encryption:init`, stored in `config/application.yml` (git-ignored, consistent with how every other secret in this project is handled) and read via `config.before_initialize` in `config/application.rb`.
- `TranscriptTurn#encrypts :text`, non-deterministic (no search dependency to preserve).
- `support_unencrypted_data = true` so rows written before this shipped keep reading correctly.
- Migration re-saves every existing `transcript_turns` row in batches of 500, converting plaintext to ciphertext on write.

## Acceptance Criteria

- `transcript_turns.text` is unreadable as plaintext from a raw SQL query against the column.
- Reading `text` through the `TranscriptTurn` model returns the original plaintext, unchanged.
- Every row written before this migration is ciphertext after running it — no row is silently left in plaintext.
- No existing feature that reads transcript text (coverage analysis, portfolio generation, transcript display, export) changes behavior.
- `candidate_name` remains searchable via the existing `ILIKE` query, unaffected.

## Tests & Verification

- RSpec: `transcript_turn_spec.rb` — a raw SQL select against the column does not contain the original plaintext; the model's `text` accessor returns the original value.
- Full RSpec suite (59 examples at that point) reran green after the migration, confirming no downstream consumer of transcript text broke.
- Seeded fault: removed `encrypts :text` from the model, reran the spec, watched the "not to include" assertion fail because the raw column held plaintext again, restored, reran green.

## Follow-up (not built this slice)

Encrypting `candidate_name` needs a blind-index or trigram-based search column designed alongside it — a separate, scoped piece of work, not a variation on this one.

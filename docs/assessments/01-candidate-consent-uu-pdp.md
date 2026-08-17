# Candidate Consent Before Interview Start (UU PDP)

Severity: P0 · Type: Missing specification → Adds

## Summary

A candidate could start an interview, have their voice streamed to Google's Gemini and transcribed, with no disclosure and no consent captured anywhere in the system. Indonesia's Personal Data Protection Law (UU PDP No. 27/2022) requires explicit consent before processing personal data, and voice data that identifies a person carries extra weight under that law. This closes the gap: a consent dialog gates both entry points to the interview, and the backend independently refuses to open the interview websocket if no consent record exists.

## Analysis

Two buttons started the interview without any consent step: `HardwareCheck.tsx`'s "Start Interview" and `InterviewPage.tsx`'s direct "Start Interview" button for candidates who already passed hardware checks. Neither the `Session` model nor any table recorded whether a candidate had agreed to anything. The audio websocket middleware authenticated the session token and checked whether the session had ended, but had no concept of consent at all.

A codebase survey during planning confirmed the surrounding gaps: `candidate_name` and full transcript text are stored in plaintext, no candidate-facing export or deletion endpoint exists, and no retention or expiry policy governs how long this data lives. Those three are documented separately (see `10-data-protection-deferred.md`) rather than folded into this change, since each is its own architectural decision.

## Options & Trade-off

**Option A — Frontend-only dialog, no backend record.**
Cheapest to build. Fails the moment a candidate opens the raw websocket URL directly, or a developer tool script bypasses the React app — the "consent" would exist only in browser state, gone on refresh, unverifiable after the fact.

**Option B — Backend consent record + guard, frontend dialog on top (chosen).**
A `consents` table tied to the session records who agreed, when, and under what policy version. The websocket middleware checks this record before opening the Gemini connection, independent of whatever the browser did. Costs one migration, one model, one route, one guard clause — small, and it means "consent recorded" is a durable fact instead of a UI state.

**Option C — Consent as a boolean column on `sessions` instead of a separate table.**
Simpler schema, but loses `given_at`, `policy_version`, and `ip_address` — exactly the audit trail a data protection law asks for if a candidate later disputes what they agreed to. Rejected for that reason.

Option B wins on contextual fit: this is a compliance requirement, and compliance requirements need an audit trail that survives a page refresh and a support ticket, not just a client-side flag.

## Solution

- `consents` table: `session_id`, `given`, `given_at`, `policy_version`, `ip_address`.
- `Session#consent_given?` delegates to the association.
- `POST /sessions/:token/consent` — token-authenticated like the existing `candidate_info`/`audio_complete` endpoints, no JWT, since candidates never log in.
- `AudioWebSocketMiddleware#authenticate_and_load` rejects the connection with `"Consent required before starting the interview"` if `consent_given?` is false, before any Gemini connection opens.
- `ConsentDialog.tsx`, built from the shared `ui/dialog.tsx` primitives, names Google Gemini explicitly, states that processing happens outside Indonesia, and links to a new `/privacy` page. Escape key and outside-click are disabled — accept or decline are the only ways out.
- Decline records the refusal (not just silence) and shows a blocked screen instead of silently disabling a button.

## Acceptance Criteria

- A candidate who has never consented sees the dialog before either Start Interview button becomes reachable.
- Accepting records `given: true`, `given_at`, `policy_version`, and the candidate's IP, then reveals the hardware check / start flow.
- Declining records `given: false` and shows a blocked screen; no path back into the interview without a page refresh.
- A websocket connection attempt with no consent record is rejected server-side, regardless of what the frontend shows.
- Reconsenting after a decline updates the same consent row — never creates a duplicate.
- A candidate who already consented (e.g., reloaded the page) does not see the dialog again.

## Tests & Verification

- RSpec: `session_spec.rb` (`consent_given?` for no record / declined / given), `sessions_consent_spec.rb` (record, decline, idempotency, unknown token, `candidate_info` reflects consent state), `audio_websocket_middleware_spec.rb` (rejects without consent, allows with consent, rejects after an explicit decline).
- Vitest: `ConsentDialog.test.tsx` (names Gemini and cross-border processing, links to `/privacy`, accept/decline callbacks, disabled while submitting), `InterviewPage.consent.test.tsx` (dialog blocks Start Interview, accept reveals hardware check, decline shows the blocked screen, backend-confirmed consent skips the dialog entirely).
- Seeded fault: removed the `return [nil, ...]` guard line in the middleware, watched two channel specs fail with the exact expected assertion, restored it, reran green.

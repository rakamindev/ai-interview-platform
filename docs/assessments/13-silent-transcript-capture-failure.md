# Silent Transcript Capture Failure

Severity: P0 · Type: Defective implementation → Fixed

## Summary

`save_transcript_turn` caught every persistence error, logged it, and moved on — the interview kept running as if nothing broke. A candidate could complete an entire session with zero transcript saved, and nothing anywhere told an assessor "this is missing because it failed," versus "the candidate said nothing." Found live: a stale server process (from before an unrelated encryption config change, see `12-encryption-at-rest.md`) raised a configuration error on every single turn save, and 24 turns across 3 real sessions were silently dropped before this surfaced.

## Analysis

`app/channels/audio_websocket_middleware.rb:649-659` wrapped `session.transcript_turns.create!` in a broad `rescue StandardError => e` that only called `Rails.logger.error`. This is defensible for a genuinely transient, one-off failure (a single dropped turn shouldn't kill an interview), but it has no concept of a *persistent* failure — the same misconfiguration or connectivity problem fails every subsequent turn for the rest of the session, and the logged error is the only trace anywhere. Neither the assessor's transcript view nor the candidate's own data view had any way to distinguish "empty because nothing was said" from "empty because we failed to record it."

The trigger this time was operational, not a logic bug: Puma keeps its boot-time config in memory for the life of the process, and `config/application.yml` changes (adding the encryption keys) only take effect after a restart. The running server from before that change never had `key_derivation_salt` configured, so every `TranscriptTurn` write raised `ActiveRecord::Encryption::Errors::Configuration`. The rescue caught it, logged it, and the interview continued for its full duration with an assessor and candidate both none the wiser.

## Options & Trade-off

**Option A — Let a transcript-save failure raise and end the session.**
Over-corrects: a single transient blip (a momentary DB hiccup) would abort an otherwise-fine interview. The problem isn't that failures happen, it's that they're invisible.

**Option B — Flag the session on first failure, keep the interview running (chosen).**
`Session#transcript_capture_failed_at` gets set once, on the first save failure, without aborting anything. The interview experience for the candidate is unaffected in the moment (they don't know it broke, which is correct — there's nothing they could do about it live), but every downstream viewer of the transcript now gets an honest signal instead of a blank state that looks identical to "nothing was said."

**Option C — Retry the save with backoff before giving up.**
Worth doing eventually for transient failures, but doesn't address this specific failure mode: a configuration error isn't transient, it will fail identically on every retry for the rest of the process's life. Flagging visibly is the higher-value fix; retry logic is a separate, complementary improvement.

## Solution

- `transcript_capture_failed_at:datetime` on `sessions`.
- `save_transcript_turn`'s rescue sets it once (`if session.transcript_capture_failed_at.nil?`) — one write per session, not one per failed turn.
- `Session#transcript_capture_failed?` helper.
- Exposed via the assessor `GET /sessions/:id/transcript` and the candidate's own `GET /sessions/:token/my_data`.
- `TranscriptPage.tsx` and `MyDataDialog.tsx` both render a distinct, explicit failure message instead of the generic "no transcript" empty state when this flag is true.

## Acceptance Criteria

- The first transcript-save failure in a session sets `transcript_capture_failed_at`; subsequent failures in the same session do not overwrite it.
- A session where every turn saved successfully never sets this field.
- Both the assessor transcript view and the candidate's own data view show a distinct failure message, not the same empty state used for a genuinely empty transcript.
- The interview itself is unaffected by a save failure — no crash, no early termination triggered by this specific failure.

## Tests & Verification

- RSpec: `audio_websocket_middleware_spec.rb` covers flagging on failure, not overwriting the timestamp on a second failure, and not flagging on success. `sessions_my_data_spec.rb` and `sessions_transcript_spec.rb` cover both serializers exposing the flag correctly.
- Vitest: `TranscriptPage.test.tsx` and `MyDataDialog.test.tsx` cover the distinct failure message appearing instead of, not alongside, the generic empty state.
- Seeded fault: removed the flag-setting line from the rescue block, reran the middleware spec, watched the "flags the session" example fail on a nil timestamp, restored, reran the full suite green (81 RSpec examples). Repeated on the frontend side by forcing the condition to always render the generic empty state, watched the "distinct failure banner" test fail, reverted, reran green (117 Vitest examples).
- **This is the AI verification moment for this PR's report**: the failure was invisible until this hardening pass exposed it — a stale server process silently dropped real interview data for three actual test sessions, and the only reason it was caught is that this specific fix was being built. Direct evidence for why "log and continue" is not sufficient for anything on a critical data path.

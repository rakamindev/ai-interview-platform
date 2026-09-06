# Interview lifecycle reliability slice

## What changed

- A candidate invite-token request cannot end an active interview on its own. The WebSocket records `completion_authorized_at` only after the server reaches natural coverage completion.
- Gemini/browser connection exhaustion becomes `failed`, not `ended`. Failed sessions do not create a portfolio or enqueue a portfolio-generation job.
- The frontend distinguishes a completed interview from an unavailable one. It never says an interview was recorded after reconnect exhaustion, invalid invite loading, or a permanent completion failure.
- Completion retries are bounded and session ending is row-locked, preventing duplicate completion jobs during retry/timeout races.
- The assessor coverage WebSocket checks the JWT role, not only the tenant claim.
- The Docker build excludes the local API configuration file so secrets are supplied at runtime instead of baked into an image.

## Data migration

`20260907000000_add_completion_and_failure_metadata_to_sessions` only adds nullable columns. It is reversible automatically and does not rewrite existing rows:

- `completion_authorized_at`
- `failure_code` (short operational code, never a provider payload)
- `failure_at`

Run `bundle exec rails db:migrate` from `api/` before deploying the API change.

## Verification and deliberate fault injection

Run `bundle exec rspec spec/services/sessions/completion_gate_spec.rb` from `api/`. The regression test proves an active session without the server marker is rejected.

For a seeded-fault demonstration, temporarily change `session.active?` in `Sessions::CompletionGate.allowed?` to `true` on a scratch branch. The second and third examples must fail, then revert that one-line change. Do not commit the fault. This repository already contained unrelated uncommitted changes, so a separate scratch worktree should be used before creating PR history.

## AI verification moment

The initial implementation trusted the browser call to `audio_complete` and converted any terminal WebSocket failure to the same "Interview Complete" UI. That looks plausible but is unsafe: a stale invite URL or provider outage could create a portfolio for an interview that never occurred. The corrected design stores a server-side authorization marker, returns a distinct failed state, and tests the gate directly.

An AI-generated request-spec fixture initially omitted `assessments.created_by`, because the Rails model does not validate it. Running the test against PostgreSQL exposed the database `NOT NULL` constraint. The fixture now supplies it; this is why the request test, rather than only a mocked unit test, remains in the suite.

The Gemini defaults were also stale. Gemini 2.0 Flash was shut down on 1 June 2026, so the sample configuration now uses current model identifiers. Verify availability in the target Google AI project before production rollout.

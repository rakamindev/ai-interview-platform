# Phase 4 — Backend changes, explained for a frontend dev

This is the phase that actually fixes the P0 bug the whole versioning mechanism (Phases 2-3) exists for. It's the biggest phase so far and touches more files than the plan doc originally called for — I found a gap partway through and had to widen the fix. Read on for why.

## The bug, concretely

A recruiter creates an Assessment with 5 skills, invites a candidate (an interview `Session` gets created, an invite link goes out), then — before that candidate actually connects and starts the interview — edits the assessment and swaps 2 skills. Two things happen today, both wrong:

1. The candidate's **coverage tracking** (which skills has the interview covered so far) gets initialized from whatever skills the assessment has *right now*, not what it had when they were invited.
2. The candidate's **actual interview questions** — the system prompt fed to the AI interviewer — get compiled from whatever skills the assessment has *right now* too.

Two candidates invited to "the same" assessment at different times can silently end up interviewed on completely different criteria, with no record that anything changed.

## Where the real bug actually lived — the part the plan doc missed

The original plan said the fix was: change `Sessions::StartHandler` (coverage maps) and `Assessments::SystemPromptCompiler` (interview prompt) to read from a frozen snapshot instead of the live assessment. I started there, but while tracing exactly how the system prompt reaches Gemini, I found the real mechanism was one level deeper than the plan described.

`app/channels/audio_websocket_middleware.rb` — the code that handles the candidate's live WebSocket connection — didn't call `SystemPromptCompiler` fresh for each connection. It read a **cache column**, `assessment.system_prompt`, populated once by a background job (`SystemPromptGeneratorWorker`) whenever an assessment is created or edited. That cache is a single value **shared by every session for that assessment** — so if the assessment gets edited (and the worker re-runs) between when candidate A is invited and when candidate A actually connects, candidate A gets the new prompt, silently. Fixing only `StartHandler` and the compiler's constructor, as originally planned, would have fixed the coverage-map half of this bug and left the actual interview content — the more important half — still broken. I widened the fix to cover this once I found it (documented in `assessment/IMPLEMENTATION_PLAN.md` §8's decision log, dated 2026-08-18).

The good news: that cache column and its worker aren't wasted code — they're still genuinely useful for a **recruiter-facing preview** of the compiled prompt (returned in `assessments_controller.rb`'s JSON response, presumably shown somewhere in the assessment edit UI). That part is completely untouched. Only the *live interview connection* stopped trusting it.

## The changes, file by file

**`app/services/sessions/creator.rb`** (new) — a small class (a "PORO" — Plain Old Ruby Object, the repo's term for a service class that isn't an ActiveRecord model, Sidekiq worker, or controller) that builds and saves a `Session`, stamping it with the assessment's *current* version **at the moment of invite**:
```ruby
def call
  session = @assessment.sessions.new(
    candidate_id: @candidate_id,
    candidate_name: @candidate_name,
    tenant_id: @tenant_id,
    assessment_version_id: current_assessment_version&.id
  )
  session.save
  session
end
```
This replaced logic that used to live inline in the controller's `create` action. Pulling it into its own class means a later phase (bulk CV-screening auto-invites, which won't go through this controller at all) can call the exact same path instead of re-implementing invite logic a second time — the same reasoning as extracting a shared hook or utility function on the frontend when two places need identical behavior.

**`app/controllers/api/v1/sessions_controller.rb#create`** — now just calls `Sessions::Creator.new(...).call` and renders the result. Same external API, no request/response shape change.

**`app/services/sessions/start_handler.rb`** — `initialize_coverage_maps` now reads `session.assessment_version.skills_snapshot` (the frozen snapshot from Phase 2) instead of `session.assessment.assessment_skills` (live). One important detail: `skills_snapshot` is a `jsonb` column, so its array elements are plain hashes with **string** keys (`skill['skill_id']`), not the method-style access (`skill.skill_id`) you get on a real `AssessmentSkill` row — the code has to know which shape it's working with.

**`app/services/assessments/system_prompt_compiler.rb`** — used to take a whole `Assessment` object; now takes `language:` and `skills:` directly as keyword arguments. This lets it compile a prompt from *either* a live `Assessment`'s skills (the worker/preview path) *or* a frozen version's `skills_snapshot` (the live interview path), without knowing or caring which. To make both inputs work through the same internal code (which reads `skill.skill_label`, `skill.scope_include`, etc.), snapshot hashes get wrapped in `OpenStruct` at the constructor boundary — `OpenStruct` is a Ruby stdlib class that turns a hash into an object with matching method-style accessors, so `OpenStruct.new({'skill_label' => 'Ruby'}).skill_label` returns `'Ruby'`. It's a small normalization step so the rest of the class never has to branch on "is this a hash or a real record."

**`app/channels/audio_websocket_middleware.rb`** — the file the original plan missed (see above). The old `ensure_system_prompt` method (lazily regenerate-and-cache onto `assessment.system_prompt` if blank) is gone from the live-connect path entirely, replaced by `compile_session_system_prompt(session)`, which compiles fresh from `session.assessment_version` every time a candidate connects — cheap, since the compiler is "pure string interpolation, no LLM call," so there's nothing worth caching. The compiled value gets stashed on the per-connection `ConnectionState` object (a small class the app already uses to carry state between WebSocket event callbacks) so the code that actually opens the Gemini connection can read it without going back to the database.

**`app/models/session.rb`** — `belongs_to :assessment_version, optional: true` (nullable, matching the column added in Phase 2). Also fixes a *second*, unrelated bug the plan doc flagged as F2: `invite_url` used to build candidate links from `APP_BASE_URL` — documented in this repo's own README as the **backend** host — even though `/interview/:token` is a **frontend** route. It now uses a new `WEB_BASE_URL` env var instead. Without this, every invite email (a later phase) would have sent candidates to the API, not the app.

**`app/models/assessment.rb`** — one-line correction to Phase 2's own callback. It was building `skills_snapshot` from `assessment_skills.reload.map { ... }` with no explicit ordering, but the *live* code paths this phase now replaces always explicitly did `.order(:display_order)`. Without matching that, a candidate's skills could show up in a different order than the recruiter configured. Fixed to `.reload.sort_by(&:display_order).map { ... }`.

**Config** (`config/application.yml.sample`, `k8s/configmap.yaml`, `README.md`) — `WEB_BASE_URL` documented alongside the existing `APP_BASE_URL`.

## Specs — the actual P0 regression test

`spec/services/sessions/start_handler_spec.rb` is the one that matters most: it creates a session (which snapshots the assessment's skills at that moment via `Sessions::Creator`), *then* edits the assessment's skills (destroy one, add another, via nested attributes — the same path a recruiter's real edit takes), then runs `StartHandler` and asserts the resulting coverage maps still show the **original** skill, not the edited one. That's the bug, proven fixed.

A second test in the same file covers the doc's other explicit requirement: a session with a `nil` `assessment_version_id` (one created before Phase 2's backfill ran, or in some future scenario where versioning data is missing) still starts correctly — falling back to the assessment's live skills rather than crashing. `spec/services/assessments/system_prompt_compiler_spec.rb` covers the compiler's two input shapes (hash snapshot vs. live records) directly, and `spec/services/sessions/creator_spec.rb` confirms a new session gets stamped with the assessment's current version.

One test-setup detail worth flagging (a repeat of something from earlier phases, one more time for a new reason): building a skill via `create(:assessment_skill, assessment: assessment)` directly, instead of through the assessment's nested attributes, does **not** trigger `Assessment`'s `after_save` — so no version snapshot ever captures a skill added that way. The regression test has to add its skill through `assessment.update!(assessment_skills_attributes: [...])`, exactly like a real recruiter edit, for the version snapshot to actually contain it.

## Running it yourself

```bash
cd api
bundle exec rspec
bundle exec rails zeitwerk:check
```

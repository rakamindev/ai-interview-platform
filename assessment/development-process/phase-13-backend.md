# Phase 13 — Backend changes, explained for a frontend dev

One new endpoint, reusing infrastructure Phase 6 already built. No new service, no new worker
logic — this phase is almost entirely about *when* to call something that already exists.

## Why this phase exists

Live-testing the CV screening feature surfaced entries stuck in `needs_review` with
`decision_reason: model_failed` and no score. Rather than guess, the actual cause was traced with
timestamped log correlation: `[Gemini::HttpClient] API error 503: "This model is currently
experiencing high demand..."` — Gemini's own capacity limit, a transient error, not a bug in this
app or a bad API key (an earlier guess based on stale, unrelated log lines from hours earlier was
wrong — corrected once the *current*, timestamped entries were actually checked). Since it's
transient, simply running the same pipeline step again often succeeds. Before this phase, the only
way to retry was re-uploading the whole CV as a brand new entry.

## The new endpoint

`POST /api/v1/cv_screening_entries/:id/reanalyze`, added to `config/routes.rb` next to the
existing `review`/`file` member routes on the same resource. In `CvScreeningEntriesController`:

```ruby
def reanalyze
  unless @entry.decision == 'needs_review' && @entry.decision_reason == 'model_failed'
    return json_error('Only an entry that failed to analyze can be re-analyzed', :unprocessable_entity)
  end

  @entry.update!(decision: 'pending', decision_reason: nil, score: nil)
  CvScreeningProcessEntryWorker.perform_async(@entry.id)

  json_response(entry: entry_json(@entry))
end
```

The guard is deliberately narrow: only `model_failed`, not any `needs_review` entry. A
`below_private_threshold` entry reached a real answer from a Gemini call that actually succeeded —
re-running it wouldn't produce a different score, since the same CV against the same requirements
gives the same result. A `parse_failed`/`empty_text`/`no_email_detected` entry failed for a reason
intrinsic to the file itself (corrupt, no text layer, no email present) — re-running extraction on
the exact same bytes fails identically every time. `model_failed` is the one case where the
failure was external (a network call breaking), which is genuinely worth retrying.

## Why no new retry logic was written

Resetting the entry's `decision` back to `'pending'` and calling
`CvScreeningProcessEntryWorker.perform_async(entry.id)` is the entire mechanism — the exact same
worker Phase 6 already built handles everything else. Its own idempotency guard,

```ruby
return unless entry.pending?
```

is the reason this works with zero new pipeline code: an entry that isn't `pending` is treated as
already-resolved and skipped automatically (this is also what stops the pipeline from ever
double-processing an entry a recruiter already reviewed by hand). Setting it back to `pending` is
the one and only thing needed to make the entry eligible for the pipeline again — everything
downstream (extraction, email detection, the two Gemini layers, the decision) runs exactly as it
does for a brand new upload, because as far as that worker is concerned, it *is* a fresh run.

## Specs

`spec/requests/api/v1/cv_screening_entries_spec.rb` gained two cases: a `model_failed` entry
resets to `pending` and enqueues the worker (asserted against
`CvScreeningProcessEntryWorker.jobs`, Sidekiq's own test-mode job array — this codebase's `rspec`
suite runs Sidekiq in `fake!` mode via `spec/rails_helper.rb`'s `require 'sidekiq/testing'`, so
jobs are captured rather than actually executed during the test run); and a
`below_private_threshold` entry is refused with `422` and left completely untouched.

## Running it yourself

```bash
cd api
bundle exec rspec spec/requests/api/v1/cv_screening_entries_spec.rb
bundle exec rspec
bundle exec rails zeitwerk:check
```

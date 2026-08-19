# Phase 14 — Backend changes, explained for a frontend dev

Same shape as Phase 13's endpoint — one new controller action, no new service or worker logic.
The interesting part of this phase isn't the new endpoint itself, it's a real bug it surfaces and
fixes along the way in code that already existed.

## Why this phase exists

Live testing left several CV entries permanently showing "Processing" — `decision: pending`
forever. The cause: `CvScreeningProcessEntryWorker.perform_async(entry.id)` (called on every
upload) pushes a job onto a Redis queue, but nothing was actually consuming that queue — no
`bundle exec sidekiq` process was running at the time. The job just sat there. Before this phase,
there was no way out of that state for a recruiter short of someone editing the database directly.

## The new endpoint

```ruby
def cancel
  return json_error('Only a still-processing entry can be cancelled', :unprocessable_entity) unless @entry.pending?

  @entry.update!(decision: 'needs_review', decision_reason: 'cancelled')
  CvScreenings::BatchNotifier.new(@entry.cv_screening_batch).evaluate_after_entry_decision

  json_response(entry: entry_json(@entry))
end
```

Moves a stuck entry to `needs_review`, never any flavor of rejection — an entry whose analysis
never actually ran has had zero real evaluation, so treating it as a rejection would be actively
misleading, and would violate the same "no system failure produces an automated rejection"
invariant every other failure path in this pipeline (Phase 6) already respects.

`decision_reason: 'cancelled'` is a brand new value, not one of the pipeline's own reasons
(`parse_failed`, `model_failed`, etc.) — this is honest about *why* the entry landed here: nothing
about the CV or the Gemini call failed, a human just stopped waiting. Worth knowing:
`cv_screening_entries.decision_reason` is a plain `string` column with no database check
constraint or Rails `inclusion` validation (only `decision` itself is validated against a closed
list) — so adding a new reason value here needed zero migration and zero model change.

## The bug this phase found and fixed along the way

This is the more interesting part. `CvScreenings::BatchNotifier#evaluate_after_entry_decision`
(built in Phase 7) has this guard at its top:

```ruby
def evaluate_after_entry_decision
  return if @batch.cv_screening_entries.where(decision: 'pending').exists?
  return unless @batch.notification_status == 'pending'

  uniform_outcome? ? @batch.update!(notification_status: 'held') : release!
end
```

It deliberately waits until **every** entry in a batch has a final decision before deciding
whether to hold or release the batch's notification emails (FR5) — it can't know the outcome
distribution until everyone's done. But that means a single entry stuck at `pending` forever
doesn't just affect *that* entry — it silently blocks this evaluation from ever running for the
**entire batch**, even for other entries that finished deciding minutes or hours earlier. The only
visible symptom would be "the held-banner never shows up, and nobody ever gets notified" — with
nothing in the UI pointing at the actual cause.

`#cancel` calls this same method itself, right after updating the entry — the same
`evaluate_after_entry_decision` the worker already calls after every automated decision (Phase 7).
No new notification logic was written; cancelling the stuck entry is simply what removes it from
the "still pending" count that was blocking the evaluation from ever running.

## Reanalyze also needed to change

Phase 13's `reanalyze` endpoint only accepted `decision_reason == 'model_failed'`. A cancelled
entry deserves the same second chance — maybe Sidekiq is healthy again — so the guard became:

```ruby
REANALYZABLE_REASONS = %w[model_failed cancelled].freeze
```

with the check changed to `REANALYZABLE_REASONS.include?(@entry.decision_reason)`. Everything else
about `reanalyze` (reset to `pending`, re-enqueue the same worker) is unchanged.

## Specs

`spec/requests/api/v1/cv_screening_entries_spec.rb` gained: cancelling a `pending` entry moves it
to `needs_review`/`cancelled`; cancelling anything else is refused with `422`; and — the one
proving the actual bug fix, not just the entry's own state change — cancelling one stuck entry in
a batch that also contains an already-`invited` entry flips the batch's `notification_status` away
from `'pending'`, demonstrating the `BatchNotifier` unblock genuinely fires. `reanalyze`'s spec
file gained a case confirming a `cancelled` entry is accepted too.

## Running it yourself

```bash
cd api
bundle exec rspec spec/requests/api/v1/cv_screening_entries_spec.rb
bundle exec rspec
bundle exec rails zeitwerk:check
```

# Phase 20 — Backend changes, explained for a frontend dev

A bug found through real usage, then a deliberate feature removal that followed directly from it.
For the original design this phase changes, see [`phase-7-backend.md`](./phase-7-backend.md)'s FR5
section.

## The bug: notifications could get permanently stuck, silently

Reported directly: candidates auto-invited or auto-rejected by the pipeline never actually got an
email, while a recruiter manually clicking Invite/Reject on an entry worked fine. Grepping
`log/development.log` for every `Delivered mail` line confirmed it — every single one traced back to
the manual review controller action; `CvScreenings::BatchNotifier#release!` (the automated path) had
never once actually sent anything in the whole session, despite several batches already sitting at
`notification_status: "released"` in the database.

The bug was in `evaluate_after_entry_decision`'s uniformity check:

```ruby
# before
def evaluate_after_entry_decision
  return if @batch.cv_screening_entries.where(decision: 'pending').exists?
  return unless @batch.notification_status == 'pending'

  uniform_outcome? ? @batch.update!(notification_status: 'held') : release!
end

def uniform_outcome?
  decided_outcomes = @batch.cv_screening_entries.where(decision: %w[invited not_advanced]).distinct.pluck(:decision)
  decided_outcomes.size == 1
end
```

`uniform_outcome?` treats "exactly one distinct outcome" as the *only* held case, so anything else —
`decided_outcomes.size != 1` — falls through to `release!`. That's correct when there are genuinely
2 different outcomes (a normal mixed batch). But it's *also* what happens when there are **zero**
decided outcomes yet — e.g. a batch whose only entry so far landed on `needs_review` after a
transient Gemini rate-limit or the storage bug diagnosed earlier in this same session. `0 != 1` too,
so that case also called `release!`.

`release!` itself correctly found nothing to send (its query only matches `invited`/`not_advanced`),
but it *unconditionally* still set `notification_status: 'released'` at the end. That permanently
burned the batch's status the moment its first entry hit `needs_review` — and since
`evaluate_after_entry_decision`'s own guard only proceeds `unless notification_status == 'pending'`,
every future call for that batch became a silent no-op. When the entry later reached a genuine
decision (e.g. via the Re-analyze button, added back in Phase 13), nothing ever re-evaluated
notification for it — no exception, no log line, the email just never went out.

An existing spec had actually encoded this as *intended* behavior:

```ruby
it 'releases immediately when nothing auto-decided (every entry needs_review)' do
  create(:cv_screening_entry, cv_screening_batch: batch, decision: 'needs_review')
  described_class.new(batch).evaluate_after_entry_decision
  expect(batch.reload.notification_status).to eq('released')   # the bug, asserted as correct
  expect(ActionMailer::Base.deliveries).to be_empty
end
```

This was harmless when Phase 7 wrote it — there was no way yet for a `needs_review` entry to later
become a real decision. Phase 13's Re-analyze button made that possible, and nobody connected the
two: a `needs_review`-then-later-decided entry, in a batch small enough that nothing else had
decided anything yet, would now silently lose its notification forever. Small batches (exactly
what this session's manual CV-upload testing used) hit this hardest — one transient failure before
the entry's first success was enough to break it.

## The fix

```ruby
def evaluate_after_entry_decision
  return if @batch.cv_screening_entries.where(decision: 'pending').exists?
  return unless @batch.notification_status == 'pending'
  return if decided_outcomes.empty?

  decided_outcomes.size == 1 ? @batch.update!(notification_status: 'held') : release!
end

private

def decided_outcomes
  @batch.cv_screening_entries.where(decision: %w[invited not_advanced]).distinct.pluck(:decision)
end
```

One new guard: do nothing at all while zero outcomes are decided yet. `uniform_outcome?` became
`decided_outcomes`, a plain query the method itself can check for emptiness before deciding
held-vs-released.

## Then: FR5's confirm gate was removed entirely

Right after this fix, the next request was more direct: stop holding anything for confirmation at
all — auto-invite and auto-reject should always send immediately. That's a bigger change than the
bug fix above; see [`phase-7-backend.md`](./phase-7-backend.md)'s FR5 section for what the gate
originally did and why. `evaluate_after_entry_decision` lost its uniformity branch entirely:

```ruby
def evaluate_after_entry_decision
  return if @batch.cv_screening_entries.where(decision: 'pending').exists?
  return unless @batch.notification_status == 'pending'
  return unless @batch.cv_screening_entries.where(decision: %w[invited not_advanced]).exists?

  release!
end
```

The empty-outcomes guard from the bug fix stays — it's still exactly the mechanism that lets a
later-decided `needs_review` entry get correctly notified once it has a real outcome. What's gone
is the *branch*: there is no longer any path that produces `'held'`.

Three things were deleted outright, now that nothing can reach them:
- `POST /cv_screenings/:id/batches/:id/confirm` (`config/routes.rb`)
- `CvScreeningBatchesController#confirm` and its `set_batch` before_action (the controller's only
  user of `set_batch`, so that private method went too)
- `CvScreeningBatch#held_for_confirmation?`

`'held'` stays in `CvScreeningBatch::NOTIFICATION_STATUSES` — not because anything can produce it
anymore, but so a row already sitting at `'held'` from before this change doesn't fail its own
`inclusion` validation on a future save.

## Specs

`batch_notifier_spec.rb`:
- The test that had encoded the bug now asserts the correct behavior — stays `'pending'`, not
  `'released'`, when nothing's decided yet.
- A new regression test proves the actual reported scenario end-to-end: a `needs_review` entry that
  later reaches a real decision still gets notified on the second `evaluate_after_entry_decision`
  call.
- The old "holds the batch when uniform" test now asserts immediate release instead, since holding
  no longer exists.

`cv_screening_batches_spec.rb` — the two `POST .../confirm` request specs were deleted; the endpoint
they tested no longer exists.

## Running it yourself

```bash
cd api
bundle exec rspec spec/services/cv_screenings/batch_notifier_spec.rb spec/requests/api/v1/cv_screening_batches_spec.rb
bundle exec rspec
bundle exec rails zeitwerk:check
```

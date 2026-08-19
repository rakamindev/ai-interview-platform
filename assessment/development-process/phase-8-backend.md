# Phase 8 — Backend changes, explained for a frontend dev

Phase 8's real work is the frontend (see [`phase-8-frontend.md`](./phase-8-frontend.md)) — the CV screening pipeline itself was finished in Phases 5–7. This phase's backend changes are all small, reactive additions: things the UI genuinely needed that nobody had built yet, discovered by asking "what does a recruiter looking at this screen actually need to see or do?" rather than planned upfront.

## 1. Two new columns — one migration

`db/migrate/20260819000001_add_phase8_display_columns.rb`:

```ruby
add_column :cv_screening_entries, :score, :integer
add_column :vacancy_versions, :approximate, :boolean, default: false, null: false
add_column :assessment_versions, :approximate, :boolean, default: false, null: false
```

**`score`** — Phase 6's `DecisionEngine` always *computed* a 0–100 match score internally, but never stored it — it only stored the final `decision` (`invited`/`not_advanced`/`needs_review`). That's correct for what a *candidate* ever sees (§6's own invariant: no numeric score ever reaches a candidate), but a *recruiter* reviewing a borderline `needs_review` entry needs the number that drove the recommendation to make a sensible manual call. One line in `app/services/cv_screenings/decision_engine.rb`, right after Layer 2 resolves:

```ruby
@entry.update!(score: match.score)
```

**`approximate`** — Phase 2's backfill task (`lib/tasks/versions.rake`) creates one `VacancyVersion`/`AssessmentVersion` per pre-existing record when the versioning feature was first added, since those records had no "version at the time" to snapshot — the backfill just snapshots *current* state and calls it version 1. That's a real gap: it's not actually what the vacancy looked like when some now-ancient session was created, just the closest available approximation. The UI needs to say so rather than presenting it as fact, so the backfill task now passes `approximate: true`, and every version created normally afterwards defaults to `false`.

## 2. Session ↔ CvScreeningEntry, exposed both ways

`cv_screening_entries.session_id` already existed (added in Phase 7, for the invite email link). What Phase 8 adds is the *reverse* lookup — `app/models/session.rb`:

```ruby
has_one :cv_screening_entry, dependent: :nullify
```

Rails infers this is a `has_one` (not `has_many`) from the existing `belongs_to :session` on `CvScreeningEntry` plus the fact that `Inviter` only ever creates one session per entry. `dependent: :nullify` means deleting a session doesn't cascade-delete the CV screening entry — it just clears the FK, since the entry's own history (decision, score, filename) is worth keeping independently of whether that particular session still exists.

`sessions_controller.rb#session_json` then exposes it:

```ruby
cv_screening_entry_id: session.cv_screening_entry&.id,
cv_screening_score:    session.cv_screening_entry&.score
```

This is what lets `AssessmentInvitePage`'s candidate list show a "CV screening" badge (plus the score) next to a session that came from this pipeline, without a second API round-trip per session.

## 3. Listing a screening's upload batches

`POST /cv_screenings/:id/batches` (create) existed since Phase 5. Nothing could **list** them — but `CvScreeningDetailPage` needs to (for the FR5 held-banner from Phase 7, and to show which upload batch used an `approximate` vacancy version). `app/controllers/api/v1/cv_screening_batches_controller.rb`:

```ruby
# GET /api/v1/cv_screenings/:cv_screening_id/batches
def index
  batches = @cv_screening.cv_screening_batches.order(created_at: :desc)
  json_response(batches: batches.map(&method(:batch_json)))
end
```

`config/routes.rb` changes `resources :batches, only: %i[create]` to `only: %i[index create]`. `batch_json` also now includes `vacancy_version_approximate: batch.vacancy_version&.approximate || false` (the boolean from §1, denormalized onto the batch response so the frontend doesn't need a separate lookup), and both `batch_json`/`entry_json` now include the new `score` field.

## Specs

Existing specs got small additive assertions rather than new files: `decision_engine_spec.rb` checks `entry.score` is set correctly (including a threshold-minus-1 case, to make sure a losing score is still recorded even though the decision is `not_advanced`); `versions_spec.rb` checks the backfill sets `approximate: true`; `vacancy_spec.rb` checks a normally-created version defaults to `approximate: false`; `cv_screening_batches_spec.rb` adds a request spec for the new index action. Full suite: 91 examples passing (up from 90 after Phase 7).

## Running it yourself

```bash
cd api
bundle exec rails db:migrate
bundle exec rspec
bundle exec rails zeitwerk:check
```

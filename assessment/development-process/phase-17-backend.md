# Phase 17 — Backend changes, explained for a frontend dev

Unusually for this project's later phases, this one starts by fixing two bugs that were already
in the codebase before this phase touched anything — not bugs this phase introduced.

## The bugs, found before writing any new code

`vacancies_controller.rb` and `assessments_controller.rb` already had a `destroy` action and an
already-routed `DELETE` endpoint. Both looked like this:

```ruby
def destroy
  @vacancy.destroy
  json_response(message: "Vacancy deleted")
end
```

Two things were wrong with this, found by reading the actual schema and models rather than
assuming:

1. **Every Vacancy always has at least one `VacancyVersion`** (a `Vacancy` model callback creates
   one on every save — this app snapshots a version every time a vacancy is edited, for the same
   "don't let evaluation criteria drift under an in-flight candidate" reason covered in earlier
   phases). The `Vacancy` model's association was `has_many :vacancy_versions` with no `dependent:`
   option at all. In ActiveRecord, no `dependent:` means "do nothing to the children when the
   parent is destroyed" — so calling `.destroy` on a Vacancy would hit Postgres's own foreign key
   constraint (which defaults to `NO ACTION`, i.e. "refuse") and raise an unhandled 500 error,
   *every single time*, regardless of whether anything else was using the vacancy. Same bug,
   same shape, for `Assessment` → `AssessmentVersion`.
2. **Nothing checked whether a `CvScreening` referenced the vacancy/assessment at all.**
   `cv_screenings` has `vacancy_id`/`assessment_id` foreign key columns, but neither `Vacancy` nor
   `Assessment` had a Rails association pointing at `CvScreening` — so there was no way for the
   code to even ask "is this in use?" A raw `.destroy` call would eventually hit the *database's*
   foreign key constraint here too (once the versions bug above was fixed) and blow up the same way.

Both controllers also never checked whether `.destroy` actually succeeded — `Assessment` already
had `has_many :sessions, dependent: :restrict_with_error` (Rails' built-in "refuse to delete if
children exist" option, which makes `.destroy` return `false` and populate `.errors` instead of
raising) — but since the controller never looked at the return value, an Assessment with real
interview sessions would appear to "delete successfully" from the API caller's point of view while
Rails silently did nothing.

## The fix — model associations

```ruby
# vacancy.rb / assessment.rb
has_many :vacancy_versions, dependent: :destroy       # was: no dependent: at all
has_many :cv_screenings                                # new — no dependent:, this is a
                                                         # read/blocking check, not a cascade
```

`dependent: :destroy` tells Rails to delete the child rows *before* attempting to delete the
parent, so the foreign key never gets violated. The plain `has_many :cv_screenings` with no
`dependent:` option is deliberately just a normal association — it exists so the controller can
write `vacancy.cv_screenings.exists?`, not so anything cascades through it.

## The fix — controllers

Both `destroy` actions now look like this (Vacancy shown, Assessment is the same shape with an
extra Sessions check):

```ruby
def destroy
  blockers = deletion_blockers(@vacancy)
  return json_error("...", :unprocessable_entity, details: blockers) if blockers

  if @vacancy.destroy
    json_response(message: "Vacancy deleted")
  else
    json_error(@vacancy.errors.full_messages.to_sentence, :unprocessable_entity)
  end
end

private

def deletion_blockers(vacancy)
  screenings = vacancy.cv_screenings.select(:id, :name)
  return nil if screenings.empty?

  { deletable: false, reason: "cv_screenings",
    blocking_cv_screenings: screenings.map { |cs| { id: cs.id, name: cs.name } } }
end
```

`deletion_blockers` is called from two places: a new `GET /vacancies/:id/deletion_check` endpoint
(so the frontend can ask "would this be allowed?" *before* showing a confirmation dialog, picking
the right dialog variant immediately), and `destroy` itself. This is deliberate, not laziness — the
eligibility check the frontend calls first is only a courtesy for choosing the right UI; the actual
safety boundary is `destroy` re-running the identical check server-side every time, since the
state of the world can change in the gap between a recruiter opening the dialog and clicking
confirm (e.g. someone else creates a CV screening against this vacancy in another tab).

`AssessmentsController`'s version of `deletion_blockers` checks two things in order: CV screenings
first (has a concrete "go delete that" navigation target for the frontend), then
`assessment.sessions.exists?` (`reason: "sessions"` — nothing in this app lets a recruiter delete a
Session directly, so there's no navigation target for that case, just a message).

## `CvScreening` — no blocker, just cascading its own data

```ruby
def destroy
  if @cv_screening.destroy
    json_response(message: 'CV screening deleted')
  else
    json_error(@cv_screening.errors.full_messages.to_sentence, :unprocessable_entity)
  end
end
```

No `deletion_blockers` call — confirmed nothing else in the schema references a `CvScreening`
except its own children, which were already `dependent: :destroy` (`cv_screening_batches` →
`cv_screening_entries`) before this phase. Deleting a screening is always safe.

## The attachment cleanup nobody would have noticed missing

`CvScreeningEntry` has `has_one_attached :cv_file` (the uploaded PDF/DOCX, stored on R2). Rails'
`has_one_attached` does **not** automatically purge the underlying file when the owning record is
destroyed — this was already known in this codebase, because
`CvScreenings::RetentionSweep` (the 90-day PII cleanup job from an earlier phase) explicitly calls
`entry.cv_file.purge if entry.cv_file.attached?` rather than relying on any automatic behavior.
Cascading a `CvScreening#destroy` down through its batches to its entries would, without this,
delete every DB row cleanly but leave every actual file sitting in R2 forever — invisible in this
app (nothing lists orphaned blobs), a slow-burn storage cost, not a correctness bug, but real. Fixed
with a `before_destroy` on `CvScreeningEntry` itself, so it applies no matter what triggers the
destroy (this cascade, a future admin tool, a console session):

```ruby
before_destroy :purge_cv_file

private

def purge_cv_file
  cv_file.purge if cv_file.attached?
end
```

## Specs

New request specs for all three controllers: a Vacancy/Assessment with no CV screenings deletes
cleanly *and its versions are actually gone afterward* (the concrete proof the cascade fix works,
not just that the request returned 200); one with a CV screening attached is blocked, and the
response body's `blocking_cv_screenings` detail has the right id/name; an Assessment with an
existing Session is blocked with `reason: "sessions"`; a CvScreening with an attached file deletes
and the file's `ActiveStorage::Blob` row is confirmed gone too (proving the `before_destroy`
actually fires through the full batch → entry cascade, not just in isolation).

## Running it yourself

```bash
cd api
bundle exec rspec spec/requests/api/v1/vacancies_spec.rb spec/requests/api/v1/assessments_spec.rb spec/requests/api/v1/cv_screenings_spec.rb
bundle exec rspec
bundle exec rails zeitwerk:check
```

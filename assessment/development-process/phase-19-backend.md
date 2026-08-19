# Phase 19 — Backend changes, explained for a frontend dev

A small, focused change: one controller gains an eager-load and three extra response fields. For
the frontend reasoning (how it's rendered), see [`phase-19-frontend.md`](./phase-19-frontend.md).

## The question this answers

After Phase 18 made it possible to edit a `CvScreening`'s vacancy, assessment, or threshold after
candidates had already been uploaded and scored against it, the natural next question was: how
does a recruiter actually *see*, for any given candidate, which vacancy/assessment/threshold they
were actually screened against? Turned out there was no way — not even in the raw API response.
`GET /cv_screenings/:id/entries` (which powers the candidates table) returned nothing about
vacancy/assessment/threshold per entry, and the batches endpoint only exposed raw
`vacancy_id`/`assessment_id` integers, not human-readable names.

A second, related gap surfaced once this landed: the detail page's own "Auto-invite threshold"
banner (built in an earlier phase) reads `latestBatch?.threshold`, the same batch-snapshot value —
so editing a screening's threshold via `CvScreeningEditPage` and then looking at its detail page
made it *look* like the edit hadn't saved, when really the banner was correctly still reporting
what actually governed the already-decided candidates. `threshold` was added to `entry_json`
alongside the vacancy/assessment fields to fix both: the per-candidate view and a clearer banner
(see the frontend doc for the banner change).

## Where the data actually lives

`api/app/controllers/api/v1/cv_screening_entries_controller.rb`:

```ruby
# before
def index
  scope = @cv_screening.cv_screening_entries
  scope = scope.where(decision: params[:decision]) if params[:decision].present?
  scope = scope.order(created_at: :desc)
  ...
end

# after
def index
  scope = @cv_screening.cv_screening_entries.includes(cv_screening_batch: %i[vacancy assessment])
  scope = scope.where(decision: params[:decision]) if params[:decision].present?
  scope = scope.order(created_at: :desc)
  ...
end
```

`.includes(...)` is ActiveRecord's version of a JOIN FETCH / Prisma `include` — it preloads each
entry's `cv_screening_batch`, and that batch's `vacancy` and `assessment`, in a couple of extra
bulk queries up front instead of firing one query per entry per association (an N+1) as the
response gets serialized. Without it, a page of 20 entries would trigger up to 40 extra queries
just to read two names.

`entry_json` (the private serialization method — this codebase has no separate serializer layer,
see `phase-1-backend.md`'s concept table) then reads through that preload:

```ruby
def entry_json(entry)
  {
    id: entry.id,
    # ...existing fields...
    vacancy_role_title: entry.cv_screening_batch.vacancy.role_title,
    assessment_name:    entry.cv_screening_batch.assessment.name,
    threshold:          entry.cv_screening_batch.threshold
  }
end
```

## Why it reads `entry.cv_screening_batch.vacancy`, not `@cv_screening.vacancy`

This is the one line in the whole phase worth pausing on. `@cv_screening` is the *live* screening
record — after a Phase 18 edit, its `vacancy_id`/`assessment_id`/`threshold` may already point
somewhere new. `entry.cv_screening_batch` is the batch that entry actually belongs to, and
`CvScreeningBatch` snapshots its own `vacancy_id`/`assessment_id`/`threshold` from the parent
screening once, at upload time (see Phase 18's backend doc) — none of it changes afterward. Reading
through the batch, not the screening, is what makes this feature correct rather than just present:
it means the UI keeps showing what a candidate was *actually* judged against and by what threshold,
forever, regardless of what the screening's settings say today.

A request spec proves this end-to-end rather than trusting the model relationship alone: creates an
entry, then edits the *screening's* vacancy/assessment/threshold to something else entirely, then
hits `GET /entries` and asserts the response still reports the original (batch) vacancy/assessment
names and threshold — not the new ones.

## Running it yourself

```bash
cd api
bundle exec rspec spec/requests/api/v1/cv_screening_entries_spec.rb
bundle exec rspec
```

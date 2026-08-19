# Phase 18 — Backend changes, explained for a frontend dev

The smallest backend change in this project's phase history — one line, in one file. Worth its own
short note anyway, since the "why" is more interesting than the diff.

## The one-line fix

`api/app/controllers/api/v1/cv_screenings_controller.rb`'s `#update` action already existed before
this phase — it just couldn't rename a screening:

```ruby
# before
def cv_screening_update_params
  params.require(:cv_screening).permit(:vacancy_id, :assessment_id, :threshold)
end

# after
def cv_screening_update_params
  params.require(:cv_screening).permit(:name, :vacancy_id, :assessment_id, :threshold)
end
```

Rails' strong parameters (`permit`) is an allowlist — any key sent in the request body that isn't
listed here is silently dropped before it ever reaches the model, regardless of what the column
itself allows. `create`'s own permit list (`cv_screening_params`, a few lines above this one) *did*
already include `:name` — this was specifically an `update`-only gap, not a validation or column
issue. Confirmed via a new request spec (`spec/requests/api/v1/cv_screenings_spec.rb`) that a
`PATCH` now updates all four fields — name included — together in one request.

## Why nothing else needed to change

Every other field this phase's frontend edit form needed — `vacancy_id`, `assessment_id`,
`threshold` — was already permitted by `update` before this phase touched anything. That's not an
accident: `CvScreeningBatch` (built several phases earlier) already snapshots those same three
fields from its parent `CvScreening` at upload time specifically so they could keep being edited
safely afterward — see that model's own class comment, which says outright that this exists so "a
batch keeps scoring against the vacancy state it was uploaded against, even if the vacancy (or the
screening's own threshold) is edited later." In other words, the backend was already built
anticipating an edit page like this one; the frontend simply hadn't been built yet to use it.

## Running it yourself

```bash
cd api
bundle exec rspec spec/requests/api/v1/cv_screenings_spec.rb
bundle exec rspec
```

# Phase 3 — Backend changes, explained for a frontend dev

Short one. If you've read [`phase-1-backend.md`](./phase-1-backend.md) and [`phase-2-backend.md`](./phase-2-backend.md), you have everything needed to follow this — Phase 3 is a small, surgical retrofit that *uses* the version tables Phase 2 built, rather than introducing new concepts.

## What this phase is actually solving

A Fit/Gap report compares a candidate's portfolio against a vacancy's requirements. Today, `fit_gap_reports.vacancy_id` points at a **live** Vacancy row — one whose `role_title`/skills can be edited at any time. So a report generated in March, read in August after the vacancy was edited, silently ends up *looking like* it describes August's requirements, even though it was actually generated against March's. There's no way to tell, after the fact, what the vacancy actually looked like when the report was made.

Phase 2 built the fix mechanism (`VacancyVersion` — a frozen snapshot, see that doc). Phase 3 is where a real consumer actually starts using it: every time a Fit/Gap report is generated, it now also stamps *which* vacancy version it was generated against.

## The change — `app/services/fit_gap/engine.rb`

One line added to the existing `report.update!(...)` call, plus one small private method:

```ruby
report.update!(
  skill_comparisons: skill_comparisons,
  culture_narrative: narratives[:culture],
  overall_narrative: narratives[:overall],
  generated_at:       Time.current,
  vacancy_version_id: current_vacancy_version&.id   # ← new
)

private

def current_vacancy_version
  @vacancy.vacancy_versions.order(created_at: :desc).first
end
```

"Guaranteed to exist" is doing real work in that comment — it's safe to assume a version always exists here *because* of Phase 2: every `Vacancy` save creates one, and the backfill task covered every vacancy that existed before that callback shipped. So by the time this code runs, there's always at least one version to point at.

## What deliberately did **not** change

`app/controllers/api/v1/portfolios_controller.rb` still does exactly what it did before: `FitGapReport.find_by(...)&.destroy` followed by re-enqueuing generation, when a recruiter explicitly asks for a fresh report (`regenerate_fitgap`), and `find_or_initialize_by(portfolio_id:, vacancy_id:)` inside the engine itself keeps it to **one row per portfolio+vacancy pair, always the latest** — there's a unique DB index enforcing that. That design was already correct; this phase only adds *what version that one row was generated against*, it doesn't change when or how often a new report gets made.

Concretely: if nobody explicitly regenerates a report, editing the vacancy later does **not** silently reach back and change what that report claims to describe — `vacancy_version_id` stays frozen at whatever it was stamped with at generation time. Only an explicit regeneration re-stamps it to whatever the *current* version is by then.

## Specs — `spec/services/fit_gap/engine_spec.rb`

Three cases, matching the three sentences above:
1. Generating a report stamps it with the vacancy's current version.
2. If the vacancy is edited *without* regenerating the report, the report keeps referencing the old version — proving nothing silently drifts.
3. Explicitly regenerating **after** an edit re-stamps the *same* report row (not a new one) to the *new* current version.

One test-setup gotcha worth flagging, since it's the second time it's shown up (first was Phase 2's specs): building a vacancy, then creating a `vacancy_skill` for it directly via the factory, leaves the in-memory `vacancy` object's cached `vacancy_skills` association stale (still empty) — because Phase 2's own `after_save` callback already loaded and cached it as empty at creation time, before the skill existed. The fix is the same as before: `vacancy.reload` before using it again. This isn't a product bug, just something to know about when writing tests against these models.

## Running it yourself

```bash
cd api
bundle exec rspec spec/services/fit_gap/engine_spec.rb
bundle exec rspec
bundle exec rails zeitwerk:check
```

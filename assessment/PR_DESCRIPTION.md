# Trustworthy skill ratings: no level without evidence

## Why

A portfolio level is what an assessor acts on, and it changes a candidate's
outcome. Before this PR the system turned *missing evidence* into *a low score*:

- A skill the interview never reached was stored as **L1** (`nil.to_i.clamp(1, 5)`)
  and then counted as a **gap** against the vacancy.
- Evidence quotes were never checked against the transcript.
- The fit/gap **Required** column was always blank (`required_level` vs `expected_level`).
- Portfolio and override endpoints weren't tenant-scoped: a cross-tenant override
  returned **201** and a cross-tenant export returned **200**.
- **PDF export crashed** for any portfolio with an assessor override.

## What changes

**API**
- `Portfolios::Generator` classifies each configured skill as `rated`,
  `not_assessed` or `insufficient_evidence`. A level needs at least one quote found
  verbatim in a candidate turn (`Portfolios::EvidenceMatcher`, which stores the
  turn number). Confidence is derived from coverage (PRD 01 §5), not taken from the model.
- One transaction per save. Rows are updated in place, so assessor overrides survive
  regeneration. An atomic claim stops duplicate jobs, and a dead worker can be taken
  over after 10 minutes. Stored errors never contain model output.
- `FitGap::Engine`: `not_assessed` is never a gap. Comparisons carry override, AI-level
  and low-confidence flags. An input fingerprint lets the API report a stale report.
  Concurrent inserts are race-safe, and the fallback narrative counts unassessed skills
  separately.
- Tenant scoping for `/portfolios/*` and `/portfolio_skills/*/override`. Overrides need
  a reason and are refused on unrated skills. `enqueue_once` dedupes fit/gap jobs.
- PDF: Windows-1252-safe text. Unrated skills and override reasons are printed.
- Zeitwerk inflections for `AudioWebSocketMiddleware` and `CoverageWebSocketMiddleware`.
  Eager loading (production, CI) raised `NameError`, and `rails zeitwerk:check` fails on `main`.
- `Gemini::HttpClient` can use the Interactions API (`GEMINI_HTTP_API=interactions`).
  This is needed for AI Studio auth keys (`AQ.`), which get 404 on `generateContent`.
  Gemini error bodies are no longer logged.

**Migrations** (reversible, safe on existing rows)
- `portfolio_skills.ai_level` becomes nullable. Adds `rating_status` (with check
  constraints that keep it consistent with the level), `probe_count` and `coverage_state`.
- Adds `portfolios.generation_started_at` and `fit_gap_reports.input_fingerprint`.
- Existing rows all have a level, so they default to `rated`. Rollback refuses while
  unrated rows exist instead of inventing a level.

**Web**
- Portfolio page:
  - Unrated skills show no badge. They explain why and say they are not counted
    against the candidate.
  - Quotes link to their transcript turn.
  - Confidence is explained in terms of probes.
  - An override needs a reason, and server errors are shown inline.
  - Generating, failed and load-error states.
- Fit/gap page:
  - The required level is shown.
  - Not-assessed rows are neutral and excluded from the gap count.
  - Low-confidence and override labels; a stale banner with regenerate.
  - `useFitGapReport` triggers generation once, then polls with GET and stops after 2 minutes.
  - Stacked cards on phones.
- `LevelRadio` uses unique ids (labels used to control the first group on the page).
- The header fits at 375 px.

**Tooling**
- RSpec harness: 72 examples, with factories and a fake Gemini client.
- Vitest + Testing Library: 25 tests.
- GitHub Actions: builds the DB from migrations, checks rollback and schema drift,
  then runs RSpec (eager-loaded), typecheck, Vitest and the build. The workflow holds
  no credentials: the throwaway Postgres container uses `trust` auth.

## How it was verified

- The same specs run against `main` fail 48 of 57 (`assessment/evidence/baseline-rspec-against-main.txt`).
- **Seeded fault**: branch [`scratch/seeded-fault`](https://github.com/fahmiprasanda123/ai-interview-platform/commits/scratch/seeded-fault) re-introduces the L1 fallback in
  both services. 6 RSpec and 5 Vitest failures, then a revert commit makes both
  suites green again (`assessment/evidence/seeded-fault-*.txt`).
- Clicked through with `api/db/seeds/demo_interview.rb` (fictional data, real
  generator and engine, canned model answers). Screenshots are in `assessment/screenshots/`.

## Not in this PR (escalation)

- `AuthenticationController#resolve_scheme` takes the tenant from the
  client-supplied `X-Tenant-Scheme` header. Users are global, so an admin can mint a
  token for any organization. Fixing this needs a decision on how users map to tenants.
- Under UU PDP: no candidate notice for sending transcripts to Gemini (a cross-border
  transfer), no retention policy, and no way for candidates to access their results.

Full write-up: `assessment/REPORT.md`. Criteria: `assessment/acceptance-criteria.md`.

## Reviewer checklist

- [ ] `cd api && bundle exec rails db:migrate && bundle exec rspec`
- [ ] `bundle exec rails runner db/seeds/demo_interview.rb` and open the printed URLs
- [ ] `cd web && npm ci && npm test && npm run typecheck`

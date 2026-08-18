# Test harness

The brief baseline: RSpec had no examples, the web app had no runner, and there is no CI. This slice adds **enough harness to prove the change**, not an enterprise pipeline.

CI is an explicit non-goal.

## Run

```bash
# API
cd api
unset BUNDLE_PATH
bundle exec rspec

# Web
cd web
npm test
```

Focused:

```bash
cd api && bundle exec rspec spec/requests/portfolios_spec.rb spec/services/fit_gap/engine_spec.rb
cd web && npx vitest run src/utils/portfolioStatus.test.ts src/components/fitgap/ComparisonTable.test.tsx
```

## What the suite proves

**API (RSpec)**

- `GET /sessions/:id/portfolio` — generating / failed + error / complete + skills / 401 without token
- `POST …/portfolio/regenerate` — only from `failed`; second click while pending is rejected
- Export and fit-gap refused until complete; fit-gap queues `generating`
- PDF export with Gemini punctuation, emoji, and an assessor override (Prawn Windows-1252) returns `%PDF`, not 500
- Override create/update, level 1–5, `overridden_by`
- `FitGap::Engine` — `not_assessed`, `required_level`, override → `is_override` / `exceed`
- Pending invite reuse / revoke

**Web (Vitest + Testing Library)**

- Portfolio envelope → generating / failed / empty / complete
- Secret-like tokens stripped from error copy
- Export / fit-gap / retry gates (`portfolioActionsAllowed`)
- Fit-gap table: `not_assessed`, required level, override mark
- Session status pill (including failed vs completed)
- Vacancy → assessment prefill and custom-skill payload mapping
- List search/filter helpers

## Seeded fault (T3)

Prove the assertions are real (brief: do not weaken a test to make it pass).

1. Branch from the harness commit, e.g. `scratch/seeded-fault`.
2. Break one production line the suite already covers, for example remove `required_level` from `api/app/services/fit_gap/engine.rb`, or force `portfolioActionsAllowed` to return `canExport: true` while generating.
3. Run the matching spec → **RED**. Screenshot the failure.
4. Revert the break (or `git revert` the scratch commit) → **GREEN**. Keep the RED/GREEN history visible.
5. Do not merge the broken commit to the case-study branch.

Until those screenshots are in the portal PDF, T3 is specified here but not yet evidenced.

## Honest limits

- Request specs stub assessor auth; they do not mint real JWTs.
- List search is client-side after walking API pages (`per_page` max 100).
- No browser E2E (Playwright/Cypress). Helpers + request specs cover the decision seam.
- Workers are asserted via `perform_async` stubs, not a live Sidekiq/Gemini run.
- PDF export is proven as HTTP 200 + `%PDF` bytes, not by inspecting glyphs. Unsupported characters are replaced with `?` (no bundled TTF).

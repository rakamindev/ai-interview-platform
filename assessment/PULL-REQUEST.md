# PR description

Paste this as the body when opening the pull request.

**Title:**
`Make "not assessed" representable, and stop the fit/gap report claiming to be complete`

**Base:** `rakamindev/ai-interview-platform` → `main`
**Compare:** `myst-al/ai-interview-platform` → `feat/fit-gap-integrity`

---

## What this changes

`portfolio_skills.ai_level` was `NOT NULL CHECK (1..5)`. There was no way to store *we did not assess this*, so the generator pushed every missing rating through:

```ruby
ai_level: skill_data['level'].to_i.clamp(1, 5)
```

`nil.to_i` is `0`; clamped to the range it becomes **`1`** — the anchor reading *"executes with explicit guidance, cannot apply independently."*

A skill the interview ran out of time to reach was written into a candidate's permanent evaluation as a documented weakness. The frontend's `parseLevel` applied the same fallback independently, and the fit/gap summary counted only match, exceed and gap — so a seven-skill role reported on four and read as complete.

This makes absence representable in the schema, carries it honestly through the service, the API contract and the UI, and adds the test harness that holds it there.

While in the controllers I also found and fixed a **cross-tenant read and write** of candidate personal data.

## Before / after

Same candidate, same data, same API.

| | |
|---|---|
| **Before** — Required blank on every row; summary counts 4 of 7 skills | ![before](assessment/screenshots/00-BEFORE-fitgap-desktop.png) |
| **After** — Required populated; 3 unassessed skills stated, counted and neutral; override provenance visible | ![after](assessment/screenshots/01-fitgap-desktop.png) |

## Findings addressed

| | Finding | Where |
|---|---|---|
| P0 | Unassessed skill recorded as L1 | `Portfolios::Generator`, schema |
| P0 | Same coercion again in the client | `parseLevel` |
| P0 | Required column blank on every row — API emits `expected_level`, client declared `required_level` (**zero occurrences in `api/`**) | type ↔ engine |
| P0 | Summary omits unassessed skills entirely | `ComparisonTable`, fallback narrative |
| P0 | Cross-tenant read **and write** of candidate data | `PortfoliosController`, `PortfolioSkillsController` |
| P0 | Malformed model response wipes the portfolio, 4× under retry | `Generator#save_skills` |
| P0 | Candidate transcript fragments persisted to `generation_error` and logged | `Generator`, worker |
| P1 | Override provenance computed then discarded before serialisation | `FitGap::Engine` |
| P1 | Medium confidence displayed as "confirmed" | `FitGapReportPage` |
| P1 | Failure stub rendered under "Culture & Competency Fit" unlabelled | `FitGapReportPage` |
| P1 | Polling never terminates on a permanently failed job | `FitGapReportPage` |
| P1 | Every non-404 error swallowed into a blank page | `FitGapReportPage` |
| P1 | Duplicate vacancy labels silently drop a requirement | `index_by(&:skill_label)` |
| P1 | Empty vacancy crashes the worker (`[]` is blank in Rails) | `FitGapReport` validation |
| P2 | `.env.example` points at :3000; API serves :3001 | `web/.env.example` |
| P2 | `PortfolioSkill` TS type misdescribes the wire — caused the bare `3` render | `types/index.ts` |
| P2 | `LevelRadio` emits duplicate DOM ids, one set per skill card | `LevelRadio.tsx` |

## Migrations

Three, all reversible.

The two that relax `NOT NULL` **refuse to roll back** while unrepresentable rows exist rather than backfilling them to `1` — that would silently re-harm those candidates during what an operator believes is a neutral rollback. Verified `migrate → rollback → migrate` against a populated database.

In PostgreSQL a `CHECK` evaluates to `UNKNOWN` against `NULL` and the row passes, so the existing range constraints admit `NULL` unchanged and still reject `0` and `6`. No constraint change was needed.

## Tests

Built from zero — `.rspec` existed with no `spec/` directory, and the web app had no runner.

```
54 examples, 0 failures     # RSpec
Tests  18 passed (18)       # Vitest
```

Covering the paths that were broken, not the happy path: level coercion across `nil`/`""`/`"three"`/`0`/`9`/`"L4"`, an unusable response leaving an existing portfolio intact, a mid-batch failure rolling the whole rewrite back, overrides surviving regeneration with the overruled `ai_level` retained, no transcript content in `generation_error` or logs, `not_covered` vs `insufficient_evidence`, duplicate labels both surviving, cross-tenant access raising `RecordNotFound`, the Required cell being populated, and the summary counts summing to the number of required skills.

**Seeded fault test.** Both defects reintroduced on a scratch branch to watch the suites fail, then reverted — fault and revert both in history (`075e96e`, `49f1636`). Restoring the coercion produces 7 failures; restoring `required_level` produces 3, one of which is `Found multiple elements with the text: —` because the Required cell falls back to a dash too. Evidence in `assessment/evidence/`.

## Trade-offs worth reviewing

**Client renamed to `expected_level`, not the reverse.** `skill_comparisons` is persisted JSONB, so fixing the client repairs every historical report with no backfill, and keeps one name from the `vacancy_skills` column through the service to the PDF export — which already reads the correct key. Renaming the API would have broken `Exports::PdfGenerator`.

**Explicit `in_current_tenant` scope, not `default_scope`.** Sidekiq workers legitimately run with no tenant in `RequestStore`; a default scope would either return nothing there or need `unscoped` scattered through them. The cost is that it is opt-in — see the escalation below.

**Nullable `ai_level`, not an `evidence_state` enum.** One nullable column instead of a new enum plus backfill plus a generator write path. The `not_covered` / `insufficient_evidence` distinction is derived at the report layer, which is where a human reads it. Cheap to walk back if SQL-level querying becomes a product need.

## Not done — flagging deliberately

- **Tenancy has no guard that fails when someone adds a model.** I fixed the four I found; the next unscoped model reintroduces the hole. This wants a lint or a shared concern, not four patches. I would not call this closed.
- **`users` has no `tenant_id`** — it is a flat global table shared with `rakamin-api`, and `assessor_overrides.overridden_by` is an unconstrained bigint. I could not determine from this repo whether user↔org membership is enforced upstream. If it is not, this fix is necessary but not sufficient.
- **UU PDP data-subject rights** — no retention policy, erasure path, or candidate export.
- **The prompt is the real business logic and is untestable.** Level assignment lives in a heredoc. I improved it (it now instructs the model to return `null` rather than guess) but "does this produce calibrated levels?" needs an evaluation harness with labelled transcripts.
- **No request specs for tenancy**, only model-level. The model specs prove the scope; a request spec would prove the controllers use it. First gap I would close.
- The live interview WebSocket, coverage state engine and audio pipeline are untouched by design.

## Running it

The documented setup assumes host-native Ruby, PostgreSQL and Redis, and the production Dockerfile excludes the dev/test bundle groups so it cannot run RSpec. This adds `api/Dockerfile.dev` and a compose stack:

```bash
cp .env.example .env      # add a Google AI Studio key
docker compose up -d --build
docker compose exec api bundle exec rails db:create db:migrate db:seed
docker compose exec api bundle exec rails demo:seed
cd web && npm install && npm run dev
```

`demo:seed` is new. `db/seeds.rb` only creates the organisation and taxonomy, leaving the portfolio and fit/gap screens unreachable without conducting a live AI interview. It builds one assessed candidate that lands on every branch of the comparison.

Full analysis and reasoning: [`assessment/REPORT.md`](assessment/REPORT.md).

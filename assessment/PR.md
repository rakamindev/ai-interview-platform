# Make the Fit/Gap report trustworthy (API + web)

## Why

The Fit/Gap report is the screen a hiring manager acts on. It is also the one place where a wrong number changes a candidate's outcome. On `main` it:

- shows a **blank "Required" column**: the API sends `expected_level`, the web reads `required_level`; the PDF and the screen disagree;
- lets **any assessor read or write another company's candidate data** by id (export, fit/gap, override);
- **deletes the report** when an assessor overrides a rating, then the page re-enqueues → duplicate jobs; if the job fails the report is gone;
- has **no failed state**: a worker error means an infinite spinner;
- reports **unprobed skills and one-probe ratings** the same way as real gaps;
- **loses assessor overrides** when a portfolio is regenerated;
- **cannot boot in production** (eager loading aborts; found by CI).

Full analysis with evidence: `assessment/02-gap-analysis.md`.

## What changed

### API
- **Tenant isolation** (`TenantOwnedRecords`): every portfolio, report, export and override lookup is scoped through the session's tenant. Other tenants get 404. Workers run as the owning tenant and refuse mixed pairs.
- **`FitGap::Comparator`** (pure): explicit rules for `not_assessed` (with a reason), overrides (with AI level kept for audit) and `needs_verification` for low or unknown confidence.
- **Report lifecycle** (reversible migration): `status`, `inputs_digest`, `narrative_source`, `error_message`, `queued_at`, `generation_started_at`. Existing rows are backfilled as `complete`.
- **`FitGap::Scheduler`**: the single, idempotent entry point. One job per pair, leases recover lost or crashed jobs, overrides mark reports outdated instead of deleting them.
- **`FitGap::Narrator`**: the model is optional. Timeout, HTTP error, missing key or malformed output produce a deterministic summary flagged `fallback`. The prompt includes competency summaries and asks for areas to probe, never a hire/no-hire recommendation.
- **`FitGap::ReportPresenter`**: the single JSON contract (`status`, `stale`, `summary`, normalised rows).
- **Portfolio regeneration**: atomic (savepoint), re-attaches overrides, normalises model confidence.
- **Ops**: parameter filtering for candidate data; production boot fixed (dead Active Job config, Zeitwerk `WebSocket` inflection).

### Web
- `useFitGapReport` state machine: ensure → poll with backoff → ready | failed | timeout. It stops on unmount and on terminal states.
- Redesigned screen built on the existing shadcn primitives and Rakamin tokens:
  - summary with not-assessed and limited-evidence callouts;
  - a level track per skill (required ring vs candidate fill);
  - provenance badges (AI vs assessor override, with the note on hover/focus);
  - an honest narrative label (AI draft vs automatic summary);
  - stacked rows on phones;
  - states for empty, not-ready, not-available, error, stale and failed.
- Assessor header no longer overflows phones.

### Tests & CI
- RSpec harness from scratch: **106 examples**, also run with eager loading.
- Vitest + Testing Library from scratch: **30 tests**.
- **Cross-service contract**: the API spec generates the JSON fixture the web tests render, so a renamed field fails CI on either side.
- GitHub Actions: RSpec on Postgres/Redis, then web typecheck, tests and build.

## How to verify

```bash
cd api && bundle exec rspec && CI=true bundle exec rspec && bundle exec rails zeitwerk:check
cd web && npm ci && npm run typecheck && npm test && npm run build
```

Manual check (fictional demo data):
1. Open the fit/gap report. You see required vs candidate levels, a not-assessed skill with its reason, and a limited-evidence flag.
2. Override a rating on the portfolio page, then return. The previous report stays visible with "A rating changed — updating the report", then refreshes with an "Assessor override · AI said L2" badge.
3. Unset `GEMINI_API_KEY`. The report still completes, labelled "Automatic summary".
4. Use a token from another tenant. You get 404 / "This report isn't available".

## Proof
- Red-before-green commits for the seam bug, tenant isolation and override loss (`assessment/05-proof.md`).
- **Seeded fault**: `1b0b539` reintroduces "unprobed = gap" and the `required_level` read; the API had 17 failures and the web 3. `6c99dea` reverts it.
- Screenshots: `assessment/screenshots/`.

## Migration & rollout
- `20261023000000_add_lifecycle_to_fit_gap_reports`: additive columns with defaults; safe on existing rows; `down` drops them. Old reports show as outdated and refresh on first view.
- Worker signature unchanged (`portfolio_id, vacancy_id`), so jobs already queued during deploy still run.

## Not in this PR (follow-ups)
- `tenant_id` on portfolio, report and override tables, plus fail-closed default scope or Postgres RLS (cross-team decision).
- PDF export still renders the older row shape (no provenance or uncertainty markers).
- Data retention and erasure for transcripts and portfolios (UU PDP).

🤖 Generated with [Claude Code](https://claude.com/claude-code)

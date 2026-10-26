# Step 5 — Execution Proof

## Test suites

| Suite | Before (main) | After |
|---|---|---|
| API (RSpec) | no specs | **106 examples, 0 failures**, also run with eager loading (`CI=true`) |
| Web (Vitest + Testing Library) | no test runner | **30 tests, 0 failures**, plus `tsc --noEmit` and `vite build` |
| CI | none | `.github/workflows/ci.yml`: RSpec on Postgres/Redis, then web typecheck, tests and build |

### Coverage map (acceptance criteria → tests)

| Area | Spec / test |
|---|---|
| AC1–AC7 computation | `api/spec/services/fit_gap/comparator_spec.rb` (22 examples incl. corrupt levels, diacritics, overrides, low confidence) |
| AC8–AC11, AC14 scheduling | `api/spec/services/fit_gap/scheduler_spec.rb`, `api/spec/requests/fit_gap_reports_spec.rb` |
| AC12 model failures | `api/spec/services/fit_gap/narrator_spec.rb` (timeout, HTTP error, missing key, prose, `{}`, array, blank, non-string) |
| AC13, AC15, AC19 worker | `api/spec/workers/fit_gap_generator_worker_spec.rb` (lease, duplicate job, crash recovery, tenant mismatch, retries exhausted) |
| AC16 atomic writes | `engine_spec.rb` (write failure leaves previous result), `portfolios_generator_spec.rb` (no partial portfolio) |
| AC17 overrides survive regeneration | `api/spec/services/portfolios_generator_spec.rb` |
| AC18, AC20, AC21 security & validation | `api/spec/requests/portfolio_tenant_isolation_spec.rb`, `fit_gap_reports_spec.rb` |
| AC22 log hygiene | `api/spec/config/filter_parameter_logging_spec.rb`, narrator log assertions |
| Migration safety | `api/spec/migrations/add_lifecycle_to_fit_gap_reports_spec.rb` (down → legacy row → up; reversible) |
| API↔web contract | `api/spec/contracts/fit_gap_report_contract_spec.rb` generates `web/src/test/fixtures/fitgap-report.contract.json`, which all web tests render |
| AC24–AC33 presentation | `web/src/pages/fitgap/__tests__/FitGapReportPage.test.tsx` (11 states incl. polling stop, deadline, transient error, unmount), component tests for table, summary and narrative |

## Red before green

Each defect was reproduced by a failing test *before* the fix, and the history shows it:

| Defect | Red commit | Evidence | Fix commit |
|---|---|---|---|
| F1 blank "Required" column | `test(web): reproduce fit/gap Required column rendering blank` | `evidence/web-01-seam-bug-red.txt` | contract + web redesign |
| F2 cross-tenant access | `test(api): reproduce cross-tenant access …` (5/5 red) | `evidence/api-02-tenant-isolation-red.txt` | `fix(api): scope portfolio, report, export and override lookups to tenant` |
| F8 overrides lost / partial portfolio | spec run before fix (4/4 red) | `evidence/api-04-override-loss-red.txt` | `fix(api): keep assessor overrides …` |
| F0 production cannot boot | `zeitwerk:check` + production runner on main | `evidence/api-05-production-boot.txt` | `fix(api): make the app bootable with eager loading; add CI` |

## Seeded fault test

On branch `scratch/seeded-fault` (fast-forwarded into the feature branch so the history is visible in the PR):

1. `1b0b539 test: SEEDED FAULT — unprobed skills become gaps; UI reads required_level` deliberately reintroduces the two defects this PR is about: one in computation, one at the API↔web seam.
2. Result: **API 17 failures** (comparator AC2, contract, narrator, engine, request specs) and **web 3 failures** (including the original seam reproduction). Evidence: `evidence/seeded-api-red.txt`, `evidence/seeded-web-red.txt`.
3. `6c99dea Revert "test: SEEDED FAULT …"` restores the tree byte-for-byte (`git diff a75fe9c` is empty). Back to 106/106 and 30/30: `evidence/seeded-api-green.txt`, `evidence/seeded-web-green.txt`.

No assertion was weakened at any point. Two specs were *corrected* when they encoded a wrong assumption, with the stricter behaviour kept:
- the "401 without a token" spec became two specs (401 when the tenant is known, 403 fail-closed when it is not);
- the seam reproduction test now finds the row by `data-testid` instead of `<tr>`. It makes the same two assertions (required L3, candidate L2) and uses the API-generated contract fixture.

## Data protection checklist

- Migration reversible; existing rows backfilled safely (`evidence/api-03-migration-safety.txt`, migration spec).
- All portfolio, report, export and override endpoints scoped to the caller's tenant; workers run as the owning tenant and refuse mixed pairs.
- Inputs validated (`vacancy_id` format and ownership, portfolio readiness).
- Logs: ids and exception classes only; parameter filter for names, tokens, notes, evidence and transcript text.
- Commits: no secrets (`config/application.yml`, `web/.env` are git-ignored); all names in specs, seeds and screenshots are fictional.

## Engineering depth claimed

- Pure rule engine separated from IO; the model is optional and can never block or alter an outcome.
- Idempotent scheduling with row locks and leases that recover lost or crashed jobs, and no deletes on the hot path.
- One serializer as the single source of the contract, enforced across services by a generated fixture.
- Found and fixed two latent release blockers (production boot) and a subtle Rails autosave-after-rollback bug.

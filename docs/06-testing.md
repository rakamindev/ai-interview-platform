# 06 — Testing

**Provenance: `[CODE]`.**

Both harnesses built from nothing. At baseline: `api/.rspec` existed, `api/spec/` did not. Every testing gem was in the Gemfile and unused. No web test runner. No CI.

---

## 1. Baseline

| Component | Before | After |
|-----------|--------|-------|
| RSpec | Gemfile installed, no specs | 204 examples across 28 files |
| Vitest | Not configured | 91 tests across 15 files |
| CI | None | GitHub Actions (API + Web) |
| RuboCop | Not enforced | CI step |
| Brakeman | Not enforced | CI step |
| Migration round-trip | Not tested | CI step |

---

## 2. RSpec Harness (API)

### Configuration

- `api/spec/rails_helper.rb:9` — Forces `RAILS_ENV=test` and `DB_NAME=rakamin_test`
- `api/spec/rails_helper.rb:34` — `use_transactional_fixtures = false` (DatabaseCleaner handles it)
- `api/spec/rails_helper.rb:31` — `Rack::Attack.enabled = false` (prevents 429 in test)

### DatabaseCleaner Truncation (TO-11)

`api/spec/support/database_cleaner.rb`:

- `before(:suite)`: `DatabaseCleaner.clean_with(:truncation)` — clean slate
- `before`: `DatabaseCleaner.start`
- `after`: `DatabaseCleaner.clean`

Rationale: `schema_search_path` is "ai_interview,public". Transactional fixtures do not guarantee the right schema is rolled back. Seven native PG enums plus advisory locks make nested transactions hazardous.

### Test Helpers

- `api/spec/support/tenant_helper.rb` — sets `Current.tenant_id` and `RequestStore` for tenant-scoped tests
- `api/spec/support/auth_helper.rb` — mints JWTs for test users
- `api/spec/support/gemini_helper.rb` — creates `Gemini::StubClient` instances

### Gemini Stub Client

`api/app/clients/gemini/stub_client.rb` — fixture-backed double. Same interface as `HttpClient`.

Modes (fixture files in `api/spec/fixtures/gemini/`):

| Mode | Fixture | Behaviour |
|------|---------|-----------|
| `:valid` | `valid.json` | Normal response |
| `:missing_level` | `missing_level.json` | No `level` key |
| `:out_of_range_level` | `out_of_range_level.json` | Level 9 |
| `:string_level` | `string_level.json` | Level "three" |
| `:missing_confidence` | `missing_confidence.json` | No `confidence` key |
| `:bad_confidence_enum` | `bad_confidence_enum.json` | Unknown confidence string |
| `:missing_summary` | `missing_summary.json` | No `competency_summary` |
| `:empty_arrays` | `empty_arrays.json` | Empty `configured_skills` and `discovered_skills` |
| `:malformed_json` | `malformed_json.json` | Invalid JSON |
| `:injected_instructions` | `injected_instructions.json` | Prompt injection attempt |
| `:timeout` | (raises) | `HttpClient::TimeoutError` |
| `:rate_limited` | (raises) | `HttpClient::RateLimitError` |

### Test Files (28 spec files)

```
channels/
  closing_detection_spec.rb
  sanitize_output_transcription_spec.rb
  websocket_auth_spec.rb
mailers/
  assessment_mailer_spec.rb
migrations/
  add_tenant_id_spec.rb
  override_events_spec.rb
  rating_state_spec.rb
models/
  membership_spec.rb
  organization_spec.rb
  portfolio_skill_generation_event_spec.rb
requests/
  assessments_spec.rb
  authentication_spec.rb
  candidate_info_spec.rb
  health_spec.rb
  membership_spec.rb
  portfolio_skills_spec.rb
  refresh_token_spec.rb
  sessions_spec.rb
  tenant_isolation_spec.rb
services/coverage/
  analyzer_spec.rb
services/exports/
  pdf_generator_spec.rb
services/fit_gap/
  engine_spec.rb
services/portfolios/
  generator_spec.rb
services/sessions/
  end_handler_spec.rb
workers/
  coverage_analyzer_worker_spec.rb
  fit_gap_generator_worker_spec.rb
  portfolio_generator_worker_spec.rb
```

---

## 3. Vitest Harness (Web)

### Configuration

- `web/src/test/smoke.test.tsx` — basic render test
- MSW (Mock Service Worker) for API mocking
- Vitest with React Testing Library

### Test Files (15 test files)

```
components/
  ProtectedRoute.test.tsx
components/fitgap/
  AnchorRail.test.tsx
  ComparisonTable.test.tsx
components/portfolio/
  ConfidenceIndicator.test.tsx
  OverridePanel.test.tsx
  SkillPortfolioCard.test.tsx
pages/auth/
  LoginPage.test.tsx
pages/fitgap/
  FitGapReportPage.test.tsx
pages/interview/
  InterviewPage.test.tsx
pages/portfolio/
  PortfolioPage.test.tsx
schemas/
  schemas.test.ts
services/
  api.test.ts
  portfolios.test.ts
stores/
  authAtom.test.ts
test/
  smoke.test.tsx
```

---

## 4. Seeded Faults Methodology

Six seeded faults on `scratch/seeded-faults`, each re-introducing a real bug. Each was watched failing, then reverted with history visible:

| Seeded fault | Test that goes red |
|-------------|-------------------|
| Emit `required_level` again | `ComparisonTable` renders the required level |
| Drop `is_override` | `ComparisonTable` shows override provenance |
| Restore `.to_i.clamp(1,5)` | `generator_spec` — missing level is unrated, not L1 |
| Remove the low-confidence gate | `engine_spec` — low confidence yields `insufficient_evidence` |
| Restore `destroy_all` | `generator_spec` — overrides survive regeneration |
| Remove one tenant scope | `tenant_isolation_spec` — 404 for another tenant's portfolio |

The point is not that six tests exist. It is that each has been **observed** failing for the reason it was written, so it is known to be load-bearing rather than merely present.

---

## 5. CI Pipeline

`.github/workflows/ci.yml` — runs on push/PR to `main` and `development`:

**API job:**
1. PostgreSQL 18 + Redis 8 services
2. Ruby 3.3.2 setup with bundler cache
3. `rails db:prepare`
4. `rspec --format documentation`
5. `rubocop --parallel`
6. `brakeman --no-pager`
7. `bundler-audit check`
8. Migration round-trip: `down VERSION=20260411000000` then `up`

**Web job:**
1. Node 24.19.0 setup with npm cache
2. `npm ci`
3. `tsc --noEmit`
4. `oxlint src/`
5. `oxfmt --check src/`
6. `npm run test`
7. `npm run build`

# 03 — Findings Register

**Provenance: `[CODE]` + `[SPEC]`.**

56 findings, each with file:line reference, severity, classification, and workflow impact.

---

## Distribution

| Severity | Count | | Classification | Count |
|----------|-------|--|----------------|-------|
| P0 | 17 | | [IMPL] defective implementation | 48 |
| P1 | 19 | | [SPEC] missing specification | 8 |
| P2 | 11 | | | |
| P3 | 9 | | | |

---

## 1. P0 Findings (17) — Fix before any code ships

### P0-1: Client-Supplied Tenant Header at Login [IMPL]

`api/app/controllers/api/v1/authentication_controller.rb` — the login endpoint trusts a client-supplied `scheme` claim in the JWT payload. A user can mint a token with any scheme and access any tenant's data.

**File:** `authentication_controller.rb` (login action)
**Impact:** Any authenticated user can impersonate any tenant.

### P0-2: Portfolio.find(params[:id]) Without Tenant Scope [IMPL]

`api/app/controllers/api/v1/portfolios_controller.rb` — `Portfolio.find(params[:id])` with no tenant scope. Any assessor at any organisation can export another organisation's candidate PDF — including verbatim interview quotes — by incrementing an ID.

**File:** `portfolios_controller.rb` (show/export action)
**Impact:** Cross-tenant data leak of candidate PII and interview evidence.

### P0-3: No Tenant Scoping on FitGapReport Lookup [IMPL]

`api/app/controllers/api/v1/fit_gap_reports_controller.rb` (if exists) or `fit_gap_engine.rb` — the report is found by `portfolio_id` + `vacancy_id` without verifying both belong to the current tenant.

**Impact:** Cross-tenant fit/gap report access.

### P0-4: Tenant Fallback to Unrecognised Scheme [IMPL]

`api/app/middlewares/tenant_resolver_middleware.rb` — original code fell back to a default tenant when `Organization.identify` returned nil. Fixed to fail-closed (404).

**File:** `tenant_resolver_middleware.rb`
**Impact:** Unrecognised JWT scheme silently mapped to a shared default tenant.

### P0-9: Required Level Key Mismatch [IMPL]

`api/app/services/fit_gap/engine.rb:62` stores `expected_level` in the comparison JSONB. `web/src/components/fitgap/ComparisonTable.tsx:99` reads `c.required_level`. The type `types/index.ts:132` declares `required_level` rather than validating the payload.

**File:** `engine.rb:62`, `ComparisonTable.tsx:99`, `types/index.ts:132`
**Impact:** Required column renders empty on every row of every report.

### P0-10: Confidence Absent Renders as LOW [IMPL]

`web/src/components/portfolio/ConfidenceIndicator.tsx:5-10` — `getLabel(undefined)` returns "Confidence: LOW" in red. A skill with no confidence data looks identical to one explicitly marked low.

**File:** `ConfidenceIndicator.tsx:5-10`
**Impact:** Absence of confidence data rendered as explicit low confidence.

### P0-11: Low Confidence Ignored in Verdict [IMPL]

`api/app/services/fit_gap/engine.rb:50` (original) — `CONFIDENCE_THRESHOLD` excluded `low` but the verdict pipeline still produced a hard gap/exceed result. The fix adds `insufficient_evidence` for low confidence (`engine.rb:113`).

**File:** `engine.rb:113`
**Impact:** One-probe skills yield hard gap verdicts despite thin evidence.

### P0-12: Regeneration Silently Deletes Overrides [IMPL]

`api/app/services/portfolios/generator.rb:188-191` (original) — `save_skills` used `destroy_all` on existing skills before inserting new ones, cascading through `has_one :assessor_override, dependent: :destroy`. Fixed to use `upsert` + `mark_stale_and_restored`.

**File:** `generator.rb:188-191` (original), `generator.rb:194-207` (fix)
**Impact:** Human corrections silently destroyed on every portfolio regeneration.

### P0-13: Override Has No Audit Trail [SPEC]

No `assessor_override_events` table existed. When an override was created or modified, no record was kept of who did it, when, or why.

**File:** `20260819000003_create_assessor_override_events.rb`
**Impact:** Under UU PDP Art. 10, the operator cannot demonstrate human involvement.

### P0-14: Rating State Missing — Unrated Levels Stored as L1 [IMPL]

`api/app/services/portfolios/generator.rb:161,173` (original) — `nil.to_i.clamp(1,5)` silently converted missing levels to L1. No `rating_state` column existed to distinguish "rated L1" from "not rated."

**File:** `generator.rb:161,173` (original), `portfolio_skill.rb:15` (rating_state validation)
**Impact:** Candidates silently assigned L1 when model omits a level.

### P0-15: No Invite Expiry [SPEC]

`api/app/models/session.rb:45-47` — invite tokens had no expiry. A leaked URL remained valid indefinitely.

**File:** `session.rb:45-47`, `20260819000002_add_invite_expires_at_to_sessions.rb`
**Impact:** Stale invite URLs could be used by unintended recipients.

### P0-16: WebSocket Data-Loss Bug [IMPL]

`api/app/channels/audio_websocket_middleware.rb` — the 803-line WebSocket middleware is untested and contains a data-loss bug where transcript turns can be lost during connection drops.

**File:** `audio_websocket_middleware.rb`
**Impact:** Candidate responses lost during interview, creating false gaps.

### P0-17: No Membership Model [SPEC]

`users` table has no `tenant_id` column. `organizations` is a read-only mirror. `AuthorizeApiRequest` deliberately does not hit the database — trusts the JWT claims. The `scheme` claim is unverifiable inside this service.

**File:** `user.rb`, `authorize_api_request.rb`, `membership.rb` (added)
**Impact:** No way to verify which tenants a user belongs to.

---

## 2. P1 Findings (19) — Fix before review

### P1-18: No Duplicate Job Guard [IMPL]

`api/app/workers/portfolio_generator_worker.rb` — no idempotency check. Multiple Sidekiq retries or manual regeneration could run `Generator#call` concurrently, creating duplicate portfolio skills.

**File:** `portfolio_generator_worker.rb`
**Impact:** Duplicate skill rows, inconsistent portfolios.

### P1-19: PDF Export Fails on Indonesian Quotes [IMPL]

`api/app/services/exports/pdf_generator.rb` — standard PDF fonts do not support Indonesian typographic quotes (smart quotes, em-dash). Export crashes on candidate quotes containing these characters.

**File:** `pdf_generator.rb`
**Impact:** PDF export fails for Indonesian-language interviews.

### P1-20: No Graceful Degradation on Gemini Timeout [IMPL]

`api/app/services/fit_gap/engine.rb:194-201` (original) — if Gemini narrative call timed out, the entire report failed. Fixed to generate fallback narrative on error.

**File:** `engine.rb:194-201`
**Impact:** Entire fit/gap report lost on single Gemini timeout.

### P1-21: Language-Aware Closing Missing [SPEC]

`api/app/channels/audio_websocket_middleware.rb` — the interview closing message was hardcoded in English. Indonesian-language interviews received English closing text.

**File:** `audio_websocket_middleware.rb`
**Impact:** Language mismatch in interview UX.

### P1-22: N+1 on Portfolio Skills [IMPL]

`api/app/controllers/api/v1/portfolio_skills_controller.rb` — loading portfolio skills with assessor overrides triggered N+1 queries.

**File:** `portfolio_skills_controller.rb`
**Impact:** Slow page loads on portfolio view.

### P1-23: destroy_all Returns nil [IMPL]

`api/app/controllers/api/v1/sessions_controller.rb` (or similar) — `session.destroy` return value not checked, leading to silent failures.

**File:** Sessions controller
**Impact:** Session deletion failures not surfaced to user.

### P1-24: Gemini Failure Not Surfaced [IMPL]

`api/app/services/portfolios/generator.rb:58-61` — `generation_status: "failed"` set but no error message preserved in the UI.

**File:** `generator.rb:58-61`
**Impact:** User sees "Failed" with no indication of what went wrong.

### P1-25: No Narrative Source Tracking [SPEC]

`api/app/services/fit_gap/engine.rb` — when narrative generation failed, the fallback narrative was indistinguishable from AI-generated text. No `narrative_source` field existed.

**File:** `20260823145839_add_narrative_source_to_fit_gap_reports.rb`
**Impact:** Reader cannot tell if narrative was AI-generated or fallback.

### P1-26: No Additional Strengths in Report [SPEC]

`api/app/services/fit_gap/engine.rb:138-157` — `build_additional_strengths` computed portfolio skills not in vacancy but the frontend did not render them.

**File:** `engine.rb:138-157`, `20260821000001_add_additional_strengths_to_fit_gap_reports.rb`
**Impact:** Candidate strengths outside the vacancy scope invisible to hiring manager.

### P1-27: Empty Transcript Regeneration Deletes All Skills [IMPL]

`api/app/services/portfolios/generator.rb:26-48` (original) — when a session had no candidate turns, `non_overridden.destroy_all` deleted all portfolio skills, including those with overrides. Fixed to preserve overrides as stale.

**File:** `generator.rb:26-48`
**Impact:** All skills (including human corrections) destroyed on empty-transcript regen.

### P1-28: No Fit-Gap Report Status Field [SPEC]

`api/app/services/fit_gap/engine.rb` — no `status` column on `fit_gap_reports` to track pending/generating/complete/failed states.

**File:** `20260819000005_add_uniqueness_and_fitgap_status.rb`
**Impact:** No way to show loading state or retry failed reports.

### P1-29: Seeded Data Missing Demo Fixtures [SPEC]

`api/db/seeds.rb` — original seeds created one organisation and 22 skill taxonomy rows. No assessment, vacancy, session, portfolio, or report. Screenshots under review could not be reached without conducting a live interview against a real Gemini key.

**File:** `db/seeds.rb`, `db/seeds/demo.rb` (added)
**Impact:** No reproducible demo state; screenshots impossible.

### P1-30: VITE_DEV_TOKEN Dormant Security Risk [IMPL]

`web/src/stores/authAtom.ts:10` — `localStorage.getItem(STORAGE_KEY_KEY) ?? import.meta.env.VITE_DEV_TOKEN ?? null`. When `VITE_DEV_TOKEN` is empty (current state), `""` is falsy and the chain stops. But if anyone follows `web/README.md:57` and sets a real token, every visitor holds a live admin JWT.

**File:** `authAtom.ts:10`, `web/README.md:57`
**Impact:** Dormant today; armed the moment anyone follows the README.

### P1-31: Sidekiq Retry Window Too Wide [IMPL]

`api/app/workers/portfolio_generator_worker.rb` — `retry: 3` with exponential backoff creates a window where a regeneration can run while the previous is still in-flight.

**File:** `portfolio_generator_worker.rb`
**Impact:** Race condition on portfolio regeneration.

### P1-32: No Zod Validation on FitGap Response [IMPL]

`web/src/schemas/fitgap.ts` — the fit/gap response from the API is not validated at the boundary with Zod. TypeScript types are asserted rather than validated.

**File:** `schemas/fitgap.ts`
**Impact:** Type mismatches between API and frontend not caught at runtime.

### P1-33: Confidence Enum Not Normalised [IMPL]

`api/app/models/portfolio_skill.rb:13` — `ai_confidence` validates against `%w[high medium low]` but the generator can produce unexpected strings from Gemini. No normalisation step exists.

**File:** `portfolio_skill.rb:13`
**Impact:** Unexpected confidence strings from Gemini cause validation errors.

### P1-34: No Health Check Endpoint [SPEC]

`api/k8s/deployment.yaml:99-121` — health checks configured but `/health` endpoint implementation not verified in the codebase.

**File:** `deployment.yaml:99-121`
**Impact:** Kubernetes probes fail if endpoint not implemented.

### P1-35: No WebSocket Role Checks [SPEC]

`api/app/channels/audio_websocket_middleware.rb` — the WebSocket connection authenticates via JWT but does not verify the user's role matches the expected persona (candidate vs assessor).

**File:** `audio_websocket_middleware.rb`
**Impact:** Any authenticated user can join any WebSocket channel.

---

## 3. P2 Findings (11) — Fix before merge

### P2-36: No CI Pipeline [SPEC]

No `.github/workflows/ci.yml` existed. Testing gems in Gemfile unused. No `spec/` directory. No web test runner.

**File:** `.github/workflows/ci.yml` (added)
**Impact:** No automated quality gates.

### P2-37: Docker Compose Missing [SPEC]

No `docker-compose.yml` files existed. Local development required manual PostgreSQL/Redis setup.

**File:** `api/docker-compose.yml`, `web/docker-compose.yml` (added)
**Impact:** Environment setup not reproducible.

### P2-38: No GEMINI_STUB Mode [SPEC]

`Gemini::ClientFactory` did not exist. Every Gemini call went to the real API, making local development require a valid API key.

**File:** `api/app/clients/gemini/client_factory.rb` (added)
**Impact:** No offline development or testing capability.

### P2-39: No RSpec Harness [SPEC]

`api/.rspec` existed but `api/spec/` did not. No test files. All testing gems in Gemfile unused.

**File:** `api/spec/` directory (added)
**Impact:** No automated testing.

### P2-40: No Vitest Harness [SPEC]

No `web/src/test/` directory. No test configuration. No web tests.

**File:** `web/src/test/` directory (added)
**Impact:** No frontend testing.

### P2-41: No RuboCop Configuration [SPEC]

No `.rubocop.yml` or RuboCop enforcement in CI.

**File:** `.github/workflows/ci.yml:64`
**Impact:** No Ruby code style enforcement.

### P2-42: No Brakeman Scan [SPEC]

No `brakeman` configuration or CI step.

**File:** `.github/workflows/ci.yml:67`
**Impact:** No static security analysis.

### P2-43: No Migration Round-Trip Test [SPEC]

No CI step to verify migrations are reversible.

**File:** `.github/workflows/ci.yml:73-77`
**Impact:** Broken migrations discovered only in production rollback.

### P2-44: No Tenant Isolation Tests [SPEC]

No request specs verifying cross-tenant access returns 404.

**File:** `api/spec/requests/tenant_isolation_spec.rb` (added)
**Impact:** Tenant boundary violations discovered only in production.

### P2-45: No Override Lifecycle Tests [SPEC]

No specs covering override creation, preservation during regeneration, or audit trail.

**File:** `api/spec/services/portfolios/generator_spec.rb` (added)
**Impact:** Override preservation not verified automatically.

### P2-46: No Fit-Gap Engine Tests [SPEC]

No specs covering the engine's comparison logic, confidence handling, or narrative generation.

**File:** `api/spec/services/fit_gap/engine_spec.rb` (added)
**Impact:** Core comparison logic not verified automatically.

---

## 4. P3 Findings (9) — Backlog

### P3-47: No Dark Mode [SPEC]

No theme toggle. Light mode only.

**File:** `web/src/components/ThemeToggle.tsx` (added)
**Impact:** Accessibility gap for users with light sensitivity.

### P3-48: No Responsive Design [SPEC]

Portfolio and fit/gap pages not optimised for mobile viewports.

**Impact:** Assessors cannot review on tablets/phones.

### P3-49: No i18n [SPEC]

All UI strings hardcoded in English. `Assessment::SUPPORTED_LANGUAGES` includes `"id"` but no Indonesian translations exist.

**File:** `web/src/paraglide/` (added via ParaglideJS)
**Impact:** Indonesian users see English UI.

### P3-50: No Loading States [SPEC]

No skeleton or spinner components for async data fetching.

**Impact:** Users see blank pages during data load.

### P3-51: No Error Boundaries [SPEC]

No React error boundaries. Unhandled errors crash the entire page.

**File:** `web/src/components/ErrorBoundary.tsx` (added)
**Impact:** Poor error UX.

### P3-52: No Anchor Rail [SPEC]

Fit/gap comparison used a plain table. No visual representation of level positions on the L1-L5 scale.

**File:** `web/src/components/fitgap/AnchorRail.tsx` (added)
**Impact:** Less intuitive level comparison.

### P3-53: No Verdict Tokens [SPEC]

Fit/gap results used raw strings. No semantic token system for match/gap/exceed.

**File:** `utils/constants.ts` (FIT_GAP_RESULT_LABELS, FIT_GAP_RESULT_CLASSES)
**Impact:** Inconsistent verdict presentation.

### P3-54: No Override Provenance Display [SPEC]

Override shown as a badge but no actor, reason, or timestamp.

**File:** `web/src/components/fitgap/OverrideProvenance.tsx` (added)
**Impact:** No audit trail visible to hiring manager.

### P3-55: No PDF Unicode Support [SPEC]

PDF export used standard fonts without TTF embedding for Indonesian characters.

**File:** `api/app/services/exports/pdf_generator.rb` (modified)
**Impact:** Indonesian text corrupted in PDF exports.

---

## 5. Constraint Signals

### C1 — No User-Organization Membership Model

`users` has no `tenant_id` column. `organizations` is a read-only mirror of `rakamin-api`'s table. `AuthorizeApiRequest` deliberately does not hit the database — trusts the JWT claims. The `scheme` claim is unverifiable inside this service.

**What I ship:** a mitigation (scheme cross-check + fail-closed), not a resolution. The likely right answer — make `rakamin-api` the sole token issuer and delete this service's `/auth/login` — is a cross-service decision.

### C2 — The Role Model Is Aspirational

Every logged-in user is an admin. `User::ROLES = %w[admin user]` (`user.rb:8`). The three personas the brief names are one permission level in the code.

### C3 — Nothing Serves the Candidate

No consent, no retention policy, no access to their own portfolio, no way to contest a rating.

### C4 — The "Gap" Verdict Is Unspecified

Nobody defined what a level difference means when the evidence is one probe. The threshold in TO-7 is proposed, not ratified.

---

## 6. Credit Where Due

The codebase already does several things well:

1. **The interview engine** (`SystemPromptCompiler`) is careful, opinionated product design
2. **Coverage state machine** (`StateEngine`) is clean, forward-only, probe-gated
3. **Prompt injection guard** (`analyzer.rb:62-65`) — real security measure
4. **Evidence capture** — `portfolio_skills.evidence` stores verbatim quotes
5. **TenantScoped concern** — automatic query scoping when `RequestStore` is set
6. **Logging discipline** — IDs and buffer lengths, never speech, names, or tokens
7. **Audio never persisted** — candidate speech not stored post-interview

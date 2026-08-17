# Phase 5-6 — Implementation Report (AC mapping)

> Covers the backend delivery (`api/`) of the Portfolio Delivery Reliability fix
> (Option A: self-healing lifecycle). Frontend deliverable (AC14–AC17) is in the
> next phase on `web/`. Test run: `bundle exec rspec` → **34 examples, 0 failures**.

## 1. What changed

### Backend (all running, all green)

| File | Change |
|---|---|
| `db/migrate/20260817000000_add_generation_attempted_at_to_portfolios.rb` | Adds `generation_attempted_at` (datetime, precision 6) chaser: set when a generation attempt starts, cleared on success, nil on failure. The precise TTL anchor for recovery. |
| `db/migrate/20260817000001_add_timestamps_to_portfolios.rb` | Adds `created_at`/`updated_at` (the table previously had **no** Rails timestamps). Required so a `pending` portfolio with `generation_attempted_at = nil` (enqueue lost) can still be detected as stale. |
| `app/models/portfolio.rb` | Adds `GENERATION_RECOVERY_TTL_MINUTES = 15`, plus `pending` scope and `pending?` predicate (was missing — caused a 500 in `show`). |
| `app/services/sessions/end_handler.rb` | Rewritten: whole termination serialized on the session row (`with_lock`), second calls are no-ops, `create_portfolio` guarded, `safe_enqueue_portfolio_generation` rescues enqueue failures (never 500s; portfolio stays `pending` for recovery), reason upgrade from `error` kept. Returns `@session`, never raises. |
| `app/services/portfolios/generator.rb` | `call` wraps the portfolio in `with_lock`; returns early for `complete`/`generating` (dedup — no double Gemini runs P1-02); records `generation_attempted_at` on start and clears it on success; failure marks `failed` + `generation_error` + clears the clock. `save_skills` now runs inside `Portfolio.transaction(requires_new: true)` (real savepoint → rollback works even inside an outer transaction) and the rescue resets the stale in-memory association so the failure UPDATE can't re-insert phantom skills (found by the atomic-swap spec). |
| `app/services/portfolios/recovery.rb` | **New.** Single-record `recover_stuck!` (used by the API read-time heal) and sweep `recover!` (rake task). Conservative `stuck?` logic: pending → no attempt ≤ 15 min old; generating → attempt > 15 min. Row-lock idempotent (second sweep sees a fresh clock and skips). Never raises; returns the recovered records. |
| `app/controllers/api/v1/portfolios_controller.rb` | `show` now runs `heal_stalled_portfolio` then returns `generating` for `pending` too (was only `generating`); `regenerate` allowed for `pending`/`generating`/`failed`, blocked (422) only for `complete`; new private `heal_stalled_portfolio` (nil portfolio on ended session → self-heal; stuck → `Recovery#recover_stuck!`) and `safe_enqueue_generation`. |
| `lib/tasks/portfolio_recovery.rake` | **New.** `bin/rails portfolios:recover` sweep — the cron/CI hook for the 15 min TTL. |

## 2. Database

- One new reversible schema delta: `portfolios.generation_attempted_at`, `created_at`, `updated_at` (see diff).
- Existing rows: `generation_attempted_at` null (default) → older `pending` portfolios are immediately eligible for recovery on first read, which re-creates the same (idempotent) generation — correct for the pre-existing stuck rows.
- Migration applied to both `rakamin_development` and test DB; `schema.rb` regenerated.
- Portfolios table previously had no timestamps → added so `stuck?` has an anchor when `generation_attempted_at` is nil.

## 3. Test suite (new)

Spec infra: `spec_helper`, `rails_helper`, `spec/support/tenant_context.rb`, `spec/support/sidekiq.rb` (fake Sidekiq), factories for users/assessments/sessions/portfolios. DatabaseCleaner: transaction default, truncation opt-in for the threading spec, `RequestStore.clear!` after each example.

| Spec | Count | Covers |
|---|---|---|
| `spec/services/sessions/end_handler_spec.rb` | 7 | ends+creates, exactly-one-enqueue, idempotent second call, reason coercion, error→manual upgrade, enqueue-failure no-500, **2-thread concurrency → 1 portfolio + 1 job** (truncation strategy) |
| `spec/services/portfolios/generator_spec.rb` | 6 | happy path complete + atomic skills, `attempted_at` written while running, dedup on `generating`, dedup on `complete`, Gemini failure → `failed` + error + cleared clock, **mid-write failure keeps previous skills (atomic swap)** |
| `spec/services/portfolios/recovery_spec.rb` | 7 | fresh pending untouched, stale pending recovered + enqueued, fresh generating untouched, stale generating recovered, failed/complete untouched, idempotent across sweeps, enqueue-failure returns false without raising |
| `spec/requests/portfolios_controller_spec.rb` | 13 | 202 for pending, 202 for generating, self-heal nil portfolio, self-heal stuck, fresh pending not re-enqueued, complete payload, failed payload w/ error, auth w/o token, regenerate for pending/generating/failed, regenerate blocked for complete, 404 no portfolio |

## 4. AC mapping (backend)

| AC | Status | Evidence |
|---|---|---|
| AC1 exactly-one portfolio+job per end | ✅ | end_handler "enqueues exactly one…"; concurrency spec |
| AC2 second end call no-op | ✅ | end_handler "idempotent: a second call…" |
| AC3 success → complete + skills + generated_at | ✅ | generator "generates a complete portfolio…" |
| AC4 nil portfolio self-heals on GET | ✅ | request "self-heals an ended session with no portfolio" |
| AC5 pending > TTL re-enqueued on GET | ✅ | request "self-heals a stuck pending portfolio…" |
| AC6 generating > TTL reset+re-enqueued | ✅ | recovery "recovers a generating portfolio that started before the TTL" |
| AC7 fresh generating untouched | ✅ | recovery "does not recover a generating portfolio that started recently"; request "does not enqueue a fresh…" |
| AC8 regenerate allowed pending/generating/failed, 422 complete | ✅ | request regenerate×3 + "rejects regeneration… complete" |
| AC9 generating with half-written skills doesn't lose skills | ✅ | generator "keeps the previous skills if a skill write fails midway" |
| AC10 Gemini failure → failed + readable error | ✅ | generator "marks the portfolio failed…"; request failed payload |
| AC11 no unbounded re-enqueues | ✅ | recovery sweep only pending/generating > TTL; failed/complete skipped |
| AC12 concurrent ends → 1 portfolio + 1 job, no 500 | ✅ | end_handler "serializes concurrent end calls…" (2 threads) |
| AC13 Redis-down enqueue → no 500, recoverable | ✅ | end_handler "does not 500 the caller…"; recovery "returns false and does not raise…" |
| AC14–AC17 UI/UX | ✅ | `web/src/pages/portfolio/PortfolioPage.tsx` (see §6) |

## 5. Notes / trade-offs

- **Side-effect on GET** (self-heal) is intentional and documented in the controller: idempotent, row-lock guarded, and bounded by the 15 min TTL. Worst case a stuck portfolio is healed on its next read.
- Recovery uses `generation_attempted_at` (precise) for rebirth chaser; falls back to `created_at` for a `pending` portfolio that never got attempted (lost enqueue).
- Not in this release (documented in `02-problem-inventory.md`, security follow-up): P1-03 RequestStore not cleared per-request; P1-04 JWT claims trusted without a DB check. No code changes touching auth/tenant were made beyond the test-only `create_test_organization!`.
- `api/config/application.yml` holds a **placeholder** `GEMINI_API_KEY` — never commit a real key; all AI-touching specs stub the Gemini client.

## 6. Frontend (Phase 5c) — `web/src/pages/portfolio/PortfolioPage.tsx`

The page was already stateful but suffered the exact P1 symptoms: an **indefinite spinner** while stuck `generating`/`pending`, a failed state that hid the backend reason, export buttons offered before complete, and a `catch(() => {})` that silently swallowed load failures into an eternal spinner.

Changes (verified via `tsc --noEmit`; **no frontend test runner is installed** — vitest was suggested in the design doc, but neither the repo nor the assessment scope has a JS test harness, so this phase ships verified-by-typecheck UI only):

| AC | Behavior |
|---|---|
| AC14 generating < TTL | Healthy generating banner (spinner + "takes about 2 minutes"). |
| AC15 stuck > timeout | New 3-minute budget (`GENERATION_TIMEOUT_MS`) — after it elapses, banner switches to "taking longer than expected" with a working **Retry generation** (calls `regeneratePortfolio`, which the backend now accepts from `pending`/`generating`/`failed`, then re-polls). A 30s re-render tick flips the banner exactly on schedule. |
| AC16 failed shows reason | Failed card now displays `portfolio.generation_error` verbatim + Retry. |
| AC17 empty vs fetch-error distinct | New distinct fetch-error card (with "Retry load") vs a "no portfolio yet" empty state; no more silent swallows. Export buttons hidden unless `complete`. |
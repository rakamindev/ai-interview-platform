# AI Verification Log

AI (Claude Code) was used for exploration, drafting code and tests. Every change was verified by running it. These are the moments where generated code was wrong or risky.

## 1. Assumed timestamp column → would have re-created the infinite spinner (caught by specs)

- **What was generated:** the scheduler's "lost job" lease used `report.updated_at`, and the worker's failure path wrote `update_columns(..., updated_at: Time.current)`.
- **Why it was wrong:** `fit_gap_reports` was created without timestamps (`db/schema.rb` has only `generated_at`). Rails conventions made the assumption look natural.
- **How it was caught:** the scheduler/worker specs failed with `NoMethodError: undefined method 'updated_at'` and `PG::UndefinedColumn`. Worse, the worker spec showed the report stuck in `generating`: the `rescue` itself raised, so the "mark as failed" never happened — exactly the infinite-spinner defect (F5) this PR exists to remove.
- **Fix:** explicit `queued_at` lease column in the (unreleased) migration; rolled back and re-migrated locally; added a spec for the "pending but still within lease" branch.
- **Lesson:** verify schema facts against `schema.rb`, not framework conventions; test the failure path, not just the happy path.

## 2. "Atomic" rewrite that was not atomic (caught by a partial-write spec + SQL trace)

- **What was generated:** wrapping `save_skills` in `PortfolioSkill.transaction do … end` to stop partial portfolios.
- **Why it was wrong:** (a) without `requires_new: true` the block joins any outer transaction, so a failure does not roll back at that boundary; (b) even with a savepoint, the generator's `rescue` then called `portfolio.update!(status: 'failed')`. After a rollback the in-memory association still holds the created skills as new records, and **autosave re-inserted them** — the error handler itself produced the partial write.
- **How it was caught:** the spec "leaves the previous skills and overrides intact when the write fails midway" kept returning two `Communication` rows. Subscribing to `sql.active_record` showed `ROLLBACK TO SAVEPOINT` followed by a fresh `INSERT`.
- **Fix:** `transaction(requires_new: true)` and `portfolio.reload` before marking it failed.

## 3. Factory referencing an association that does not exist

- **What was generated:** `factory :assessment { organization; tenant_id { organization.id } }`.
- **Why it was wrong:** `Assessment` has no `belongs_to :organization` (tenancy is a bare `tenant_id` resolved from `public.organizations`). FactoryBot would try `assessment.organization=`.
- **How it was caught:** re-reading `app/models/assessment.rb` before running; rewritten as a transient attribute.

## 4. Local environment: Docker image build for Ruby

- **What was suggested:** build a dev Docker image to avoid installing Ruby 3.3.2.
- **Why it was wrong for the situation:** the image build (native gems, no cache) took >10 minutes; the user stopped it. Switched to rbenv + Homebrew Postgres/Redis, with an isolated Redis DB index and fresh databases so other local projects are untouched.

# Retention Policy for Candidate Personal Data

Severity: P1 · Type: Missing specification → Adds

## Summary

Sessions and transcripts lived forever by default — no column tracked when a session's personal data should expire, and no job ever purged old data. This adds an `expires_at` window set at session-end time, and a Rake task that purges personal data past that window while preserving the hiring team's actual assessment record.

## Analysis

No table had an `expires_at`, `deleted_at`, or equivalent column before this change. No Sidekiq-cron job, `whenever` schedule, or any other scheduling gem existed anywhere in the codebase — every existing Sidekiq worker is triggered by an application event (session end, coverage analysis, portfolio generation), never by a clock.

## Options & Trade-off

**Option A — Add sidekiq-cron (or whenever) to schedule an in-app recurring job.**
Works, but introduces a new gem and a new piece of infrastructure (cron-in-Redis or a system crontab writer) to solve what's fundamentally a "run this daily" problem that the deploy target almost certainly already has a mechanism for (Heroku Scheduler, a Kubernetes CronJob, a plain crontab).

**Option B — A Rake task invoked by whatever external scheduler the deployment already has (chosen).**
`retention:purge_expired` does the work; the task's own description documents that it needs external scheduling. No new gem, no new abstraction — matches how this codebase already treats "things that need to run periodically" (which is to say, it doesn't have any yet, and one Rake task is the smallest way to introduce the capability without over-building it).

**Option C — Purge personal data immediately at session end instead of after a retention window.**
Defeats the purpose of a hiring record: the whole reason a portfolio persists is so the hiring team can review it after the interview ends, sometimes weeks later. A window is the point.

## Solution

- Migration adds `expires_at` and `data_purged_at` to `sessions`, backfilled for existing ended sessions using `CANDIDATE_DATA_RETENTION_DAYS` (default 90, configurable via ENV — a placeholder for whatever the actual business policy turns out to be).
- `Sessions::EndHandler` sets `expires_at` to `ended_at + retention_days` whenever a session ends.
- `Session#purge_personal_data!` replaces `candidate_name` and every transcript turn's text with a marker, leaves the portfolio's verdict and skill scores untouched, and is idempotent via `data_purged_at`.
- `Session.expired_for_purge` scopes to sessions past their expiry that haven't been purged yet.
- `lib/tasks/retention.rake`'s `purge_expired` task runs the purge across every expired session.

## Acceptance Criteria

- Every session gets an `expires_at` the moment it ends, based on the configured retention window.
- The purge task touches only sessions where `expires_at` has passed and `data_purged_at` is still nil.
- A purged session's portfolio verdict and skill scores remain fully intact and queryable.
- Running the purge task twice does not re-purge already-purged sessions or raise an error.
- The retention window is configurable via `CANDIDATE_DATA_RETENTION_DAYS`, not hardcoded.

## Tests & Verification

- RSpec: `end_handler_spec.rb` (sets `expires_at` from the configured window, doesn't overwrite it on a second `call`), `session_retention_spec.rb` (`purge_personal_data!` replaces name/transcript text, records `data_purged_at`, is idempotent, leaves the portfolio untouched; `.expired_for_purge` includes only sessions past expiry that haven't been purged), `retention_rake_spec.rb` (the task purges only expired sessions, is idempotent across repeated invocations).
- Seeded fault: reverted `purge_personal_data!` to overwrite `candidate_name` with its own current value instead of the marker, reran the model and rake-task specs, watched three examples fail on the literal value, reverted, reran the full suite green (75 examples at that point).

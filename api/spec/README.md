# Backend RSpec suite

Run from the API directory:

    bundle exec rspec

Run a focused area:

    bundle exec rspec spec/models
    bundle exec rspec spec/services
    bundle exec rspec spec/auth

## Current coverage areas

| Area | Specs |
|---|---|
| Session model | Invite token generation/uniqueness, status and end-reason validation, invite URL |
| Session lifecycle | Activation, coverage-map initialization/idempotency, Redis failure tolerance, end reason, duration, portfolio creation and job enqueue |
| Fit/gap engine | Match/gap/exceed/not-assessed classification, assessor overrides, Gemini fallback, report upsert behavior |
| Authorization | JWT role allow-list, missing/malformed token, unauthorized role |
| Tenant scoping | Current-tenant filtering, tenant assignment, tenant validation, request-context restoration |
| Coverage state engine | Forward-only transitions, probe-count gate, invalid/regressive proposals |
| Prompt compiler | Language, skill scope/anchors and system safety instructions |

## Test boundaries

- Gemini and Redis are stubbed in unit/service specs. These tests do not prove live provider connectivity or WebSocket/audio behavior.
- The test database must have the application's PostgreSQL schema loaded. Configure the DB_* environment variables used by config/database.yml.
- These are behavior tests, not a measured line/branch coverage percentage. Add SimpleCov only when the project is ready to maintain a coverage report and threshold.
- Tests intentionally avoid production credentials and external services.

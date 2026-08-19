# Phase 9 — CI, the seeded-fault demo, and the PR, explained for a frontend dev

This phase adds no application code at all — no new model, service, or endpoint. It adds one file, `.github/workflows/ci.yml`, that runs everything the previous 8 phases already built. If you've set up GitHub Actions for a JS project before, the shape will look familiar; this doc explains the Rails-specific parts. For the `web` job's steps, see [`phase-9-frontend.md`](./phase-9-frontend.md).

## Concept table

| Rails/Ruby term | Rough JS/npm equivalent |
|---|---|
| `bin/rails db:create db:migrate` | Running your ORM's migration CLI against a fresh database — think `prisma migrate deploy`, but two separate steps (create the database itself, then run migrations against it) |
| `zeitwerk:check` | A Rails-specific "does every file actually define the class its path implies" check — closer to a strict TypeScript build than to ESLint; explained more below |
| `bundle exec rspec` | `npm test` — runs the whole spec suite |
| `ENV.fetch('X')` (no default) | `process.env.X` used directly with no fallback — throws/crashes if unset, same as accessing an env var Node expects to exist |
| GitHub Actions "service container" | A sidecar Docker container the job gets for free — here, a throwaway Postgres and a throwaway Redis, alive only for the duration of the job |

## What a GitHub Actions workflow file actually is

`.github/workflows/ci.yml` declares one or more **jobs** that run on GitHub's own servers whenever the file's `on:` triggers fire — here, every push to `main` and every pull request. Each job gets a fresh Ubuntu VM, checks out the repo, and runs a list of **steps** top to bottom; a step that exits non-zero fails the whole job. This repo's workflow declares two independent jobs, `api` and `web`, which run in parallel (nothing in either depends on the other's outcome).

```yaml
services:
  postgres:
    image: postgres:15
    ports: ["5432:5432"]
    options: >-
      --health-cmd pg_isready
      --health-interval 10s
```

A **service container** is a second Docker container GitHub starts alongside the job's main container, on the same Docker network — so `localhost:5432` inside the `api` job really does reach a live, empty Postgres 15 instance for the lifetime of that job only. It's discarded afterward; nothing persists between runs. The `--health-cmd` option makes GitHub wait until `pg_isready` actually succeeds before letting the job's own steps start, so the very first step never races a Postgres that's still booting.

## Why `db:create db:migrate`, never `db:test:prepare`

This is the single most important line in the whole workflow, and it's a landmine this codebase already has a guard against — `spec/rails_helper.rb` aborts with a long explanatory message if you get this wrong. The short version: `db/schema.rb` (the file Rails normally uses to fast-rebuild a test database in one shot) never captured the very first migration's `CREATE SCHEMA ai_interview` statement, because that statement predates `schema.rb`'s existence in this repo. Every domain table in this app lives inside that `ai_interview` Postgres schema, not the default `public` one. If CI (or anyone) ran `db:test:prepare` or `db:schema:load`, Rails would happily rebuild every table — inside `public`, silently, with no error — and every single spec would then fail with "table does not exist," or worse, quietly pass against the wrong tables. Running the real migrations one by one (`db:create db:migrate`) is slower but is the only path that actually reconstructs the schema correctly.

## `zeitwerk:check` and the eager-loading gotcha that turned out not to exist

**Zeitwerk** is Rails' autoloader — the thing that lets you reference a class like `CvScreenings::DecisionEngine` anywhere in the app without an explicit `require`, purely because the file lives at `app/services/cv_screenings/decision_engine.rb`, a path Zeitwerk can derive the constant name from. `zeitwerk:check` eager-loads (requires) every single autoloadable file up front and confirms each one actually defines the constant its path implies — think of it as a stricter, Rails-specific version of what `tsc --noEmit` catches for you today: files that reference something that turns out not to really be there, except Zeitwerk catches it by trying to load everything, not by static analysis.

This matters for CI specifically because **this app has never eager-loaded before** — `development` doesn't (it lazy-loads each class on first use, for faster reloads), and until this phase, nothing else did either. `config/environments/test.rb` already had `config.eager_load = ENV["CI"].present?` sitting there, unused, waiting for a CI environment that didn't exist yet. The plan doc that guided this whole build flagged a specific expected failure here: `config/application.rb` does `require_relative '../app/middlewares/application_middleware'` at boot, while `app/middlewares` is *also* one of Zeitwerk's autoload paths — a classic setup for a "Zeitwerk expected to autoload this constant itself, but it was already loaded another way" conflict.

I ran `CI=true bundle exec rails zeitwerk:check` locally before writing a single line of the workflow, exactly as the doc's own instructions said to. It passed cleanly — "All is good!" — with zero conflicts. The modern versions of Rails/Zeitwerk this app actually runs tolerate a constant that's already defined via `require_relative`, as long as it matches what Zeitwerk expects to find at that path; the hard failure the doc anticipated is a real historical Zeitwerk behavior, just not one present in these exact dependency versions. No code changed — this is logged in the plan doc's decision log as a doc inaccuracy, the same way five earlier ones were.

## The env-var gap the doc's own checklist missed

The plan doc listed `SECRET_KEY_BASE`, `GEMINI_API_KEY` + the three `GEMINI_*_MODEL` vars, the `DB_*` vars, `REDIS_URL`, `APP_BASE_URL`, `WEB_BASE_URL`, and `CI: "true"` as required. I didn't take that list on faith — I grepped every `ENV.fetch(...)` call in `api/` for ones with **no default value** (the ones that raise `KeyError` at boot/use time rather than silently falling back), and found one more: `config/initializers/cors.rb:5` does `ENV.fetch('ALLOWED_ORIGINS').split(',')` with no fallback at all. I confirmed this the direct way — moved `config/application.yml` out of the way locally (so the environment looks exactly like CI, where that gitignored file doesn't exist), ran the workflow's exact declared env vars by hand, and watched it fail on `ALLOWED_ORIGINS` specifically. Added it, re-ran the same simulation end to end (`db:create db:migrate` → `zeitwerk:check` → the full 91-example suite), and it passed clean. That whole verification is logged in the decision log rather than just trusting the doc's checklist.

## The seeded-fault demo

Every earlier phase's spec suite exists to prove *something specific* keeps working. This phase's job is to prove the suite itself is trustworthy — that a real, meaningful bug actually makes a test fail with a name a non-engineer could read and understand, not just some incidental crash.

The target is one line in `CvScreenings::DecisionEngine` (`api/app/services/cv_screenings/decision_engine.rb:63`):

```ruby
if threshold.present? && match.score >= threshold
```

Flipping `>=` to `>` is a genuinely dangerous, genuinely subtle bug: a candidate who scores *exactly* at the qualifying bar would silently get rejected instead of invited — invisible on a code read, since `>` looks almost identical to `>=`, and it would only ever surface in production as "why didn't this borderline candidate get an interview," long after the fact.

Phase 6 already added the spec this demo depends on — the "boundary" spec, which is the actual point, not the fault injection itself:

```ruby
it 'auto-invites when the score is EXACTLY equal to the threshold — the >= boundary, ' \
   'the exact line the Phase 9 seeded fault targets' do
  # ... score: screening.threshold ...
  expect(entry.reload.decision).to eq('invited')
end
```

I verified the mechanism works — locally, with a plain file edit, no `git commit` involved — by flipping the operator, running `bundle exec rspec spec/services/cv_screenings/decision_engine_spec.rb`, and confirming exactly one named failure:

```
1. CvScreenings::DecisionEngine auto-invites when the score is EXACTLY equal to the
   threshold — the >= boundary, the exact line the Phase 9 seeded fault targets
   expected: "invited"
        got: "needs_review"
```

Nine other examples in the same file stayed green — proof the fault is narrow and the test suite pinpoints exactly the right behavior, not just "something broke somewhere." I then reverted the edit and re-ran the same spec file to confirm a clean return to 10/10 passing, with `git diff` on the file showing no residual change.

The actual git branch-commit-revert-push sequence (creating `test/seeded-fault-threshold`, committing the fault as its own commit, reverting as a second commit, pushing so CI runs red-then-green on GitHub itself) is handed to you to run rather than something I ran myself — this repo's standing working agreement is that I don't run `git commit`, and pushing a branch plus opening a PR both need your own explicit go-ahead regardless of that agreement. The exact commands are in `assessment/IMPLEMENTATION_PLAN.md` §10.

## Running it yourself

```bash
cd api
CI=true bundle exec rails zeitwerk:check
CI=true bundle exec rspec

# to see the seeded-fault mechanism yourself, without touching git:
# 1. flip >= to > on decision_engine.rb:63
# 2. bundle exec rspec spec/services/cv_screenings/decision_engine_spec.rb   # 1 named failure
# 3. flip it back
# 4. bundle exec rspec spec/services/cv_screenings/decision_engine_spec.rb   # green again
```

To actually exercise `.github/workflows/ci.yml` on GitHub's own infrastructure (not just a local simulation), push a branch and open a PR — that's the handoff described above and in the PR description (`assessment/phase-9-pr-description.md`).

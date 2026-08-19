# Phase 2 — Backend changes, explained for a frontend dev

Phase 1's doc ([`phase-1-backend.md`](./phase-1-backend.md)) covered the Rails/RSpec basics — read that first if you haven't. This phase is the first one that actually changes the database and adds real behavior, so a few new concepts show up: migrations (writing them, not just running them), model callbacks, and Rake tasks. This doc explains those as they come up.

## What this phase is actually solving

Picture this bug: a recruiter creates an Assessment with 5 skills, invites a candidate, then — before the candidate takes the interview — edits the assessment and swaps out 2 of those skills. Right now, the candidate's actual interview reads the assessment's skills **live, at the moment they connect**, not what they were invited against. So the candidate gets quizzed on skills that didn't exist when they were invited, with zero record that anything changed. Two candidates for "the same" assessment could silently be tested on different criteria.

The fix pattern is: instead of every part of the app reading `assessment.assessment_skills` live, take an immutable snapshot ("version") every time an Assessment (or Vacancy) is saved, and have consumers read *that* frozen snapshot instead of the live, mutable record. This phase builds the snapshot mechanism only — `VacancyVersion` and `AssessmentVersion` tables plus the code that creates them. **Nothing reads from these versions yet** — that's Phase 3 (Fit/Gap reports) and Phase 4 (the actual interview, which is the real bug fix). This phase is scaffolding.

## 1. Migrations — six new ones

A **migration** is a small Ruby file describing one incremental change to the database schema (add a table, add a column...), with a timestamp in its filename so Rails knows the order to apply them in. Think of it like a numbered, ordered patch — closer to a Prisma/Knex migration than anything in the frontend world, since React has no equivalent (there's no persistent schema to evolve on the client).

Six new files landed in `api/db/migrate/`, applied in filename order via `bin/rails db:migrate`:

1. **`create_vacancy_versions`** — a brand new table. Each row is one frozen snapshot of a Vacancy at some point in time:
   ```ruby
   create_table :vacancy_versions do |t|
     t.references :vacancy, null: false, foreign_key: true, type: :bigint
     t.string :role_title, limit: 255, null: false
     t.text :culture_dimensions
     t.text :competency_expectations
     t.text :public_requirement_text
     t.jsonb :skills_snapshot, null: false, default: []
     t.datetime :created_at, null: false
   end
   ```
   Two things worth calling out: there's **no `updated_at` column**. That's deliberate — this table is meant to be write-once. Rows get created, never edited. And `skills_snapshot` is a `jsonb` column — Postgres' native JSON storage, which here just holds an array of skill hashes, e.g. `[{"skill_id": "ruby", "skill_label": "Ruby", "expected_level": 4}]`. It's the closest DB equivalent to storing a plain JS array/object as a column value.
2. **`create_assessment_versions`** — same idea, for `Assessment`, with `assessment_skills`' fuller column set in its `skills_snapshot`.
3. **`add_column :vacancies, :public_requirement_text, :text`** — a genuinely new field on `Vacancy` itself (not just the version table). This is the text a rejected candidate will eventually see in feedback emails (a later phase) — kept separate from the private scoring criteria.
4. **`add_column :fit_gap_reports, :vacancy_version_id, :bigint`** — a nullable pointer column, added but not yet wired to anything (Phase 3's job).
5. **`add_column :sessions, :assessment_version_id, :bigint`** — same idea for `Session` (Phase 4's job).
6. **`add_foreign_key`/`add_index` for both new pointer columns** — run separately, *after* the backfill task (§3) populates them. Adding a foreign-key constraint just tells Postgres "every value in this column must point at a real row in that other table" — doing that only after the column is filled in avoids any risk of the constraint failing against not-yet-backfilled data.

## 2. Model callbacks — where the snapshot actually gets created

A **callback** is a hook that runs automatically at a point in a model's lifecycle — `after_save` runs every time a record is saved (create or update), no matter what triggered the save. There's no direct React equivalent, but the flavor is closest to a `useEffect` that fires after every state update, except it's server-side and runs inside the same database transaction as the save itself.

`app/models/vacancy.rb`:
```ruby
after_save :create_vacancy_version

private

def create_vacancy_version
  VacancyVersion.create!(
    vacancy_id: id,
    role_title: role_title,
    culture_dimensions: culture_dimensions,
    competency_expectations: competency_expectations,
    public_requirement_text: public_requirement_text,
    skills_snapshot: vacancy_skills.reload.map do |skill|
      { skill_id: skill.skill_id, skill_label: skill.skill_label, expected_level: skill.expected_level }
    end
  )
end
```

`Assessment` has the identical pattern (`app/models/assessment.rb`). One `after_save`, no `on: :create` restriction, so it fires on **every** save — create and update alike, with no de-duplication. That's a deliberate simplicity choice from the plan: storage cost is accepted in exchange for never having to reason about "did anything actually change" logic.

**Why `.reload` before mapping the skills?** Skills (`vacancy_skills`/`assessment_skills`) are edited through "nested attributes" — one API call that saves the Vacancy *and* creates/updates/destroys its skill rows in the same request, the same database transaction. By the time `after_save` runs, those child rows are already correctly saved in the database — but the in-memory Ruby object might still be holding a stale, already-loaded copy of the old list (this bit us during testing — see the two spec files below). Calling `.reload` forces a fresh read from the database, guaranteeing the snapshot reflects exactly what's really there, not what Ruby happened to have cached in memory.

## 3. The backfill Rake task

A **Rake task** is a named, runnable script — Ruby's equivalent of an npm script (`npm run something`), except defined in Ruby and invoked with `rake some:task` or `rails some:task`. There was no `lib/tasks/` directory in this repo at all before this phase; it's created fresh.

Why is a backfill needed? The callback in §2 only fires on *future* saves. Vacancies and Assessments that already existed before this phase shipped have no version at all. `api/lib/tasks/versions.rake` fixes that once:

```ruby
namespace :versions do
  task backfill: :environment do
    Vacancy.find_each do |vacancy|
      next if VacancyVersion.exists?(vacancy_id: vacancy.id)
      # ...build one VacancyVersion from the vacancy's current state...
    end
    # ...same for Assessment...
  end
end
```

Run it with `bundle exec rake versions:backfill`. The `next if VacancyVersion.exists?(...)` line is what makes it **idempotent** — safe to run more than once. Run it twice and the second run does nothing, because every vacancy already has a version by then. This matters operationally: if the task is interrupted halfway (a deploy restarts mid-run, say), re-running it from scratch is always safe.

One more detail: this task deliberately runs *unscoped* across every tenant (customer organization) in the database, not just one. That's intentional here — a backfill needs to cover everyone, and it's the one place in this codebase where that's correct rather than a bug (see the "tenant" section of the Phase 1 doc for why every other piece of code has to be careful about this).

## 4. Controller — `public_requirement_text` becomes editable

`app/controllers/api/v1/vacancies_controller.rb`'s `vacancy_params` (the Rails equivalent of validating/whitelisting a request body — think of it like a lightweight, hand-written zod schema applied to `req.body`) now permits `:public_requirement_text`, and `vacancy_json` (the hand-written response serializer, since this app has no serializer library) now returns it. Without both halves, the field would accept writes but never come back on a `GET` — a broken round trip.

## 5. Specs — what's actually being tested

Three new spec files, matching the pattern from Phase 1's `organization_spec.rb`:

- **`spec/models/vacancy_spec.rb`** / **`spec/models/assessment_spec.rb`** — three tests each: (1) saving creates a version with the right captured values, (2) destroying one skill and adding another via nested attributes produces a version whose snapshot reflects only the new skill set, (3) an *earlier* version's data is provably untouched after later saves — proving the callback always **creates a new row**, never edits an old one.
- **`spec/lib/tasks/versions_spec.rb`** — a new kind of test: invoking a Rake task from inside RSpec, via `Rake::Task['versions:backfill'].invoke`. A small support file, `spec/support/rake.rb`, makes this possible — it loads all Rake tasks once for the whole suite and re-enables them before each example (a Rake task normally refuses to run twice in the same process, so tests that call `.invoke` more than once need an explicit `Rake::Task[...].reenable` between calls — used here to prove the task is idempotent within a single test).

## 6. Running it yourself

```bash
cd api
bundle exec rails db:migrate           # applies migrations 1-5
bundle exec rake versions:backfill     # backfills any pre-existing rows
bundle exec rails db:migrate           # applies migration 6 (FK + index), now that data is populated
bundle exec rspec
bundle exec rails zeitwerk:check
```

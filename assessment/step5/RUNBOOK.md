# Running this branch on another laptop

Two levels. Level 1 needs almost nothing and proves the tests; Level 2 runs the whole product.

---

## Level 1 — run the tests only (~10 minutes)

This is enough to reproduce every claim in `05-monozukuri-execution.md` except the
database-backed specs, and it needs no PostgreSQL, no Redis and no Gemini key.

### Frontend suite

```bash
cd web
npm install          # Node 20+ (Vite 6 needs it)
npm test             # expect: 4 files, 23 tests passing
npx tsc --noEmit     # expect: no output
```

### Backend — the four database-free specs

```bash
cd api
# Ruby 3.3.2 (see .ruby-version). rbenv install 3.3.2 / asdf install ruby 3.3.2
bundle install       # needs libpq for the pg gem: brew install libpq postgresql@16

bundle exec rspec \
  spec/lib \
  spec/services/portfolios/skill_payload_spec.rb \
  spec/services/portfolios/coverage_lookup_spec.rb \
  spec/services/portfolios/skill_selection_spec.rb
```

These four load `spec_helper` only — no Rails boot, no database. They cover the
transcript leak, the fabricated-score rule, the coverage gate and the selection
rules together.

If `bundle install` fails compiling `pg` on macOS:

```bash
brew install libpq
bundle config build.pg --with-pg-config=$(brew --prefix libpq)/bin/pg_config
bundle install
```

---

## Level 2 — run the full suite and the app

### 1. Services

```bash
# PostgreSQL
brew install postgresql@16 && brew services start postgresql@16
# Redis (Sidekiq)
docker run -d -p 6379:6379 --name redis redis:alpine
```

### 2. Backend config

```bash
cd api
cp config/application.yml.sample config/application.yml
```

Fill in `config/application.yml`. `SECRET_KEY_BASE`, `DB_*` and `REDIS_URL` are
enough to run the tests and browse the UI; `GEMINI_API_KEY` is only needed to run
a live interview.

> `config/application.yml` and `web/.env` are gitignored and are **not** in the
> archive — copy them across from your other laptop, or recreate them from
> `application.yml.sample` / `.env.example`. Do not commit either file.

### 3. Databases

```bash
cd api
bin/rails db:create db:migrate db:seed          # development

RAILS_ENV=test bin/rails db:create
RAILS_ENV=test bin/rails db:migrate             # use migrate, not schema:load
```

**Use `db:migrate` for the test database, not `db:schema:load`.** The app lives in
a `ai_interview` PostgreSQL schema created by the first migration, and `schema.rb`
does not dump `create_schema`, so a fresh `schema:load` fails on the missing
schema. Running the migrations creates it.

`spec/rails_helper.rb` calls `maintain_test_schema!`, so if you skip the test-DB
migrate you get a clear "Migrations are pending" message instead of a confusing
`NoMethodError` on `generation_started_at`.

### 4. Full backend suite

```bash
cd api && bundle exec rspec
# 6 spec files: 4 database-free, plus portfolio_spec and generator_spec
```

### 5. Run the app

| Service | Command | Port |
|---|---|---|
| Redis | `docker start redis` | 6379 |
| Sidekiq | `cd api && bundle exec sidekiq -r ./config/environment.rb -C config/sidekiq.yml` | — |
| Rails API | `cd api && bundle exec rails server` | 3001 |
| Web | `cd web && npm run dev` | 5173 |

Sidekiq matters here: portfolio generation (N10) is a background job, so without
it a portfolio stays `pending` forever and you will not see the states this branch
added.

`web/.env.example` still says port **3000**; the API actually serves on **3001**
(`config/puma.rb`). Set both `VITE_API_BASE_URL` and `VITE_WS_BASE_URL` to 3001 —
that mismatch is pre-existing, not something this branch introduced.

---

## Reproducing the seeded fault test

Run it on a clean tree (`git status` empty). It creates its own scratch branch,
commits the fault, runs both suites, then reverts.

```bash
./assessment/step5/seeded-fault.sh
```

Expected: the API suite and `npm test` both go red, then both go green after the
revert. `git log --oneline -3` at the end shows the fault commit and its revert.

The script aborts if any of the four edits fails to apply, so it cannot silently
"pass" against unmodified source.

---

## Rolling back the migration

```bash
cd api && bin/rails db:rollback STEP=1
```

Drops `generation_started_at`, `generation_attempts` and the composite index, and
nothing else.

---

## Just reading the change

```bash
git log --oneline main..feat/product-revamp
git diff main..feat/product-revamp
git log --oneline chore/seeded-fault-proof   # the fault + its revert
```

---

## Quick troubleshooting

| Symptom | Cause |
|---|---|
| `PG::ConnectionBad` | PostgreSQL not running, or `DB_*` values in `application.yml` are wrong |
| `Migrations are pending` when running rspec | run `RAILS_ENV=test bin/rails db:migrate` |
| `schema "ai_interview" does not exist` | you ran `db:schema:load`; drop the DB and use `db:migrate` |
| Portfolio stays `pending` in the UI | Sidekiq is not running |
| `KeyError: key not found: GEMINI_API_KEY` | only needed for a live interview; set any placeholder to browse the UI |
| Frontend gets CORS errors | `ALLOWED_ORIGINS` must include `http://localhost:5173` |

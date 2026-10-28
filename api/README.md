# Local Setup

## Prerequisites

- Ruby (see `.ruby-version`)
- Node.js + npm
- PostgreSQL (running locally or via Docker)
- Docker (for Redis)

---

## 1. Environment variables

```bash
cp config/application.yml.sample config/application.yml
```

Fill in the required values in `config/application.yml`:

| Variable | Description |
|---|---|
| `SECRET_KEY_BASE` | Must match `rakamin-api` — JWT tokens are shared |
| `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USERNAME` / `DB_PASSWORD` | Shared PostgreSQL instance |
| `GEMINI_API_KEY` | Google AI Studio API key |
| `GEMINI_LIVE_MODEL` | e.g. `gemini-3.1-flash-live-preview` |
| `GEMINI_ANALYSIS_MODEL` | e.g. `gemini-2.0-flash-001` |
| `GEMINI_PRO_MODEL` | e.g. `gemini-2.5-pro` |
| `REDIS_URL` | e.g. `redis://localhost:6379/1` |
| `ALLOWED_ORIGINS` | CORS origin for the frontend, e.g. `http://localhost:5173` |
| `APP_BASE_URL` | Backend base URL, e.g. `http://localhost:3001` |

---

## 2. Install dependencies

```bash
bundle install
```

---

## 3. Set up the database

```bash
rails db:create   # skip if DB already exists
rails db:migrate
rails db:seed
```

---

## 4. Start Redis via Docker

```bash
docker run -d -p 6379:6379 --name redis redis:alpine
```

---

## 5. Start Sidekiq

```bash
bundle exec sidekiq -r ./config/environment.rb -C config/sidekiq.yml
```

---

## 6. Start the Rails server

```bash
bundle exec rails server
```

Runs on **port 3001** by default.

---

## 7. Start the frontend

```bash
cd ../ai-interview-web
npm install
npm run dev
```

Runs on **port 5173** by default.

---

## All services at a glance

| Service | Command | Port |
|---|---|---|
| Redis | `docker run -d -p 6379:6379 --name redis redis:alpine` | 6379 |
| Sidekiq | `bundle exec sidekiq -r ./config/environment.rb -C config/sidekiq.yml` | — |
| Rails API | `bundle exec rails server` | 3001 |
| Frontend | `npm run dev` (in `ai-interview-web/`) | 5173 |

---

## Running tests

The suite uses RSpec, FactoryBot and WebMock. Gemini is never called: specs pass a
`FakeGeminiClient` (see `spec/support/fake_gemini_client.rb`) as `gemini_client:`,
`WebMock.disable_net_connect!` blocks all outbound HTTP, and `GEMINI_API_KEY` is replaced
with a dummy value before the app boots. Sidekiq runs in fake mode (jobs stay in memory).

Prepare the test database once (and again after adding a migration):

```bash
RAILS_ENV=test bundle exec rails db:create db:migrate
```

Use `db:migrate`, not `db:schema:load`: `schema.rb` cannot express the `ai_interview`
Postgres schema, so loading it would put every table in `public`.

Run the suite:

```bash
bundle exec rspec
CI=true bundle exec rspec   # same as CI: eager loads the whole app first
```

CI (`.github/workflows/ci.yml`) runs the same suite against PostgreSQL and Redis service
containers with dummy secrets only.

### Dev scenarios (manual testing without a live interview)

```bash
bundle exec rails runner db/seeds/dev_scenarios.rb
```

Creates obviously fake portfolios and fit/gap reports for the Portfolio, Override and
Fit/Gap flow using the real generator and engine with a fake Gemini client. Development
environment only; idempotent.

---

## Local setup notes (macOS)

- **Ruby 3.3.2**: if Homebrew refuses to install `rbenv` because Command Line Tools are
  outdated, clone `rbenv` and `ruby-build` into `~/.rbenv` and build with
  `RUBY_CONFIGURE_OPTS="--with-openssl-dir=$(brew --prefix openssl@3) --with-libyaml-dir=$(brew --prefix libyaml)" rbenv install 3.3.2`.
- **`bin/rails` is not executable** in the repository; use `bundle exec rails ...`.
- **Puma crashes on fork** (`objc[...] ... fork() was called`) because `config/puma.rb`
  defaults to 2 workers with `preload_app!`. Run a single process locally:
  `WEB_CONCURRENCY=0 bundle exec rails server -p 3001`.
- **Redis without Docker**: `brew services start redis` works with
  `REDIS_URL=redis://localhost:6379/1`.
- `ALLOWED_ORIGINS` must be set (for example `http://localhost:5173`), otherwise every
  `rails` command fails at boot.

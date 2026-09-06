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

## 8. Testing

### Setup the test database (first time only)

```bash
rails db:create db:migrate RAILS_ENV=test
```

Uses the `rakamin_test` database with the same `ai_interview` search path as dev/prod.

### Run the test suite

```bash
bundle exec rspec
```

Target just the auth area:

```bash
bundle exec rspec spec/requests/api/v1/authentication_spec.rb spec/models/user_spec.rb
```

Run the linter:

```bash
bundle exec rubocop
```

Notes:

- `Rack::Attack` (rate limiting) is disabled during the suite via `spec/support/rack_attack.rb` so per-IP throttles don't cause 429s.
- Request specs pick a tenant via the `X-Tenant-Scheme` header (fallback to the first `public.organizations` row). Request helpers live in `spec/support/request_helpers.rb`.
- `Current` (RequestStore-based) is cleared after every example via `rails_helper.rb` so tenant/user state does not leak between tests.
- Current status: **21 examples, 0 failures** (auth request specs + user model). `Metrics/BlockLength` offenses in `spec/` are within the project's existing rubocop baseline.

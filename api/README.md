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
| `GEMINI_API_KEY` | Google AI Studio API key. Leave it empty locally: the app then runs on a deterministic mock client and no Google account is needed |
| `GEMINI_ENABLED` | `true` (default) or `false`. `false` refuses every AI call instead of silently doing nothing |
| `GEMINI_MOCK_MODE` | `true` forces the mock client (offline development, no cost). Defaults to on in the test suite and whenever no key is set outside production/staging |
| `GEMINI_LIVE_MODEL` | Optional. Default `gemini-3.8-live` (WebSocket interview) |
| `GEMINI_FLASH_MODEL` | Optional. Default `gemini-3.6-flash` (coverage analysis, fit/gap narratives, checks) |
| `GEMINI_PRO_MODEL` | Optional. Default `gemini-3.6-flash` (portfolio generation) |
| `REDIS_URL` | e.g. `redis://localhost:6379/1` |
| `ALLOWED_ORIGINS` | CORS origin for the frontend, e.g. `http://localhost:5173` |
| `APP_BASE_URL` | Backend base URL, e.g. `http://localhost:3001` |

Model ids must be ones Google still serves — the previous defaults
(`gemini-2.0-flash-001`, `gemini-2.0-pro-001`, `gemini-2.5-pro`,
`gemini-3.1-flash-live-preview`) are shut down or restricted. See
[the model list](https://ai.google.dev/gemini-api/docs/models) and
[deprecations](https://ai.google.dev/gemini-api/docs/deprecations).

### AI health check

```bash
bundle exec rake gemini:check     # prints config, then makes one real call
bundle exec rake gemini:models    # lists the models this API key can call
```

Neither task prints the API key. Exit code is non-zero on failure, so both
are usable in CI or a post-deploy smoke test.

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

## 8. Run the tests

The suite needs a PostgreSQL instance; point it at any throwaway database:

```bash
docker run -d --name ai-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=rakamin_test -p 5433:5432 postgres:15-alpine
export DB_HOST=localhost DB_PORT=5433 DB_USERNAME=postgres DB_PASSWORD=postgres

bundle exec rails db:test:prepare   # loads db/schema.rb into rakamin_test
bundle exec rspec
```

Gemini calls are mocked in the test environment, so no `GEMINI_API_KEY` is
required. `bundle exec rake gemini:check` is the smoke test for the client
wiring itself (mock/disabled paths exit non-zero on failure).

---

## All services at a glance

| Service | Command | Port |
|---|---|---|
| Redis | `docker run -d -p 6379:6379 --name redis redis:alpine` | 6379 |
| Sidekiq | `bundle exec sidekiq -r ./config/environment.rb -C config/sidekiq.yml` | — |
| Rails API | `bundle exec rails server` | 3001 |
| Frontend | `npm run dev` (in `ai-interview-web/`) | 5173 |

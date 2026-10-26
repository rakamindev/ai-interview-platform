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

## Tests

```bash
RAILS_ENV=test bundle exec rails db:create db:schema:load   # first time
bundle exec rspec                                          # full suite
CI=true bundle exec rspec                                  # with eager loading, as CI runs it
bundle exec rails zeitwerk:check                           # verifies the app can eager load (production boot)
```

- Gemini is never called from specs: clients are injected or stubbed (`spec/support/fit_gap_helpers.rb`).
- `spec/contracts/fit_gap_report_contract_spec.rb` writes the fit/gap JSON fixture used by the web tests.
  After an intentional contract change: `UPDATE_CONTRACTS=1 bundle exec rspec spec/contracts`.
- Specs use fictional people only. Never paste real candidate data into specs or seeds.

### macOS note

Puma forks workers by default. On macOS this can crash with `objc[...] +[NSCharacterSet initialize] may have been in progress in another thread when fork() was called`. For local development, run single-mode:

```bash
WEB_CONCURRENCY=0 OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES bundle exec rails server -p 3001
```

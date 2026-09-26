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
| `GEMINI_LIVE_MODEL` | Model for the voice interview, e.g. `gemini-3.1-flash-live-preview` |
| `GEMINI_FLASH_MODEL` | Model for coverage analysis and fit/gap notes, e.g. `gemini-2.5-flash` |
| `GEMINI_PRO_MODEL` | Model for the final skill report: a strong model that answers reliably for your key, e.g. `gemini-3.6-flash` |
| `REDIS_URL` | e.g. `redis://localhost:6379/1` |
| `ALLOWED_ORIGINS` | CORS origin for the frontend, e.g. `http://localhost:5173` |
| `WEB_APP_URL` | Web app URL, used in candidate invite links, e.g. `http://localhost:5173`. The old name `APP_BASE_URL` still works |

### Check your Gemini models

Google retires model names over time, and some models are closed to new API keys. If interviews stop after a few seconds, or reports fail with `API returned 404`, check that your models answer:

```bash
bundle exec rails runner 'puts Gemini::HttpClient.new(model: Gemini::Models.flash, timeout: 30).generate_content("Reply with OK")'
bundle exec rails runner 'puts Gemini::HttpClient.new(model: Gemini::Models.pro, timeout: 30).generate_content("Reply with OK")'
```

Each command should print `OK`. To see every model your key can use, call `GET https://generativelanguage.googleapis.com/v1beta/models` with your key.

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

The seed does not create a user. To log in, create an admin (choose your own email and password):

```bash
bundle exec rails runner 'User.create!(email: "admin@example.com", password: "choose-a-password", role: "admin")'
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

Runs on **port 3001** by default. On macOS, if the server crashes when you log in (an `objc` fork error), start it as a single process: `WEB_CONCURRENCY=0 bundle exec rails server`.

---

## 7. Start the frontend

```bash
cd ../web
npm install
npm run dev
```

Runs on **port 5173** by default.

---

## 8. Run the tests

Build the test database with migrations. Don't use `db:schema:load`: `schema.rb` can't create the `ai_interview` schema.

```bash
RAILS_ENV=test bundle exec rails db:create db:migrate
bundle exec rspec
```

Specs never call Gemini: webmock blocks every real HTTP call. The coverage report is written to `coverage/index.html`.

---

## All services at a glance

| Service | Command | Port |
|---|---|---|
| Redis | `docker run -d -p 6379:6379 --name redis redis:alpine` | 6379 |
| Sidekiq | `bundle exec sidekiq -r ./config/environment.rb -C config/sidekiq.yml` | — |
| Rails API | `bundle exec rails server` | 3001 |
| Frontend | `npm run dev` (in `web/`) | 5173 |

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
| `GEMINI_LIVE_MODEL` | e.g. `gemini-3.8-live` |
| `GEMINI_FLASH_MODEL` | e.g. `gemini-3.8-flash` |
| `GEMINI_PRO_MODEL` | Portfolio analysis model, e.g. `gemini-3.6-flash` |
| `REDIS_URL` | e.g. `redis://localhost:6379/1` |
| `ALLOWED_ORIGINS` | CORS origin for the frontend, e.g. `http://localhost:5173` |
| `FRONTEND_BASE_URL` | Frontend URL for candidate invites, e.g. `http://localhost:5173` |

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
cd ../web
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
| Frontend | `npm run dev` (in `web/`) | 5173 |

## Verification

Use Ruby 3.3.2 (`rbenv exec bundle exec ...` if your shell still resolves the system Ruby).
Run migrations before starting the API. For tests, point `DATABASE_URL` at a dedicated PostgreSQL database:

```bash
RAILS_ENV=test bundle exec rails db:create db:migrate
bundle exec rspec
```

Never point the test database at production. Tests use synthetic records and fake Sidekiq jobs; Gemini is stubbed.

Local admin accounts now have an `organization_id`. Existing accounts in a single-organization database bind on first login. In a multi-organization database, an administrator must explicitly assign each account before login; request headers cannot choose membership. Signed tokens from the upstream authentication service continue to use their verified scheme claim.

Fit/gap endpoints return the current deterministic comparison immediately (HTTP 200); they do not enqueue AI narrative jobs. The old worker remains compatible with already queued jobs. Unknown ratings are `null` and result in `not_assessed` unless a human rating exists.

The nullable-rating migration rolls back on databases without null ratings. If unassessed records exist, rollback intentionally stops rather than inventing L1 values or destroying data. Keep the expanded nullable schema during an application rollback until those records are reconciled.

## Interview reconnect troubleshooting

Check the server's close code before changing retry delays. A 1007/1008 close with an
invalid key/model message before `setupComplete` is a configuration failure: fix the
server's `GEMINI_API_KEY`/`GEMINI_LIVE_MODEL` and restart Rails. The unused invite stays
pending and no portfolio is generated. Retry cannot repair an unavailable model or
invalid credentials. Live authentication follows Google's WebSocket `?key=` contract;
never log that URL. REST portfolio errors (for example HTTP 401) are a separate path.

Temporary upstream failures receive at most three consecutive retries. A setup that
never becomes ready times out after 15 seconds. Browser disconnect closes its upstream
client and preserves the active session; an old connection cannot expire a new one.
An abandoned session remains active until resumed or ended by the assessor. Audio
lost during disconnection is not replayed; ask the candidate to repeat the answer.
Concurrent tabs and multi-pod session ownership still require a separate design.

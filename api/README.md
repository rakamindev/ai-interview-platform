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

## Candidate Consent API (UU PDP)

### Record Consent

```
POST /api/v1/sessions/:token/consent
```

Records explicit candidate consent before the AI interview begins, as required by UU PDP No. 27/2022.

**Request Body:**

```json
{
  "pdp_retention_acknowledged": true,
  "consent_version": "v1.0-uupdp-2022"
}
```

**Success Response (200):**

```json
{
  "status": "ok",
  "session_id": 42,
  "consent_given": true,
  "consent_given_at": "2026-11-07T10:30:00Z",
  "consent_version": "v1.0-uupdp-2022"
}
```

**Error Responses:**

| Status | Condition |
|---|---|
| 422 | `pdp_retention_acknowledged` is missing or false |
| 409 | Consent was already recorded for this session |
| 404 | Invalid token |

### Candidate Info

```
GET /api/v1/sessions/:token/candidate
```

Now includes consent fields in the response:

```json
{
  "session_id": 42,
  "role_title": "Backend Engineer",
  "time_limit_min": 30,
  "session_status": "pending",
  "consent_given": false,
  "consent_given_at": null,
  "consent_version": null,
  "pdp_retention_acknowledged": false
}
```

### WebSocket Enforcement

The `AudioWebSocketMiddleware` now blocks WebSocket connections if the candidate has not given consent. A JSON error message is returned and the connection is closed.

---

## Running Tests

```bash
# Run all specs (uses SQLite in-memory for offline testing)
TEST_DB_ADAPTER=sqlite3 bundle exec rspec

# Run consent-specific specs
TEST_DB_ADAPTER=sqlite3 bundle exec rspec spec/requests/api/v1/sessions_consent_spec.rb spec/models/session_spec.rb
```

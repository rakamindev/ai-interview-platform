# Local Setup

## Prerequisites

- Ruby (see `.ruby-version`)
- Node.js + npm
- PostgreSQL (running locally or via Docker)
- Redis (locally or via Docker)

---

## 1. Environment variables

```bash
cp config/application.yml.sample config/application.yml
```

Fill in the required values in `config/application.yml`:

| Variable | Description |
|---|---|
| `SECRET_KEY_BASE` | Rails secret; also the default JWT signing key (see `JWT_SECRET_KEY`). |
| `JWT_SECRET_KEY` | *(optional)* Dedicated JWT signing key. Falls back to `SECRET_KEY_BASE` if unset — **set a distinct value in production.** |
| `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USERNAME` / `DB_PASSWORD` | PostgreSQL connection |
| `GEMINI_API_KEY` | Google AI Studio API key |
| `GEMINI_LIVE_MODEL` | e.g. `gemini-2.0-flash-live-001` |
| `GEMINI_FLASH_MODEL` | e.g. `gemini-2.0-flash-001` (coverage analysis) |
| `GEMINI_PRO_MODEL` | e.g. `gemini-2.5-pro` (portfolio generation) |
| `REDIS_URL` | e.g. `redis://localhost:6379/1` |
| `ALLOWED_ORIGINS` | CORS origin(s) for the frontend, comma-separated. **Must be specific — not `*`** (cookie auth enables CORS credentials, which forbids a wildcard). e.g. `http://localhost:5173` |
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
rails db:seed      # creates the test organization + skill taxonomy (no users)
```

---

## 4. Create an admin user

Login is **admin/assessor only**, and every user must be linked to an organization.
`db:seed` does **not** create users, so make one in the console:

```bash
bundle exec rails console
```
```ruby
org = Organization.find_by(scheme: "test-corp")   # created by db:seed
User.create!(email: "admin@test-corp.com", password: "password123", role: "admin", organization: org)
```

---

## 5. Start Redis

```bash
# local install
redis-server --port 6379
# …or via Docker
docker run -d -p 6379:6379 --name redis redis:alpine
```

---

## 6. Start Sidekiq

```bash
bundle exec sidekiq -r ./config/environment.rb -C config/sidekiq.yml
```

---

## 7. Start the Rails server

```bash
bundle exec rails server
```

Runs on **port 3001** by default.

---

## 8. Start the frontend

```bash
cd ../web
npm install
cp .env.example .env    # points at http://localhost:3001
npm run dev
```

Runs on **port 5173** by default.

---

## Signing in

Auth uses a JWT delivered in an **HttpOnly cookie** set at login (the token is never
stored in JS). Two options for local work:

- **Log in via the UI** at `http://localhost:5173/login` with the admin credentials
  from step 4. The backend sets the `auth_token` cookie; `POST /api/v1/auth/logout`
  clears it.
- **Dev token (skip login):** mint a JWT for your admin user and put it in `web/.env`
  as `VITE_DEV_TOKEN` — it's sent as an `Authorization` header in dev builds only:
  ```ruby
  # rails console
  user = User.find_by(email: "admin@test-corp.com")
  JsonWebToken.encode(user_id: user.id, role: user.role, scheme: user.organization.scheme)
  ```
  The `user_id` must reference a real, active user — tokens are validated against the DB.

---

## Running tests

```bash
# Backend (RSpec) — prepare the test DB once, then run:
RAILS_ENV=test bundle exec rails db:migrate
RAILS_ENV=test bundle exec rspec

# Frontend (Vitest):
cd ../web && npm test
```

The test DB is prepared with **migrations** (not `db:schema:load`) because the app
lives in a custom `ai_interview` PostgreSQL schema — see
[`docs/engineering-notes.md`](docs/engineering-notes.md).

---

## All services at a glance

| Service | Command | Port |
|---|---|---|
| Redis | `redis-server --port 6379` (or Docker) | 6379 |
| Sidekiq | `bundle exec sidekiq -r ./config/environment.rb -C config/sidekiq.yml` | — |
| Rails API | `bundle exec rails server` | 3001 |
| Frontend | `npm run dev` (in `web/`) | 5173 |

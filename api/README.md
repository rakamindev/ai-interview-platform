# Backend Service (`api/`)

A Ruby on Rails 7.1 REST & WebSocket backend service powered by PostgreSQL, Sidekiq/Redis, and Google Gemini AI.

---

## Prerequisites

- **Ruby:** `3.3.2` (managed via rbenv, asdf, or mise)
- **PostgreSQL:** `14+`
- **Redis:** `6+` (for asynchronous Sidekiq worker execution)
- **Bundler:** `2.5+`

---

## 1. Environment Configuration

```bash
cp config/application.yml.sample config/application.yml
```

Edit `config/application.yml` with your local secrets:

| Variable | Required | Description |
|---|---|---|
| `SECRET_KEY_BASE` | **Yes** | 64+ byte secret used for JWT signing and cookie verification. **Enforces fail-fast validation with zero hardcoded fallbacks.** |
| `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USERNAME` / `DB_PASSWORD` | **Yes** | PostgreSQL connection credentials. |
| `GEMINI_API_KEY` | **Yes** | Google AI Studio API key (`v1beta` endpoint). |
| `GEMINI_LIVE_MODEL` | No | Model for real-time live interviews (default: `gemini-2.5-flash`). |
| `GEMINI_ANALYSIS_MODEL` | No | Model for competency and portfolio synthesis (default: `gemini-2.5-flash`). |
| `REDIS_URL` | No | Redis connection URL (default: `redis://localhost:6379/1`). |
| `ALLOWED_ORIGINS` | No | CORS allowed origins for frontend (default: `http://localhost:5173`). |
| `APP_BASE_URL` | No | Backend base URL (default: `http://localhost:3001`). |

---

## 2. Dependencies & Database Setup

```bash
# Install gems
bundle install

# Prepare database and run migrations
bin/rails db:create
bin/rails db:migrate

# Seed multi-tenant organizations & demo records
bin/rails db:seed
```

---

## 3. Multi-Tenant Seed Accounts

Seeding populates two distinct organizations to verify tenant isolation:

| Tenant | Email | Password | Seeded Data Summary |
|---|---|---|---|
| **Test Corp** (`test-corp`) | `admin@example.com` | `password123` | Engineering Assessment · 2 Vacancies · Precomputed Portfolios |
| **Acme Corp** (`acme-corp`) | `admin@acme.com` | `password123` | Product Mgmt Assessment · 2 Vacancies · Precomputed Portfolios |

---

## 4. Running the Application

### Start Redis (via Docker)
```bash
docker run -d -p 6379:6379 --name redis redis:alpine
```

### Start Sidekiq Worker (Background Synthesis)
```bash
bundle exec sidekiq -r ./config/environment.rb -C config/sidekiq.yml
```

### Start Rails API Server (Port 3001)
```bash
bundle exec rails server
```

The API serves on **`http://localhost:3001`**.

---

## 5. Running the Test Suite (RSpec)

The backend includes a comprehensive RSpec test suite covering authentication, multi-tenant isolation, cryptographic JWT integrity, Fit/Gap calculations, and Sidekiq worker scoping:

```bash
bundle exec rspec
```

**Status:** 41 examples, 0 failures.

---

## Key Architectural Principles

1. **Strict Multi-Tenancy:** Tenant identity is resolved strictly from user membership records (`users.scheme`). Client-supplied headers or parameters are ignored during login to prevent tenant spoofing.
2. **Fail-Fast Cryptography:** `JsonWebToken` strictly raises `KeyError` if `SECRET_KEY_BASE` is unset or blank.
3. **Auditability (UU PDP):** Score calibrations are stored in `AssessorOverride` rows preserving immutable baseline AI ratings.

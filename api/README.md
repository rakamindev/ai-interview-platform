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

## Running Tests

### Setup test database

```bash
RAILS_ENV=test bundle exec rails db:create db:migrate
```

### Run all tests

```bash
RAILS_ENV=test bundle exec rspec
```

### Run specific test file

```bash
RAILS_ENV=test bundle exec rspec spec/models/session_spec.rb
```

### Run specific test by line number

```bash
RAILS_ENV=test bundle exec rspec spec/models/session_spec.rb:25
```

### Run tests with documentation format

```bash
RAILS_ENV=test bundle exec rspec --format documentation
```

### Test coverage

| Category | Specs | What's Tested |
|---|---|---|
| Models | 17 | Validations, associations, scopes, callbacks, TenantScoped & CacheVersion concerns |
| Services | 8 | StateEngine, MapInjector, StartHandler, EndHandler, SystemPromptCompiler, PdfGenerator, FitGap::Engine, Portfolios::Generator |
| Workers | 4 | CoverageAnalyzer, PortfolioGenerator, FitGapGenerator, SystemPromptGenerator (incl. tenant context) |
| Requests (API endpoints) | 13 | Assessments, Sessions (+ erasure), PortfolioSkills, Vacancies, SkillTaxonomies, Auth, Consent, Health/SpeedTest, RateLimiting, Response format contracts, Index caching, Session data erasure |
| Auth & Concerns | 1 | AuthorizeApiRequest |
| Serializers | 1 | Contract specs for all 9 serializers against shared key-sets |

**Total: 390 examples** — includes rate limiter tests (login 5/min per IP, candidate endpoints 30/min per IP), multi-tenancy isolation tests, response contract specs (exact key-set + type + N+1 regression), cache invalidation tests (no stale data after writes, no cross-tenant leakage), UU PDP tests (consent gate, right-to-erasure cascades), and Gemini client mocking (no real API calls in tests).

---

## UU PDP — Data Retention & Erasure

Interview data is personal data and must not be retained indefinitely.

### Retention purge

```bash
bundle exec rails pdp:purge_expired                     # purge sessions ended > 90 days ago
PDP_RETENTION_DAYS=30 rails pdp:purge_expired           # custom window
PDP_RETENTION_DAYS=0 rails pdp:purge_expired            # disabled (no-op)
```

Rules:
- Only **ended** sessions are purged — live/pending interviews are never touched
- Cascades remove all personal-data children: `transcript_turns`, `coverage_maps`, `portfolio` → `portfolio_skills` → `assessor_overrides`, and `fit_gap_reports`
- Deletes run in batches of 100 to avoid long DB locks

Schedule daily via k8s CronJob / crontab:

```
0 3 * * * cd /app && bundle exec rails pdp:purge_expired
```
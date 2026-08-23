# 07 — Local Development

**Provenance: `[CODE]`.**

---

## 1. Docker Compose Setup

Two separate compose files (split for prod/dev separation):

### API: `api/docker-compose.yml`

Services:
- **postgres** — PostgreSQL 18 Alpine, port 5432, healthcheck via `pg_isready`
- **redis** — Redis 8 Alpine, port 6379, healthcheck via `redis-cli ping`
- **api-dev** — Rails API (Puma), port 3001, depends on postgres + redis
- **sidekiq** — Background worker, same image as api-dev

Key environment variables:
```yaml
GEMINI_STUB: "true"          # Enable stub mode (default)
GEMINI_STUB_MODE: "valid"    # Default fixture mode
SECRET_KEY_BASE: "compose-development-secret"
DB_HOST: postgres
REDIS_URL: redis://redis:6379/1
```

### Web: `web/docker-compose.yml`

Services:
- **web-dev** — Vite dev server, port 5173

Key environment variables:
```yaml
VITE_API_BASE_URL: http://localhost:3001/api/v1
VITE_WS_BASE_URL: ws://localhost:3001
```

---

## 2. GEMINI_STUB Mode

`Gemini::ClientFactory` (`api/app/clients/gemini/client_factory.rb:9-16`):

```ruby
if ENV["GEMINI_STUB"] == "true"
  StubClient.new(model: model, timeout: timeout)
else
  HttpClient.new(model: model, timeout: timeout)
end
```

When `GEMINI_STUB=true` (the default in docker-compose), all Gemini calls are intercepted by `StubClient`, which returns fixture-backed responses. No real API key needed.

### Stub Modes

Controlled by `GEMINI_STUB_MODE` env var:

| Mode | Behaviour |
|------|-----------|
| `valid` | Normal portfolio/coverage response |
| `missing_level` | Skill without `level` key |
| `out_of_range_level` | Level 9 (outside 1-5) |
| `string_level` | Level "three" (string, not int) |
| `missing_confidence` | Skill without `confidence` key |
| `bad_confidence_enum` | Unknown confidence string |
| `missing_summary` | Skill without `competency_summary` |
| `empty_arrays` | Empty configured/discovered arrays |
| `malformed_json` | Invalid JSON response |
| `injected_instructions` | Prompt injection attempt in response |
| `timeout` | Raises `HttpClient::TimeoutError` |
| `rate_limited` | Raises `HttpClient::RateLimitError` |

---

## 3. Demo Fixtures

`api/db/seeds/demo.rb` — loaded from `db/seeds.rb` when `Portfolio.exists?` is false.

### Organisations

| Name | Scheme | Purpose |
|------|--------|---------|
| Test Corp | `test-corp` | Primary tenant |
| Rival Corp | `rival-corp` | Cross-tenant verification |

### User

| Email | Role | Memberships |
|-------|------|-------------|
| `dev@test-corp.local` | admin | Test Corp + Rival Corp |

### Assessments

| Name | Language | Skills | Tenant |
|------|----------|--------|--------|
| Frontend Engineer | en | React, Node.js, REST API, Communication, Problem Solving | Test Corp |
| Insinyur Perangkat Lunak | id | Node.js, DB Design, Problem Solving | Test Corp |

### Vacancy

| Role | Required Skills |
|------|----------------|
| Senior Frontend Engineer | React (L4), Node.js (L2), REST API (L3), Communication (L3), Agile (L3) |

### 7 Portfolios (Edge Cases)

| # | Candidate | Status | Purpose |
|---|-----------|--------|---------|
| A | Rina Kartika | complete | Primary: mixed confidence, discovered skill, override-ready |
| B | Budi Santoso | complete | All-low-confidence (short interview) |
| C | Dewi Lestari | complete | Has assessor override with audit trail |
| D | Failed Candidate | failed | Error state |
| E | Generating Candidate | generating | In-progress state |
| F | Empty Candidate | complete | Zero skills (time_ceiling end) |
| G | Long Text Candidate | complete | 2000-char quote, 200-char label |

Plus:
- **Rival Candidate** (Rival Corp) — cross-tenant verification

### Fit/Gap Report

Generated for Portfolio A vs the vacancy, with:
- Match (Communication, Problem Solving)
- Gap (Node.js L3 vs L2 required, wait — reversed: candidate L3 vs expected L2 = exceed)
- Exceed (React L3 vs L4 required — actually gap)
- Low confidence (REST API — single probe)
- Discovered strength (Micro-frontend Architecture)

---

## 4. Makefile Targets

`Makefile` — unified entry point for all operations:

### API Targets

| Target | Command | Description |
|--------|---------|-------------|
| `api-up` | `docker compose -f api/docker-compose.yml up -d` | Start API stack |
| `api-down` | `... down` | Stop API stack |
| `api-nuke` | `... down -v` | Stop + remove volumes |
| `api-build` | `... up -d --build` | Rebuild and start |
| `api-test` | `... exec rspec` | Run RSpec suite |
| `api-console` | `... exec rails c` | Rails console |
| `api-seed` | `... exec rails db:seed:replant` | Reset and seed |

### Web Targets

| Target | Command | Description |
|--------|---------|-------------|
| `web-up` | `docker compose -f web/docker-compose.yml up -d` | Start web stack |
| `web-test` | `... exec npm run test` | Run Vitest suite |
| `web-lint` | `npm run lint` | Lint with oxlint |
| `web-fmt` | `npm run fmt` | Format with oxfmt |

### Combined Targets

| Target | Description |
|--------|-------------|
| `up` | Start both API and web |
| `down` | Stop both |
| `test` | Run both test suites |
| `lint` | Lint web code |

### Env Checks

`check-api-env` — verifies `api/config/application.yml` exists. When `GEMINI_STUB` is off, rejects placeholder values for `SECRET_KEY_BASE` and `GEMINI_API_KEY`.

`check-web-env` — verifies `web/.env` exists.

---

## 5. Quick Start

```bash
# 1. Copy config files
cp api/config/application.yml.sample api/config/application.yml
cp web/.env.example web/.env

# 2. Start everything
make up

# 3. Seed database
make api-seed

# 4. Open browser
open http://localhost:5173

# 5. Run tests
make test
```

GEMINI_STUB is `true` by default — no API key needed for local development.

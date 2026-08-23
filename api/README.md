# AI Interview Platform — API

Rails 7.0 · Ruby 3.3.2 · PostgreSQL · Redis/Sidekiq · Gemini

## Quick start (Docker Compose)

```bash
cd <repo root>/api
cp config/application.yml.sample config/application.yml   # no edits needed
docker compose up
```

API serves on **http://localhost:3001**. No Gemini key needed — `GEMINI_STUB=true` is
the compose default; the product runs against fixture responses.

## Optional fast path — native Ruby

For faster file-watching during development. Requires Ruby 3.3.2 (see `.ruby-version`),
a local PostgreSQL on port 5432, and Redis on 6379.

```bash
mise use ruby@3.3.2            # or rbenv/asdf
docker compose up postgres redis   # infrastructure only
cd api && bundle install
cp config/application.yml.sample config/application.yml   # fill in values
bundle exec rails db:prepare
bundle exec rails db:seed
bundle exec rails server          # port 3001
```

Set `GEMINI_STUB=true` in `config/application.yml` to run without a key.

## Environment variables

| Variable | Description |
|---|---|
| `SECRET_KEY_BASE` | Must match `rakamin-api` — JWT tokens are shared |
| `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USERNAME` / `DB_PASSWORD` | PostgreSQL (default: `localhost` / `5432` / `rakamin_development` / `postgres`) |
| `GEMINI_API_KEY` | Google AI Studio key (not needed when `GEMINI_STUB=true`) |
| `GEMINI_LIVE_MODEL` | e.g. `gemini-3.1-flash-live-preview` |
| `GEMINI_FLASH_MODEL` | e.g. `gemini-3.5-flash` |
| `GEMINI_PRO_MODEL` | e.g. `gemini-3.5-flash` |
| `REDIS_URL` | Default: `redis://localhost:6379/1` |
| `ALLOWED_ORIGINS` | CORS origin for the frontend, e.g. `http://localhost:5173` |
| `APP_BASE_URL` | Backend base URL, e.g. `http://localhost:3001` |

## Seed data

`bundle exec rails db:seed` creates one organisation (Test Corp), 22 pilot skills, and
a dev user:

```
email:    dev@test-corp.local
password: password
```

Demo fixtures (assessments, portfolios, fit/gap reports) load automatically in
development and test — see `db/seeds/demo.rb`.

## Running tests

```bash
bundle exec rspec
```

## See also

- [`web/README.md`](../web/README.md) — frontend setup
- [`docker-compose.yml`](docker-compose.yml) — API stack definition (postgres, redis, sidekiq)

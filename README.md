# The Product
Please refer to https://github.com/rakamindev/ai-interview-platform/wiki for initial product specification

# The Platform

A two-service application used for the Product Engineer case study. It is provided as a single repository so the whole thing clones, runs, and releases as one unit.

```
.
├── api/    # Backend service (Ruby on Rails, PostgreSQL, Redis/Sidekiq)
└── web/    # Frontend web app (React 18 + TypeScript, Vite, Tailwind)
```

The two services run together: the web app talks to the API over REST and WebSocket.

## Running it locally

Each service has its own setup guide. Run the API first, then the web app pointed at it.

1. **API** — see [`api/README.md`](api/README.md). Rails app; needs Ruby (see `api/.ruby-version`), PostgreSQL, and Redis. It serves on `http://localhost:3001`.
2. **Web** — see [`web/README.md`](web/README.md). Vite app; `npm install`, copy `.env.example` to `.env`, point `VITE_API_BASE_URL` at the API, then `npm run dev`. It serves on `http://localhost:5173`.

## Running everything with Docker Compose

Docker Compose starts the API, frontend, Sidekiq worker, Redis, and PostgreSQL:

```bash
cp .env.example .env
# Add GEMINI_API_KEY to .env for interview/AI features.
docker compose up --build
```

The services are available at:

| Service | URL / port |
|---|---|
| Web | http://localhost:5173 |
| API | http://localhost:3001 |
| PostgreSQL | localhost:5433 |
| Redis | localhost:6379 |

PostgreSQL is exposed on host port **5433** and remains on port 5432 inside the Compose network. The API automatically runs `rails db:prepare` when it starts. Stop the stack with `docker compose down`; add `-v` only when you want to remove the database and Redis volumes.

## Code quality

Run all quality checks through Docker from the repository root:

```bash
docker compose run --rm --no-deps web npm run check
docker compose run --rm -e RAILS_ENV=test api bundle exec rails db:prepare
docker compose run --rm -e RAILS_ENV=test api bundle exec rspec
docker compose run --rm --no-deps api bundle exec rubocop
```

The frontend check runs ESLint, Prettier verification, Vitest, TypeScript checking, and the production build. The Rails suite uses the Compose PostgreSQL service and a separate `rakamin_test` database. RuboCop applies Ruby, Rails, and RSpec rules. Existing backend debt is tracked in `api/.rubocop_todo.yml` and should be reduced as affected files are improved.

## Notes for the case study

- This is the codebase you assess, harden, and release. Treat it as a version about to ship to a client.
- Work in the `/assessment` folder at the repo root for your written deliverables; code changes go in `api/` or `web/`.
- See the case-study brief you were given for what to produce and how it is evaluated.

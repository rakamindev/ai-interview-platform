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

## Running the tests

CI runs both suites on every pull request (see [`.github/workflows/ci.yml`](.github/workflows/ci.yml)). Locally:

```bash
# API — RSpec. Needs PostgreSQL and Redis running; Rack::Attack builds its
# throttle store at boot, so Rails will not start without Redis.
cd api
bundle exec rails db:create db:migrate RAILS_ENV=test
bundle exec rspec

# Web — types, unit tests, production build
cd web
npx tsc --noEmit
npm run test
npm run build
```

The API reads its configuration from `config/application.yml` (copy `config/application.yml.sample`); every key in it can also be supplied as an environment variable, which is how CI runs without the file.

## Notes for the case study

- This is the codebase you assess, harden, and release. Treat it as a version about to ship to a client.
- Work in the `/assessment` folder at the repo root for your written deliverables; code changes go in `api/` or `web/`.
- See the case-study brief you were given for what to produce and how it is evaluated.

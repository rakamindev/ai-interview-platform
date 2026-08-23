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

**One-time setup:**

```bash
cd api && cp config/application.yml.sample config/application.yml   # fill in DB_* at least
bundle install && rails db:create && rails db:migrate && rails db:seed
cd ../web && cp .env.example .env   # defaults already point at localhost:3001
npm install
```

**Every time after that**, from the repo root:

```bash
bin/dev
```

Starts everything (Redis, Rails API on `:3001`, Sidekiq, Vite on `:5173`) in one terminal. `Ctrl+C` stops all of it. Then open `http://localhost:5173/login` and log in with the seeded account above.

Full details (all env vars, project structure) are still in [`api/README.md`](api/README.md) and [`web/README.md`](web/README.md) if you need them — `bin/dev` is the fast path.

## Notes for the case study

- This is the codebase you assess, harden, and release. Treat it as a version about to ship to a client.
- Work in the `/assessment` folder at the repo root for your written deliverables; code changes go in `api/` or `web/`.
- See the case-study brief you were given for what to produce and how it is evaluated.

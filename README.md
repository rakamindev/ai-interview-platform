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

## Running with Docker

This repo also ships as a single Docker Compose stack for local development.

Set any optional env values you need in your shell, especially `GEMINI_API_KEY` for AI features and `VITE_DEV_TOKEN` if you want to sign in through the web app. Then run:

```bash
docker compose up --build
```

The services will be available at:

- API: `http://localhost:3001`
- Web: `http://localhost:5173`

Important env values:

- `DB_HOST=db`
- `DB_PORT=5432`
- `SECRET_KEY_BASE=docker_development_secret_key_base`
- `REDIS_URL=redis://redis:6379/1`
- `APP_BASE_URL=http://localhost:3001`
- `ALLOWED_ORIGINS=http://localhost:5173`
- `VITE_API_BASE_URL=http://localhost:3001/api/v1`
- `VITE_WS_BASE_URL=ws://localhost:3001`

## Notes for the case study

- This is the codebase you assess, harden, and release. Treat it as a version about to ship to a client.
- Work in the `/assessment` folder at the repo root for your written deliverables; code changes go in `api/` or `web/`.
- See the case-study brief you were given for what to produce and how it is evaluated.

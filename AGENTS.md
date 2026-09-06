# AGENTS.md

Two-service monorepo: **Rails API** (`api/`) + **React SPA** (`web/`). They communicate over REST and WebSocket.

## Commands

**Web (from `web/`):**
```
npm install          # install deps
npm run dev          # Vite dev server → http://localhost:5173
npm run build        # tsc + vite build
```

**API (from `api/`):**
```
bundle install                       # install gems
rails db:create db:migrate db:seed   # first-time DB setup
bundle exec rails server             # → http://localhost:3001
bundle exec sidekiq -r ./config/environment.rb -C config/sidekiq.yml  # background jobs
bundle exec rspec                    # tests (rspec)
bundle exec rubocop                  # linter
```

**Redis (Docker):**
```
docker run -d -p 6379:6379 --name redis redis:alpine
```

## Architecture

- `api/` — Ruby 3.3.2, Rails 7.0.8, PostgreSQL, Redis/Sidekiq, WebSocket (faye-websocket), Gemini API integration
- `web/` — React 18, TypeScript, Vite 5, Tailwind 3, Jotai (state), React Router DOM 7, Axios

## Key constraints

- **API port 3001, Web port 5173** — don't change without updating both sides
- **Shared PostgreSQL database** with `rakamin-api` (tables live in `ai_interview` schema, search path: `ai_interview,public`)
- **`SECRET_KEY_BASE` must match `rakamin-api`** — JWT tokens are shared
- **Environment:** API uses Figaro (`config/application.yml`); Web uses Vite env vars (`.env`)
- **`@` alias** in web resolves to `./src` (vite.config.ts + tsconfig.json)
- **Audio features** require microphone/speaker — test with `getUserMedia`-capable browser
- No ESLint config in web; no active RSpec specs in api (tests exist but `spec/` is empty)
- `assessment/` folder at repo root is for written deliverables, not code

## API routes

All routes under `/api/v1/`. Key endpoints:
- `POST /auth/login` — JWT authentication
- `GET/POST /assessments` + nested `/sessions`
- `GET /sessions/:token/candidate` — candidate-facing (invite token, no JWT)
- `POST /sessions/:token/audio_complete` — audio upload
- `GET /skill_taxonomies` — reference data
- `GET/POST /vacancies`
- `GET /portfolios/:id/export` — PDF export
- `POST /portfolios/:id/fitgap` — vacancy fit/gap analysis

## Startup order

Redis → Sidekiq → Rails server → Web dev server

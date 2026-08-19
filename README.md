# Rakamin AI Interview

> **Rakamin AI Interview** is a multi-tenant B2B module of Rakamin's hiring platform that replaces or augments human screening with **fully AI-conducted live voice interviews**. An AI interviewer (Gemini Live) talks with each candidate in real time over a streaming-audio WebSocket, probes their skills against a configured taxonomy (L1–L5 anchors), and produces an **evidence-grounded portfolio** — per-skill level, confidence, and quoted transcript evidence. Assessors define vacancies and skill-based assessments, invite candidates, monitor live sessions, **override AI levels with notes**, and read **fit-gap reports** (match / gap / exceed / not assessed) against a vacancy's requirements.

**The two services** (one repo, run together over REST + WebSocket):

| Service | Stack | Docs |
|---|---|---|
| **`web/`** | React 18 + TypeScript · Vite · Tailwind | [`web/README.md`](web/README.md) |
| **`api/`** | Ruby on Rails · PostgreSQL · Redis/Sidekiq | [`api/README.md`](api/README.md) |

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

## Prerequisites

Install and have these available before either service will run successfully:

- **Ruby** — version in [`api/.ruby-version`](api/.ruby-version), plus Bundler (for the API)
- **Node.js 18+** and **npm** (for the web app)
- **PostgreSQL** — shared database, local or via Docker
- **Redis** — backs Sidekiq background jobs and streaming state (Docker is fine)
- **Gemini API key** (`GEMINI_API_KEY`) and configured models — the live interview, portfolio generation, and fit-gap reports depend on it
- **A Rakamin platform JWT** for local auth (`VITE_DEV_TOKEN`) and a `SECRET_KEY_BASE` that **matches `rakamin-api`** — auth is shared, not standalone
- **A modern browser** with `getUserMedia` and `AudioWorklet` support — required for the candidate interview (microphone required; camera optional via `VITE_REQUIRE_CAMERA`)

## Running it locally

Each service has its own setup guide. Run the API first, then the web app pointed at it.

1. **API** — see [`api/README.md`](api/README.md). Rails app; needs Ruby (see `api/.ruby-version`), PostgreSQL, and Redis. It serves on `http://localhost:3001`.
2. **Web** — see [`web/README.md`](web/README.md). Vite app; `npm install`, copy `.env.example` to `.env`, point `VITE_API_BASE_URL` at the API (`http://localhost:3001/api/v1`), then `npm run dev`. It serves on `http://localhost:5173`.

## Notes for the case study

- This is the codebase you assess, harden, and release. Treat it as a version about to ship to a client.
- Work in the `/assessment` folder at the repo root for your written deliverables; code changes go in `api/` or `web/`.
- See the case-study brief you were given for what to produce and how it is evaluated.

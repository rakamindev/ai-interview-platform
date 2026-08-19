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

## Notes for the case study

- This is the codebase you assess, harden, and release. Treat it as a version about to ship to a client.
- Work in the `/assessment` folder at the repo root for your written deliverables; code changes go in `api/` or `web/`.
- See the case-study brief you were given for what to produce and how it is evaluated.

## What changed in this revamp ("integrity of assessment")

This branch ships one focused PR that makes assessment results honest and trustworthy:

- **Transcript integrity guard** (`TranscriptIntegrity`) — a portfolio is no longer published from an unreadable transcript. Corrupted audio (hallucinated multilingual content) now leads to an `unverifiable` portfolio instead of a misleading low score.
- **Four honest portfolio states** in the web UI — `generating` (polling), `failed` (readable error + retry), `unverifiable` (reason + review + manual override), and `complete`.
- **Healthy 429 handling** — rate limits are surfaced as clear errors and retried with proper backoff instead of hammering the Gemini quota.
- **Robust PDF export** — non-WinAnsi characters no longer crash exports (no more 500), and a portfolio is never marked `complete` without evidence.
- **Protected data (UU PDP)** — sensitive params/PII are filtered from logs; secrets are gitignored.
- **Designed failure paths** — timeouts, model errors, partial writes, and duplicate jobs handled explicitly.

### Proof

- `bundle exec rspec` → **18 examples, 0 failures** (first spec suite in the repo), including a seeded-fault test and designed-failure-path specs.
- `npx tsc --noEmit` → clean.
- Seeded-fault scratch branch (`scratch-seeded-fault`) shows a red→green cycle with visible history.
- Full execution narrative: [`docs/execution.md`](docs/execution.md).

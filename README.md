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

**Quickest path — Docker Compose via Make (no local toolchain required):**

```bash
make up                                # starts both stacks (API + Web)
make logs                              # follow all output
make down                              # stop both (keeps volumes)
make nuke                              # stop and wipe volumes
make test                              # rspec (API) + vitest (Web)
```

The Makefile runs config checks before every target — `api/config/application.yml` and
`web/.env` must exist. If missing, the target aborts with a copy-pasteable fix.
Stub mode (`GEMINI_STUB=true`) is the default; placeholder values pass the check.

```bash
make check                             # verify config files exist and are valid
make NO_CHECK=1 down                   # bypass checks (escape hatch for broken configs)
```

Individual stacks can be managed separately:

```bash
make api-up / api-down / api-logs      # API only (postgres, redis, sidekiq)
make web-up / web-down / web-logs      # Web only (Node 24.19.0 LTS)
make api-console                       # Rails console
make api-seed                          # reset demo data
```

The Makefile is a thin wrapper around `docker compose -f api/docker-compose.yml` and
`docker compose -f web/docker-compose.yml` — raw compose commands still work directly.

| Service | URL |
|---|---|
| Web | http://localhost:5173 |
| API | http://localhost:3001 |

No Gemini API key required — `GEMINI_STUB=true` is the API compose default. See
[`api/README.md`](api/README.md) for the optional native (mise) fast path.

## Notes for the case study

- This is the codebase you assess, harden, and release. Treat it as a version about to ship to a client.
- Work in the `/assessment` folder at the repo root for your written deliverables; code changes go in `api/` or `web/`.
- See the case-study brief you were given for what to produce and how it is evaluated.

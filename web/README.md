# AI Interview Platform — Web

React 18 · TypeScript · Vite · Tailwind

## Quick start (Docker Compose)

```bash
cd <repo root>
docker compose -f web/docker-compose.yml up
```

Web serves on **http://localhost:5173** using Node 24.19.0 LTS. The compose file
handles `npm ci` and environment variables automatically. Requires the API stack
(`docker compose -f api/docker-compose.yml up` from the repo root) to be running first.

## Optional fast path — native Node

```bash
cd web
npm install
cp .env.example .env
npm run dev
```

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `VITE_API_BASE_URL` | Yes | Backend REST API, e.g. `http://localhost:3001/api/v1` |
| `VITE_WS_BASE_URL` | Yes | WebSocket server, e.g. `ws://localhost:3001` |

All other variables are optional — remove or leave blank as needed.

## Available scripts

| Command | Description |
|---|---|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Type-check (`tsc`) then production build |
| `npm run preview` | Preview the production build locally |
| `npm run test` | Vitest (requires deps installed) |

## Tech stack

- **React 18** with TypeScript
- **Vite** (build tool)
- **Tailwind CSS 3** (styling)
- **Radix UI** (accessible UI primitives)
- **Jotai** (state management)
- **React Hook Form + Zod** (form validation)
- **Axios** (HTTP client)
- **React Router DOM 7** (routing)
- **Vitest + React Testing Library + MSW** (testing)

## Project structure

```
src/
├── components/         # Reusable UI components
│   ├── ui/             # Base UI primitives (shadcn/ui style)
│   ├── interview/      # Interview session components
│   ├── assessment/     # Assessment management components
│   ├── portfolio/      # Candidate portfolio/results
│   ├── fitgap/         # Fit/gap comparison
│   └── layout/         # Layout wrappers
├── hooks/              # Custom React hooks
├── pages/              # Route-level page components
├── services/           # API clients (Axios instance, endpoints)
├── stores/             # Jotai atoms (auth, tenant)
├── schemas/            # Zod validation schemas
├── types/              # TypeScript type definitions
└── utils/              # Utility functions
```

## Notes

- The `@` path alias resolves to `./src` (configured in `vite.config.ts` and `tsconfig.json`).
- Audio features (interview page) require microphone and speaker access.
- The backend must be running for authentication, session management, and real-time audio to work.

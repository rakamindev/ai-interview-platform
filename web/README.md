# AI Interview Platform — Web Revamp

Frontend for the AI Interview Platform. Built on **Vite + React + TypeScript** with **TanStack Router** and **TanStack Query**, styling with **Tailwind CSS v4** and **@base-ui/react**.

## Prerequisites

- **Node.js** (v18+ recommended)
- **npm** (comes with Node)
- A running backend API server (default: `http://localhost:3001`)

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env
```

Edit `.env` with your local values:

```env
# Backend API base URL (includes /api/v1 prefix)
VITE_API_BASE_URL=http://localhost:3001/api/v1

# WebSocket base URL (no /api/v1)
VITE_WS_BASE_URL=ws://localhost:3001

# Speed test endpoints — when set, used instead of external services (leave blank to use external CDN/httpbin)
VITE_SPEED_TEST_PING_URL=http://localhost:3001/api/v1/speed_test/ping
VITE_SPEED_TEST_UPLOAD_URL=http://localhost:3001/api/v1/speed_test/upload

# Dev tenant context
VITE_DEV_TENANT_ID=1
VITE_DEV_TENANT_NAME=Demo Tenant
```

```bash
# 3. Start the dev server
npm run dev
```

The app will be available at **http://localhost:5173**.

## Available Scripts

| Command             | Description                          |
| ------------------- | ------------------------------------ |
| `npm run dev`       | Start Vite dev server with HMR       |
| `npm run build`     | Build the production bundle          |
| `npm run preview`   | Preview the production build locally |
| `npm run typecheck` | Type-check with `tsc --noEmit`       |
| `npm run lint`      | Run ESLint                           |
| `npm run test`      | Run unit tests with Vitest           |
| `npm run format`    | Format files with Prettier           |

## Environment Variables

| Variable                     | Required | Description                                                  |
| ---------------------------- | -------- | ------------------------------------------------------------ |
| `VITE_API_BASE_URL`          | Yes      | Backend REST API base URL (includes `/api/v1`)               |
| `VITE_WS_BASE_URL`           | Yes      | WebSocket server URL (used for live audio streaming)         |
| `VITE_SPEED_TEST_PING_URL`   | No       | Custom ping endpoint for hardware check speed test           |
| `VITE_SPEED_TEST_UPLOAD_URL` | No       | Custom upload endpoint for speed test                        |
| `VITE_REQUIRE_CAMERA`        | No       | Set to `"true"` to enforce camera check (default: `"false"`) |
| `VITE_DEV_TENANT_ID`         | No       | Tenant ID for multi-tenant context                           |
| `VITE_DEV_TENANT_NAME`       | No       | Tenant display name                                          |

## Tech Stack

- **React** + **TypeScript**
- **Vite** (build tool) + **TanStack Router** (file-based routing) + **TanStack Query** (server state)
- **Tailwind CSS v4** (styling) + **tw-animate-css** + **lucide-react** (icons)
- **@base-ui/react** (accessible UI primitives — `components/ui` are thin wrappers)
- **Jotai** (state management)
- **React Hook Form + Valibot** (form validation)
- **ky** (HTTP client)

## Project Structure

```
src/
├── components/
│   ├── layout/         # App / auth / candidate layout wrappers, header, nav
│   └── ui/             # Base UI primitives (@base-ui/react wrappers, shadcn/ui style)
├── features/           # Feature-scoped modules
│   ├── assessment/     # Assessment CRUD, invite, list/detail
│   ├── auth/           # Login, current-user (queries /auth/me)
│   ├── candidate/      # Candidate-facing interview (hardware check, session API)
│   ├── portfolio/      # Portfolio results, fit/gap, overrides, export
│   ├── session/        # Session monitor, transcript, real-time audio hooks/WS
│   ├── skill-taxonomy/ # Reference skill data
│   └── vacancy/        # Vacancy CRUD
│       (each feature: components/ queries/ mutations/ schemas/ hooks/)
├── hooks/              # Shared custom hooks
├── lib/                # api-client (ky wrapper), utils
├── providers/          # Theme provider
├── routes/             # File-based routes (TanStack Router)
│   ├── _auth/          # Login
│   ├── _protected/     # Assessor app (requires JWT)
│   └── _public/        # Candidate-facing pages (no auth), e.g. /interview/:token
├── stores/             # Jotai atoms (auth)
└── utils/              # Constants, helpers, hardware/speed-test utils
public/
└── audio-worklet-processor.js  # Audio worklet for real-time PCM processing
```

## Notes

- The `@` path alias resolves to `./src` (configured in `tsconfig.json` / Vite `tsconfigPaths`).
- Routes are file-based via TanStack Router — the route tree is generated from `src/routes/` on dev/build.
- Forms use **Valibot** schemas (not zod); HTTP calls go through `apiClient` (a `ky` wrapper in `src/lib/api-client.ts`).
- Audio features (candidate interview) require microphone/speaker access — test in a browser that supports `getUserMedia` and `AudioWorklet`. The `audio-worklet-processor.js` asset must be present in `public/`.
- The backend must be running for authentication, session management, and real-time audio streaming to work.

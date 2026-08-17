# Local Development Setup

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
# Backend API base URL
VITE_API_BASE_URL=http://localhost:3001/api/v1

# WebSocket base URL (no /api/v1)
VITE_WS_BASE_URL=ws://localhost:3001

# Dev auth token — replace with a real JWT from Rakamin platform
VITE_DEV_TOKEN=<your-jwt-here>

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

| Command           | Description                          |
| ----------------- | ------------------------------------ |
| `npm run dev`     | Start Vite dev server with HMR       |
| `npm run build`   | Type-check with `tsc` then build     |
| `npm run preview` | Preview the production build locally |

## Environment Variables

| Variable                     | Required | Description                                                  |
| ---------------------------- | -------- | ------------------------------------------------------------ |
| `VITE_API_BASE_URL`          | Yes      | Backend REST API base URL                                    |
| `VITE_WS_BASE_URL`           | Yes      | WebSocket server URL (used for live audio streaming)         |
| `VITE_DEV_TOKEN`             | Yes      | JWT for authenticating in local development                  |
| `VITE_DEV_TENANT_ID`         | Yes      | Tenant ID for multi-tenant context                           |
| `VITE_DEV_TENANT_NAME`       | Yes      | Tenant display name                                          |
| `VITE_SPEED_TEST_PING_URL`   | No       | Custom ping endpoint for hardware check speed test           |
| `VITE_SPEED_TEST_UPLOAD_URL` | No       | Custom upload endpoint for speed test                        |
| `VITE_REQUIRE_CAMERA`        | No       | Set to `"true"` to enforce camera check (default: `"false"`) |

## Tech Stack

- **React 18** with TypeScript
- **Vite 5** (build tool)
- **Tailwind CSS 3** (styling)
- **Radix UI** (accessible UI primitives)
- **Jotai** (state management)
- **React Hook Form + Zod** (form validation)
- **Axios** (HTTP client)
- **React Router DOM 7** (routing)

## Project Structure

```
src/
├── components/         # Reusable UI components
│   ├── ui/             # Base UI primitives (shadcn/ui style)
│   ├── interview/      # Interview session components
│   ├── assessment/     # Assessment management components
│   ├── portfolio/      # Candidate portfolio/results
│   └── layout/         # Layout wrappers
├── hooks/              # Custom React hooks (audio capture, playback, WebSocket)
├── pages/              # Route-level page components
├── services/           # API clients (Axios instance, endpoints)
├── stores/             # Jotai atoms (auth, tenant)
├── types/              # TypeScript type definitions
└── utils/              # Utility functions
public/
└── audio-worklet-processor.js  # Audio worklet for real-time PCM processing
```

## Notes

- The `@` path alias resolves to `./src` (configured in `vite.config.ts` and `tsconfig.json`).
- Audio features (interview page) require microphone and speaker access — test in a browser that supports `getUserMedia` and `AudioWorklet`.
- The backend must be running for authentication, session management, and real-time audio streaming to work.

# Frontend Application (`web/`)

A modern, responsive React 18 Single Page Application (SPA) built with TypeScript, Vite, Tailwind CSS, Radix UI, and TanStack Query.

---

## Prerequisites

- **Node.js:** `v18+` (LTS recommended)
- **npm:** `v9+`
- A running backend API service (default: `http://localhost:3001/api/v1`)

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables
cp .env.example .env

# 3. Start development server
npm run dev
```

The application runs on **`http://localhost:5173`**.

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Starts the Vite development server with Hot Module Replacement (HMR). |
| `npm test` | Runs the **Vitest** unit & component test suite (28 tests across 9 suites). |
| `npm run build` | Runs TypeScript compilation (`tsc`) and bundles optimized production assets with Vite. |
| `npm run preview` | Serves the production build locally for verification. |
| `npx playwright test` | Executes the end-to-end browser test suite (6 browser flows). |

---

## Multi-Tenant Demo Authentication

The login page at `/login` provides **1-Click Quick-Fill Demo Buttons** for testing multi-tenant isolation:

- **Test Corp:** `admin@example.com` / `password123` (Engineering assessments & vacancies)
- **Acme Corp:** `admin@acme.com` / `password123` (Product Management assessments & vacancies)

> **In-Memory Cache Purge:** When switching accounts or logging out, `queryClient.clear()` is executed automatically to guarantee 0% data bleeding between tenants in the browser.

---

## Project Architecture (Feature-Sliced Modular Design)

The codebase is organized into **5 vertical feature slices** for high cohesion and maintainability:

```
src/
├── components/           # Shared presentation primitives & application layouts
│   ├── layout/private/   # Private shell (navbar, sidebar, breadcrumb, bottom tab bar)
│   └── ui/               # Radix UI + Tailwind design system components
├── features/             # Vertical domain slices
│   ├── assessments/      # Assessment management, invite link generator, custom skills
│   ├── auth/             # Login page, multi-tenant quick-fill, auth API services
│   ├── evaluation/       # Skill portfolios, human overrides, Fit/Gap comparison tables
│   ├── interview/        # Live WebAudio 16kHz PCM capture, emerald voice bars, timer
│   └── vacancies/        # Vacancy rubric definitions and target level sliders
├── lib/                  # Singletons (Axios client, queryClient, queryKeys, utils)
├── stores/               # Global state (authAtom, persistent tenantAtom)
├── types/                # Canonical TypeScript domain types
└── test/                 # Vitest & Testing Library setup utilities
```

---

## Data Layer & State Management

- **TanStack Query (v5):** Handles server data caching, automatic 3-second background polling while evaluations are generating, and **optimistic updates** for instant assessor score calibration.
- **Jotai:** Manages lightweight atomic state (`authAtom` for JWT tokens, `tenantAtom` synchronized with `localStorage` for responsive navbar badges).
- **WebAudio API & AudioWorklet:** Processes 16kHz PCM audio frames in real time with Int16 Root-Mean-Square (RMS) calculations driving live voice visualizers.

# Local Development Setup

## Prerequisites

- **Node.js** >= 22 (jsdom 30 needs it)
- **pnpm** (lockfile is `pnpm-lock.yaml`)
- A running backend API server (default: `http://localhost:3001`)

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Set up environment variables
cp .env.example .env
```

Edit `.env` with your local values:

```env
# Backend API base URL
VITE_API_BASE_URL=http://localhost:3001/api/v1

# WebSocket base URL (no /api/v1)
VITE_WS_BASE_URL=ws://localhost:3001

# Dev auth token - optional. Normal login stores a token.
VITE_DEV_TOKEN=

# Dev tenant context
VITE_DEV_TENANT_ID=1
VITE_DEV_TENANT_NAME=Demo Tenant
```

```bash
# 3. Start the dev server
pnpm dev
```

The app will be available at **http://localhost:5173**.

## Available Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Start Vite dev server with HMR |
| `pnpm test` | Run tests with Vitest + Testing Library |
| `pnpm exec tsc --noEmit` | Type check without emitting files |
| `pnpm build` | Type-check with `tsc` then build |
| `pnpm preview` | Preview the production build locally |

## Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| `VITE_API_BASE_URL` | Yes | Backend REST API base URL (`http://localhost:3001/api/v1`) |
| `VITE_WS_BASE_URL` | Yes | WebSocket server URL (`ws://localhost:3001`) |
| `VITE_DEV_TOKEN` | No | Optional JWT for development. Normal login stores a token. |
| `VITE_DEV_TENANT_ID` | Yes | Tenant ID for multi-tenant context |
| `VITE_DEV_TENANT_NAME` | Yes | Tenant display name |
| `VITE_SPEED_TEST_PING_URL` | No | Custom ping endpoint for hardware check speed test |
| `VITE_SPEED_TEST_UPLOAD_URL` | No | Custom upload endpoint for speed test |
| `VITE_REQUIRE_CAMERA` | No | Set to `"true"` to enforce camera check (default: `"false"`) |

## Building a page

Every assessor screen is built from the same pieces. Use them instead of writing headers, skeletons, or error boxes by hand; the examples below compile as written.

| Piece | Import | Use it for |
| --- | --- | --- |
| `PageHeader` | `@/components/layout/PageHeader` (default) | Every screen's header: back link, title, subtitle, action buttons. |
| `FormPageLayout` | `@/components/layout/FormPageLayout` (default) | Create and edit forms: header plus one form card. |
| `RowList`, `RowListSkeleton` | `@/components/layout/RowList` (default, named) | Index lists where each row links to a record. |
| `PageSkeleton`, `PageHeaderSkeleton` | `@/components/layout/PageSkeleton` (default, named) | Loading state shaped like the real page, so nothing jumps when data arrives. |
| `ErrorState` | `@/components/feedback/ErrorState` (default) | A failed load or action, with an optional retry. Renders `role="alert"`. |
| `EmptyState` | `@/components/feedback/EmptyState` (default) | Nothing to show yet: says why and offers one next step. |
| `Notice` | `@/components/motion/Notice` (named) | Fades a message in and out (errors, warnings, confirmations). |
| `Collapse` | `@/components/motion/Collapse` (named) | Expands and collapses content in place. |
| `LevelBadge` | `@/components/portfolio/LevelBadge` (default) | Any L1 to L5 skill level. `size`: `"sm"` or `"md"`. |
| `formatDate` | `@/utils/format` (named) | Every user-facing date, e.g. "27 Oct 2026". |

Animation: `MotionProvider` (`src/components/motion/MotionProvider.tsx`) already wraps the app in `main.tsx`. It loads the animation engine lazily and turns motion off for users who ask for reduced motion. Inside components use `m.div` from `motion/react`, never `motion.div` (strict mode throws).

### A list page, end to end

```tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/layout/PageHeader";
import PageTransition from "@/components/layout/PageTransition";
import RowList, { RowListSkeleton } from "@/components/layout/RowList";
import ErrorState from "@/components/feedback/ErrorState";
import EmptyState from "@/components/feedback/EmptyState";
import { vacanciesApi } from "@/services/vacancies";
import { formatDate } from "@/utils/format";
import type { Vacancy } from "@/types";

export default function VacancyListPage() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = () => {
    setLoading(true);
    setError(false);
    vacanciesApi
      .list()
      .then((res) => setVacancies(res.data.vacancies))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  return (
    <PageTransition className="space-y-6">
      <PageHeader title="Vacancies" subtitle="Roles candidates are compared against.">
        <Button asChild>
          <Link to="/vacancies/new">New vacancy</Link>
        </Button>
      </PageHeader>

      {error ? (
        <ErrorState message="Could not load vacancies. Check your connection and try again." onRetry={load} />
      ) : loading ? (
        <RowListSkeleton />
      ) : vacancies.length === 0 ? (
        <EmptyState
          title="No vacancies yet"
          description="Fit/gap reports compare candidates against a vacancy."
          action={
            <Button asChild variant="outline" size="sm">
              <Link to="/vacancies/new">Create a vacancy</Link>
            </Button>
          }
        />
      ) : (
        <RowList
          label="Vacancies"
          items={vacancies.map((v) => ({
            key: v.id,
            to: `/vacancies/${v.id}/edit`,
            title: v.role_title,
            meta: v.updated_at ? `Updated ${formatDate(v.updated_at)}` : undefined,
          }))}
        />
      )}
    </PageTransition>
  );
}
```

### Smaller pieces

```tsx
// Detail page loading state: mirror the real header and the first block of content.
<PageSkeleton label="portfolio">
  <PageHeaderSkeleton actions={3} />
  <Skeleton className="h-48 w-full" />
</PageSkeleton>

// Form page: the header comes from the layout, only the form goes inside.
<FormPageLayout backTo="/vacancies" backLabel="Vacancies" title="New vacancy" description="Define the role and its required levels.">
  <form onSubmit={handleSubmit}>{/* fields */}</form>
</FormPageLayout>

// A message that should be noticed when it appears.
<Notice show={saved}>
  <p role="status">Override saved.</p>
</Notice>

// Inline editor that opens under its trigger without the page jumping.
<Collapse show={open}>{/* editor */}</Collapse>

<LevelBadge level={3} size="sm" />
```

## New page checklist

- [ ] Header is a `PageHeader`.
- [ ] Loading shows a `PageSkeleton` shaped like the real page. Add the page to `src/pages/__tests__/loadingStates.test.tsx`; the test fails if the skeleton is missing.
- [ ] Failed loads show an `ErrorState` with a retry.
- [ ] Empty data shows an `EmptyState` with one action.
- [ ] No horizontal scroll at 390px; tap targets at least 44px on phones.
- [ ] Sentence-case labels and buttons ("New vacancy", not "New Vacancy").
- [ ] Colors come from the tokens in `src/index.css` (see `DESIGN.md`), never raw hex.

## Design

See [DESIGN.md](./DESIGN.md) for why the app looks and moves the way it does: palette and contrast, the level badge motif, where motion is used, and phone rules.

## Tech Stack

- **React 18** with TypeScript
- **Vite** (build tool)
- **Tailwind CSS 3** (styling)
- **Radix UI** (accessible UI primitives)
- **Jotai** (state management)
- **React Hook Form + Zod** (form validation)
- **Axios** (HTTP client)
- **React Router DOM 7** (routing)
- **motion** (animation)

## Project Structure

```
src/
├── components/         # Reusable UI components
│   ├── ui/             # Base UI primitives (shadcn/ui style)
│   ├── interview/      # Interview session components
│   ├── assessment/     # Assessment management components
│   ├── portfolio/      # Candidate portfolio/results
│   ├── fitgap/         # Fit/gap comparison table
│   ├── vacancies/      # Vacancy form
│   ├── layout/         # Page shell: header, form layout, lists, skeletons
│   ├── feedback/       # ErrorState, EmptyState
│   └── motion/         # MotionProvider, Notice, Collapse
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
- Audio features (interview page) require microphone and speaker access - test in a browser that supports `getUserMedia` and `AudioWorklet`.
- The backend must be running for authentication, session management, and real-time audio streaming to work.

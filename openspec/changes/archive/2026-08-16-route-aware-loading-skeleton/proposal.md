## Why

The app has three visually distinct shells — the assessor dashboard (`AssessorLayout`), the two-column auth screen (`AuthShell`), and the minimal candidate/interview view (`CandidateLayout`) — but a single global `Suspense` fallback (`App.tsx:42`) renders one skeleton (`BrandedSkeleton`) shaped only like the assessor shell. On cold loads of `/login`, `/signup`, `/access-denied`, and `/interview/:token`, users briefly see an assessor-style top-nav skeleton (branding + fake "Assessments/Vacancies" nav pills, wide `max-w-7xl` content) that then snaps to a completely different layout. The signature auth teal panel and the candidate minimal header never appear in the skeleton, so the transition is a jarring silhouette mismatch rather than a smooth reveal.

## What Changes

- Make the branded loading skeleton **route-aware**: the single `Suspense` fallback selects a silhouette variant from the current path via `useLocation()`. This is possible because `BrowserRouter` wraps `App` (`main.tsx:11`) and the fallback renders inside the router (the existing `SessionExpiredHandler` already reads location from the same subtree).
- Add three silhouette variants inside `BrandedSkeleton`:
  - **Auth** (`/login`, `/signup`, `/access-denied`): two-column split matching `AuthShell` — teal side panel + centered form placeholder.
  - **Interview** (`/interview/*`): minimal non-sticky header + narrow centered content matching `CandidateLayout`.
  - **Assessor** (all other routes): the current top-nav silhouette; behavior for authorized routes is unchanged and remains the default fallback.
- Keep a single top-level `Suspense` boundary and the existing lazy-loading strategy. Nested per-shell boundaries and de-lazying layouts (Option B) and reusing the real static chrome (Option A+) are explicitly out of scope.

## Capabilities

### New Capabilities
- `route-loading-skeleton`: A route-aware branded loading skeleton that renders a shell-appropriate silhouette (auth / interview / assessor) for lazy route-chunk loading, chosen from the current route, with the assessor silhouette as the default for unmatched paths.

### Modified Capabilities
- `assessor-shell`: The existing "Branded loading fallback" requirement is reframed so the authorized routes render the *assessor variant* of the shared route-aware skeleton. Observable behavior for authorized routes is unchanged; the requirement is updated so it no longer implies the branded skeleton is exclusive to authorized routes.

## Impact

- Code: `web/src/components/layout/BrandedSkeleton.tsx` becomes route-aware (adds internal variant sub-components); consumed unchanged at `web/src/App.tsx:42`.
- No routing table, API, dependency, or bundle-strategy changes. The skeleton stays eagerly imported.
- Risk: the skeleton duplicates the route→shell mapping already encoded in `App.tsx`. Mitigated by a small shared path-matching helper (or clearly commented predicates) — resolved in design.md.

## Context

The SPA has three visually distinct shells:

- `AssessorLayout` — sticky top-nav header (brand + Assessments/Vacancies pills + tenant/identity/live/logout), `max-w-7xl` content. Authorized routes.
- `AuthShell` — two-column split on `lg`: solid primary/teal side panel (VoiceBars + wordmark + tagline) and a centered `max-w-sm` form. Used by `/login`, `/signup`, `/access-denied`.
- `CandidateLayout` — minimal, non-sticky header (`max-w-2xl`, "AI Interview"), narrow `max-w-xl` content. Used by `/interview/:token`.

All routes are lazy and share a single `Suspense fallback={<BrandedSkeleton/>}` at `App.tsx:42`. `BrandedSkeleton` today renders one silhouette that mimics only `AssessorLayout`. On cold loads of auth/interview routes the fallback flashes the assessor silhouette, then snaps to a different layout.

Key enabler: `BrowserRouter` wraps `App` (`main.tsx:11`) and the `Suspense` renders inside the router, so the fallback can call `useLocation()`. `SessionExpiredHandler` already reads location from the same subtree. React Router commits the new `location` before rendering the matched (lazy) element that suspends, so the fallback observes the destination path.

## Goals / Non-Goals

**Goals:**
- Render a shell-appropriate silhouette (auth / interview / assessor) while a route chunk loads, chosen from the current path.
- Eliminate the wrong-silhouette flash on `/login`, `/signup`, `/access-denied`, `/interview/*`.
- Keep the single top-level `Suspense` boundary and the existing lazy-loading/bundle strategy.
- Keep the change small and self-contained (one component file + optional tiny path helper).

**Non-Goals:**
- Nested per-shell `Suspense` boundaries or de-lazying layouts (rejected Option B).
- Reusing the real static chrome (`AuthShell`/`CandidateLayout`) inside the skeleton (rejected Option A+); avoids pulling those modules into the eager bundle.
- Pixel-perfect skeletons, animated cross-fades, or changing brand copy.

## Decisions

**D1 — Select the variant inside the fallback via `useLocation()`.**
The fallback reads `pathname` and branches to one of three internal variants. Rationale: router context is guaranteed here (precedent: `SessionExpiredHandler`), and a `Suspense` fallback cannot receive per-route props. Alternatives: Option B (per-shell boundaries) is a heavier refactor; passing route info via context adds machinery for no gain.

**D2 — Keep one `Suspense` boundary in `App.tsx`.**
`App.tsx:42` is unchanged; only `BrandedSkeleton` gains internal branching. Proportional to the symptom.

**D3 — Centralize route→shell matching in a small predicate helper.**
Provide `isAuthPath(pathname)` and `isInterviewPath(pathname)` (e.g., colocated with the skeleton or a small `lib` module); everything else defaults to assessor. Rationale: the skeleton necessarily re-encodes the route families from `App.tsx`; a single helper (plus a comment cross-referencing the route table) keeps them from drifting and is trivially unit-testable. Auth set = `/login`, `/signup`, `/access-denied`; interview = prefix `/interview/`.

**D4 — Three internal presentational variants, self-contained.**
`AuthSkeleton`, `InterviewSkeleton`, `AssessorSkeleton` live inside `BrandedSkeleton.tsx` using existing `Skeleton` primitives and Tailwind classes that mirror each shell's silhouette (auth: `lg:grid lg:grid-cols-2` with a solid `bg-primary` panel block + centered form bars; interview: minimal header + `max-w-xl` content; assessor: current markup). No imports of the real layouts.

**D5 — Assessor silhouette is the default.**
Any unmatched path renders the assessor variant, preserving current behavior for `/` and all authorized routes.

## Risks / Trade-offs

- Route-family drift between `App.tsx` and the skeleton → centralize predicates in one helper, cross-reference the route table in a comment, and add a small unit test asserting each path family maps to the right variant.
- `useLocation()` in the fallback returning the wrong path → verified by React Router semantics (location commits before the suspending element renders) and the existing `SessionExpiredHandler` precedent; covered by variant tests using `MemoryRouter`.
- Teal color block appears briefly before the real auth page → acceptable and on-brand; it matches the destination and is strictly better than the assessor mismatch.
- Warm cache means the fallback may not render at all → variants only matter on cold/slow loads; no downside when skipped.

## Migration Plan

Pure frontend change; no data or API migration. Rollback = revert `BrandedSkeleton.tsx` (and the helper). Validate with `vp check` and `vp test`, plus a manual throttled cold-load of `/login`, `/signup`, `/access-denied`, `/interview/:token`, and an authorized route to confirm each silhouette matches its shell.

## Open Questions

- Should the variants share a single consistent wordmark treatment for brand continuity across shells? Deferred; not required for "acceptable."

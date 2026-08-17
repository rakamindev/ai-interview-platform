## Context

`web/` (React 19.2 + Vite 7 via the vite-plus toolchain) has no DOM-based unit tests: 2 test files, 7 tests, all running under vitest 4.1.10's default `node` environment (`renderToStaticMarkup` + pure logic). `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, and `@vitest/coverage-v8` are not installed. `vp test` reads its config from the `test:` block of `web/vite.config.ts` (per local vite-plus docs at `node_modules/vite-plus/docs/config/test.md`). Existing tests import `describe/it/expect` from `vite-plus/test` (the toolchain re-export) — this is the convention to preserve.

Surface to cover: 81 TS/TSX files (~7,728 lines) — 41 components (incl. 17 shadcn `ui/` wrappers), 15 pages, 7 hooks (audio/WebSocket-heavy), 7 axios services, 2 stores, 3 utils, 3 lib.

## Goals / Non-Goals

**Goals:**
- A repeatable, fast unit-test harness: `vp test` renders React components in jsdom with RTL + jest-dom matchers.
- Coverage gate of 95% (statements/lines/functions) and 90% (branches) across `web/src/**`, enforced so `vp test` fails below threshold.
- Mocking conventions that make the audio/WebSocket/browser-API surface testable without flakiness.
- Colocated `*.test.ts(x)` files following the existing `vite-plus/test` import convention.

**Non-Goals:**
- No E2E/browser tests (Playwright etc.) — unit tests only in this change.
- No changes to application behavior or the API backend.
- No snapshot-testing culture — behavior assertions via RTL queries.
- Not covering `web/public/` or `web/*.config.*` files.

## Decisions

### D1. Environment: jsdom over happy-dom
Chosen: **jsdom** (latest ^26 line). It is the reference environment for RTL and the most compatible with vitest 4.1.x. happy-dom is faster but has a history of subtle DOM-API gaps (e.g., layout/`Range`/SVG quirks) that bite Radix UI components — the app is Radix-heavy. Alternative considered: happy-dom (rejected for compat risk on the 17 Radix `ui/` wrappers).

### D2. Config location: `test:` block in `web/vite.config.ts`
Chosen: extend the existing `vite.config.ts` with a `test:` block (`environment: "jsdom"`, `globals: true`, `setupFiles`, `coverage`). The toolchain explicitly reads Vitest settings from there — no separate `vitest.config.ts` (which could confuse `vp test` path resolution).
`globals: true` is **required**: RTL's automatic cleanup hooks into a global `afterEach`; without it, state leaks between tests.

### D3. Coverage provider and thresholds
Chosen: `@vitest/coverage-v8@^4.1.x` (must match bundled vitest 4.1.10) with `provider: "v8"`.
Thresholds: `statements/lines/functions: 95`, `branches: 90`. Branch coverage at 95 is disproportionately expensive (error-path branches in forms, `catch (e: any)` paths, empty states) for marginal safety value; 90 still catches untested branches.
Include: `['src/**/*.{ts,tsx}']`; exclude: `['src/**/*.test.{ts,tsx}', 'src/test/**']` plus the two legacy test files. `src/types/index.ts` stays in scope (pure types, counts as covered).

### D4. Shared setup file: `web/src/test/setup.ts`
Registers jest-dom (`import "@testing-library/jest-dom/vitest"`) and provides **global browser-API stubs** as a single import surface for tests:
- `window.matchMedia` / `ResizeObserver` (Radix/dnd-kit require them; without stubs every component render crashes)
- A lightweight `AudioContext` stub (used by audio hooks; real one is unavailable in jsdom)
- `navigator.mediaDevices.getUserMedia` stub
- A `WebSocket` stub class
Stubs are **opt-out per test** via `vi.stubGlobal` overrides; shared defaults live in the setup file. Per-file `// @vitest-environment` docblocks remain available.

### D5. Service mocking convention
All page/component tests mock `@/services/*` axios modules with `vi.mock` and return canned Axios-shaped responses (`{ data: {...} }`). No HTTP layer runs in unit tests. `useNavigate`/`useParams` come from real `MemoryRouter` wrappers in a shared `renderWithProviders` helper (`web/src/test/utils.tsx`) that also wraps in `JotaiProvider` where atoms are needed.

### D6. Test file conventions
- Colocation: `src/<path>/<file>.test.ts(x)` next to the unit under test (existing convention: `BrandedSkeleton.test.tsx`).
- Imports: `describe/it/expect` from `vite-plus/test`; `render/screen/waitFor` from `@testing-library/react`; interactions via `@testing-library/user-event` (already present transitively).
- File-naming: `*.test.tsx` for components/pages, `*.test.ts` for pure logic.

## Risks / Trade-offs

- **[Flake risk in audio/WebSocket tests]** → Centralized stubs in `setup.ts`; async assertions via `waitFor` with generous-but-bounded timeouts; no real timers in tests (`vi.useFakeTimers` where polling is exercised).
- **[95% statements over shadcn `ui/` wrappers feels like busywork]** → Each wrapper gets a light render-smoke + one behavior assertion; the 855 lines they contribute is cheap because they render fast.
- **[`globals: true` may collide with lint rule `vite-plus/prefer-vite-plus-imports`]** → `vp check` may flag vitest globals imports; keep explicit `vite-plus/test` imports (D6) so no rule is tripped — verify during task 2 and adjust the lint rule if needed.
- **[Coverage gate will fail pre-existing PR workflows]** → By design: the gate is the point. Tasks land in waves so coverage rises monotonically and the gate only turns on at the end (final task), avoiding a broken `vp test` mid-change.
- **[jsdom + vitest 4.1.10 version mismatch]** → Pin `@vitest/coverage-v8` to `^4.1.10`; install `jsdom@^26` (known-compatible with vitest 3/4 per upstream issue #1397 discussion).

## Migration Plan

1. Land harness first (deps, config, setup file, helper) with a single trivial test proving jsdom+RTL works — `vp test` stays green throughout.
2. Write tests in waves: utils/lib/stores → components/ui → business components → hooks → pages.
3. Turn on `coverage.thresholds` only in the final task, after coverage already exceeds the gate, so the gate never blocks a green run.
4. Rollback: revert package.json + vite.config.ts `test:` block and delete test files; app code is untouched, so rollback is trivial.

## Open Questions

- None blocking. Minor: whether `@testing-library/jest-dom` matcher style (implicit `expect` extension) is acceptable vs explicit chai-style — default is to adopt jest-dom since RTL docs standardize on it.
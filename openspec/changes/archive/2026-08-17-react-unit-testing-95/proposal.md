## Why

The web app has no meaningful unit test coverage today: only 2 test files (7 tests) exist, both DOM-free (`renderToStaticMarkup` + pure logic), and the RTL stack (`@testing-library/react`, jsdom, jest-dom, coverage provider) is not installed at all. For a product "about to ship to a client," the pages, components, and hooks that implement assessment config, live monitoring, interviews, and portfolio review are untested — regressions have no safety net. This change stands up the full React testing harness and drives coverage to a 95% gate.

## What Changes

- Add the test toolchain: `@testing-library/react@^16.3`, `@testing-library/jest-dom`, `jsdom`, and `@vitest/coverage-v8@^4.1.x` (pinned to the toolchain's vitest 4.1.10).
- Configure `vp test` via the `test:` block in `web/vite.config.ts`: `environment: "jsdom"`, `globals: true`, a shared setup file (jest-dom matchers + shared mocks), and a `coverage` block with thresholds.
- Add a test setup file (`web/src/test/setup.ts` or similar) with jest-dom registration and any global browser-API stubs needed (matchMedia, ResizeObserver, AudioContext, etc.).
- Write unit tests across `web/src/` — utils/lib/stores, components (incl. shadcn `ui/` primitives), hooks, and all pages — mocking axios service modules, `useNavigate`, and browser APIs (WebSocket, getUserMedia, AudioContext, clipboard) as required.
- Enforce the coverage gate: `vp test` fails when statement/line/function coverage drops below 95% (branches at 90%, see design.md).
- Migrate the existing `BrandedSkeleton.test.tsx` SSR-style test to RTL where it adds value; keep the pure-logic `routeShell.test.ts` as-is.
- **BREAKING** (for CI/quality bar only, not app behavior): `vp test` will fail under the coverage threshold, so future PRs must carry tests.

## Capabilities

### New Capabilities
- `react-unit-testing`: The test harness and coverage contract — RTL/Vitest/jsdom setup, shared test utilities, browser-API mocking conventions, and the 95% coverage gate that `vp test` enforces for all of `web/src/`.

### Modified Capabilities
<!-- No existing capability's runtime behavior changes; testing is additive. -->

## Impact

- **Code**: `web/vite.config.ts` (new `test:` block), new `web/src/test/setup.ts` + shared test helpers, 30–45 new `*.test.ts(x)` files across `web/src/`, the two existing test files (one possibly migrated to RTL).
- **Dependencies**: `web/package.json` devDependencies gain `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, `@vitest/coverage-v8`. (`@testing-library/dom` and `@testing-library/user-event` are already present transitively.)
- **Tooling**: `vp test` (vitest 4.1.10 via vite-plus) gains a jsdom environment and coverage thresholds. `vp check` and the existing quality gate are unchanged.
- **Risk**: Mock-heavy tests for the audio/WebSocket hooks and the 4 largest pages (InterviewPage, LiveMonitorPage, PortfolioPage, HardwareCheck) are the highest-effort, highest-flake-risk surface.
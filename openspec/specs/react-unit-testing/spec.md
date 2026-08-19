# react-unit-testing Specification

## Purpose
TBD - created by archiving change react-unit-testing-95. Update Purpose after archive.
## Requirements
### Requirement: jsdom + RTL test harness
The `vp test` command MUST run unit tests in a jsdom environment with `@testing-library/react` rendering and `@testing-library/jest-dom` matchers available, configured via the `test:` block in `web/vite.config.ts`.

#### Scenario: rendering a component under test
- **WHEN** a test calls `render(<Component />)` with RTL and asserts via `screen` queries
- **THEN** the component mounts in a jsdom DOM and jest-dom matchers like `toBeInTheDocument` are available

#### Scenario: automatic cleanup between tests
- **WHEN** multiple tests render components in the same file
- **THEN** RTL cleanup unmounts each render after every test (globals enabled), so state does not leak

### Requirement: shared test setup with browser API stubs
The test harness MUST provide a shared setup file that registers jest-dom and stubs browser APIs required by the app (matchMedia, ResizeObserver, AudioContext, navigator.mediaDevices, WebSocket) with sane defaults, overridable per test.

#### Scenario: component relying on matchMedia/ResizeObserver renders
- **WHEN** a test renders a Radix UI or dnd-kit component that calls `window.matchMedia` or `ResizeObserver`
- **THEN** the shared setup provides working stubs so the render does not throw

#### Scenario: audio/WebSocket hooks are testable
- **WHEN** a test exercises a hook that uses `AudioContext`, `getUserMedia`, or `WebSocket`
- **THEN** the shared stubs are in place and the test can override them with `vi.stubGlobal` for its specific scenario

### Requirement: coverage gate
`vp test` MUST enforce coverage thresholds — 95% statements, 95% lines, 95% functions, 90% branches — over `web/src/**` (excluding test files and test helpers), failing the run when any threshold is not met.

#### Scenario: coverage below threshold fails the run
- **WHEN** the suite's coverage for any metric falls below its threshold
- **THEN** `vp test` exits non-zero and prints the per-metric coverage report

#### Scenario: coverage at or above threshold passes
- **WHEN** all metrics meet or exceed their thresholds
- **THEN** `vp test` exits zero and prints the coverage summary

### Requirement: colocated test files with toolchain imports
Unit tests MUST be colocated as `*.test.ts(x)` next to the unit under test and MUST import `describe`/`it`/`expect` from `vite-plus/test`, following the existing project convention.

#### Scenario: new test follows convention
- **WHEN** a new unit test is added for `src/pages/foo/Bar.tsx`
- **THEN** it lives at `src/pages/foo/Bar.test.tsx` and imports test primitives from `vite-plus/test`

### Requirement: service mocking convention
Page and component tests MUST mock `@/services/*` axios modules via `vi.mock` with canned response shapes; no HTTP requests may be issued during unit tests.

#### Scenario: page test renders with canned data
- **WHEN** a page test renders a page that fetches from a service module
- **THEN** the service module is mocked with a canned `{ data: ... }` response and the page renders its content without network I/O


## 1. Test Harness Setup

- [x] 1.1 Add devDependencies to `web/package.json`: `@testing-library/react@^16.3`, `@testing-library/jest-dom`, `jsdom@^26`, `@vitest/coverage-v8@^4.1.10`; run `vp install`
- [x] 1.2 Add `test:` block to `web/vite.config.ts`: `environment: "jsdom"`, `globals: true`, `setupFiles: ["src/test/setup.ts"]`, `include: ["src/**/*.test.{ts,tsx}"]` (no coverage thresholds yet — enabled in task 7.1)
- [x] 1.3 Create `web/src/test/setup.ts`: register `@testing-library/jest-dom/vitest`; stub `window.matchMedia`, `ResizeObserver`, minimal `AudioContext`, `navigator.mediaDevices.getUserMedia`, and a `WebSocket` stub class (all overridable via `vi.stubGlobal`)
- [x] 1.4 Create `web/src/test/utils.tsx`: `renderWithProviders(ui, { route, initialEntries, atoms })` helper wrapping in `MemoryRouter` + `JotaiProvider`
- [x] 1.5 Write a smoke test proving the harness: render a trivial component with RTL (e.g., `StatusIndicator` or a `ui/badge`) and assert with jest-dom; verify `vp test` passes in the jsdom environment

## 2. Pure Logic Tests (utils / lib / stores / services)

- [x] 2.1 Test `src/lib/routeShell.ts` — already covered by `routeShell.test.ts`; migrate `BrandedSkeleton.test.tsx` from `renderToStaticMarkup` to RTL (`render` + `screen`) and keep all 4 scenarios passing
- [x] 2.2 Test `src/utils/constants.ts` and the remaining `src/lib/*` files (pure constants/functions)
- [x] 2.3 Test `src/utils/internetSpeedTest.ts` (download/upload/latency math and threshold logic with mocked `fetch`/XHR)
- [x] 2.4 Test `src/utils/hardwareUtils.ts` (browser detection, speed-test wrapper logic with mocked APIs)
- [x] 2.5 Test `src/stores/authAtom.ts` and `src/stores/tenantAtom.ts` (atom initial state + actions; localStorage mocking for token persistence)
- [x] 2.6 Test `src/services/*` (assessments, sessions, vacancies, auth, portfolios, skillTaxonomies, api) — verify request paths/methods/param shapes by mocking the axios instance

## 3. Component Tests (ui primitives + presentational)

- [x] 3.1 Render-smoke + one behavior assertion each for all 17 `src/components/ui/*` wrappers (badge, button, card, input, label, dialog, select, tabs, accordion, alert-dialog, dropdown-menu, radio-group, separator, skeleton, progress, tooltip)
- [x] 3.2 Test `src/components/StatusIndicator.tsx`, `src/components/ProtectedRoute.tsx` (redirect behavior with auth atom states), `src/components/BrandedSkeleton.tsx` via RTL
- [x] 3.3 Test `src/components/interview/*` (InterviewTimer countdown, TranscriptBubble rendering, VoiceBars active/inactive states)
- [x] 3.4 Test `src/components/portfolio/*` (LevelBadge level→style mapping, SkillPortfolioCard, OverridePanel form submission)
- [x] 3.5 Test `src/components/fitgap/ComparisonTable.tsx` (table rows, empty state)
- [x] 3.6 Test `src/components/assessment/*` (LevelRadio selection, SkillPicker open/close + skill add, CustomSkillForm field binding, SkillCard drag handle render, SystemPromptPreview rendering)
- [x] 3.7 Test `src/components/layout/AssessorLayout.tsx` and `CandidateLayout.tsx` (nav rendering, logout flow with mocked authApi + navigate)

## 4. Hook Tests

- [x] 4.1 Test `src/hooks/usePolling.ts`, `src/hooks/useCapsLock.ts`, `src/hooks/useForm.ts` (pure React hook logic with fake timers where polling is involved)
- [x] 4.2 Test `src/hooks/useAudioCapture.ts` and `src/hooks/useAudioPlayback.ts` (start/stop lifecycle with stubbed AudioContext + getUserMedia; assert state transitions)
- [x] 4.3 Test `src/hooks/useCoverageWebSocket.ts` and `src/hooks/useAudioWebSocket.ts` (connect/reconnect/message-handling with the WebSocket stub; fake timers for reconnect backoff)

## 5. Page Tests

- [x] 5.1 Test `src/pages/auth/*` (LoginPage submit + error display, SignupPage validation + submit, AccessDeniedPage render) with mocked auth services
- [x] 5.2 Test `src/pages/assessments/AssessmentListPage.tsx` and `AssessmentInvitePage.tsx` (list render, create session, copy-link + revoke flows with mocked sessions/assessments services)
- [x] 5.3 Test `src/pages/assessments/AssessmentNewPage.tsx` and `AssessmentEditPage.tsx` (form render, skill add/remove via UI, submit → navigate; empty-skills error path)
- [x] 5.4 Test `src/pages/vacancies/*` (VacancyListPage, VacancyNewPage, VacancyEditPage — render, submit, edit-load flows)
- [x] 5.5 Test `src/pages/portfolio/PortfolioPage.tsx` (override save, run fit-gap navigation guard, export flow with mocked services)
- [x] 5.6 Test `src/pages/fitgap/FitGapReportPage.tsx` (report load, regenerate, polling while generating)
- [x] 5.7 Test `src/pages/transcript/TranscriptPage.tsx` (transcript list render + empty state)
- [x] 5.8 Test `src/pages/monitor/LiveMonitorPage.tsx` (initial load, live transcript polling, end-session → navigate, error paths)
- [x] 5.9 Test `src/pages/interview/InterviewPage.tsx` (render with stubbed audio/WebSocket hooks, state transitions: connecting → active → draining_audio → ended; safety-timeout path)

## 6. Coverage Tuning

- [x] 6.1 Run `vp test --coverage` and inspect per-file gaps; add targeted tests for any file still below the 95/90 targets (branch gaps in `catch` paths and empty states)
- [x] 6.2 If a specific surface is untestable in jsdom (e.g., AudioWorklet internals), add a documented per-file `/* v8 ignore next */` with rationale comment (limit: keep overall thresholds intact)

## 7. Gate + Verification

- [x] 7.1 Enable `coverage.thresholds` in `web/vite.config.ts`: `statements: 95`, `lines: 95`, `functions: 95`, `branches: 90`, with `include: ["src/**/*.{ts,tsx}"]` and excludes for test files/helpers
- [x] 7.2 Final verification: `vp test` (all tests pass, coverage meets gate) and `vp check` (0 errors, 0 warnings) both green
- [x] 7.3 Update `web/AGENTS.md` review checklist if needed to note the coverage gate in the `vp test` step
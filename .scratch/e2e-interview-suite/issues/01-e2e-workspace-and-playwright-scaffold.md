# 01-e2e-workspace-and-playwright-scaffold

Status: resolved
Blocked by: none

## Context
There is currently no top-level E2E test workspace or Playwright test runner. The project has isolated backend RSpec suites (`api/spec`) and frontend Vitest suites (`web/src/test`), but lacks multi-service browser automation.

## Implementation Details
1. Create `e2e/package.json` with `@playwright/test`, `typescript`, `@types/node`, and test scripts (`"test": "playwright test"`, `"test:ui": "playwright test --ui"`).
2. Configure `e2e/tsconfig.json` for Node 18+ and Playwright.
3. Configure `e2e/playwright.config.ts`:
   - Browser: Chromium.
   - Launch args: `--use-fake-device-for-media-stream`, `--use-fake-ui-for-media-stream`, `--autoplay-policy=no-user-gesture-required`.
   - Permissions: `['microphone']`.
   - Base URL: `http://localhost:5174`.
   - WebServer array orchestrating Vite (`web/`), Rails test API (`api/`), and Mock Gemini server.
4. Add a smoke test `e2e/tests/smoke.spec.ts` to verify Chromium launches and media permissions are granted without prompts.

## Verification
- `cd e2e && npm install && npx playwright test tests/smoke.spec.ts`

## Comments
- Created `e2e/package.json` with `@playwright/test`, `typescript`, `@types/node`, `@types/ws`, `tsx`, and `ws`.
- Created `e2e/tsconfig.json` targeting Node 18+ and Playwright.
- Created `e2e/playwright.config.ts` configuring Chromium with `--use-fake-device-for-media-stream`, `--use-fake-ui-for-media-stream`, `--autoplay-policy=no-user-gesture-required`, permissions: `['microphone']`, base URL `http://localhost:5174`, and multi-process webServer orchestration for Mock Gemini, Rails API (`api/`), and Vite (`web/`).
- Created `e2e/mock-gemini/server.ts` scaffolding the mock server on port 8080 with HTTP health check and WebSocket connection handling.
- Created `e2e/fixtures.ts` providing strongly typed synthetic media device routing for automated headless execution across environments.
- Created `e2e/tests/smoke.spec.ts` verifying Chromium launch, web server responsiveness, and automated microphone acquisition in live readyState without prompts.
- Added E2E output paths to `.gitignore`.
- Ran and verified: `npm test` passed (439ms execution). All Vitest (17 tests) and RSpec (23 tests) suites remain green.

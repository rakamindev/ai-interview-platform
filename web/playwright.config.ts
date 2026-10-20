import { defineConfig } from "@playwright/test";

// Browser tests against the real web app and the real API (web/e2e). They read the synthetic data from
// `rails e2e:seed` and never trigger a model call. See README, "Running the E2E tests".
const ci = !!process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  outputDir: "./e2e/.results",
  // One worker: the tests share one seeded database, and the dev API is a single Puma process.
  workers: 1,
  retries: ci ? 1 : 0,
  // Vite in Docker on a Windows bind mount needs ~25s for the first page; CI is much faster.
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: ci ? [["list"], ["html", { open: "never", outputFolder: "e2e/.report" }]] : "list",
  use: {
    baseURL: process.env.E2E_WEB_URL ?? "http://localhost:5173",
    // Locally the installed Chrome, so nothing is downloaded; in CI, Playwright's own Chromium.
    channel: ci ? undefined : "chrome",
    deviceScaleFactor: 2,
    storageState: "./e2e/.auth/state.json",
    navigationTimeout: 90_000,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1280, height: 800 } } },
    { name: "mobile", use: { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true } },
  ],
});

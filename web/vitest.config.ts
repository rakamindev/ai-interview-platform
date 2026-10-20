import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

export default mergeConfig(
  viteConfig,
  defineConfig({
    // Read env files from src/test (which has none) so a developer's web/.env,
    // with its dev JWT and API URL, never leaks into a test run.
    envDir: "./src/test",
    test: {
      environment: "jsdom",
      // Serve the page from the API's origin so requests skip the CORS preflight;
      // CORS is the API's concern (rack-cors), not what these tests cover.
      environmentOptions: { jsdom: { url: "http://api.test/" } },
      setupFiles: ["./src/test/setup.ts"],
      include: ["src/**/*.test.{ts,tsx}"],
      env: {
        // A shell with NODE_ENV=production would load React's production build,
        // which has no act(), and every render would fail.
        NODE_ENV: "test",
        VITE_API_BASE_URL: "http://api.test/api/v1",
        VITE_WS_BASE_URL: "ws://api.test",
      },
      restoreMocks: true,
      // npm run test:coverage (CI). A floor a point under the measured line coverage, so it can't quietly drop;
      // not a target. E2E specs live in e2e/ and aren't part of this run.
      coverage: {
        provider: "v8",
        include: ["src/**/*.{ts,tsx}"],
        exclude: ["src/**/*.test.{ts,tsx}", "src/test/**", "src/**/*.d.ts", "src/main.tsx"],
        reporter: ["text-summary", "html", "json-summary"],
        thresholds: { lines: Number(process.env.COVERAGE_FLOOR ?? 0) },
      },
      // The first render in each file transforms the whole app; inside Docker on a
      // Windows bind mount that alone takes ~5s, Vitest's default test timeout.
      testTimeout: 15_000,
    },
  })
);

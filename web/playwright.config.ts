import { defineConfig } from "@playwright/test";

/**
 * Screenshot capture for the report, not part of `npm test`.
 * Needs the API (3001) and web (5173) dev servers and the demo seed:
 *   cd api && bundle exec rails demo:seed_report
 *   cd web && npm run screenshots
 */
export default defineConfig({
    testDir: "./e2e",
    timeout: 60_000,
    fullyParallel: false,
    reporter: "list",
    use: {
        baseURL: process.env.WEB_URL ?? "http://localhost:5173",
        channel: "chrome", // the installed Google Chrome; no browser download needed
        colorScheme: "light",
    },
});

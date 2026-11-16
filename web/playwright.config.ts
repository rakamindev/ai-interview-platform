// playwright.config.ts
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "e2e",
  webServer: { command: "npm run dev", url: "http://localhost:5173", reuseExistingServer: true },
  use: {
    baseURL: "http://localhost:5173",
    permissions: ["microphone"],
    launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] },
  },
});
import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', timeout: 60000, expect: { timeout: 15000 }, workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: process.env.REVIEW_BASE_URL || 'http://localhost:5174', headless: true,
    channel: process.env.CI ? undefined : 'chrome', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
});

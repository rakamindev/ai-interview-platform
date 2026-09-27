import { defineConfig, devices } from '@playwright/test';

// When GEMINI_API_KEY is present, the audio WS seam targets the real Google
// Gemini Live endpoint and the local mock is skipped (see `npm run test:live`).
// Without it, tests run against the deterministic mock server.
const LIVE_GEMINI = !!process.env.GEMINI_API_KEY;

const GOOGLE_GEMINI_WS_URL =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';

const railsAudioEnv: Record<string, string> = {
  OBJC_DISABLE_INITIALIZE_FORK_SAFETY: 'YES',
  ...(LIVE_GEMINI
    ? {
        GEMINI_API_KEY: process.env.GEMINI_API_KEY!,
        GEMINI_WS_URL: process.env.GEMINI_WS_URL || GOOGLE_GEMINI_WS_URL,
        ...(process.env.GEMINI_LIVE_MODEL ? { GEMINI_LIVE_MODEL: process.env.GEMINI_LIVE_MODEL } : {}),
      }
    : { GEMINI_WS_URL: 'ws://localhost:8080' }),
};

export default defineConfig({
  testDir: './tests',
  globalSetup: './global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'on-first-retry',
    permissions: ['microphone'],
    launchOptions: {
      args: [
        '--use-fake-device-for-media-stream',
        '--use-fake-ui-for-media-stream',
        '--autoplay-policy=no-user-gesture-required',
      ],
    },
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        permissions: ['microphone'],
        launchOptions: {
          args: [
            '--use-fake-device-for-media-stream',
            '--use-fake-ui-for-media-stream',
            '--autoplay-policy=no-user-gesture-required',
          ],
        },
      },
    },
  ],

  webServer: [
    // Mock Gemini — only for the deterministic mock-mode suite; skipped in live mode.
    ...(LIVE_GEMINI
      ? []
      : [
          {
            command: 'npm run mock-gemini',
            url: 'http://localhost:8080/health',
            reuseExistingServer: !process.env.CI,
            timeout: 120 * 1000,
          },
        ]),
    {
      command: 'RAILS_ENV=test bundle exec rails server -p 3001',
      cwd: '../api',
      url: 'http://localhost:3001/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
      env: railsAudioEnv,
    },
    {
      command: 'npm run dev -- --port 5174',
      cwd: '../web',
      url: 'http://localhost:5174',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
      env: {
        VITE_API_BASE_URL: 'http://localhost:3001/api/v1',
        VITE_WS_BASE_URL: 'ws://localhost:3001',
      },
    },
  ],
});

import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const audioFixturePath = path.resolve(process.cwd(), 'e2e/fixtures/candidate_speech.wav');

export default defineConfig({
  testDir: './e2e',
  testIgnore: 'interview_error.spec.ts',
  timeout: 60000,
  fullyParallel: false,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: 'http://localhost:5173',
    permissions: ['microphone', 'camera'],
    trace: 'on-first-retry',
    screenshot: 'on',
    video: 'on-first-retry',
    launchOptions: {
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        `--use-file-for-fake-audio-capture=${audioFixturePath}`,
        '--autoplay-policy=no-user-gesture-required',
      ],
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'cd ../api && RAILS_ENV=development bundle exec rails s -p 3001',
      url: 'http://localhost:3001/health',
      reuseExistingServer: true,
      timeout: 30000,
    },
    {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 30000,
    },
  ],
});

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function globalSetup() {
  console.log('[E2E Global Setup] Seeding test database via rails db:seed:e2e...');
  const apiDir = path.resolve(__dirname, '../api');
  execSync('RAILS_ENV=test bundle exec rails db:seed:e2e', {
    cwd: apiDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      RAILS_ENV: 'test',
    },
  });

  try {
    execSync('RAILS_ENV=development bundle exec rails db:seed:e2e', {
      cwd: apiDir,
      stdio: 'inherit',
      env: {
        ...process.env,
        RAILS_ENV: 'development',
      },
    });
  } catch (e) {
    console.warn('[E2E Global Setup] Warning: could not seed development db:', e);
  }

  try {
    await fetch('http://localhost:8080/api/reset', { method: 'POST' });
    console.log('[E2E Global Setup] Mock Gemini reset successfully.');
  } catch (e) {
    // mock gemini may not be started yet if managed by playwright webServer
  }

  console.log('[E2E Global Setup] Databases seeded successfully.');
}

export default globalSetup;

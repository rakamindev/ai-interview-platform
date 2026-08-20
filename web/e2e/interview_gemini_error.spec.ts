import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let inviteToken: string;

test.beforeAll(() => {
  // Generate a fresh session invite token via Rails runner
  const apiDir = path.resolve(__dirname, '../../api');
  const cmd = `RAILS_ENV=development bundle exec rails runner "assessment = Assessment.unscoped.first || Assessment.create!(tenant_id: 1, name: 'Senior Frontend Engineer', time_limit_min: 45); session = Session.create!(tenant_id: assessment.tenant_id, assessment_id: assessment.id, status: 'pending', invite_token: SecureRandom.hex(32)); puts 'E2E_TOKEN:' + session.invite_token"`;
  const output = execSync(cmd, { cwd: apiDir, encoding: 'utf-8' });
  const match = output.match(/E2E_TOKEN:([a-f0-9]+)/);
  if (!match) {
    throw new Error(`Failed to create E2E test session. Output: ${output}`);
  }
  inviteToken = match[1];
  console.log(`[PLAYWRIGHT E2E] Fresh test session token: ${inviteToken}`);
});

test.describe('AI Interview Platform - Error Flow', () => {
  test('Error Path: Catches Gemini model / server errors non-silently and displays user error alert', async ({ page }) => {
    // Navigate to interview page
    await page.goto(`/interview/${inviteToken}`);
    
    // Check consent box
    const consentCheckbox = page.locator('input[type="checkbox"]');
    await expect(consentCheckbox).toBeVisible({ timeout: 10000 });
    await consentCheckbox.check({ force: true });

    // Start hardware check / interview
    const startCheckBtn = page.locator('#hardware-check-start-btn');
    await expect(startCheckBtn).toBeEnabled({ timeout: 60000 });
    await startCheckBtn.click();

    // Verify system displays non-technical friendly error alert after backend retries fail (takes longer)
    await expect(page.locator('text=Server Error')).toBeVisible({ timeout: 45000 });
    await expect(page.locator('text=The server is currently experiencing trouble, please try again later.')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots/9_interview_error.png', fullPage: true });
  });
});

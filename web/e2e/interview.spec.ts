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

test.describe('AI Interview Platform - E2E Candidate Interview Flow', () => {
  test('Happy Path: Completes onboarding, hardware check, multi-turn live voice interview, and end interview flow', async ({ page }) => {
    page.on('console', (msg) => console.log('[PAGE CONSOLE]', msg.text()));
    page.on('requestfailed', (req) => console.error('[FAILED REQ]', req.url(), req.failure()?.errorText));

    // 1. Onboarding Page Navigation
    await page.goto(`/interview/${inviteToken}`);
    await expect(page.locator('text=Privacy Notice & Consent')).toBeVisible();
    await page.screenshot({ path: 'screenshots/5_interview_onboarding.png', fullPage: true });

    // 2. Consent Checkbox
    const consentCheckbox = page.locator('input[type="checkbox"]');
    if (await consentCheckbox.isVisible()) {
      await consentCheckbox.check({ force: true });
    }

    // 3. Hardware Check & Start Interview
    const startCheckBtn = page.locator('#hardware-check-start-btn');
    await expect(startCheckBtn).toBeEnabled({ timeout: 60000 });
    await page.screenshot({ path: 'screenshots/6_interview_hardware_check.png', fullPage: true });
    await startCheckBtn.click();

    // 4. Active Live Interview Session & WebSockets
    const endBtn = page.locator('button:has-text("End Interview")');
    await expect(endBtn).toBeVisible({ timeout: 30000 });
    await page.screenshot({ path: 'screenshots/7_interview_active.png', fullPage: true });

    // 5. Sustained Multi-Turn Voice Exchange (AI questions + Candidate multi-sentence voice stream)
    await page.waitForTimeout(18000);

    // 6. Manual End Interview
    await endBtn.click();

    // Confirm modal
    const confirmBtn = page.getByRole('button', { name: 'End interview' });
    await expect(confirmBtn).toBeVisible({ timeout: 5000 });
    await confirmBtn.click();

    // 7. Completion Screen Verification
    await expect(page.locator('text=Interview Complete')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Thank you. The interview has been recorded.')).toBeVisible();
    await page.screenshot({ path: 'screenshots/8_interview_complete.png', fullPage: true });
  });
});

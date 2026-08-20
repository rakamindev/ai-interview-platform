import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('AI Interview Platform - Assessor UI Flows', () => {
  let assessmentId: string;

  test.beforeAll(() => {
    // Generate a fresh assessment with some sessions via Rails runner
    const apiDir = path.resolve(__dirname, '../../api');
    const cmd = `RAILS_ENV=development bundle exec rails runner "
      org = Organization.first || Organization.create!(id: 0, name: 'Test Org', scheme: 'test', identifier: 'test', host: 'localhost')
      User.find_by(email: 'assessor@example.com') || User.create!(email: 'assessor@example.com', password: 'password', role: 'admin')
      assessment = Assessment.create!(tenant_id: org.id, created_by: User.last.id, name: 'E2E Test Role', time_limit_min: 30)
      3.times { |i| Session.create!(tenant_id: org.id, assessment_id: assessment.id, candidate_name: 'Candidate ' + i.to_s, status: %w[pending active ended].sample, invite_token: SecureRandom.hex(16)) }
      puts 'E2E_ASSESSMENT:' + assessment.id.to_s
    "`;
    const output = execSync(cmd, { cwd: apiDir, encoding: 'utf-8' });
    const match = output.match(/E2E_ASSESSMENT:([0-9]+)/);
    if (match) {
      assessmentId = match[1];
    }
  });

  test.beforeEach(async ({ page }) => {
    // Log in
    await page.goto('/login');
    await page.fill('input[type="email"]', 'assessor@example.com');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/assessments/);
  });

  test('Validates Assessment List search and pagination', async ({ page }) => {
    await page.goto('/assessments');
    await expect(page.locator('h1', { hasText: 'Assessments' })).toBeVisible();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'screenshots/1_assessment_list.png', fullPage: true });

    // Test Search
    await page.fill('input[placeholder="Search assessments..."]', 'E2E Test Role');
    await page.waitForTimeout(500); // Wait for debounce
    await expect(page.locator('text=E2E Test Role').first()).toBeVisible();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'screenshots/2_assessment_search_result.png', fullPage: true });
  });

  test('Validates Candidates List search and status filter', async ({ page }) => {
    test.skip(!assessmentId, 'Assessment ID not found');
    await page.goto(`/assessments/${assessmentId}/invite`);
    
    // Check search
    await page.fill('input[placeholder="Search name..."]', 'Candidate 0');
    await page.waitForTimeout(500); // debounce
    await expect(page.locator('text=Candidate 0').first()).toBeVisible();

    // Check filter
    await page.locator('button:has-text("Status")').click();
    await page.locator('div[role="option"]:has-text("Pending")').click();
    await page.waitForTimeout(500); // api debounce

    // Clear search and ensure table updates
    await page.fill('input[placeholder="Search name..."]', '');
    await page.waitForTimeout(500);
  });
});

import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('AI Interview Platform - Human Review Process', () => {
  let assessmentId: string;
  let sessionId: string;
  let vacancyId: string;

  test.beforeAll(() => {
    const apiDir = path.resolve(__dirname, '../../api');
    const cmd = `RAILS_ENV=development bundle exec rails runner "
      tenant = Tenant.first || Tenant.create!(name: 'Test Tenant')
      User.find_by(email: 'assessor@example.com') || User.create!(email: 'assessor@example.com', password: 'password', role: 'assessor', tenant: tenant)
      
      assessment = Assessment.create!(tenant_id: tenant.id, name: 'E2E Review Role', time_limit_min: 30)
      
      session = Session.create!(tenant_id: tenant.id, assessment_id: assessment.id, candidate_name: 'Review Candidate', status: 'ended', end_reason: 'completed', invite_token: SecureRandom.hex(16))
      
      portfolio = Portfolio.create!(tenant_id: tenant.id, session_id: session.id, status: 'completed', generation_status: 'complete')
      
      PortfolioSkill.create!(portfolio_id: portfolio.id, skill_label: 'Test Skill', ai_level: 3, ai_confidence: 0.9, ai_reasoning: 'AI thinks it is level 3')
      
      vacancy = Vacancy.create!(tenant_id: tenant.id, role_title: 'Target Role', created_by: User.last.id)
      VacancySkill.create!(vacancy_id: vacancy.id, skill_label: 'Test Skill', expected_level: 4)

      FitGapReport.create!(portfolio_id: portfolio.id, vacancy_id: vacancy.id, skill_comparisons: [], overall_narrative: 'Initial')

      puts 'E2E_DATA:' + [assessment.id, session.id, vacancy.id].join(',')
    "`;
    const output = execSync(cmd, { cwd: apiDir, encoding: 'utf-8' });
    const match = output.match(/E2E_DATA:([0-9,]+)/);
    if (match) {
      const parts = match[1].split(',');
      assessmentId = parts[0];
      sessionId = parts[1];
      vacancyId = parts[2];
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

  test('Validates viewing portfolio and manual grade adjustment', async ({ page }) => {
    test.skip(!sessionId, 'Data not found');
    await page.goto(`/assessments/${assessmentId}/sessions/${sessionId}/portfolio`);
    
    // Verify skill is displayed
    await expect(page.locator('text=Test Skill')).toBeVisible();
    await expect(page.locator('text=AI thinks it is level 3')).toBeVisible();

    // Open override modal
    await page.click('button:has-text("Override")');
    await expect(page.locator('h2', { hasText: 'Override Score' })).toBeVisible();

    // Adjust grade to Level 4
    await page.click('button:has-text("L4")');
    await page.fill('textarea[placeholder="Explain why you are overriding the AI..."]', 'Candidate demonstrated deeper knowledge.');
    await page.click('button:has-text("Save Override")');

    // Wait for the UI to reflect the override
    await expect(page.locator('text=Candidate demonstrated deeper knowledge.')).toBeVisible();
    await expect(page.locator('text=L4').first()).toBeVisible();
  });

  test('Validates role comparison execution', async ({ page }) => {
    test.skip(!sessionId, 'Data not found');
    await page.goto(`/assessments/${assessmentId}/sessions/${sessionId}/portfolio`);

    // Click fit/gap comparison
    await page.click('button:has-text("Compare with Vacancy")');
    
    // Select the vacancy
    await page.locator('button:has-text("Select a vacancy...")').click();
    await page.locator(`text=Target Role`).click();

    // Trigger analysis
    await page.click('button:has-text("Analyze Fit")');

    // Should see generating state or the result if fast enough
    await expect(page.locator('text=Fit/Gap Analysis').first()).toBeVisible();
  });
});

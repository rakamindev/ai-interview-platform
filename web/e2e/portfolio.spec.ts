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
      org = Organization.first || Organization.create!(id: 0, name: 'Test Org', scheme: 'test', identifier: 'test', host: 'localhost')
      User.find_by(email: 'assessor@example.com') || User.create!(email: 'assessor@example.com', password: 'password', role: 'admin')
      
      assessment = Assessment.create!(tenant_id: org.id, created_by: User.last.id, name: 'E2E Review Role', time_limit_min: 30)
      
      session = Session.create!(tenant_id: org.id, assessment_id: assessment.id, candidate_name: 'Review Candidate', status: 'ended', end_reason: 'all_covered', invite_token: SecureRandom.hex(16))
      
      portfolio = Portfolio.create!(session_id: session.id, generation_status: 'complete')
      
      PortfolioSkill.create!(portfolio_id: portfolio.id, skill_label: 'Test Skill', ai_level: 3, ai_confidence: 'high', competency_summary: 'AI thinks it is level 3')
      
      vacancy = Vacancy.create!(tenant_id: org.id, role_title: 'Target Role', created_by: User.last.id)
      VacancySkill.create!(vacancy_id: vacancy.id, skill_label: 'Test Skill', expected_level: 4)

      FitGapReport.create!(portfolio_id: portfolio.id, vacancy_id: vacancy.id, skill_comparisons: [{'skill' => 'Test Skill', 'gap' => false}], overall_narrative: 'Initial')

      TranscriptTurn.create!(session_id: session.id, turn_number: 1, speaker: 'ai', text: 'Hello, how are you?')
      TranscriptTurn.create!(session_id: session.id, turn_number: 2, speaker: 'candidate', text: 'I am doing well, thank you! I am ready for the interview.')

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
    expect(sessionId, 'Data must exist').toBeDefined();
    await page.goto(`/assessments/${assessmentId}/sessions/${sessionId}/portfolio`);
    
    // Verify skill is displayed
    await expect(page.locator('text=Test Skill')).toBeVisible();
    await expect(page.locator('text=AI thinks it is level 3')).toBeVisible();

    // Open override panel
    await page.click('button:has-text("Override rating")');
    await expect(page.locator('text=Your rating:')).toBeVisible();

    // Adjust grade to Level 4
    await page.click('button[value="4"]');
    await page.fill('textarea[placeholder="Add context for your override..."]', 'Candidate demonstrated deeper knowledge.');
    await page.click('button:has-text("Save override")');

    // Wait for the UI to reflect the override
    await expect(page.locator('text=Candidate demonstrated deeper knowledge.')).toBeVisible();
    await expect(page.locator('text=L4').first()).toBeVisible();

    await page.screenshot({ path: 'screenshots/9_portfolio_results.png', fullPage: true });
  });

  test('Validates role comparison execution', async ({ page }) => {
    expect(sessionId, 'Data must exist').toBeDefined();
    await page.goto(`/assessments/${assessmentId}/sessions/${sessionId}/portfolio`);

    // Click fit/gap comparison
    // Wait for page load
    await expect(page.locator('text=Test Skill')).toBeVisible();
    
    // Select the vacancy
    await page.locator('button:has-text("Choose vacancy...")').click();
    await page.locator('div[role="option"]:has-text("Target Role")').first().click();

    // Trigger analysis
    await page.click('button:has-text("Run Fit/Gap Analysis")');

    // Should see generating state or the result if fast enough
    await expect(page.locator('text=Fit/Gap Report').first()).toBeVisible();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'screenshots/11_fit_gap_analysis.png', fullPage: true });
  });

  test('Validates transcript view', async ({ page }) => {
    expect(sessionId, 'Data must exist').toBeDefined();
    await page.goto(`/assessments/${assessmentId}/sessions/${sessionId}/transcript`);

    // Verify transcript bubbles are visible
    await expect(page.locator('text=Hello, how are you?')).toBeVisible();
    await expect(page.locator('text=I am doing well')).toBeVisible();

    await page.screenshot({ path: 'screenshots/10_transcript.png', fullPage: true });
  });

  test('Validates PDF export', async ({ page }) => {
    expect(sessionId, 'Data must exist').toBeDefined();
    await page.goto(`/assessments/${assessmentId}/sessions/${sessionId}/portfolio`);
    await expect(page.locator('text=Test Skill')).toBeVisible();
    
    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("PDF")');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(`portfolio-${sessionId}.pdf`);
    await download.saveAs(`screenshots/portfolio.pdf`);
  });
});

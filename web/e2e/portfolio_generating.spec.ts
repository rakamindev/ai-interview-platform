import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('AI Interview Platform - Portfolio Generating State', () => {
  let assessmentId: string;
  let sessionId: string;

  test.beforeAll(() => {
    const apiDir = path.resolve(__dirname, '../../api');
    const cmd = `RAILS_ENV=development bundle exec rails runner "
      org = Organization.first || Organization.create!(id: 0, name: 'Test Org', scheme: 'test', identifier: 'test', host: 'localhost')
      User.find_by(email: 'assessor@example.com') || User.create!(email: 'assessor@example.com', password: 'password', role: 'admin')
      
      assessment = Assessment.create!(tenant_id: org.id, created_by: User.last.id, name: 'Generating Role', time_limit_min: 30)
      
      session = Session.create!(tenant_id: org.id, assessment_id: assessment.id, candidate_name: 'Generating Candidate', status: 'ended', end_reason: 'all_covered', invite_token: SecureRandom.hex(16))
      
      portfolio = Portfolio.create!(session_id: session.id, generation_status: 'generating')
      
      puts 'E2E_DATA:' + [assessment.id, session.id].join(',')
    "`;
    const output = execSync(cmd, { cwd: apiDir, encoding: 'utf-8' });
    const match = output.match(/E2E_DATA:([0-9,]+)/);
    if (match) {
      const parts = match[1].split(',');
      assessmentId = parts[0];
      sessionId = parts[1];
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

  test('Validates generating portfolio screen', async ({ page }) => {
    test.skip(!sessionId, 'Data not found');
    await page.goto(`/assessments/${assessmentId}/sessions/${sessionId}/portfolio`);
    
    // Verify generating message is displayed
    await expect(page.locator('text=Generating portfolio...')).toBeVisible();
    await expect(page.locator('text=The AI is analyzing the interview transcript.')).toBeVisible();
  });
});

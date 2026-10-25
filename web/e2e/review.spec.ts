import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import path from 'node:path';

const route = '/assessments/1/sessions/1/fitgap/1';
const evidence = path.resolve('../assessment/evidence');

test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill('assessor@example.test');
  await page.getByLabel('Password', { exact: true }).fill(process.env.DEMO_PASSWORD || 'local-demo-only-2026');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/assessments$/);
  await page.goto(route);
  await expect(page.getByText('3 of 4 requirements assessed')).toBeVisible();
});

test('real API: evidence, filter, refresh, JSON and PDF downloads', async ({ page }) => {
  const apiRow = page.getByRole('row').filter({ hasText: 'RESTful API Design' });
  await expect(apiRow).toContainText('L4');
  await expect(apiRow).toContainText('Human reviewed');
  await expect(apiRow).toContainText('AI: L2');
  await apiRow.locator('summary').click();
  await expect(apiRow.getByText(/Synthetic human review/)).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(evidence, 'after-desktop.png'), fullPage: true });
  await page.getByLabel('Needs follow-up only').check();
  await expect(page.getByRole('row').filter({ hasText: 'Database Design & SQL' })).toHaveCount(0);
  await expect(page.getByRole('row').filter({ hasText: 'Communication' })).toBeVisible();
  await page.getByLabel('Needs follow-up only').uncheck();
  await page.getByRole('button', { name: 'Refresh comparison', exact: true }).click();
  await expect(page.getByText('Preparing your comparison')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download PDF' })).toBeEnabled({ timeout: 30000 });
  for (const format of ['JSON', 'PDF']) {
    const downloaded = page.waitForEvent('download');
    await page.getByRole('button', { name: `Download ${format}` }).click();
    const file = await downloaded;
    expect(await file.failure()).toBeNull();
    await file.saveAs(path.join(evidence, `sample-fitgap.${format.toLowerCase()}`));
  }
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByRole('link', { name: 'View transcript', exact: true }).click();
  await expect(page).toHaveURL(/\/transcript$/);
});

test('real API: narrow screen, keyboard evidence control, and accessible comparison', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.getByRole('heading', { name: 'Requirement by requirement' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const control = page.locator('summary').first();
  await control.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('details').first()).toHaveAttribute('open', '');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(evidence, 'after-mobile.png'), fullPage: true });
  const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(audit.violations).toEqual([]);
});

test('simulated response: failed refresh preserves the last successful report', async ({ page }) => {
  await page.route('**/api/v1/portfolios/1/fitgap/1', async intercepted => {
    const original = await intercepted.fetch();
    const data = await original.json();
    data.report.generation_status = 'failed';
    data.report.error_code = 'queue_unavailable';
    await intercepted.fulfill({ response: original, json: data });
  });
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('processing queue is unavailable');
  await expect(page.getByText('3 of 4 requirements assessed')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download PDF' })).toBeDisabled();
  await page.screenshot({ path: path.join(evidence, 'simulated-failed-refresh.png'), fullPage: true });
  await page.unroute('**/api/v1/portfolios/1/fitgap/1');
  await page.getByRole('button', { name: 'Retry comparison' }).click();
  await expect(page.getByRole('button', { name: 'Download PDF' })).toBeEnabled({ timeout: 30000 });
});

test('simulated response: long labels and empty requirements remain readable', async ({ page }) => {
  await page.route('**/api/v1/portfolios/1/fitgap/1', async intercepted => {
    const original = await intercepted.fetch();
    const data = await original.json();
    data.report.skill_comparisons[0].skill_label = 'LongSkillNameWithoutBreaks'.repeat(10);
    await intercepted.fulfill({ response: original, json: data });
  });
  await page.setViewportSize({ width: 320, height: 812 });
  await page.reload();
  await expect(page.locator('td > p').filter({ hasText: 'LongSkillNameWithoutBreaks'.repeat(10) })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: path.join(evidence, 'simulated-long-label-mobile.png'), fullPage: true });
  await page.unroute('**/api/v1/portfolios/1/fitgap/1');
  await page.route('**/api/v1/portfolios/1/fitgap/1', async intercepted => {
    const original = await intercepted.fetch();
    const data = await original.json();
    data.report.skill_comparisons = [];
    for (const key of Object.keys(data.report.summary)) data.report.summary[key] = 0;
    await intercepted.fulfill({ response: original, json: data });
  });
  await page.reload();
  await expect(page.getByText('No skill requirements', { exact: true })).toBeVisible();
  await page.screenshot({ path: path.join(evidence, 'simulated-empty-requirements.png'), fullPage: true });
});

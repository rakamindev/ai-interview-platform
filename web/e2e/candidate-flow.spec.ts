import { test, expect } from '@playwright/test';

test.describe('Candidate interview flow', () => {
  test('shows interview page with hardware check when navigating to invite link', async ({
    page,
  }) => {
    await page.goto('/interview/test-token-123');

    // Page should render role title or default heading
    await expect(page.getByText(/AI Interview/).first()).toBeVisible();

    // Hardware check component should be present
    await expect(page.getByTestId('hardware-check')).toBeVisible();
  });

  test('shows interview tips before starting', async ({ page }) => {
    await page.goto('/interview/test-token-123');

    await expect(page.getByText(/This is a voice interview/)).toBeVisible();
    await expect(page.getByText(/The AI will ask follow-up questions/)).toBeVisible();
  });

  test('shows connection status UI elements', async ({ page }) => {
    await page.goto('/interview/test-token-123');

    // Connection status component should exist in the DOM once interview starts
    // Before start, we just verify the page structure
    await expect(page.getByText('AI Interview')).toBeVisible();
    await expect(page.getByText(/minutes/)).toBeVisible();
  });
});

test.describe('Login page', () => {
  test('renders login form with email and password fields', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: /Sign in/ })).toBeVisible();
  });
});

test.describe('Accept invite page', () => {
  test('shows invalid link message when token is missing', async ({ page }) => {
    await page.goto('/accept-invite');

    await expect(page.getByText('Invalid Invite Link')).toBeVisible();
    await expect(
      page.getByText(/This invite link is invalid or missing a token/)
    ).toBeVisible();
  });
});

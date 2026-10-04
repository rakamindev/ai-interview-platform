import { test, expect } from '@playwright/test';

test.describe('Login Page Visual & Auth Flow', () => {
  test('should display Rakamin official UI elements', async ({ page }) => {
    await page.goto('/login');

    // 1. Verify Fake Logo exists
    await expect(page.locator('text=Rakamin').first()).toBeVisible();

    // 2. Verify Heading
    await expect(page.getByRole('heading', { name: 'Login to Rakamin' })).toBeVisible();

    // 3. Verify Email input
    await expect(page.getByPlaceholder('Enter your email')).toBeVisible();

    // 4. Verify primary button matches Rakamin's "Send Link"
    const sendLinkBtn = page.getByRole('button', { name: 'Send Link' });
    await expect(sendLinkBtn).toBeVisible();
  });

  test('should login successfully with valid admin credentials', async ({ page }) => {
    await page.goto('/login');

    // Tulis email
    await page.fill('input[type="email"]', 'admin@rakamin.com');
    
    // Buka form password
    await page.click('button:has-text("Masuk dengan kata sandi")');
    
    // Tulis password
    await page.fill('input[type="password"]', 'password');

    // Klik tombol submit (asumsi ada tombol 'Masuk dengan Magic Link' / 'Masuk dengan kata sandi')
    await page.click('button[type="submit"]');

    // Validasi URL berubah ke dashboard assessments
    await expect(page).toHaveURL(/\/assessments/);
    
    // Validasi banner selamat datang
    await expect(page.getByRole('heading', { name: 'Hi Assessor, Selamat Datang!' })).toBeVisible();
  });
});

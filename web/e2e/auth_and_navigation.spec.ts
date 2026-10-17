import { test, expect } from "@playwright/test";

test.describe("Authentication and Layout Navigation Flow", () => {
  test("should render the Login page with Rakamin branding and quick demo button", async ({ page }) => {
    await page.goto("/login");

    // Check Rakamin logo and branding
    const logo = page.locator("img[alt='Rakamin']");
    await expect(logo).toBeVisible();

    // Check header
    await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible();

    // Check Quick Demo Login pill
    await expect(page.getByText("admin@rakamin.com • admin123")).toBeVisible();
    await expect(page.getByRole("button", { name: /1-Click Sign In/i })).toBeVisible();

    // Check email & password inputs
    const emailInput = page.locator("#email");
    const passwordInput = page.locator("#password");
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
  });

  test("should authenticate successfully using 1-Click Demo Login and navigate to Assessments", async ({ page }) => {
    await page.goto("/login");

    // Click 1-Click Sign In
    await page.getByRole("button", { name: /1-Click Sign In/i }).click();

    // Should redirect to /assessments
    await page.waitForURL("**/assessments");
    await expect(page).toHaveURL(/.*\/assessments/);

    // Header should show Rakamin branding and navigation
    const headerLogo = page.locator("header img[alt='Rakamin']");
    await expect(headerLogo).toBeVisible();
    await expect(page.getByRole("link", { name: /Assessments/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Role Vacancies/i })).toBeVisible();

    // Sign out button should be present
    const signOutBtn = page.getByRole("button", { name: /Sign Out/i });
    await expect(signOutBtn).toBeVisible();
  });

  test("should open Google Account Chooser and authenticate successfully when selecting an account", async ({ page }) => {
    await page.goto("/login");

    // Google Sign In button should be visible
    const googleBtn = page.getByRole("button", { name: /Sign in with Google/i });
    await expect(googleBtn).toBeVisible();

    // Click Google Sign In -> opens Account Chooser Dialog
    await googleBtn.click();

    // Verify Google Account Chooser Dialog is displayed
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/Pilih akun Google Anda/i)).toBeVisible();
    await expect(dialog.getByText("admin@rakamin.com")).toBeVisible();

    // Click on Admin Rakamin account inside dialog
    await dialog.getByRole("button", { name: /Admin Rakamin/i }).click();

    // Should authenticate and redirect to /assessments
    await page.waitForURL("**/assessments");
    await expect(page).toHaveURL(/.*\/assessments/);

    // Header should show Rakamin navigation
    await expect(page.getByRole("link", { name: /Assessments/i })).toBeVisible();
  });

  test("should allow any Google/Gmail user account when using Google Sign In", async ({ page }) => {
    await page.goto("/login");

    // Click Google Sign In
    await page.getByRole("button", { name: /Sign in with Google/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Click on "Gunakan akun Google lain..."
    await dialog.getByText(/Gunakan akun Google lain/i).click();

    // Fill with a personal Gmail email
    await dialog.locator("input[type='email']").fill("stranger@gmail.com");
    await dialog.getByRole("button", { name: /Lanjutkan/i }).click();

    // Should authenticate and redirect to /assessments
    await page.waitForURL("**/assessments");
    await expect(page).toHaveURL(/.*\/assessments/);

    // Header should show Rakamin navigation
    await expect(page.getByRole("link", { name: /Assessments/i })).toBeVisible();
  });

  test("should log out and redirect back to /login when Sign Out is clicked", async ({ page }) => {
    // Perform login first
    await page.goto("/login");
    await page.getByRole("button", { name: /1-Click Sign In/i }).click();
    await page.waitForURL("**/assessments");

    // Click Sign Out
    const signOutBtn = page.getByRole("button", { name: /Sign Out/i });
    await signOutBtn.click();

    // Should redirect to /login
    await page.waitForURL("**/login");
    await expect(page).toHaveURL(/.*\/login/);
  });

  test("should display error message and reject login when credentials are invalid (Failure Path)", async ({ page }) => {
    await page.goto("/login");

    await page.locator("#email").fill("unauthorized@example.com");
    await page.locator("#password").fill("wrongpassword123");
    await page.getByRole("button", { name: /Sign In to Dashboard/i }).click();

    // Error alert should be visible and URL remains /login
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByRole("alert")).toContainText(/Invalid/i);
    await expect(page).toHaveURL(/.*\/login/);
  });

  test("should redirect unauthenticated users to /login when accessing protected routes (Route Guard)", async ({ page }) => {
    // Clear any existing localStorage auth token
    await page.goto("/login");
    await page.evaluate(() => localStorage.clear());

    // Attempt direct navigation to protected route
    await page.goto("/assessments");

    // Guard should redirect back to /login
    await page.waitForURL("**/login");
    await expect(page).toHaveURL(/.*\/login/);
  });
});

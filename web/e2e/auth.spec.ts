import { expect, test } from "@playwright/test";

/**
 * These specs authenticate against a real backend user seeded by
 * `api/db/seeds.rb` (see the "Test admin user" block) — run
 * `bundle exec rails runner 'load Rails.root.join("db/seeds.rb")'`
 * against the target environment before running this suite.
 */
const E2E_EMAIL = "e2e.admin@test-corp.dev";
const E2E_PASSWORD = "e2e-test-password-1";

// `getStoredToken()` falls back to VITE_DEV_TOKEN only when localStorage has no
// `auth_token` key at all; an explicit empty string is treated as "logged out"
// (see src/stores/authAtom.ts) — this is how we force a clean session in dev,
// where VITE_DEV_TOKEN would otherwise auto-authenticate every page load.
async function forceLoggedOut(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("auth_token", "");
  });
}

test("redirects an unauthenticated visitor from a protected route to /login", async ({ page }) => {
  await forceLoggedOut(page);

  await page.goto("/assessments");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "AI Interview" })).toBeVisible();
});

test("shows an inline error when login credentials are rejected", async ({ page }) => {
  await forceLoggedOut(page);
  await page.goto("/login");

  await page.getByLabel("Email").fill(E2E_EMAIL);
  await page.getByLabel("Password").fill("definitely-the-wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByText("Invalid email or password.")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test("logs in with valid credentials and reaches the assessments dashboard", async ({ page }) => {
  await forceLoggedOut(page);
  await page.goto("/login");

  await page.getByLabel("Email").fill(E2E_EMAIL);
  await page.getByLabel("Password").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/assessments$/);
  await expect(page.getByRole("heading", { name: "Assessments" })).toBeVisible();
});

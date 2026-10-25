import { test, expect, Page } from "@playwright/test";

async function loginAsAdmin(page: Page) {
  await page.goto("/login");
  await page.fill("#email", "admin@example.com");
  await page.fill("#password", "password123");
  await page.click("button[type='submit']");
  await page.waitForURL("**/assessments", { timeout: 10000 });
}

test.describe("AI Interview Platform E2E Flows", () => {
  test("1. Login flow authenticates and redirects to assessments", async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.locator("h1")).toContainText(/Assessments/i);
    await expect(page.locator("body")).toContainText(/Senior Backend Engineer/i);
  });

  test("2. Navigating to candidate sessions and invite link", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/assessments/1/invite");
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator("body")).toContainText(/Candidates/i);
  });

  test("3. Navigating to candidate portfolio displays skill cards and evidence", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/assessments/1/sessions/1/portfolio");
    await expect(page.locator("h1")).toContainText(/Candidate Skill Portfolio/i);
    await expect(page.locator("body")).toContainText(/Target Competencies/i);
    await expect(page.locator("body")).toContainText(/Distributed Systems/i);
  });

  test("4. Navigating to Vacancies dashboard lists target roles", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/vacancies");
    await expect(page.locator("h1")).toContainText(/Vacancies/i);
    await expect(page.locator("body")).toContainText(/Senior Backend Engineer/i);
  });

  test("5. Fit/Gap report page displays comparison matrix and narratives", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/assessments/1/sessions/1/fitgap/1");
    await expect(page.locator("h1")).toContainText(/Role Fit & Gap Analysis/i);
    await expect(page.locator("body")).toContainText(/Skill-by-Skill Requirement Comparison/i);
  });

  test("6. Candidate interview route loads successfully on port 5173", async ({ page }) => {
    await page.goto("/interview/779d0e55fdc2df3b2e8954f7970cbc6a32f4ae428353245d380465aa09bbf50d");
    await expect(page.locator("body")).toBeVisible();
  });
});

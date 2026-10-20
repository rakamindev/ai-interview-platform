import { test, expect, expectNoHorizontalScroll, expectAccessible } from "./fixtures";

// The pages around the change, checked the same way: what an assessor passes through to reach a portfolio.
test.describe("Assessor pages", () => {
  test("the assessment list", async ({ page }) => {
    await page.goto("/assessments");
    await expect(page.getByText("E2E Senior Frontend Engineer")).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectAccessible(page);
  });

  test("the invite page", async ({ page, seed }) => {
    await page.goto(`/assessments/${seed.assessmentId}/invite`);
    await expect(page.getByText("E2E Mixed")).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectAccessible(page);
  });

  test("the vacancy list", async ({ page }) => {
    await page.goto("/vacancies");
    await expect(page.getByText("E2E Frontend Engineer")).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectAccessible(page);
  });
});

test.describe("Signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("the login page", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectAccessible(page);
  });
});

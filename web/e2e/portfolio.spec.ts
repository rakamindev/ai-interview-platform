import { test, expect, portfolioPath, expectNoHorizontalScroll, expectAccessible, capture } from "./fixtures";

// The portfolio page in each state, in a real browser against the real API. Nothing here clicks Retry or
// regenerates: that would queue a model call.
test.describe("Portfolio", () => {
  test("says which skills weren't assessed, and why", async ({ page, seed }, info) => {
    await page.goto(portfolioPath(seed, "E2E Mixed"));

    await expect(
      page.getByText("2 of 3 skills weren't assessed. The interview ended after 6 minutes (ended by the candidate).")
    ).toBeVisible();
    await expect(page.getByText("Not assessed", { exact: true })).toHaveCount(2);
    await expect(page.getByText("Not reached before the interview ended", { exact: true })).toBeVisible();
    await expect(page.getByText("Not enough evidence to rate", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add rating ▼" })).toHaveCount(2);
    await expectNoHorizontalScroll(page);
    await expectAccessible(page);

    const main = page.locator("main > *").first();
    if (info.project.name === "desktop") {
      await capture(main, "portfolio-mixed");
      // The Add rating panel, open: it asks where the rating comes from (AC-20). Nothing is saved.
      const card = page.locator(".rounded-xl.border").filter({ hasText: "Communication" });
      await card.getByRole("button", { name: "Add rating ▼" }).click();
      await expect(card.getByText("Where this rating comes from (required):")).toBeVisible();
      await expect(card.getByRole("button", { name: "Save rating" })).toBeDisabled();
      await capture(card, "not-assessed-card");
    } else {
      await capture(main, "mobile-portfolio");
    }
  });

  test("shows no summary line when every skill was assessed", async ({ page, seed }, info) => {
    await page.goto(portfolioPath(seed, "E2E All assessed"));

    await expect(page.getByRole("heading", { name: "Configured Skills" })).toBeVisible();
    await expect(page.getByText(/weren't assessed|wasn't assessed/)).toHaveCount(0);
    await expect(page.getByText("Not assessed", { exact: true })).toHaveCount(0);
    await expectNoHorizontalScroll(page);
    await expectAccessible(page);
    if (info.project.name === "desktop") await capture(page.locator("main > *").first(), "portfolio-all-assessed");
  });

  test("explains a failed generation in safe words and offers Retry", async ({ page, seed }, info) => {
    await page.goto(portfolioPath(seed, "E2E Failed"));

    const alert = page.getByRole("alert");
    await expect(alert).toContainText("Portfolio generation failed.");
    await expect(alert).toContainText("Model timeout: the AI didn't answer in time.");
    await expect(alert.getByRole("button", { name: "Retry" })).toBeEnabled();
    await expectNoHorizontalScroll(page);
    await expectAccessible(page);
    if (info.project.name === "desktop") await capture(page.locator("main > *").first(), "portfolio-failed");
  });

  test("shows progress while the portfolio is generated", async ({ page, seed }, info) => {
    await page.goto(portfolioPath(seed, "E2E Generating"));

    await expect(page.getByText("Generating portfolio...")).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectAccessible(page);
    if (info.project.name === "desktop") await capture(page.locator("main > *").first(), "portfolio-generating");
  });

  test("collapses long quotes and summaries, and expands them on request", async ({ page, seed }, info) => {
    await page.goto(portfolioPath(seed, "E2E Long text"));

    const more = page.getByRole("button", { name: "Show more" });
    await expect(more).toHaveCount(2);
    await expectNoHorizontalScroll(page);
    await expectAccessible(page);
    if (info.project.name === "desktop") await capture(page.locator("main > *").first(), "long-text");

    await more.first().click();
    await expect(page.getByRole("button", { name: "Show less" })).toHaveAttribute("aria-expanded", "true");
    await expectNoHorizontalScroll(page);
    await expectAccessible(page);
  });
});

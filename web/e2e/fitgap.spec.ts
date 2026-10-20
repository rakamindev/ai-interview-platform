import { test, expect, fitGapPath, expectNoHorizontalScroll, expectAccessible, capture } from "./fixtures";

test.describe("Fit/gap", () => {
  test("reports unassessed skills as unknowns, with the reason, never as gaps", async ({ page, seed }, info) => {
    await page.goto(fitGapPath(seed, "E2E Mixed"));

    await expect(page.getByText("Skill Comparison")).toBeVisible();
    await expect(page.getByText("Not reached before the interview ended: probe it in the next interview.")).toBeVisible();
    await expect(page.getByText("✅ Match: 1 skill")).toBeVisible();
    await expect(page.getByText("— Not assessed: 2 skills")).toBeVisible();
    await expect(page.getByText(/⚠ Gap/)).toHaveCount(0);
    await expectNoHorizontalScroll(page);
    await expectAccessible(page);

    if (info.project.name === "desktop") {
      await expect(page.getByRole("columnheader", { name: "Required" })).toBeVisible();
      await capture(page.locator("main > *").first(), "fitgap-mixed");
    } else {
      // On a phone the header row is hidden and each value carries its column name (AC-29).
      await expect(page.getByRole("columnheader", { name: "Required" })).toBeHidden();
      const label = await page
        .locator('td[data-label="Required"]')
        .first()
        .evaluate((td) => getComputedStyle(td, "::before").content);
      expect(label).toBe('"Required"');
      await capture(page.locator("main > *").first(), "mobile-fitgap");
    }
  });

  test("shows progress while the report is generated", async ({ page, seed }, info) => {
    // The waiting state needs a report that doesn't exist yet, and asking for one would queue a model call. So this
    // test answers the two fit/gap calls itself; everything else is the real API.
    await page.route("**/portfolios/*/fitgap/*", (route) => route.fulfill({ status: 404, json: { errors: [] } }));
    await page.route("**/portfolios/*/fitgap", (route) =>
      route.fulfill({ status: 202, json: { status: "generating", message: "Fit/gap report generation queued" } })
    );
    await page.goto(fitGapPath(seed, "E2E Mixed"));

    await expect(page.getByText("Generating fit/gap report...")).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectAccessible(page);
    if (info.project.name === "desktop") await capture(page.locator("main > *").first(), "fitgap-generating");
  });
});

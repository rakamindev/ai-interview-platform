import type { Locator, Page } from "@playwright/test";
import { test, expect, portfolioPath } from "./fixtures";

/**
 * Presses Tab until `target` has focus, as a keyboard user would. Fails if it never does: then the control can't be
 * reached without a mouse.
 */
async function tabTo(page: Page, target: Locator, maxTabs = 60) {
  await target.waitFor({ state: "visible", timeout: 15_000 });
  for (let i = 0; i < maxTabs; i++) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((el) => el === document.activeElement)) return;
  }
  throw new Error(`Tab never reached ${target}`);
}

// AC-30: what the assessor does on the new screens works without a mouse. Nothing here saves: a saved rating would
// queue a fit/gap regeneration, which calls the model.
test.describe("Keyboard only", () => {
  test("expands a long quote with Show more", async ({ page, seed }) => {
    await page.goto(portfolioPath(seed, "E2E Long text"));
    const more = page.getByRole("button", { name: "Show more" }).first();
    await expect(more).toBeVisible();

    await tabTo(page, more);
    await page.keyboard.press("Enter");

    await expect(page.getByRole("button", { name: "Show less" })).toHaveAttribute("aria-expanded", "true");
  });

  test("fills in a rating for a skill the AI didn't rate, up to Save", async ({ page, seed }) => {
    await page.goto(portfolioPath(seed, "E2E Mixed"));
    const card = page.locator(".rounded-xl.border").filter({ hasText: "Communication" });
    const addRating = card.getByRole("button", { name: "Add rating ▼" });
    await expect(addRating).toBeVisible();

    await tabTo(page, addRating);
    await page.keyboard.press("Enter");
    const save = card.getByRole("button", { name: "Save rating" });
    await expect(save).toBeDisabled();

    // The level picker is one Tab stop; arrow keys move between levels and Space picks one. (Arrows alone also pick
    // on desktop, but not with touch emulation, so the test uses the key that works everywhere.)
    await tabTo(page, card.getByRole("radio", { name: "L1" }));
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(card.getByRole("radio", { name: "L3" })).toBeFocused();
    await page.keyboard.press("Space");
    await expect(card.getByRole("radio", { name: "L3" })).toBeChecked();

    await page.keyboard.press("Tab");
    await expect(card.getByLabel("Where this rating comes from (required):")).toBeFocused();
    await page.keyboard.type("Probed in the second interview.");
    await expect(save).toBeEnabled();

    await tabTo(page, card.getByRole("button", { name: "Cancel" }));
    await page.keyboard.press("Enter");
    await expect(addRating).toBeVisible();
  });

  test("opens an assessment from the list", async ({ page }) => {
    await page.goto("/assessments");
    const card = page.getByRole("link", { name: /E2E Senior Frontend Engineer/ });

    await tabTo(page, card, 30);
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/assessments\/\d+\/invite$/);
  });
});

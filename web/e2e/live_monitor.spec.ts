import { test, expect } from "@playwright/test";
import { loginAsAssessor } from "./helpers/auth";

test.describe("Real-Time AI Interview Live Monitor Flow", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAssessor(page);
  });

  test("should display Live Monitor with compact HeroBanner and real-time observer controls", async ({ page }) => {
    await page.goto("/assessments/2/sessions/2/monitor");

    // Header and HeroBanner
    await expect(page.getByText(/Live Session Monitor & Signal Tracker/i)).toBeVisible();
    await expect(page.getByText(/Real-Time AI Interview Observer/i)).toBeVisible();

    // Verify WebSocket and session cards
    await expect(page.getByText(/Coverage Status/i)).toBeVisible();
    await expect(page.getByText(/Live Transcript/i)).toBeVisible();

    // Verify presence of End Session trigger or View portfolio CTA
    await expect(
      page.getByRole("button", { name: /End Session/i }).or(page.getByRole("button", { name: /View portfolio/i }))
    ).toBeVisible();
  });

  test("should open emergency termination dialog when clicking End Session", async ({ page }) => {
    await page.goto("/assessments/2/sessions/2/monitor");

    const endSessionBtn = page.getByRole("button", { name: /End Session/i });
    if (await endSessionBtn.isVisible()) {
      await endSessionBtn.click();

      // Dialog confirmation should be visible
      await expect(page.getByRole("heading", { name: /End the session now\?/i })).toBeVisible();
      await expect(page.getByText(/The interview will stop and portfolio generation will begin/i)).toBeVisible();

      // Dismiss dialog safely without ending session
      await page.getByRole("button", { name: /Cancel/i }).click();
      await expect(page.getByRole("heading", { name: /End the session now\?/i })).not.toBeVisible();
    } else {
      // If session is already ended, view portfolio button should be visible
      await expect(page.getByRole("button", { name: /View portfolio/i })).toBeVisible();
    }
  });
});

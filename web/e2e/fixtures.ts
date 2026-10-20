import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { test as base, expect, type Locator, type Page } from "@playwright/test";
import { SEED_FILE, type Seed } from "./session";

const SCREENSHOTS = fileURLToPath(new URL("../../assessment/report/screenshots/", import.meta.url));

// Every test starts signed in (global-setup.ts) and gets the seeded IDs.
export const test = base.extend<{ seed: Seed }>({
  seed: async ({}, use) => {
    await use(JSON.parse(fs.readFileSync(SEED_FILE, "utf-8")) as Seed);
  },
});

export { expect };

export function portfolioPath(seed: Seed, candidate: string) {
  return `/assessments/${seed.assessmentId}/sessions/${sessionId(seed, candidate)}/portfolio`;
}

export function fitGapPath(seed: Seed, candidate: string) {
  return `/assessments/${seed.assessmentId}/sessions/${sessionId(seed, candidate)}/fitgap/${seed.vacancyId}`;
}

function sessionId(seed: Seed, candidate: string) {
  const id = seed.sessions[candidate];
  if (!id) throw new Error(`No seeded session for ${candidate}`);
  return id;
}

/**
 * AC-29: nothing is wider than the screen. jsdom has no layout, so only a browser can check this.
 * Measured against the configured viewport, not window.innerWidth: on a phone (isMobile) the browser zooms out to
 * fit content that's too wide, and innerWidth grows with it, so the page "fits" while the user sees it shrunk.
 * Elements are checked one by one too, because a container that clips a wide child doesn't widen the page.
 */
export async function expectNoHorizontalScroll(page: Page) {
  const screen = page.viewportSize()!.width;
  const { scrollWidth, sticksOut } = await page.evaluate((width) => {
    const sticksOut = [...document.querySelectorAll("main *")]
      .filter((el) => {
        const box = el.getBoundingClientRect();
        return box.width > 0 && box.height > 0 && box.right > width + 1;
      })
      .slice(0, 3)
      .map((el) => `<${el.tagName.toLowerCase()} class="${el.getAttribute("class") ?? ""}">`);
    return { scrollWidth: document.documentElement.scrollWidth, sticksOut };
  }, screen);
  expect(scrollWidth, `the page is wider than the ${screen}px screen`).toBeLessThanOrEqual(screen);
  expect(sticksOut, "elements reach past the right edge of the screen").toEqual([]);
}

/**
 * Known accessibility defects, each tied to a finding, so a skipped rule is visible and has an owner. Empty means axe
 * checks every rule on every page.
 */
export const KNOWN_A11Y_DEFECTS: { rule: string; finding: string }[] = [];

/** axe (WCAG 2.1 A and AA): no serious or critical violation on the page as it is now. */
export async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .disableRules(KNOWN_A11Y_DEFECTS.map((d) => d.rule))
    .analyze();
  const serious = results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id} (${v.impact}): ${v.help} at ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(", ")}`);
  expect(serious, "accessibility violations (axe)").toEqual([]);
}

/**
 * Under `npm run e2e:screenshots` (or with E2E_SCREENSHOTS=1), saves the element as the report's screenshot of
 * that name.
 * Plain files, not pixel comparisons: fonts render differently on Windows and Linux.
 */
export async function capture(target: Locator, name: string) {
  if (!process.env.E2E_SCREENSHOTS && process.env.npm_lifecycle_event !== "e2e:screenshots") return;
  await target.screenshot({
    path: path.join(SCREENSHOTS, `${name}.png`),
    animations: "disabled",
    // An element screenshot scrolls the page, and the sticky top bar would be drawn over the element.
    style: "header { position: static !important; }",
  });
}

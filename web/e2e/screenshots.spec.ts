import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";

const HERE = dirname(fileURLToPath(import.meta.url));
const API = process.env.API_URL ?? "http://localhost:3001/api/v1";
const OUT = resolve(HERE, "../../assessment/screenshots");
const VIEWPORTS = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } } as const;

/** Same dev token the web app uses (web/.env), so the API sees the same tenant. */
function token(): string {
  const env = readFileSync(resolve(HERE, "../.env"), "utf8");
  const match = env.match(/^VITE_DEV_TOKEN=(.+)$/m);
  if (!match) throw new Error("VITE_DEV_TOKEN missing from web/.env");
  return match[1].trim();
}

async function api<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token()}` } });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return (await res.json()) as T;
}

type Ids = { assessment: number; sessions: Record<string, number>; vacancy: number; emptyVacancy: number };

/** Resolves the demo seed by name, so ids survive re-seeding. */
async function demoIds(): Promise<Ids> {
  const { assessments } = await api<{ assessments: { id: number; name: string }[] }>("/assessments?per_page=100");
  const assessment = assessments.find((a) => a.name === "Demo · Frontend Engineer");
  if (!assessment) throw new Error("Demo data missing: run `bundle exec rails demo:seed_report` in api/");
  const { sessions } = await api<{ sessions: { id: number; candidate_name: string }[] }>(`/assessments/${assessment.id}/sessions`);
  const byName = Object.fromEntries(sessions.map((s) => [s.candidate_name.replace("Demo · ", ""), s.id]));
  const { vacancies } = await api<{ vacancies: { id: number; role_title: string }[] }>("/vacancies?per_page=100");
  const vacancy = (title: string) => vacancies.find((v) => v.role_title === title)!.id;
  return {
    assessment: assessment.id,
    sessions: byName,
    vacancy: vacancy("Demo · Frontend Engineer (Mid)"),
    emptyVacancy: vacancy("Demo · Vacancy without skills"),
  };
}

async function capture(page: Page, name: string, url: string, ready: string, viewport: keyof typeof VIEWPORTS) {
  await page.setViewportSize(VIEWPORTS[viewport]);
  await page.goto(url);
  await expect(page.getByText(ready, { exact: false }).first()).toBeVisible({ timeout: 15_000 });
  // No horizontal scrolling at any width.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${name} overflows horizontally at ${viewport}`).toBeLessThanOrEqual(0);
  await page.screenshot({ path: `${OUT}/${name}-${viewport}.png`, fullPage: true });
}

/** For the PDF report: just the page's content column, top portion, at desktop width. */
async function captureCrop(page: Page, name: string) {
  const box = await page.locator("main > div").first().boundingBox();
  if (!box) throw new Error(`${name}: content column not found`);
  await page.screenshot({
    path: `${OUT}/report/${name}.png`,
    fullPage: true,
    clip: { x: box.x - 16, y: Math.max(box.y - 16, 0), width: box.width + 32, height: Math.min(box.height + 32, 1000) },
  });
}

let ids: Ids;
test.beforeAll(async () => {
  ids = await demoIds();
});

const portfolio = (s: string) => `/assessments/${ids.assessment}/sessions/${ids.sessions[s]}/portfolio`;
const fitgap = (s: string, v = ids.vacancy) => `/assessments/${ids.assessment}/sessions/${ids.sessions[s]}/fitgap/${v}`;

for (const viewport of ["desktop", "mobile"] as const) {
  test.describe(viewport, () => {
    test("portfolio states", async ({ page }) => {
      await capture(page, "portfolio-mixed-evidence", portfolio("Andi"), "3 of 4", viewport);
      if (viewport === "desktop") await captureCrop(page, "portfolio-mixed-evidence");
      await capture(page, "portfolio-fully-evidenced", portfolio("Budi"), "4 of 4", viewport);
      await capture(page, "portfolio-nothing-assessed", portfolio("Citra"), "0 of 4", viewport);
      await capture(page, "portfolio-generating", portfolio("Rina"), "Retrying automatically", viewport);
      await capture(page, "portfolio-failed", portfolio("Sari"), "couldn't be generated", viewport);
      await capture(page, "portfolio-interview-in-progress", portfolio("Tono"), "still in progress", viewport);
    });

    test("fit/gap states", async ({ page }) => {
      await capture(page, "fitgap-recommendation-withheld", fitgap("Andi"), "No recommendation yet", viewport);
      if (viewport === "desktop") await captureCrop(page, "fitgap-recommendation-withheld");
      await capture(page, "fitgap-recommendation", fitgap("Budi"), "Recommendation", viewport);
      if (viewport === "desktop") await captureCrop(page, "fitgap-recommendation");
      await capture(page, "fitgap-interview-ended-early", fitgap("Citra"), "ended early", viewport);
      await capture(page, "fitgap-vacancy-without-skills", fitgap("Andi", ids.emptyVacancy), "no required skills", viewport);
    });

    test("rating a skill the interview did not cover", async ({ page }) => {
      await capture(page, "portfolio-mixed-evidence", portfolio("Andi"), "3 of 4", viewport);
      await page.getByRole("button", { name: /rate manually for cloud/i }).click();
      await page.getByRole("radiogroup", { name: /rating for cloud/i }).getByText("L2").click();
      await page.getByLabel(/reason/i).fill("Follow-up call: owns the staging environment.");
      const panel = page.getByText("Rate this skill yourself").locator("xpath=ancestor::div[contains(@class,'rounded-md')][1]");
      await panel.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${OUT}/override-rate-manually-${viewport}.png` }); // form only, not saved
      if (viewport === "desktop") {
        const card = panel.locator("xpath=ancestor::div[contains(@class,'rounded-xl') or contains(@class,'rounded-lg')][1]");
        await card.screenshot({ path: `${OUT}/report/override-rate-manually.png` });
      }
    });
  });
}

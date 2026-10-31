import { chromium } from "../web/node_modules/playwright/index.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(await fs.readFile(path.join(directory, "private/demo.json"), "utf8"));
const environment = await fs.readFile(path.join(directory, "../web/.env.local"), "utf8");
const token = environment.match(/^VITE_DEV_TOKEN=(.+)$/m)?.[1];
if (!token) throw new Error("Run the synthetic seed script before recording.");
const output = path.join(directory, "evidence/screenshots");
await fs.mkdir(output, { recursive: true });
const manifest = path.join(directory, "evidence/manual-demo.json");
await fs.writeFile(manifest, JSON.stringify({ passed: false, synthetic_data: true }, null, 2));
const browser = await chromium.launch({ channel: "chrome", headless: true });
const base = "/assessments/" + fixture.assessment_id + "/sessions/" + fixture.session_id;
const reportPath = base + "/fitgap/" + fixture.vacancy_id;
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, recordVideo: { dir: path.join(directory, "private/raw-video"), size: { width: 1280, height: 900 } }, acceptDownloads: true });
await context.addInitScript(value => localStorage.setItem("auth_token", value), token);
const page = await context.newPage();
page.setDefaultTimeout(90000);
page.setDefaultNavigationTimeout(90000);
page.on("response", response => { if (response.url().includes("/api/v1/")) console.log("API", response.status(), new URL(response.url()).pathname); });
page.on("pageerror", error => console.log("Page error:", error.message));
const started = Date.now();
const scenes = [];
const scene = (name) => { const seconds = (Date.now() - started) / 1000; scenes.push({ name, seconds }); console.log(name, seconds); };
const holdUntil = async (seconds) => {
  const remaining = started + seconds * 1000 - Date.now();
  if (remaining > 0) await page.waitForTimeout(remaining);
};
const capture = async (name) => {
  await page.evaluate(() => window.scrollTo(0, 0));
  const clip = await page.locator("main > div").boundingBox();
  if (!clip) throw new Error("Report content is not visible");
  await page.screenshot({ path: path.join(output, name + ".png"), fullPage: true, clip });
};
const go = (pathname) => page.goto("http://127.0.0.1:5173" + pathname, { waitUntil: "domcontentloaded" });

try {
  scene("Scene 1: baseline contract defect, then source evidence");
  await page.goto("http://127.0.0.1:5174" + reportPath, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Fit/Gap Report", exact: true }).waitFor();
  await page.getByRole("table").waitFor();
  await capture("baseline");
  await holdUntil(12);
  await go(base + "/portfolio");
  await page.getByRole("heading", { name: "Portfolio Results" }).waitFor();
  await capture("portfolio");
  await holdUntil(20);

  scene("Scene 2: report with incomplete assessment");
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: "Frontend Engineer - synthetic demo", exact: true }).click();
  await page.getByRole("button", { name: /Run Fit/ }).click();
  await page.getByText("3 of 4 requirements assessed").waitFor();
  await capture("desktop-partial");
  await holdUntil(45);

  scene("Scene 3: follow-up and transparent rules");
  await page.getByRole("button", { name: /Needs follow-up/ }).click();
  await capture("follow-up");
  await page.getByText("How this comparison works").click();
  await holdUntil(65);

  scene("Scene 4: authorized assessor override");
  await go(base + "/portfolio");
  const edit = page.getByRole("button", { name: /Edit override/ }).first();
  const create = page.getByRole("button", { name: /Override rating/ }).first();
  await page.getByRole("heading", { name: "Portfolio Results" }).waitFor();
  if (await edit.count()) await edit.click(); else await create.click();
  await page.getByRole("radio", { name: "L4", exact: true }).check();
  await page.getByLabel("Notes (optional):").fill("Synthetic demo: assessor reviewed the interview evidence and adjusted the rating.");
  await page.getByRole("button", { name: "Save override", exact: true }).click();
  await page.getByRole("button", { name: /Edit override/ }).first().waitFor();
  await go(reportPath);
  await page.getByText("Assessor override", { exact: true }).waitFor();
  await capture("desktop-override");
  await holdUntil(90);

  scene("Scene 5: exports from the current comparison");
  const pdfDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PDF", exact: true }).click();
  await (await pdfDownload).saveAs(path.join(directory, "evidence/sample-export.pdf"));
  const jsonDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON", exact: true }).click();
  await (await jsonDownload).saveAs(path.join(directory, "evidence/sample-export.json"));
  await holdUntil(110);

  scene("Scene 6: mobile review");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("heading", { name: "Skill comparison", exact: true }).evaluate(element => {
    const headerHeight = document.querySelector("header")?.getBoundingClientRect().height ?? 0;
    window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - headerHeight - 16);
  });
  await page.screenshot({ path: path.join(output, "mobile.png"), fullPage: false });
  await holdUntil(135);

  scene("Scene 7: simulated network failure and recovery");
  await page.setViewportSize({ width: 1280, height: 900 });
  const apiPath = "**/api/v1/portfolios/" + fixture.portfolio_id + "/fitgap/" + fixture.vacancy_id;
  await page.route(apiPath, route => route.abort("failed"));
  await page.getByRole("button", { name: "Refresh comparison" }).click();
  await page.getByRole("alert").waitFor();
  await capture("error");
  await holdUntil(145);
  await page.unroute(apiPath);
  await page.getByRole("button", { name: "Retry comparison" }).click();
  await page.getByText("3 of 4 requirements assessed").waitFor();
  await holdUntil(155);

  scene("Scene 8: unconfigured vacancy and review boundary");
  await go(base + "/fitgap/" + fixture.empty_vacancy_id);
  await page.getByText("No skill requirements configured").waitFor();
  await page.getByRole("heading", { name: "No skill requirements configured", exact: true }).locator("..").screenshot({ path: path.join(output, "empty.png") });
  await holdUntil(175);
  await go(reportPath);
  await page.getByText("3 of 4 requirements assessed").waitFor();
  await holdUntil(185);
} catch (error) {
  await page.screenshot({ path: path.join(directory, "private/recording-error.png") }).catch(() => {});
  console.log((await page.locator("body").innerText().catch(() => "")).slice(0, 2500));
  throw error;
} finally {
  const video = page.video();
  await context.close();
  if (video) await fs.copyFile(await video.path(), path.join(directory, "private/demo-raw.webm"));
  await browser.close();
}
console.log("Screenshots, exports, and raw demo were captured from the running API with synthetic records.");
await fs.writeFile(manifest, JSON.stringify({ passed: true, synthetic_data: true, api: "local Rails and PostgreSQL", simulated_failure: "one aborted comparison request for error/retry", scenes, run_duration_seconds: (Date.now() - started) / 1000 }, null, 2));

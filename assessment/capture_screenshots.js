import puppeteer from "../web/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyX2lkIjoxLCJyb2xlIjoiYWRtaW4iLCJzY2hlbWUiOiJ0ZXN0LWNvcnAiLCJleHAiOjE3OTQxNTk0MDl9.yV7Bq6xACPEfpDO03qti7LyM9hN1qy4ne8O0xeEDKn0";
const INVITE_TOKEN = "198ea090fdd8cba0540bbd8a24378771898a19c1de7b4eb56c7d0c6d5df1680d";

async function capture() {
  console.log("Launching Chrome...");
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 });

  // Pre-seed localStorage with auth token
  await page.goto("http://localhost:5173/", { waitUntil: "networkidle0" });
  await page.evaluate((tok) => {
    localStorage.setItem("auth_token", tok);
  }, TOKEN);

  // 1. Candidate Interview Pre-start with UU PDP Consent Banner
  console.log("Capturing 01_interview_pdp_consent.png...");
  await page.goto(`http://localhost:5173/interview/${INVITE_TOKEN}`, { waitUntil: "networkidle0" });
  await page.waitForSelector("button", { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({
    path: path.join(__dirname, "screenshots/01_interview_pdp_consent.png"),
    fullPage: false,
  });

  // 2. Portfolio Results with Assessor Override & Unassessed Skill
  console.log("Capturing 02_portfolio_results.png...");
  await page.goto("http://localhost:5173/assessments/2/sessions/2/portfolio", { waitUntil: "networkidle0" });
  await page.waitForSelector("h1", { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({
    path: path.join(__dirname, "screenshots/02_portfolio_results.png"),
    fullPage: true,
  });

  // 3. Fit/Gap Report with Readiness Scorecard & Comparison Table
  console.log("Capturing 03_fitgap_report.png...");
  await page.goto("http://localhost:5173/assessments/2/sessions/2/fitgap/1", { waitUntil: "networkidle0" });
  await page.waitForSelector("table", { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({
    path: path.join(__dirname, "screenshots/03_fitgap_report.png"),
    fullPage: true,
  });

  // 4. Assessment Edit Page with Language and B7 Taxonomy
  console.log("Capturing 04_assessment_edit.png...");
  await page.goto("http://localhost:5173/assessments/2/edit", { waitUntil: "networkidle0" });
  await page.waitForSelector("input#name", { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({
    path: path.join(__dirname, "screenshots/04_assessment_edit.png"),
    fullPage: true,
  });

  // 5. Mobile Responsive View for Fit/Gap
  console.log("Capturing 05_mobile_responsive_fitgap.png...");
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true });
  await page.goto("http://localhost:5173/assessments/2/sessions/2/fitgap/1", { waitUntil: "networkidle0" });
  await page.waitForSelector("table", { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({
    path: path.join(__dirname, "screenshots/05_mobile_responsive_fitgap.png"),
    fullPage: true,
  });

  console.log("All screenshots captured successfully!");
  await browser.close();
}

capture().catch((err) => {
  console.error("Capture failed:", err);
  process.exit(1);
});

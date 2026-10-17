import { test, expect } from "@playwright/test";
import { loginAsAssessor } from "./helpers/auth";

test.describe("Candidate Portfolio, Human Override, Fit/Gap Report, and Transcript Flow", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAssessor(page);
  });

  test("should display candidate competency dossier and verbatim quotes on Portfolio page", async ({ page }) => {
    await page.goto("/assessments/2/sessions/2/portfolio");

    // Check Header and compact HeroBanner
    await expect(page.getByText(/Hasil Bukti Kompetensi/i)).toBeVisible();
    await expect(page.getByText("James Rodri", { exact: true })).toBeVisible();
    await expect(page.getByText(/Candidate Competency Dossier/i)).toBeVisible();

    // Verify skills evaluated by AI
    await expect(page.getByText("QA Automation")).toBeVisible();
    await expect(page.getByText("API Testing")).toBeVisible();

    // Verify verbatim quote evidence
    await expect(page.getByText(/Playwright regression suite/i).first()).toBeVisible();
  });

  test("should perform Assessor Human Override with justification notes (UU PDP Compliance)", async ({ page }) => {
    await page.goto("/assessments/2/sessions/2/portfolio");

    // Click Override rating or Edit override button on first skill
    const overrideBtn = page.getByRole("button", { name: /Override rating|Edit override/i }).first();
    await expect(overrideBtn).toBeVisible();
    await overrideBtn.click();

    // Panel expands inline with rating options
    await expect(page.getByText("Your rating:")).toBeVisible();

    // Change level to L5
    await page.getByLabel("L5").click();

    // Input mandatory justification notes required by UU PDP audit standard
    const reasonInput = page.locator("textarea[placeholder*='Add context']");
    await reasonInput.fill("Kandidat menunjukkan bukti pemahaman CI/CD pipeline automation level lanjut.");

    // Save override
    await page.getByRole("button", { name: /Save override/i }).click();

    // Verify successful override indicator badge appears
    await expect(page.getByText(/You Overridden/i).first()).toBeVisible();
  });

  test("should display complete verbatim conversation turns on Transcript page", async ({ page }) => {
    await page.goto("/assessments/2/sessions/2/transcript");

    // Header and download button
    await expect(page.getByText(/Detail Percakapan/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Download .txt/i })).toBeVisible();

    // Check conversation turns
    await expect(page.getByText(/Selamat datang di sesi technical assessment Rakamin/i)).toBeVisible();
    await expect(page.getByText(/Playwright dan TypeScript/i)).toBeVisible();
  });

  test("should display Fit/Gap evaluation report with delta skill matrix and culture narrative", async ({ page }) => {
    await page.goto("/assessments/1/sessions/1/fitgap/1");

    // Header and role benchmark
    await expect(page.getByText(/Detail Laporan Fit\/Gap/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: /Senior Backend Engineer/i })).toBeVisible();

    // Delta skill comparison statuses
    await expect(page.getByText(/Node\.js \/ Backend Development/i).first()).toBeVisible();
    await expect(page.getByText(/System Design & Architecture/i).first()).toBeVisible();

    // Culture fit narrative synthesis
    await expect(page.getByText(/Evaluasi Budaya Kerja & Rekomendasi/i).or(page.getByText(/Culture Fit/i)).first()).toBeVisible();

    // Export PDF & CSV triggers
    await expect(page.getByRole("button", { name: /Export PDF/i })).toBeVisible();
  });
});

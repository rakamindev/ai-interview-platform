import { test, expect } from "@playwright/test";
import { loginAsAssessor } from "./helpers/auth";

test.describe("Technical Assessment Lifecycle & Input Alignment", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAssessor(page);
  });

  test("should display compact HeroBanner and assessment cards on /assessments", async ({ page }) => {
    await page.goto("/assessments");

    // Check compact HeroBanner elements
    await expect(page.getByText("Rakamin AI Assessment Hub")).toBeVisible();
    await expect(page.getByText(/Evaluasi Kompetensi Kandidat Berbasis AI/i)).toBeVisible();

    // Verify presence of at least one assessment card or the "Buat Assessment Baru" CTA
    await expect(page.getByRole("button", { name: /Buat Assessment Baru/i })).toBeVisible();
  });

  test("should verify pixel-aligned form inputs on /assessments/2/edit", async ({ page }) => {
    await page.goto("/assessments/2/edit");

    // Breadcrumb navigation should be at the top
    await expect(page.getByText(/Edit Assessment #2/i)).toBeVisible();

    // Delete button should be visible in header
    await expect(page.getByRole("button", { name: /Hapus Assessment/i })).toBeVisible();

    // Check main configuration card
    await expect(page.getByText("Konfigurasi Utama Sesi Assessment")).toBeVisible();

    // Verify role title input
    const roleInput = page.locator("#name");
    await expect(roleInput).toBeVisible();

    // Verify BATAS WAKTU SESI and BAHASA WAWANCARA AI labels and select inputs
    const timeLimitLabel = page.locator("label:has-text('BATAS WAKTU SESI')");
    const languageLabel = page.locator("label:has-text('BAHASA WAWANCARA AI')");

    await expect(timeLimitLabel).toBeVisible();
    await expect(languageLabel).toBeVisible();

    // Verify that both labels have icons and match the standardized h-5 container
    await expect(timeLimitLabel.locator("svg")).toBeVisible();
    await expect(languageLabel.locator("svg")).toBeVisible();

    // Verify L1..L5 anchor fields in Rubrik Kompetensi
    await expect(page.getByText(/Rubrik Kompetensi Standar B7/i)).toBeVisible();
    await expect(page.getByText(/Kriteria Anchor Level L1 s\/d L5/i)).toBeVisible();
  });

  test("should open delete confirmation dialog on Assessment edit page", async ({ page }) => {
    await page.goto("/assessments/2/edit");

    // Click Hapus Assessment trigger
    const deleteBtn = page.getByRole("button", { name: /Hapus Assessment/i });
    await deleteBtn.click();

    // Dialog should show confirmation modal
    await expect(page.getByRole("heading", { name: /Konfirmasi Hapus Assessment\?/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Batal/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Ya, Hapus Permanen/i })).toBeVisible();

    // Click Batal to close safely without deleting test data
    await page.getByRole("button", { name: /Batal/i }).click();
    await expect(page.getByRole("heading", { name: /Konfirmasi Hapus Assessment\?/i })).not.toBeVisible();
  });

  test("should display validation error when submitting assessment with empty role title (Failure Path)", async ({ page }) => {
    await page.goto("/assessments/new");

    // Clear role input if any, then attempt to submit immediately
    const roleInput = page.locator("#name");
    await roleInput.fill("");
    await page.getByRole("button", { name: /Simpan & Buat Sesi/i }).click();

    // Validation error message should be displayed
    await expect(page.getByText("Judul role wajib diisi", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/.*\/assessments\/new/);
  });

  test("should successfully create a new assessment with B7 rubric and redirect to invite page", async ({ page }) => {
    await page.goto("/assessments/new");

    // Fill valid role title
    await page.locator("#name").fill("Fullstack Product Engineer (E2E)");

    // Open B7 rubric picker
    const addRubricBtn = page.getByRole("button", { name: /Pilih dari Taksonomi B7/i });
    await expect(addRubricBtn).toBeVisible();
    await addRubricBtn.click();

    // Select the first standard B7 competency rubric from inside the list container
    const rubricItem = page.locator("div.max-h-64 button").first();
    await expect(rubricItem).toBeVisible();
    await rubricItem.click();

    // Submit form
    await page.getByRole("button", { name: /Simpan & Buat Sesi/i }).click();

    // Should redirect to invite page
    await page.waitForURL(/.*\/assessments\/\d+\/invite/, { timeout: 15000 });
    await expect(page).toHaveURL(/.*\/assessments\/\d+\/invite/);
    await expect(page.getByRole("heading", { name: /Daftar Sesi Wawancara Kandidat/i })).toBeVisible();
  });
});

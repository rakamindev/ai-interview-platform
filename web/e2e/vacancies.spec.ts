import { test, expect } from "@playwright/test";
import { loginAsAssessor } from "./helpers/auth";

test.describe("Role Vacancies and Category Filtering Flow", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAssessor(page);
  });

  test("should render Vacancies list with compact HeroBanner and Category Filter Pills", async ({ page }) => {
    await page.goto("/vacancies");

    // Compact HeroBanner
    await expect(page.getByText(/Explore Job Opportunities/i)).toBeVisible();

    // Category filter pills
    await expect(page.getByRole("button", { name: /Semua Kategori/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Engineering/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Product/i })).toBeVisible();

    // Search bar
    const searchInput = page.locator("input[placeholder*='Cari berdasarkan judul']");
    await expect(searchInput).toBeVisible();

    // Verify presence of vacancy cards
    await expect(page.getByText(/Senior QA Analyst/i)).toBeVisible();
  });

  test("should filter vacancy cards when clicking category filter pills", async ({ page }) => {
    await page.goto("/vacancies");

    // Click Engineering category
    const engBtn = page.getByRole("button", { name: /Engineering/i });
    await engBtn.click();

    // Senior QA Analyst should still be visible because QA is an Engineering keyword
    await expect(page.getByText(/Senior QA Analyst/i)).toBeVisible();

    // Clear filter by clicking "Semua Kategori"
    const allBtn = page.getByRole("button", { name: /Semua Kategori/i });
    await allBtn.click();
    await expect(page.getByText(/Senior QA Analyst/i)).toBeVisible();
  });

  test("should open delete confirmation modal on Vacancy edit page", async ({ page }) => {
    await page.goto("/vacancies/2/edit");

    // Breadcrumb and Delete button should be visible at top
    await expect(page.getByText(/Edit Lowongan #2/i)).toBeVisible();
    const deleteBtn = page.getByRole("button", { name: /Hapus Lowongan/i });
    await expect(deleteBtn).toBeVisible();

    // Click delete trigger
    await deleteBtn.click();

    // Modal dialog confirmation
    await expect(page.getByRole("heading", { name: /Konfirmasi Hapus Lowongan\?/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Batal/i })).toBeVisible();

    // Dismiss dialog safely
    await page.getByRole("button", { name: /Batal/i }).click();
    await expect(page.getByRole("heading", { name: /Konfirmasi Hapus Lowongan\?/i })).not.toBeVisible();
  });

  test("should display empty search state when query has no matching roles (Negative Path)", async ({ page }) => {
    await page.goto("/vacancies");

    const searchInput = page.locator("input[placeholder*='Cari berdasarkan judul']");
    await searchInput.fill("XYZNonExistentKeyword999");

    // Empty state heading and guidance should be visible
    await expect(page.getByText("Tidak ada role yang cocok")).toBeVisible();
    await expect(page.getByText("Coba ubah kata kunci pencarian Anda.")).toBeVisible();
  });

  test("should display validation error when submitting new vacancy with empty title (Failure Path)", async ({ page }) => {
    await page.goto("/vacancies/new");

    // Clear role title input if any, then attempt submit
    const roleInput = page.locator("#role_title");
    await roleInput.fill("");
    await page.getByRole("button", { name: /Simpan Lowongan/i }).click();

    // Required validation error must be displayed
    await expect(page.getByText("Judul lowongan wajib diisi", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/.*\/vacancies\/new/);
  });
});

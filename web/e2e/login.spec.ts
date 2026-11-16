import { test, expect } from "@playwright/test";

const API = "**/api/v1";

test("login redirects to the assessments list", async ({ page }) => {
  await page.route(`${API}/auth/login`, (route) =>
    route.fulfill({ json: { data: { token: "e2e-token" } } })
  );
  // Whatever the assessments page loads on mount: return an empty envelope.
  await page.route(`${API}/**`, (route) => route.fulfill({ json: { data: [] } }));

  await page.goto("/login");
  await page.getByLabel("Email").fill("a@b.co");
  await page.getByLabel("Password").fill("pw123456");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/assessments/);
});

test("shows an error on bad credentials", async ({ page }) => {
  await page.route(`${API}/auth/login`, (route) => route.fulfill({ status: 500, json: {} }));
  await page.goto("/login");
  await page.getByLabel("Email").fill("a@b.co");
  await page.getByLabel("Password").fill("wrong");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Invalid email or password.")).toBeVisible();
});

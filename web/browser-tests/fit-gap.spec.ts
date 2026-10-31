import { expect, test } from "@playwright/test";

const baseRow = {
  vacancy_skill_id: 1,
  skill_id: "react",
  skill_label: "React",
  expected_level: 3,
  candidate_level: 4,
  result: "exceed",
  delta: 1,
  reason: null,
  rating_source: "assessor",
  is_override: true,
  confidence: "high",
};
const rows = [
  baseRow,
  {
    ...baseRow,
    vacancy_skill_id: 2,
    skill_label: "Testing",
    candidate_level: 2,
    result: "gap",
    delta: -1,
    rating_source: "ai",
    is_override: false,
    confidence: "low",
  },
  {
    ...baseRow,
    vacancy_skill_id: 3,
    skill_label: "System design",
    candidate_level: null,
    delta: null,
    result: "not_assessed",
    reason: "missing_skill",
    rating_source: null,
    confidence: null,
    is_override: false,
  },
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("auth_token", "synthetic-browser-contract-fixture"),
  );
  await page.route("**/api/v1/sessions/1/portfolio", (route) =>
    route.fulfill({
      json: {
        portfolio: {
          id: 1,
          generation_status: "complete",
          skills: [],
          overrides: [],
        },
      },
    }),
  );
  await page.route("**/api/v1/portfolios/1/fitgap/2", (route) =>
    route.fulfill({
      json: {
        report: {
          id: 1,
          portfolio_id: 1,
          vacancy_id: 2,
          role_title: "Frontend Engineer (synthetic fixture)",
          generated_at: "2026-10-28T12:00:00Z",
          comparison_method: "deterministic_v1",
          skill_comparisons: rows,
        },
      },
    }),
  );
});

test("renders the real API contract and every review control", async ({
  page,
}) => {
  await page.goto("/assessments/1/sessions/1/fitgap/2");
  await expect(page.getByText("2 of 3 requirements assessed")).toBeVisible();
  await expect(
    page.getByText("Assessor override", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Needs follow-up (2)" }).click();
  await expect(page.getByRole("rowheader", { name: /React/ })).toHaveCount(0);
  await page.getByRole("button", { name: "All (3)" }).click();
  await page.getByText("How this comparison works").click();
  await expect(page.getByText(/No model is called/)).toBeVisible();
  await page.getByRole("button", { name: "Refresh comparison" }).click();
  await expect(page.getByText("2 of 3 requirements assessed")).toBeVisible();
  await page.route("**/api/v1/portfolios/1/export?**", (route) =>
    route.fulfill({ status: 503, json: { error: "synthetic export failure" } }),
  );
  await page.getByRole("button", { name: "Export PDF" }).click();
  await expect(page.getByRole("alert")).toContainText("export failed");
  await page.getByRole("button", { name: "Export JSON" }).click();
  await expect(page.getByRole("button", { name: "Export JSON" })).toBeEnabled();
  await expect(
    page.getByRole("link", { name: "Back to portfolio" }),
  ).toHaveAttribute("href", "/assessments/1/sessions/1/portfolio");
  await expect(
    page.getByRole("link", { name: "Review interview transcript" }),
  ).toHaveAttribute("href", "/assessments/1/sessions/1/transcript");
});

for (const width of [320, 390, 768, 1280]) {
  test("reflows long labels at " + width + "px", async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route("**/api/v1/portfolios/1/fitgap/2", (route) =>
      route.fulfill({
        json: {
          report: {
            id: 1,
            vacancy_id: 2,
            role_title: "Synthetic role " + "LongUnbrokenRoleLabel".repeat(10),
            generated_at: "2026-10-28T12:00:00Z",
            skill_comparisons: [
              { ...baseRow, skill_label: "LongUnbrokenSkillLabel".repeat(15) },
              ...rows.slice(1),
            ],
          },
        },
      }),
    );
    await page.goto("/assessments/1/sessions/1/fitgap/2");
    await expect(page.getByText("2 of 3 requirements assessed")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
}

test("provides a keyboard-operable retry for errors without automatic requeue", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/api/v1/portfolios/1/fitgap/2", (route) => {
    calls++;
    return route.fulfill({ status: 500, json: {} });
  });
  await page.goto("/assessments/1/sessions/1/fitgap/2");
  await expect(page.getByRole("alert")).toBeVisible();
  const retry = page.getByRole("button", { name: "Retry comparison" });
  await retry.focus();
  expect(calls).toBe(1);
  await Promise.all([
    page.waitForResponse("**/api/v1/portfolios/1/fitgap/2"),
    page.keyboard.press("Enter"),
  ]);
  await expect(page.getByRole("alert")).toBeVisible();
  expect(calls).toBe(2);
});

test("shows a purposeful empty state", async ({ page }) => {
  await page.route("**/api/v1/portfolios/1/fitgap/2", (route) =>
    route.fulfill({
      json: {
        report: {
          id: 1,
          vacancy_id: 2,
          role_title: "Synthetic empty vacancy",
          generated_at: "2026-10-28T12:00:00Z",
          skill_comparisons: [],
        },
      },
    }),
  );
  await page.goto("/assessments/1/sessions/1/fitgap/2");
  await expect(
    page.getByText("No skill requirements configured"),
  ).toBeVisible();
});

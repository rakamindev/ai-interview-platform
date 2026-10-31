import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import FitGapReportPage from "./FitGapReportPage";
import { sessionsApi } from "@/services/sessions";
import { portfoliosApi } from "@/services/portfolios";

vi.mock("@/services/sessions", () => ({
  sessionsApi: { getPortfolio: vi.fn() },
}));
vi.mock("@/services/portfolios", () => ({
  portfoliosApi: {
    getFitGap: vi.fn(),
    exportPortfolio: vi.fn(),
    triggerFitGap: vi.fn(),
  },
}));
const report = {
  id: 1,
  vacancy_id: 2,
  role_title: "Frontend Engineer",
  generated_at: "2026-10-28T00:00:00Z",
  skill_comparisons: [
    {
      vacancy_skill_id: 1,
      skill_label: "React",
      expected_level: 3,
      candidate_level: null,
      delta: null,
      result: "not_assessed",
      reason: "missing_skill",
      rating_source: null,
      confidence: null,
    },
  ],
};

function openPage(path = "/assessments/1/sessions/1/fitgap/2") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/assessments/:id/sessions/:sessionId/fitgap/:vacancyId"
          element={<FitGapReportPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.mocked(sessionsApi.getPortfolio).mockResolvedValue({
    data: { portfolio: { id: 1, generation_status: "complete" } },
  } as any);
  vi.mocked(portfoliosApi.getFitGap).mockResolvedValue({
    data: { report },
  } as any);
});

describe("FitGapReportPage", () => {
  it("announces loading then distinguishes missing assessment from a gap", async () => {
    openPage();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading skill comparison",
    );
    expect(
      await screen.findByText("0 of 1 requirements assessed"),
    ).toBeVisible();
    expect(
      screen.getByText(
        "0 meet or exceed requirements · 0 below requirement · 1 not assessed",
      ),
    ).toBeVisible();
    expect(
      screen.getByText(/Skill levels alone do not establish culture fit/),
    ).toBeVisible();
  });

  it("shows errors and retries on request without creating jobs or polling", async () => {
    vi.mocked(portfoliosApi.getFitGap).mockRejectedValueOnce({
      response: { status: 404 },
    });
    const user = userEvent.setup();
    openPage();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "could not load",
    );
    expect(portfoliosApi.triggerFitGap).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Retry comparison" }));
    expect(
      await screen.findByText("0 of 1 requirements assessed"),
    ).toBeVisible();
    expect(portfoliosApi.getFitGap).toHaveBeenCalledTimes(2);
  });

  it("explains when the portfolio is not ready", async () => {
    vi.mocked(sessionsApi.getPortfolio).mockResolvedValueOnce({
      data: { status: "generating" },
    } as any);
    openPage();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "portfolio is not ready",
    );
    expect(portfoliosApi.getFitGap).not.toHaveBeenCalled();
  });

  it("validates route IDs before requesting data", async () => {
    openPage("/assessments/1/sessions/invalid/fitgap/2");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "link is invalid",
    );
    expect(sessionsApi.getPortfolio).not.toHaveBeenCalled();
  });

  it("keeps the report visible after an export fails and re-enables the action", async () => {
    vi.mocked(portfoliosApi.exportPortfolio).mockRejectedValueOnce(
      new Error("offline"),
    );
    const user = userEvent.setup();
    openPage();
    await screen.findByText("0 of 1 requirements assessed");
    await user.click(screen.getByRole("button", { name: "Export PDF" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("export failed");
    expect(screen.getByText("0 of 1 requirements assessed")).toBeVisible();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Export PDF" })).toBeEnabled(),
    );
  });
});

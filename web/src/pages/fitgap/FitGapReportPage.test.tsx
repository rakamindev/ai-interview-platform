import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { AxiosResponse } from "axios";

import FitGapReportPage from "./FitGapReportPage";
import { portfoliosApi } from "@/services/portfolios";
import { sessionsApi } from "@/services/sessions";
import type { FitGapReport, Portfolio } from "@/types";

vi.mock("@/services/portfolios", () => ({
  portfoliosApi: {
    getFitGap: vi.fn(),
    triggerFitGap: vi.fn(),
    regenerateFitGap: vi.fn(),
    exportPortfolio: vi.fn(),
  },
}));

vi.mock("@/services/sessions", () => ({
  sessionsApi: { getPortfolio: vi.fn() },
}));

vi.mock("@/hooks/usePolling", () => ({
  usePolling: vi.fn(),
}));

const getPortfolio = vi.mocked(sessionsApi.getPortfolio);
const getFitGap = vi.mocked(portfoliosApi.getFitGap);
const triggerFitGap = vi.mocked(portfoliosApi.triggerFitGap);

const portfolio: Portfolio = {
  id: 2,
  session_id: 3,
  generation_status: "complete",
  skills: [],
  overrides: [],
};

const report: FitGapReport = {
  id: 1,
  portfolio_id: 2,
  vacancy_id: 2,
  skill_comparisons: [
    {
      skill_label: "React / Frontend Development Core",
      expected_level: 3,
      candidate_level: 3,
      result: "match",
      delta: 0,
      is_override: false,
    },
  ],
  culture_narrative: "Solid culture fit.",
  overall_narrative: "Solid overall fit.",
  generated_at: "2026-10-16T12:00:00Z",
};

function axiosError(status: number) {
  return { isAxiosError: true, response: { status } };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/assessments/1/sessions/3/fitgap/2"]}>
      <Routes>
        <Route
          path="/assessments/:id/sessions/:sessionId/fitgap/:vacancyId"
          element={<FitGapReportPage />}
        />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  getPortfolio.mockResolvedValue({
    data: { portfolio },
  } as AxiosResponse<{ portfolio: Portfolio } | { status: string }>);
});

afterEach(() => {
  cleanup();
});

describe("FitGapReportPage failure handling", () => {
  it("surfaces load failures and recovers on retry", async () => {
    getFitGap.mockRejectedValueOnce(axiosError(500));

    renderPage();

    expect(await screen.findByText(/couldn't load the fit\/gap report/i)).toBeInTheDocument();

    getFitGap.mockResolvedValueOnce({ data: { report } } as AxiosResponse<{ report: FitGapReport }>);
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));

    expect(await screen.findByText("Skill Comparison")).toBeInTheDocument();
    expect(screen.queryByText(/couldn't load/i)).not.toBeInTheDocument();
  });

  it("surfaces trigger failures when the report is missing", async () => {
    getFitGap.mockRejectedValue(axiosError(404));
    triggerFitGap.mockRejectedValueOnce(new Error("Network Error"));

    renderPage();

    expect(await screen.findByText(/couldn't start generating/i)).toBeInTheDocument();
  });
});

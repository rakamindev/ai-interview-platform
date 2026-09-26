import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import FitGapReportPage from "./FitGapReportPage";
import { portfoliosApi } from "@/services/portfolios";
import { sessionsApi } from "@/services/sessions";

vi.mock("@/services/portfolios", () => ({
  portfoliosApi: {
    getFitGap: vi.fn(),
    triggerFitGap: vi.fn(),
    regenerateFitGap: vi.fn(),
    exportPortfolio: vi.fn(),
  },
}));
vi.mock("@/services/sessions", () => ({ sessionsApi: { getPortfolio: vi.fn() } }));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/assessments/1/sessions/2/fitgap/3"]}>
      <Routes>
        <Route path="/assessments/:id/sessions/:sessionId/fitgap/:vacancyId" element={<FitGapReportPage />} />
      </Routes>
    </MemoryRouter>
  );
}

const failedReport = {
  id: 9, portfolio_id: 5, vacancy_id: 3, skill_comparisons: [],
  culture_narrative: "", overall_narrative: "", generated_at: "", status: "failed",
  error: "Generation failed (StandardError)",
};

describe("FitGapReportPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(sessionsApi.getPortfolio).mockResolvedValue({
      data: { portfolio: { id: 5, generation_status: "complete", skills: [] } },
    } as any);
  });

  // Regression: a fit/gap job that exhausted its retries used to leave the
  // page on "Generating..." forever with no way out.
  it("shows a failed state with a retry button instead of spinning forever", async () => {
    vi.mocked(portfoliosApi.getFitGap).mockResolvedValue({ data: { report: failedReport } } as any);

    renderPage();

    expect(await screen.findByText("Fit/gap report couldn't be generated")).toBeInTheDocument();
    expect(screen.queryByText("Generating fit/gap report...")).not.toBeInTheDocument();
  });

  it("retry re-queues generation and goes back to the generating state", async () => {
    vi.mocked(portfoliosApi.getFitGap).mockResolvedValue({ data: { report: failedReport } } as any);
    vi.mocked(portfoliosApi.regenerateFitGap).mockResolvedValue({ data: {} } as any);

    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: /try again/i }));

    await waitFor(() => expect(portfoliosApi.regenerateFitGap).toHaveBeenCalledWith(5, 3));
    expect(await screen.findByText("Generating fit/gap report...")).toBeInTheDocument();
  });
});

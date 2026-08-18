import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FitGapReportPage from "@/pages/fitgap/FitGapReportPage";
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
  sessionsApi: {
    getPortfolio: vi.fn(),
  },
}));

vi.mock("@/hooks/usePolling", () => ({
  usePolling: vi.fn(),
}));

const portfolio: Portfolio = {
  id: 5,
  session_id: 99,
  generation_status: "complete",
  skills: [
    { id: 1, skill_label: "React", is_discovered: false } as never,
    { id: 2, skill_label: "Leadership", is_discovered: true, ai_level: 3, ai_confidence: "high" } as never,
  ],
  overrides: [],
};

const report: FitGapReport = {
  id: 1,
  portfolio_id: 5,
  vacancy_id: 7,
  skill_comparisons: [
    { skill_label: "React", expected_level: 3, candidate_level: 4, result: "exceed", delta: 1 },
  ],
  culture_narrative: "Strong culture fit with the team values.",
  overall_narrative: "Overall a strong candidate.",
  generated_at: "2026-08-01T00:00:00Z",
};

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/assessments/1/sessions/99/fitgap/7"]}>
      <Routes>
        <Route
          path="/assessments/:id/sessions/:sessionId/fitgap/:vacancyId"
          element={<FitGapReportPage />}
        />
      </Routes>
    </MemoryRouter>
  );
}

describe("FitGapReportPage", () => {
  beforeEach(() => {
    vi.mocked(portfoliosApi.getFitGap).mockReset();
    vi.mocked(portfoliosApi.triggerFitGap).mockReset();
    vi.mocked(portfoliosApi.regenerateFitGap).mockReset();
    vi.mocked(portfoliosApi.exportPortfolio).mockReset();
    vi.mocked(sessionsApi.getPortfolio).mockReset();
  });

  it("shows a loading state before the portfolio resolves", () => {
    vi.mocked(sessionsApi.getPortfolio).mockReturnValueOnce(new Promise(() => {}) as never);

    const { container } = render(
      <MemoryRouter initialEntries={["/assessments/1/sessions/99/fitgap/7"]}>
        <Routes>
          <Route
            path="/assessments/:id/sessions/:sessionId/fitgap/:vacancyId"
            element={<FitGapReportPage />}
          />
        </Routes>
      </MemoryRouter>
    );

    expect(container.querySelectorAll('[class*="animate-pulse"]').length).toBeGreaterThan(0);
  });

  it("renders the skill comparison table and narrative on success", async () => {
    vi.mocked(sessionsApi.getPortfolio).mockResolvedValueOnce({ data: { portfolio } } as never);
    vi.mocked(portfoliosApi.getFitGap).mockResolvedValueOnce({ data: { report } } as never);

    renderPage();

    expect(await screen.findByText("Fit/Gap Report")).toBeInTheDocument();
    expect(await screen.findByText("React")).toBeInTheDocument();
    expect(screen.getByText(/strong culture fit/i)).toBeInTheDocument();
    expect(screen.getByText("Leadership")).toBeInTheDocument();
  });

  it("shows a generating state when no report exists yet (404) and triggers generation", async () => {
    vi.mocked(sessionsApi.getPortfolio).mockResolvedValueOnce({ data: { portfolio } } as never);
    vi.mocked(portfoliosApi.getFitGap).mockRejectedValueOnce({ response: { status: 404 } });
    vi.mocked(portfoliosApi.triggerFitGap).mockResolvedValueOnce({
      data: { status: "queued", message: "queued" },
    } as never);

    renderPage();

    expect(await screen.findByText(/generating fit\/gap report/i)).toBeInTheDocument();
    expect(portfoliosApi.triggerFitGap).toHaveBeenCalledWith(portfolio.id, 7);
  });

  it("regenerates the report when 'Regenerate' is clicked", async () => {
    vi.mocked(sessionsApi.getPortfolio).mockResolvedValueOnce({ data: { portfolio } } as never);
    vi.mocked(portfoliosApi.getFitGap).mockResolvedValueOnce({ data: { report } } as never);
    vi.mocked(portfoliosApi.regenerateFitGap).mockResolvedValueOnce({
      data: { status: "queued", message: "queued" },
    } as never);
    const user = userEvent.setup();

    renderPage();

    await screen.findByText("React");
    await user.click(screen.getByRole("button", { name: /regenerate/i }));

    expect(portfoliosApi.regenerateFitGap).toHaveBeenCalledWith(portfolio.id, 7);
    expect(await screen.findByText(/generating fit\/gap report/i)).toBeInTheDocument();
  });
});

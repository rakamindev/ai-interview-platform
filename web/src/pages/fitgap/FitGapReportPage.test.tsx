import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import FitGapReportPage from "./FitGapReportPage";

vi.mock("@/services/sessions", () => ({
  sessionsApi: {
    getPortfolio: vi.fn()
  }
}));
vi.mock("@/services/portfolios", () => ({
  portfoliosApi: {
    getFitGap: vi.fn(),
    triggerFitGap: vi.fn(),
    regenerateFitGap: vi.fn(),
    exportPortfolio: vi.fn()
  }
}));
vi.mock("@/hooks/usePolling", () => ({
  usePolling: vi.fn()
}));

import { sessionsApi } from "@/services/sessions";
import { portfoliosApi } from "@/services/portfolios";

const mockSessionsApi = vi.mocked(sessionsApi);
const mockPortfoliosApi = vi.mocked(portfoliosApi);

const mockPortfolio = {
  id: 5,
  session_id: 10,
  generation_status: "complete",
  skills: [],
  overrides: [],
  session: { id: 10, assessment_id: 1 }
} as any;

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/assessments/1/sessions/10/portfolio/fitgap/99"]}>
      <Routes>
        <Route
          path="/assessments/:id/sessions/:sessionId/portfolio/fitgap/:vacancyId"
          element={<FitGapReportPage />}
        />
        <Route
          path="/assessments/:id/sessions/:sessionId/portfolio"
          element={<div>Portfolio page</div>}
        />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("FitGapReportPage", () => {
  const baseReport = {
    id: 1,
    portfolio_id: 5,
    vacancy_id: 99,
    skill_comparisons: [],
    additional_strengths: [],
    culture_narrative: "Strong culture fit.",
    overall_narrative: "Recommended hire.",
    generated_at: "2026-01-01T00:00:00Z"
  };

  it("renders fallback warning banner when narrative_source is fallback", async () => {
    mockSessionsApi.getPortfolio.mockResolvedValue({
      data: { portfolio: mockPortfolio }
    } as any);
    mockPortfoliosApi.getFitGap.mockResolvedValue({
      data: { report: { ...baseReport, narrative_source: "fallback" } }
    } as any);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/AI narrative unavailable/)).toBeInTheDocument();
    });
  });

  it("does not render fallback banner when narrative_source is ai", async () => {
    mockSessionsApi.getPortfolio.mockResolvedValue({
      data: { portfolio: mockPortfolio }
    } as any);
    mockPortfoliosApi.getFitGap.mockResolvedValue({
      data: { report: { ...baseReport, narrative_source: "ai" } }
    } as any);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Strong culture fit.")).toBeInTheDocument();
    });
    expect(screen.queryByText(/AI narrative unavailable/)).not.toBeInTheDocument();
  });

  it("does not render fallback banner when narrative_source is null", async () => {
    mockSessionsApi.getPortfolio.mockResolvedValue({
      data: { portfolio: mockPortfolio }
    } as any);
    mockPortfoliosApi.getFitGap.mockResolvedValue({
      data: { report: { ...baseReport, narrative_source: null } }
    } as any);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Strong culture fit.")).toBeInTheDocument();
    });
    expect(screen.queryByText(/AI narrative unavailable/)).not.toBeInTheDocument();
  });
});

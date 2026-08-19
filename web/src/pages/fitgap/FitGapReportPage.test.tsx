import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithRoute } from "@/test/testUtils";
import FitGapReportPage from "./FitGapReportPage";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { portfoliosApi } from "@/services/portfolios";
import type { Portfolio, FitGapReport } from "@/types";

// Vacancy-context persistence (STEP 09): the Back link used to be a bare `<Link
// to="/portfolio">`, discarding which vacancy was selected — clicking it forced
// the assessor to re-pick the vacancy from scratch. It now carries the vacancy id
// (already in scope from the route param) back onto the portfolio URL.
vi.mock("@/services/sessions", () => ({
  sessionsApi: {
    get: vi.fn(),
    getPortfolio: vi.fn(),
  },
}));

vi.mock("@/services/vacancies", () => ({
  vacanciesApi: {
    get: vi.fn(),
  },
}));

vi.mock("@/services/portfolios", () => ({
  portfoliosApi: {
    getFitGap: vi.fn(),
    triggerFitGap: vi.fn(),
    regenerateFitGap: vi.fn(),
    exportPortfolio: vi.fn(),
  },
}));

function makePortfolio(overrides: Partial<Portfolio> = {}): Portfolio {
  return { id: 1, session_id: 2, generation_status: "complete", skills: [], overrides: [], ...overrides };
}

function makeReport(overrides: Partial<FitGapReport> = {}): FitGapReport {
  return {
    id: 10,
    portfolio_id: 1,
    vacancy_id: 3,
    skill_comparisons: [],
    culture_narrative: "Strong alignment with the team's collaborative style.",
    overall_narrative: "",
    generated_at: "2026-08-18T03:54:00Z",
    ...overrides,
  };
}

describe("FitGapReportPage — vacancy-context persistence", () => {
  beforeEach(() => {
    vi.mocked(sessionsApi.getPortfolio).mockReset();
    vi.mocked(sessionsApi.get).mockReset();
    vi.mocked(vacanciesApi.get).mockReset();
    vi.mocked(portfoliosApi.getFitGap).mockReset();
  });

  it("carries the vacancy id from the route back onto the portfolio URL on the Back link", async () => {
    vi.mocked(sessionsApi.getPortfolio).mockResolvedValue({ data: { portfolio: makePortfolio() } } as any);
    vi.mocked(sessionsApi.get).mockResolvedValue({
      data: { session: { id: 2, candidate_name: "Budi Santoso" } },
    } as any);
    vi.mocked(vacanciesApi.get).mockResolvedValue({
      data: { vacancy: { id: 3, role_title: "Flutter Engineer" } },
    } as any);
    vi.mocked(portfoliosApi.getFitGap).mockResolvedValue({ data: { report: makeReport() } } as any);

    renderWithRoute(<FitGapReportPage />, {
      path: "/assessments/:id/sessions/:sessionId/fitgap/:vacancyId",
      initialEntries: ["/assessments/1/sessions/2/fitgap/3"],
    });

    await screen.findByText("Fit/Gap Report");

    const backLink = document.querySelector('a[href*="/portfolio"]');
    expect(backLink).not.toBeNull();
    expect(backLink).toHaveAttribute("href", "/assessments/1/sessions/2/portfolio?vacancy=3");
  });
});

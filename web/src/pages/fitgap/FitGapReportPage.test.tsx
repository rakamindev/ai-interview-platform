import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FitGapReportPage from "@/pages/fitgap/FitGapReportPage";
import { portfoliosApi } from "@/services/portfolios";
import { sessionsApi } from "@/services/sessions";
import type { FitGapReport } from "@/types";

vi.mock("@/services/portfolios", () => ({
  portfoliosApi: { getFitGap: vi.fn(), triggerFitGap: vi.fn(), regenerateFitGap: vi.fn(), exportPortfolio: vi.fn() },
}));
vi.mock("@/services/sessions", () => ({ sessionsApi: { getPortfolio: vi.fn() } }));

const portfolio = { id: 7, generation_status: "complete", skills: [] };
const report = (over: Partial<FitGapReport> = {}): FitGapReport => ({
  id: 1,
  portfolio_id: 7,
  vacancy_id: 9,
  skill_comparisons: [{ skill_label: "React", required_level: 3, candidate_level: 2, result: "gap", delta: -1 }],
  summary: { total: 1, assessed: 1, match: 0, exceed: 0, gap: 1, not_assessed: 0, low_evidence: 0, overridden: 0, coverage_pct: 100 },
  culture_narrative: "Culture text",
  overall_narrative: "Overall text",
  narrative_status: "ready",
  generated_at: "2026-08-20T00:00:00Z",
  ...over,
});
const httpError = (status: number) => Object.assign(new Error("http"), { response: { status } });

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/assessments/1/sessions/2/fitgap/9"]}>
      <Routes>
        <Route path="/assessments/:id/sessions/:sessionId/fitgap/:vacancyId" element={<FitGapReportPage />} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(sessionsApi.getPortfolio).mockResolvedValue({ data: { portfolio } } as never);
});

describe("FitGapReportPage states", () => {
  it("renders the report with separate culture and overall sections", async () => {
    vi.mocked(portfoliosApi.getFitGap).mockResolvedValue({ data: { report: report() } } as never);
    renderPage();
    expect(await screen.findByText("Culture text")).toBeInTheDocument();
    expect(screen.getByText("Overall text")).toBeInTheDocument();
  });

  it("creates the report when none exists yet (404 then POST)", async () => {
    vi.mocked(portfoliosApi.getFitGap).mockRejectedValue(httpError(404));
    vi.mocked(portfoliosApi.triggerFitGap).mockResolvedValue({ data: { report: report() } } as never);
    renderPage();
    expect(await screen.findByText("Culture text")).toBeInTheDocument();
    expect(portfoliosApi.triggerFitGap).toHaveBeenCalledTimes(1);
  });

  it("shows the table immediately while the narrative is still updating", async () => {
    vi.mocked(portfoliosApi.getFitGap).mockResolvedValue({
      data: { report: report({ narrative_status: "pending", culture_narrative: null, overall_narrative: null }) },
    } as never);
    renderPage();
    expect(await screen.findByText("React")).toBeInTheDocument();
    expect(screen.getByText(/Updating/)).toBeInTheDocument();
  });

  it("tells the user when the AI summary failed and keeps the table", async () => {
    vi.mocked(portfoliosApi.getFitGap).mockResolvedValue({
      data: { report: report({ narrative_status: "failed", culture_narrative: null, overall_narrative: "Automatic summary unavailable." }) },
    } as never);
    renderPage();
    expect(await screen.findByText(/could not be generated/)).toBeInTheDocument();
    expect(screen.getByText("React")).toBeInTheDocument();
  });

  it("warns when nothing was assessed instead of implying a weak candidate", async () => {
    vi.mocked(portfoliosApi.getFitGap).mockResolvedValue({
      data: {
        report: report({
          skill_comparisons: [{ skill_label: "React", required_level: 3, candidate_level: null, result: "not_assessed", delta: null }],
          summary: { total: 1, assessed: 0, match: 0, exceed: 0, gap: 0, not_assessed: 1, low_evidence: 0, overridden: 0, coverage_pct: 0 },
        }),
      },
    } as never);
    renderPage();
    expect(await screen.findByText(/says nothing/)).toBeInTheDocument();
  });

  it("offers a retry on a server error and recovers", async () => {
    vi.mocked(portfoliosApi.getFitGap)
      .mockRejectedValueOnce(httpError(500))
      .mockResolvedValue({ data: { report: report() } } as never);
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Culture text")).toBeInTheDocument();
  });

  it("shows a pending state when the portfolio is still generating", async () => {
    vi.mocked(sessionsApi.getPortfolio).mockResolvedValue({ data: { status: "generating" } } as never);
    renderPage();
    expect(await screen.findByText(/portfolio is not ready yet/)).toBeInTheDocument();
    expect(portfoliosApi.getFitGap).not.toHaveBeenCalled();
  });

  it("shows an error when the portfolio request fails", async () => {
    vi.mocked(sessionsApi.getPortfolio).mockRejectedValue(httpError(500));
    renderPage();
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/load this candidate/));
  });
});

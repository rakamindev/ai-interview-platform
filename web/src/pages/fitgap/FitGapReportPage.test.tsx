import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FitGapReportPage from "./FitGapReportPage";
import { portfoliosApi } from "@/services/portfolios";
import { sessionsApi } from "@/services/sessions";
import type { FitGapReport } from "@/types";

vi.mock("@/services/portfolios", () => ({
  portfoliosApi: { getFitGap: vi.fn(), triggerFitGap: vi.fn(), regenerateFitGap: vi.fn(), exportPortfolio: vi.fn() },
}));
vi.mock("@/services/sessions", () => ({ sessionsApi: { getPortfolio: vi.fn() } }));

const api = vi.mocked(portfoliosApi);
const sessions = vi.mocked(sessionsApi);

// Synthetic report shaped exactly like the API response (assessment/02-strategy.md AC20–AC24).
function makeReport(overrides: Partial<FitGapReport> = {}): FitGapReport {
  return {
    id: 1, portfolio_id: 7, vacancy_id: 3, generated_at: "2026-10-24T00:00:00Z",
    status: "ready", narrative_source: "ai", error_message: null,
    culture_narrative: "Collaborative and clear.", overall_narrative: "Promising.",
    skill_comparisons: [
      { skill_label: "SQL", expected_level: 4, candidate_level: 4, result: "match", delta: 0 },
      { skill_label: "Go", expected_level: 3, candidate_level: 2, result: "gap", delta: -1, low_confidence: true },
      { skill_label: "Kubernetes", expected_level: 2, candidate_level: null, result: "not_assessed", delta: null },
    ],
    summary: { total: 3, assessed: 2, not_assessed: 1, coverage_pct: 67, match: 1, gap: 1, exceed: 0, low_confidence: 1 },
    ...overrides,
  };
}

const ok = <T,>(data: T) => Promise.resolve({ data } as never);
const httpError = (status: number) => Promise.reject({ response: { status, data: {} } });

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/assessments/1/sessions/9/fitgap/3"]}>
      <Routes>
        <Route path="/assessments/:id/sessions/:sessionId/fitgap/:vacancyId" element={<FitGapReportPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("FitGapReportPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    sessions.getPortfolio.mockReturnValue(ok({ portfolio: { id: 7, skills: [] } }));
  });
  afterEach(() => vi.useRealTimers());

  it("shows coverage and warns that unassessed skills are missing evidence (AC20)", async () => {
    api.getFitGap.mockReturnValue(ok({ report: makeReport() }));
    renderPage();

    expect(await screen.findByText("Assessed 2 of 3 required skills")).toBeInTheDocument();
    expect(screen.getByText("67% coverage")).toBeInTheDocument();
    expect(screen.getByText(/1 required skill was not covered/)).toBeInTheDocument();
  });

  it("labels a fallback narrative instead of presenting it as AI culture fit (AC22)", async () => {
    api.getFitGap.mockReturnValue(
      ok({ report: makeReport({ narrative_source: "fallback", culture_narrative: null, overall_narrative: "Automatic summary text" }) }),
    );
    renderPage();

    expect(await screen.findByText("AI summary unavailable")).toBeInTheDocument();
    expect(screen.queryByText("Culture & Competency Fit")).not.toBeInTheDocument();
  });

  it("polls with GET only while generating, never re-triggering generation (AC23)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    api.getFitGap.mockReturnValue(ok({ report: makeReport({ status: "generating", skill_comparisons: [] }) }));
    renderPage();

    expect(await screen.findByText("Generating fit/gap report...")).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });

    expect(api.getFitGap.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(api.triggerFitGap).not.toHaveBeenCalled();
  });

  it("shows a failed report with a working retry instead of spinning forever (AC24)", async () => {
    api.getFitGap.mockReturnValue(ok({ report: makeReport({ status: "failed", error_message: "Report generation failed. Please try again." }) }));
    api.regenerateFitGap.mockReturnValue(ok({ report: makeReport({ status: "generating", skill_comparisons: [] }) }));
    renderPage();

    expect(await screen.findByText("The report could not be generated")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));

    expect(api.regenerateFitGap).toHaveBeenCalledWith(7, 3);
    expect(await screen.findByText("Generating fit/gap report...")).toBeInTheDocument();
  });

  it("shows an error state, not a blank page, when the API errors (AC24)", async () => {
    api.getFitGap.mockReturnValue(httpError(500));
    renderPage();

    expect(await screen.findByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("starts generation once when no report exists yet (AC10)", async () => {
    api.getFitGap.mockReturnValue(httpError(404));
    api.triggerFitGap.mockReturnValue(ok({ report: makeReport({ status: "generating", skill_comparisons: [] }) }));
    renderPage();

    expect(await screen.findByText("Generating fit/gap report...")).toBeInTheDocument();
    expect(api.triggerFitGap).toHaveBeenCalledTimes(1);
  });

  it("shows an empty state for a vacancy without required skills (AC26)", async () => {
    api.getFitGap.mockReturnValue(
      ok({ report: makeReport({ skill_comparisons: [], summary: { total: 0, assessed: 0, not_assessed: 0, coverage_pct: 0, match: 0, gap: 0, exceed: 0, low_confidence: 0 } }) }),
    );
    renderPage();

    expect(await screen.findByText("This vacancy has no required skills")).toBeInTheDocument();
  });
});

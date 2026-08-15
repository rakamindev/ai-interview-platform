import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import FitGapReportPage from "../FitGapReportPage";
import { portfoliosApi } from "@/services/portfolios";
import type { FitGapReport, Portfolio } from "@/types";

vi.mock("@/services/portfolios", () => ({
  portfoliosApi: {
    getPortfolio: vi.fn(),
    getFitGap: vi.fn(),
    triggerFitGap: vi.fn(),
    regenerateFitGap: vi.fn(),
    exportPortfolio: vi.fn(),
  },
}));

const mocked = vi.mocked(portfoliosApi);

const portfolio = { id: 7, session_id: 3, generation_status: "complete", skills: [] } as unknown as Portfolio;

const report = {
  id: 1,
  portfolio_id: 7,
  vacancy_id: 9,
  narrative_status: "complete",
  culture_narrative: "Explains decisions in terms of constraints.",
  overall_narrative: "Strong fit.",
  generated_at: "2026-08-15T10:00:00Z",
  skill_comparisons: [
    {
      skill_label: "Distributed Systems",
      skill_id: "sk-1",
      required_level: 3,
      candidate_level: 3,
      ai_level: 3,
      override_level: null,
      is_override: false,
      confidence: "high",
      assessment_state: "assessed",
      result: "match",
      delta: 0,
      in_vacancy: true,
    },
  ],
} as unknown as FitGapReport;

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/assessments/1/sessions/3/fitgap/9"]}>
      <Routes>
        <Route path="/assessments/:id/sessions/:sessionId/fitgap/:vacancyId" element={<FitGapReportPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.useRealTimers());

describe("FitGapReportPage", () => {
  it("renders the report when it is ready", async () => {
    mocked.getPortfolio.mockResolvedValue(portfolio);
    mocked.getFitGap.mockResolvedValue(report);

    renderPage();

    expect(await screen.findByText("Skill Comparison")).toBeInTheDocument();
  });

  // The page had no error branch at all: a failed fetch was swallowed by a bare
  // `.finally`, leaving a header above blank space with nothing to act on.
  it("shows an error state with a retry when the portfolio fetch fails", async () => {
    mocked.getPortfolio.mockRejectedValue(new Error("Network unreachable"));

    renderPage();

    expect(await screen.findByText("This report could not be loaded")).toBeInTheDocument();
    expect(screen.getByText("Network unreachable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("recovers when the retry succeeds", async () => {
    mocked.getPortfolio.mockRejectedValueOnce(new Error("Network unreachable"));
    renderPage();
    await screen.findByText("This report could not be loaded");

    mocked.getPortfolio.mockResolvedValue(portfolio);
    mocked.getFitGap.mockResolvedValue(report);
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));

    expect(await screen.findByText("Skill Comparison")).toBeInTheDocument();
  });

  it("explains itself when the session has no portfolio yet", async () => {
    mocked.getPortfolio.mockResolvedValue(null);

    renderPage();

    expect(await screen.findByText("No portfolio for this session yet")).toBeInTheDocument();
  });

  it("does not present a failed narrative as a culture analysis", async () => {
    mocked.getPortfolio.mockResolvedValue(portfolio);
    mocked.getFitGap.mockResolvedValue({
      ...report,
      narrative_status: "failed",
      culture_narrative: null,
      overall_narrative: "Automated summary (narrative generation unavailable): 1 match.",
    } as FitGapReport);

    renderPage();

    expect(await screen.findByText("Narrative unavailable")).toBeInTheDocument();
    // The comparison is rule-based and must survive a model failure.
    expect(screen.getByText("Skill Comparison")).toBeInTheDocument();
  });

  it("stops polling and offers a way out instead of spinning forever", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mocked.getPortfolio.mockResolvedValue(portfolio);
    mocked.getFitGap.mockRejectedValue({ response: { status: 404 } });
    mocked.triggerFitGap.mockResolvedValue({} as never);

    renderPage();
    await screen.findByText(/generating fit\/gap report/i);

    // 24 attempts at 5s, then one more tick to trip the ceiling.
    await vi.advanceTimersByTimeAsync(5_000 * 26);

    await waitFor(() => expect(screen.getByText("This is taking longer than expected")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /check again/i })).toBeInTheDocument();
  });

  it("surfaces a failed regeneration rather than showing an unresolvable spinner", async () => {
    mocked.getPortfolio.mockResolvedValue(portfolio);
    mocked.getFitGap.mockResolvedValue(report);
    mocked.regenerateFitGap.mockRejectedValue(new Error("Queue is unavailable"));

    renderPage();
    await screen.findByText("Skill Comparison");

    await userEvent.click(screen.getByRole("button", { name: /regenerate/i }));

    expect(await screen.findByText("Queue is unavailable")).toBeInTheDocument();
  });
});

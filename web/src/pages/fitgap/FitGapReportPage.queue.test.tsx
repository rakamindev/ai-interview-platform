import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FitGapReportPage from "@/pages/fitgap/FitGapReportPage";
import { sessionsApi } from "@/services/sessions";
import { portfoliosApi } from "@/services/portfolios";

vi.mock("@/services/sessions", () => ({
  sessionsApi: { getPortfolio: vi.fn() },
}));

vi.mock("@/services/portfolios", () => ({
  portfoliosApi: {
    getFitGap: vi.fn(),
    triggerFitGap: vi.fn(),
    regenerateFitGap: vi.fn(),
    exportPortfolio: vi.fn(),
  },
}));

const PORTFOLIO = {
  id: 13,
  session_id: 14,
  generation_status: "complete",
  skills: [],
  overrides: [],
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/assessments/2/sessions/14/fitgap/2"]}>
      <Routes>
        <Route
          path="/assessments/:id/sessions/:sessionId/fitgap/:vacancyId"
          element={<FitGapReportPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("FitGapReportPage queue guard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.mocked(sessionsApi.getPortfolio).mockResolvedValue({
      data: { portfolio: PORTFOLIO },
    } as never);
    vi.mocked(portfoliosApi.getFitGap).mockRejectedValue({ response: { status: 404 } });
    vi.mocked(portfoliosApi.triggerFitGap).mockResolvedValue({ data: { status: "generating" } } as never);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("queues once and waits instead of spamming Gemini jobs while the report is absent", async () => {
    renderPage();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(portfoliosApi.triggerFitGap).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(15000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(portfoliosApi.triggerFitGap).toHaveBeenCalledTimes(1);
  });
});

import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AxiosError, AxiosHeaders } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import FitGapReportPage from "@/pages/fitgap/FitGapReportPage";
import { sessionsApi } from "@/services/sessions";
import { portfoliosApi } from "@/services/portfolios";
import type { Portfolio } from "@/types";

vi.mock("@/services/sessions", () => ({ sessionsApi: { getPortfolio: vi.fn() } }));
vi.mock("@/services/portfolios", () => ({
  portfoliosApi: { getFitGap: vi.fn(), triggerFitGap: vi.fn() },
}));

function httpError(status: number, message?: string) {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError("Request failed", "ERR_BAD_RESPONSE", config, null, {
    status,
    statusText: "",
    headers: {},
    config,
    data: message ? { errors: [{ message }] } : {},
  });
}

const portfolio = (generation_status: Portfolio["generation_status"]): Portfolio => ({
  id: 1,
  session_id: 3,
  generation_status,
  skills: [],
  overrides: [],
});

function mockPortfolio(p: Portfolio) {
  vi.mocked(sessionsApi.getPortfolio).mockResolvedValue({
    data: { portfolio: p },
  } as Awaited<ReturnType<typeof sessionsApi.getPortfolio>>);
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/assessments/7/sessions/3/fitgap/5"]}>
      <Routes>
        <Route
          path="/assessments/:id/sessions/:sessionId/fitgap/:vacancyId"
          element={<FitGapReportPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("FitGapReportPage", () => {
  beforeEach(() => {
    vi.mocked(portfoliosApi.getFitGap).mockReset();
    vi.mocked(portfoliosApi.triggerFitGap).mockReset();
  });

  it("explains why analysis cannot start before the portfolio is ready", async () => {
    mockPortfolio(portfolio("generating"));
    renderPage();

    expect(await screen.findByText(/The portfolio isn't ready yet/)).toBeInTheDocument();
    expect(portfoliosApi.getFitGap).not.toHaveBeenCalled();
  });

  it("shows why the analysis could not start instead of a blank page", async () => {
    mockPortfolio(portfolio("complete"));
    vi.mocked(portfoliosApi.getFitGap).mockRejectedValueOnce(httpError(404));
    vi.mocked(portfoliosApi.triggerFitGap).mockRejectedValueOnce(
      httpError(404, "Vacancy not found"),
    );
    renderPage();

    expect(await screen.findByText("Vacancy not found")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Retry/ })).toBeInTheDocument();
  });

  it("reports server errors while loading an existing report", async () => {
    mockPortfolio(portfolio("complete"));
    vi.mocked(portfoliosApi.getFitGap).mockRejectedValueOnce(httpError(500));
    renderPage();

    expect(await screen.findByText("Failed to load the fit/gap report.")).toBeInTheDocument();
    expect(portfoliosApi.triggerFitGap).not.toHaveBeenCalled();
  });
});

describe("FitGapReportPage generation polling", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("stops polling after 10 minutes and says the report is taking too long", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    mockPortfolio(portfolio("complete"));
    vi.mocked(portfoliosApi.getFitGap).mockReset().mockRejectedValue(httpError(404));
    vi.mocked(portfoliosApi.triggerFitGap)
      .mockReset()
      .mockResolvedValue({
        data: { status: "generating", message: "queued" },
      } as Awaited<ReturnType<typeof portfoliosApi.triggerFitGap>>);
    renderPage();
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(screen.getByText("Generating fit/gap report...")).toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(10 * 60 * 1000 + 5000));

    expect(screen.getByText(/taking longer than expected/)).toBeInTheDocument();
    const callsAtTimeout = vi.mocked(portfoliosApi.getFitGap).mock.calls.length;
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(portfoliosApi.getFitGap).toHaveBeenCalledTimes(callsAtTimeout);
  });
});

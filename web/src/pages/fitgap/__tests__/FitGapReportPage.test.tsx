import { render, screen, waitFor, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import FitGapReportPage, { isReportStale } from "../FitGapReportPage";
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

const portfolio = (status: Portfolio["generation_status"] = "complete"): Portfolio => ({
  id: 7,
  session_id: 3,
  generation_status: status,
  skills: [],
  overrides: [],
});

const report: FitGapReport = {
  skill_comparisons: [{ skill_label: "Ruby on Rails", required_level: 3, candidate_level: 3, result: "match", delta: 0 }],
  culture_narrative: "Collaborative and direct.",
  overall_narrative: "Recommend a second round.",
  generated_at: "2026-10-20T10:00:00Z",
} as FitGapReport;

const overrideAt = (overridden_at?: string) => ({
  id: 1, portfolio_skill_id: 1, ai_level: 2, override_level: 3, assessor_notes: "", overridden_at,
});

const notFound = () => Promise.reject({ response: { status: 404 } });

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/assessments/1/sessions/3/fitgap/9"]}>
      <Routes>
        <Route path="/assessments/:id/sessions/:sessionId/fitgap/:vacancyId" element={<FitGapReportPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("FitGapReportPage", () => {
  beforeEach(() => {
    vi.mocked(sessionsApi.getPortfolio).mockResolvedValue({ data: { portfolio: portfolio() } } as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("renders the comparison and narrative when the report exists", async () => {
    vi.mocked(portfoliosApi.getFitGap).mockResolvedValue({ data: { report } } as any);

    renderPage();

    expect((await screen.findAllByText("Ruby on Rails"))[0]).toBeInTheDocument();
    expect(screen.getByText("Collaborative and direct.")).toBeInTheDocument();
    expect(portfoliosApi.triggerFitGap).not.toHaveBeenCalled();
  });

  it("shows an error, not a blank page, when the portfolio cannot be loaded", async () => {
    vi.mocked(sessionsApi.getPortfolio).mockRejectedValue(new Error("Network Error"));

    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load the candidate portfolio");
  });

  it("explains why there is no report while the portfolio is still generating", async () => {
    vi.mocked(sessionsApi.getPortfolio).mockResolvedValue({ data: { portfolio: portfolio("generating") } } as any);

    renderPage();

    expect(await screen.findByText(/still being generated/)).toBeInTheDocument();
    expect(portfoliosApi.getFitGap).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /Regenerate/ })).not.toBeInTheDocument();
  });

  it("queues generation once on 404 and shows progress", async () => {
    vi.mocked(portfoliosApi.getFitGap).mockImplementation(notFound);
    vi.mocked(portfoliosApi.triggerFitGap).mockResolvedValue({ data: { status: "generating" } } as any);

    renderPage();

    expect(await screen.findByText(/Generating fit\/gap report/)).toBeInTheDocument();
    expect(portfoliosApi.triggerFitGap).toHaveBeenCalledTimes(1);
  });

  it("stops polling and offers a retry when generation never finishes", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(portfoliosApi.getFitGap).mockImplementation(notFound);
    vi.mocked(portfoliosApi.triggerFitGap).mockResolvedValue({ data: { status: "generating" } } as any);

    renderPage();
    await screen.findByText(/Generating fit\/gap report/);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2 * 60 * 1000 + 10_000);
    });

    expect(screen.getByRole("alert")).toHaveTextContent("taking longer than expected");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.queryByText(/Generating fit\/gap report/)).not.toBeInTheDocument();
    expect(portfoliosApi.triggerFitGap).toHaveBeenCalledTimes(1);
  });

  it("shows a retryable error when the report request fails for another reason", async () => {
    vi.mocked(portfoliosApi.getFitGap)
      .mockRejectedValueOnce({ response: { status: 500 } })
      .mockResolvedValueOnce({ data: { report } } as any);

    renderPage();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Could not load the fit/gap report");

    act(() => screen.getByRole("button", { name: "Try again" }).click());

    await waitFor(() => expect(screen.getAllByText("Ruby on Rails").length).toBeGreaterThan(0));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps the current report and explains when regenerate fails", async () => {
    vi.mocked(portfoliosApi.getFitGap).mockResolvedValue({ data: { report } } as any);
    vi.mocked(portfoliosApi.regenerateFitGap).mockRejectedValue(new Error("500"));

    renderPage();
    await screen.findAllByText("Ruby on Rails");

    act(() => screen.getByRole("button", { name: /Regenerate/ }).click());

    expect(await screen.findByRole("alert")).toHaveTextContent("Your current report is unchanged");
    expect(screen.getAllByText("Ruby on Rails").length).toBeGreaterThan(0);
  });

  it("warns that the report is stale when a rating was adjusted after it was generated", async () => {
    vi.mocked(sessionsApi.getPortfolio).mockResolvedValue({
      data: { portfolio: { ...portfolio(), overrides: [overrideAt("2026-10-21T09:00:00Z")] } },
    } as any);
    vi.mocked(portfoliosApi.getFitGap).mockResolvedValue({ data: { report } } as any);
    vi.mocked(portfoliosApi.regenerateFitGap).mockResolvedValue({ data: { status: "generating" } } as any);

    renderPage();

    expect(await screen.findByText(/A rating was overridden after this report was generated/)).toBeInTheDocument();
    act(() => screen.getByRole("button", { name: "Regenerate report" }).click());
    await waitFor(() => expect(portfoliosApi.regenerateFitGap).toHaveBeenCalledWith(7, 9));
  });
});

describe("isReportStale", () => {
  it("compares the newest override with the report time", () => {
    expect(isReportStale(report, [])).toBe(false);
    expect(isReportStale(report, [overrideAt("2026-10-19T09:00:00Z")])).toBe(false);
    expect(isReportStale(report, [overrideAt("2026-10-19T09:00:00Z"), overrideAt("2026-10-21T09:00:00Z")])).toBe(true);
    expect(isReportStale(report, [overrideAt(undefined)])).toBe(false);
    expect(isReportStale({ generated_at: "" }, [overrideAt("2026-10-21T09:00:00Z")])).toBe(false);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
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

const getFitGap = vi.mocked(portfoliosApi.getFitGap);
const triggerFitGap = vi.mocked(portfoliosApi.triggerFitGap);
const getPortfolio = vi.mocked(sessionsApi.getPortfolio);

const portfolio = (status = "complete") => ({
  data: { portfolio: { id: 7, session_id: 1, generation_status: status, skills: [], overrides: [] } },
});

const report = {
  data: {
    report: {
      id: 1, portfolio_id: 7, vacancy_id: 3,
      skill_comparisons: [{ skill_label: "React", expected_level: 4, candidate_level: 3, result: "gap", delta: -1 }],
      culture_narrative: "Works well in small teams.", overall_narrative: "", generated_at: "2026-10-01T00:00:00Z",
    },
  },
};

const notFound = () => Promise.reject({ response: { status: 404 } });
const serverError = () => Promise.reject({ response: { status: 500 } });

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/assessments/1/sessions/1/fitgap/3"]}>
      <Routes>
        <Route path="/assessments/:id/sessions/:sessionId/fitgap/:vacancyId" element={<FitGapReportPage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  getPortfolio.mockResolvedValue(portfolio() as any);
});
afterEach(() => vi.useRealTimers());

describe("FitGapReportPage", () => {
  it("shows the report and the required level when it already exists", async () => {
    getFitGap.mockResolvedValue(report as any);
    renderPage();

    expect(await screen.findByText("Works well in small teams.")).toBeInTheDocument();
    expect(triggerFitGap).not.toHaveBeenCalled();
  });

  it("asks for generation once and then only polls with GET", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    getFitGap.mockImplementation(notFound as any);
    triggerFitGap.mockResolvedValue({ data: { status: "queued" } } as any);
    renderPage();

    expect(await screen.findByText("Generating fit/gap report...")).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });

    expect(triggerFitGap).toHaveBeenCalledTimes(1);
    expect(getFitGap.mock.calls.length).toBeGreaterThanOrEqual(4);

    getFitGap.mockResolvedValue(report as any);
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(await screen.findByText("Works well in small teams.")).toBeInTheDocument();
  });

  it("stops after about three minutes and says what to do", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    getFitGap.mockImplementation(notFound as any);
    triggerFitGap.mockResolvedValue({ data: { status: "queued" } } as any);
    renderPage();
    await screen.findByText("Generating fit/gap report...");

    await act(async () => { await vi.advanceTimersByTimeAsync(5000 * 36 + 1000); });

    expect(screen.getByRole("alert")).toHaveTextContent("taking longer than expected");
    expect(screen.queryByText("Generating fit/gap report...")).not.toBeInTheDocument();
  });

  it("shows an error with Try again instead of a blank page, and recovers", async () => {
    getFitGap.mockImplementationOnce(serverError as any);
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("could not be loaded");

    getFitGap.mockResolvedValue(report as any);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Works well in small teams.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows an error when generation cannot be requested", async () => {
    getFitGap.mockImplementation(notFound as any);
    triggerFitGap.mockRejectedValue({ response: { status: 500 } });
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("could not be generated");
  });

  it("does not call the fit/gap API while the portfolio is not finished", async () => {
    getPortfolio.mockResolvedValue(portfolio("generating") as any);
    renderPage();

    expect(await screen.findByText("The portfolio is not ready yet")).toBeInTheDocument();
    expect(getFitGap).not.toHaveBeenCalled();
    expect(triggerFitGap).not.toHaveBeenCalled();
  });

  it("explains an empty state when the session has no portfolio", async () => {
    getPortfolio.mockResolvedValue({ data: {} } as any);
    renderPage();

    expect(await screen.findByText("No portfolio yet")).toBeInTheDocument();
  });

  it("links to the portfolio page when the portfolio failed", async () => {
    getPortfolio.mockResolvedValue(portfolio("failed") as any);
    renderPage();

    const link = await screen.findByRole("link", { name: "Open the portfolio page" });
    expect(link).toHaveAttribute("href", "/assessments/1/sessions/1/portfolio");
  });

  it("labels a discovered skill with its level and the confidence the model gave", async () => {
    getPortfolio.mockResolvedValue({
      data: {
        portfolio: {
          id: 7, session_id: 1, generation_status: "complete", overrides: [],
          skills: [{
            id: 11, skill_label: "Figma prototyping", is_discovered: true, ai_level: 3,
            ai_confidence: "medium", evidence: [], competency_summary: "Prototypes before coding.",
          }],
        },
      },
    } as any);
    getFitGap.mockResolvedValue(report as any);
    renderPage();

    expect(await screen.findByText("L3 · medium confidence")).toBeInTheDocument();
    expect(screen.queryByText(/confirmed/)).not.toBeInTheDocument();
  });

  it("says so when an export fails instead of doing nothing", async () => {
    getFitGap.mockResolvedValue(report as any);
    vi.mocked(portfoliosApi.exportPortfolio).mockRejectedValue({ response: { status: 500 } });
    renderPage();
    await screen.findByText("Works well in small teams.");

    await userEvent.click(screen.getByRole("button", { name: "PDF" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("PDF export could not be created");
  });
});

import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import FitGapReportPage, { MAX_POLLS, POLL_INTERVAL_MS } from "./FitGapReportPage";
import { portfoliosApi } from "@/services/portfolios";
import { sessionsApi } from "@/services/sessions";
import { buildComparison, buildSkill } from "@/test/factories";

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

const notFound = { response: { status: 404 } };

function completePortfolio() {
  return { data: { portfolio: { id: 7, session_id: 1, generation_status: "complete", skills: [buildSkill()], overrides: [] } } };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/assessments/1/sessions/1/fitgap/5"]}>
      <Routes>
        <Route path="/assessments/:id/sessions/:sessionId/fitgap/:vacancyId" element={<FitGapReportPage />} />
      </Routes>
    </MemoryRouter>
  );
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("FitGapReportPage", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(sessionsApi.getPortfolio).mockResolvedValue(completePortfolio() as any);
    vi.mocked(portfoliosApi.triggerFitGap).mockResolvedValue({ data: { status: "generating" } } as any);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("asks for the report once and only reads while waiting", async () => {
    vi.mocked(portfoliosApi.getFitGap).mockRejectedValue(notFound);

    renderPage();
    expect(await screen.findByText(/Generating fit\/gap report/)).toBeInTheDocument();

    for (let i = 0; i < 5; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
      });
    }

    expect(portfoliosApi.triggerFitGap).toHaveBeenCalledTimes(1);
    expect(vi.mocked(portfoliosApi.getFitGap).mock.calls.length).toBeGreaterThan(5);
  });

  it("stops waiting and says so when the report never arrives", async () => {
    vi.mocked(portfoliosApi.getFitGap).mockRejectedValue(notFound);

    renderPage();
    await screen.findByText(/Generating fit\/gap report/);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * (MAX_POLLS + 1));
    });

    expect(screen.getByText(/taking longer than usual/)).toBeInTheDocument();
  });

  it("shows the overall assessment and warns about unassessed required skills", async () => {
    vi.mocked(portfoliosApi.getFitGap).mockResolvedValue({
      data: {
        report: {
          id: 1,
          portfolio_id: 7,
          vacancy_id: 5,
          generated_at: "2026-10-19T00:00:00Z",
          culture_narrative: "Culture text",
          overall_narrative: "Strong on design. Testing level is unknown.",
          skill_comparisons: [
            buildComparison(),
            buildComparison({ skill_label: "Testing", candidate_level: null, result: "not_assessed", delta: null }),
          ],
        },
      },
    } as any);

    renderPage();

    expect(await screen.findByText("Strong on design. Testing level is unknown.")).toBeInTheDocument();
    expect(screen.getByText("Culture text")).toBeInTheDocument();
    expect(screen.getByText(/1 required skill has no rating/)).toBeInTheDocument();
  });

  it("explains when the portfolio is not ready instead of showing a blank page", async () => {
    vi.mocked(sessionsApi.getPortfolio).mockResolvedValue({ data: { status: "generating" } } as any);

    renderPage();
    await flush();

    expect(await screen.findByText(/isn't ready yet/)).toBeInTheDocument();
    expect(portfoliosApi.triggerFitGap).not.toHaveBeenCalled();
  });

  it("offers a retry when loading fails", async () => {
    vi.mocked(sessionsApi.getPortfolio).mockRejectedValue(new Error("network"));

    renderPage();

    expect(await screen.findByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});

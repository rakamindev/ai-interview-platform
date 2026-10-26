import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import FitGapReportPage from "@/pages/fitgap/FitGapReportPage";
import { portfoliosApi } from "@/services/portfolios";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { POLL_DEADLINE_MS } from "@/hooks/useFitGapReport";
import { makeReport } from "@/test/fixtures/fitgap";
import type { FitGapReport } from "@/types";

vi.mock("@/services/portfolios", () => ({
  portfoliosApi: { ensureFitGap: vi.fn(), getFitGap: vi.fn(), regenerateFitGap: vi.fn(), exportPortfolio: vi.fn() },
}));
vi.mock("@/services/sessions", () => ({ sessionsApi: { getPortfolio: vi.fn() } }));
vi.mock("@/services/vacancies", () => ({ vacanciesApi: { get: vi.fn() } }));

const api = vi.mocked(portfoliosApi);
const ok = (report: FitGapReport) => Promise.resolve({ data: { report } }) as never;
const httpError = (status: number, message: string) =>
  Promise.reject({ response: { status, data: { errors: [{ status, message }] } } });

const portfolio = {
  id: 1, session_id: 1, candidate_id: null, generation_status: "complete", generated_at: "", generation_error: null,
  skills: [{ id: 9, skill_id: null, skill_label: "Micro-frontends", is_discovered: true, ai_level: 2,
             ai_confidence: "low", evidence: [], competency_summary: "" }],
  overrides: [],
};

const pending = () => makeReport({ status: "pending", skill_comparisons: [], summary: { total: 0, match: 0, gap: 0, exceed: 0, not_assessed: 0, needs_verification: 0 }, overall_narrative: null, culture_narrative: null, narrative_source: null });

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/assessments/1/sessions/1/fitgap/1"]}>
      <Routes>
        <Route path="/assessments/:id/sessions/:sessionId/fitgap/:vacancyId" element={<FitGapReportPage />} />
      </Routes>
    </MemoryRouter>
  );
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.mocked(sessionsApi.getPortfolio).mockResolvedValue({ data: { portfolio } } as never);
  vi.mocked(vacanciesApi.get).mockResolvedValue({ data: { vacancy: { role_title: "Senior Frontend Engineer" } } } as never);
});

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("FitGapReportPage", () => {
  it("renders a ready report with summary, rows, narrative and provenance", async () => {
    api.ensureFitGap.mockReturnValue(ok(makeReport()));
    renderPage();

    expect(await screen.findByText("Communication")).toBeInTheDocument();
    expect(screen.getByText("Senior Frontend Engineer")).toBeInTheDocument();
    expect(screen.getByText("At a glance")).toBeInTheDocument();
    expect(screen.getByText("AI-generated draft")).toBeInTheDocument();
    expect(screen.getByText(/Generated/)).toBeInTheDocument();
    expect(screen.getByText("Micro-frontends")).toBeInTheDocument();
    expect(api.getFitGap).not.toHaveBeenCalled();
  });

  it("shows progress on first generation, polls, and stops once complete", async () => {
    api.ensureFitGap.mockReturnValue(ok(pending()));
    api.getFitGap.mockReturnValueOnce(ok(makeReport({ status: "generating", skill_comparisons: [] })))
                 .mockReturnValue(ok(makeReport()));
    renderPage();

    expect(await screen.findByText(/Comparing the portfolio with the vacancy/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Updating/ })).toBeDisabled();

    await advance(2000);
    await advance(3000);
    expect(await screen.findByText("Communication")).toBeInTheDocument();

    const calls = api.getFitGap.mock.calls.length;
    await advance(30_000);
    expect(api.getFitGap).toHaveBeenCalledTimes(calls);
  });

  it("keeps the previous version visible while an override refresh runs", async () => {
    api.ensureFitGap.mockReturnValue(ok(makeReport({ status: "pending", stale: true })));
    api.getFitGap.mockReturnValue(ok(makeReport({ status: "generating", stale: true })));
    renderPage();

    expect(await screen.findByText("A rating changed — updating the report")).toBeInTheDocument();
    expect(screen.getByText("Communication")).toBeInTheDocument();
    expect(screen.getByLabelText("Skill comparison").closest("[aria-busy='true']")).toBeInTheDocument();
  });

  it("shows a failed run with its safe message and retries via regenerate", async () => {
    api.ensureFitGap.mockReturnValue(ok(makeReport({ status: "failed", error_message: "We could not generate this report. Please try again." })));
    api.regenerateFitGap.mockReturnValue(ok(makeReport()));
    renderPage();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("We could not generate this report. Please try again.");
    expect(alert).toHaveTextContent("Showing the last successful version below.");

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(api.regenerateFitGap).toHaveBeenCalledWith(1, 1);
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });

  it("stops polling after the deadline and offers to check again", async () => {
    api.ensureFitGap.mockReturnValue(ok(pending()));
    api.getFitGap.mockReturnValue(ok(pending()));
    renderPage();
    await screen.findByText(/Comparing the portfolio/);

    await advance(POLL_DEADLINE_MS + 10_000);
    expect(await screen.findByText("This is taking longer than usual")).toBeInTheDocument();

    const calls = api.getFitGap.mock.calls.length;
    await advance(60_000);
    expect(api.getFitGap).toHaveBeenCalledTimes(calls);

    api.ensureFitGap.mockReturnValue(ok(makeReport()));
    await userEvent.click(screen.getByRole("button", { name: "Check again" }));
    expect(await screen.findByText("Communication")).toBeInTheDocument();
  });

  it("tolerates a transient polling error", async () => {
    api.ensureFitGap.mockReturnValue(ok(pending()));
    api.getFitGap.mockReturnValueOnce(httpError(502, "Bad gateway") as never).mockReturnValue(ok(makeReport()));
    renderPage();
    await screen.findByText(/Comparing the portfolio/);

    await advance(2000);
    await advance(3000);
    expect(await screen.findByText("Communication")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("explains when the portfolio is not ready instead of queuing work", async () => {
    vi.mocked(sessionsApi.getPortfolio).mockResolvedValue({ data: { status: "generating" } } as never);
    renderPage();

    expect(await screen.findByText("The portfolio isn't ready yet")).toBeInTheDocument();
    expect(api.ensureFitGap).not.toHaveBeenCalled();
  });

  it("does not reveal whether a session from another organization exists", async () => {
    vi.mocked(sessionsApi.getPortfolio).mockRejectedValue({ response: { status: 404 } });
    renderPage();

    expect(await screen.findByText("This report isn't available")).toBeInTheDocument();
    expect(screen.getByText(/doesn't exist or isn't shared with your organization/)).toBeInTheDocument();
    expect(api.ensureFitGap).not.toHaveBeenCalled();
  });

  it("shows a recoverable error when the report cannot be loaded", async () => {
    api.ensureFitGap.mockReturnValueOnce(httpError(500, "An unexpected error occurred.") as never)
                    .mockReturnValue(ok(makeReport()));
    renderPage();

    expect(await screen.findByText("Couldn't load this report")).toBeInTheDocument();
    expect(screen.getByText("An unexpected error occurred.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Communication")).toBeInTheDocument();
  });

  it("guides the assessor when the vacancy has no required skills", async () => {
    api.ensureFitGap.mockReturnValue(ok(makeReport({ skill_comparisons: [], summary: { total: 0, match: 0, gap: 0, exceed: 0, not_assessed: 0, needs_verification: 0 } })));
    renderPage();

    expect(await screen.findByText("This vacancy has no required skills")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add required skills" })).toHaveAttribute("href", "/vacancies/1/edit");
  });

  it("stops polling when the page is left", async () => {
    api.ensureFitGap.mockReturnValue(ok(pending()));
    api.getFitGap.mockReturnValue(ok(pending()));
    const { unmount } = renderPage();
    await screen.findByText(/Comparing the portfolio/);

    unmount();
    await advance(60_000);
    expect(api.getFitGap).not.toHaveBeenCalled();
  });

  it("disables export until the report is ready", async () => {
    api.ensureFitGap.mockReturnValue(ok(pending()));
    api.getFitGap.mockReturnValue(ok(pending()));
    renderPage();

    await screen.findByText(/Comparing the portfolio/);
    expect(screen.getByRole("button", { name: /Export/ })).toBeDisabled();
  });
});

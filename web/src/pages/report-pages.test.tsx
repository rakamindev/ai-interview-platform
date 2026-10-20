import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, AxiosHeaders } from "axios";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PortfolioPage from "./portfolio/PortfolioPage";
import FitGapReportPage, { POLL_INTERVAL_MS, TIMEOUT_MS } from "./fitgap/FitGapReportPage";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { portfoliosApi } from "@/services/portfolios";
import { comparison, notAssessedSkill, portfolio, report, skill } from "@/test/fixtures";

vi.mock("@/services/sessions", () => ({
  sessionsApi: { getPortfolio: vi.fn(), get: vi.fn(), regeneratePortfolio: vi.fn() },
}));
vi.mock("@/services/vacancies", () => ({ vacanciesApi: { list: vi.fn(), get: vi.fn() } }));
vi.mock("@/services/portfolios", () => ({
  portfoliosApi: { getFitGap: vi.fn(), triggerFitGap: vi.fn(), regenerateFitGap: vi.fn(), exportPortfolio: vi.fn(), saveOverride: vi.fn() },
}));

const ok = <T,>(data: T) => ({ data }) as never;
const httpError = (status: number) =>
  new AxiosError("request failed", String(status), undefined, undefined, {
    status, data: {}, statusText: "", headers: {}, config: { headers: new AxiosHeaders() },
  });

beforeEach(() => {
  vi.mocked(sessionsApi.get).mockResolvedValue(ok({ session: { candidate_name: "Demo Candidate" } }));
  vi.mocked(vacanciesApi.list).mockResolvedValue(ok({ vacancies: [{ id: 2, role_title: "Frontend Engineer" }] }));
  vi.mocked(vacanciesApi.get).mockResolvedValue(ok({ vacancy: { id: 2, role_title: "Frontend Engineer" } }));
});

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/assessments/:id/sessions/:sessionId/portfolio" element={<PortfolioPage />} />
        <Route path="/assessments/:id/sessions/:sessionId/fitgap/:vacancyId" element={<FitGapReportPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

const PORTFOLIO = "/assessments/1/sessions/3/portfolio";
const FITGAP = "/assessments/1/sessions/3/fitgap/2";

describe("PortfolioPage", () => {
  it("summarises how many skills have evidence and explains 'not assessed'", async () => {
    vi.mocked(sessionsApi.getPortfolio).mockResolvedValue(ok({ portfolio: portfolio([skill(), notAssessedSkill()]) }));

    renderAt(PORTFOLIO);

    expect(await screen.findByText(/skills\s+assessed in the interview/)).toHaveTextContent("1 of 2 skills assessed");
    expect(screen.getByText("1 without evidence")).toBeInTheDocument();
    expect(screen.getByText(/It is not a low score/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /rate manually for cloud infrastructure/i })).toBeInTheDocument();
  });

  it("says the interview is still running instead of spinning forever", async () => {
    vi.mocked(sessionsApi.getPortfolio).mockResolvedValue(ok({ status: "not_ready", session_status: "active" }));

    renderAt(PORTFOLIO);

    expect(await screen.findByText("The interview is still in progress")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Watch it live" })).toBeInTheDocument();
  });

  it("shows that a temporary AI error is being retried", async () => {
    vi.mocked(sessionsApi.getPortfolio).mockResolvedValue(ok({ status: "generating", last_error: "Rate limited" }));

    renderAt(PORTFOLIO);

    expect(await screen.findByText("Generating the portfolio")).toBeInTheDocument();
    expect(screen.getByText(/Retrying automatically .*Rate limited/)).toBeInTheDocument();
  });

  it("shows why generation failed and restarts it", async () => {
    vi.mocked(sessionsApi.getPortfolio).mockResolvedValue(
      ok({ portfolio: portfolio([], { generation_status: "failed", generation_error: "Failed after 3 retries: Rate limited" }) }),
    );
    vi.mocked(sessionsApi.regeneratePortfolio).mockResolvedValue(ok({}));

    renderAt(PORTFOLIO);

    expect(await screen.findByText("Reason: Failed after 3 retries: Rate limited")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Generate again" }));
    expect(sessionsApi.regeneratePortfolio).toHaveBeenCalledWith(3);
    expect(await screen.findByText("Generating the portfolio")).toBeInTheDocument();
  });

  it("treats 'already generating' (409) as progress, not as an error", async () => {
    vi.mocked(sessionsApi.getPortfolio).mockResolvedValue(ok({ portfolio: portfolio([], { generation_status: "failed" }) }));
    vi.mocked(sessionsApi.regeneratePortfolio).mockRejectedValue(httpError(409));

    renderAt(PORTFOLIO);
    await userEvent.click(await screen.findByRole("button", { name: "Generate again" }));

    expect(await screen.findByText("Generating the portfolio")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("offers a way forward when the portfolio can't be loaded", async () => {
    vi.mocked(sessionsApi.getPortfolio).mockRejectedValue(httpError(500));

    renderAt(PORTFOLIO);

    expect(await screen.findByText("Couldn't load this portfolio")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("reports a failed export instead of failing silently", async () => {
    vi.mocked(sessionsApi.getPortfolio).mockResolvedValue(ok({ portfolio: portfolio([skill()]) }));
    vi.mocked(portfoliosApi.exportPortfolio).mockRejectedValue(httpError(500));

    renderAt(PORTFOLIO);
    await userEvent.click(await screen.findByRole("button", { name: "Export PDF" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't export the PDF");
  });
});

describe("FitGapReportPage", () => {
  beforeEach(() => {
    vi.mocked(sessionsApi.getPortfolio).mockResolvedValue(ok({ portfolio: portfolio([skill()]) }));
  });

  it("withholds the recommendation and lists what is missing", async () => {
    vi.mocked(portfoliosApi.getFitGap).mockResolvedValue(
      ok({
        report: report({
          recommendation_status: "insufficient_evidence",
          evidence_gaps: [{ reason: "skills_not_assessed", skills: ["Cloud"] }],
          skill_comparisons: [comparison({ skill_label: "Cloud", candidate_level: null, result: "not_assessed", delta: null })],
          overall_narrative: null,
          culture_narrative: null,
        }),
      }),
    );

    renderAt(FITGAP);

    expect(await screen.findByRole("heading", { name: "No recommendation yet" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Recommendation" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Rate it on the portfolio" })).toHaveAttribute("href", PORTFOLIO);
  });

  // Regression (F-002): the page showed `culture_narrative || overall_narrative`, hiding the recommendation.
  it("shows the recommendation and the culture narrative as separate sections", async () => {
    vi.mocked(portfoliosApi.getFitGap).mockResolvedValue(ok({ report: report() }));

    renderAt(FITGAP);

    expect(await screen.findByRole("heading", { name: "Recommendation" })).toBeInTheDocument();
    expect(screen.getByText("Recommend proceeding to the technical round.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Culture and competency fit" })).toBeInTheDocument();
    expect(screen.getByText("Comfortable with written, async collaboration.")).toBeInTheDocument();
  });

  it("flags reports generated before evidence checks existed", async () => {
    vi.mocked(portfoliosApi.getFitGap).mockResolvedValue(ok({ report: report({ recommendation_status: null }) }));

    renderAt(FITGAP);

    expect(await screen.findByText(/generated before evidence checks existed/)).toBeInTheDocument();
  });

  it("explains an empty vacancy instead of showing an empty table", async () => {
    vi.mocked(portfoliosApi.getFitGap).mockResolvedValue(
      ok({
        report: report({
          skill_comparisons: [],
          recommendation_status: "insufficient_evidence",
          evidence_gaps: [{ reason: "no_vacancy_skills", skills: [] }],
        }),
      }),
    );

    renderAt(FITGAP);

    expect(await screen.findByText("This vacancy has no required skills to compare against.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add skills to the vacancy" })).toHaveAttribute("href", "/vacancies/2/edit");
  });

  it("asks for the portfolio first when it isn't complete", async () => {
    vi.mocked(sessionsApi.getPortfolio).mockResolvedValue(ok({ status: "generating", last_error: null }));

    renderAt(FITGAP);

    expect(await screen.findByText("The portfolio isn't ready yet")).toBeInTheDocument();
    expect(portfoliosApi.getFitGap).not.toHaveBeenCalled();
  });

  it("requests a report once when none exists, then shows it when ready", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(portfoliosApi.getFitGap)
      .mockRejectedValueOnce(httpError(404))
      .mockResolvedValueOnce(ok({ report: report() }));
    vi.mocked(portfoliosApi.triggerFitGap).mockResolvedValue(ok({ status: "generating" }));

    renderAt(FITGAP);
    expect(await screen.findByText("Comparing the portfolio with the vacancy")).toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS));

    expect(await screen.findByRole("heading", { name: "Recommendation" })).toBeInTheDocument();
    expect(portfoliosApi.triggerFitGap).toHaveBeenCalledTimes(1);
  });

  // Regression (F-012): a dead job used to leave the page polling forever.
  it("stops waiting after the timeout and offers to generate again", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(portfoliosApi.getFitGap).mockRejectedValue(httpError(404));
    vi.mocked(portfoliosApi.triggerFitGap).mockResolvedValue(ok({ status: "generating" }));
    vi.mocked(portfoliosApi.regenerateFitGap).mockResolvedValue(ok({ status: "generating" }));

    renderAt(FITGAP);
    expect(await screen.findByText("Comparing the portfolio with the vacancy")).toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(TIMEOUT_MS + POLL_INTERVAL_MS));

    expect(await screen.findByText("The report is taking too long")).toBeInTheDocument();
    expect(portfoliosApi.triggerFitGap).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "Generate again" }));
    expect(portfoliosApi.regenerateFitGap).toHaveBeenCalledWith(7, 2);
  });

  it("shows a load error for failures other than 'not found'", async () => {
    vi.mocked(portfoliosApi.getFitGap).mockRejectedValue(httpError(500));

    renderAt(FITGAP);

    expect(await screen.findByText("Couldn't load this report")).toBeInTheDocument();
    expect(portfoliosApi.triggerFitGap).not.toHaveBeenCalled();
  });
});

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AssessmentListPage from "@/pages/assessments/AssessmentListPage";
import AssessmentInvitePage from "@/pages/assessments/AssessmentInvitePage";
import VacancyListPage from "@/pages/vacancies/VacancyListPage";
import PortfolioPage from "@/pages/portfolio/PortfolioPage";
import FitGapReportPage from "@/pages/fitgap/FitGapReportPage";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import { assessmentsApi } from "@/services/assessments";
import { vacanciesApi } from "@/services/vacancies";
import { sessionsApi } from "@/services/sessions";
import { portfoliosApi } from "@/services/portfolios";
import type { FitGapReport, Portfolio, SkillComparison } from "@/types";

vi.mock("@/services/assessments", () => ({
  assessmentsApi: {
    list: vi.fn(),
    get: vi.fn(),
    getSessions: vi.fn(),
    createSession: vi.fn(),
  },
}));

vi.mock("@/services/vacancies", () => ({
  vacanciesApi: {
    list: vi.fn(),
    get: vi.fn(),
  },
}));

vi.mock("@/services/sessions", () => ({
  sessionsApi: {
    getPortfolio: vi.fn(),
    get: vi.fn(),
  },
}));

vi.mock("@/services/portfolios", () => ({
  portfoliosApi: {
    getFitGap: vi.fn(),
    triggerFitGap: vi.fn(),
    regenerateFitGap: vi.fn(),
    exportPortfolio: vi.fn(),
  },
}));

const makeComparison = (overrides: Record<string, unknown> = {}) =>
  ({
    skill_label: "Ruby on Rails",
    expected_level: 3,
    candidate_level: 3,
    result: "match",
    delta: 0,
    ...overrides,
  }) as unknown as SkillComparison;

const makePortfolio = (): Portfolio => ({
  id: 21,
  session_id: 31,
  generation_status: "complete",
  skills: [],
  overrides: [],
});

const makeReport = (): FitGapReport => ({
  id: 41,
  portfolio_id: 21,
  vacancy_id: 51,
  skill_comparisons: [],
  culture_narrative: "DEV TEST narrative",
  overall_narrative: "DEV TEST summary",
  generated_at: "2026-01-01T00:00:00Z",
});

function renderFitGapPage() {
  return render(
    <MemoryRouter initialEntries={["/assessments/11/sessions/31/fitgap/51"]}>
      <Routes>
        <Route
          path="/assessments/:id/sessions/:sessionId/fitgap/:vacancyId"
          element={<FitGapReportPage />}
        />
      </Routes>
    </MemoryRouter>
  );
}

function renderWithRouter(ui: ReactNode) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("assessment and vacancy result acceptance criteria", () => {
  beforeEach(() => {
    vi.mocked(assessmentsApi.list).mockResolvedValue({
      data: { assessments: [], meta: {} },
    } as never);
    vi.mocked(assessmentsApi.get).mockResolvedValue({
      data: { assessment: { id: 11, name: "Demo assessment", time_limit_min: 45, skills: [] } },
    } as never);
    vi.mocked(assessmentsApi.getSessions).mockResolvedValue({
      data: { sessions: [] },
    } as never);
    vi.mocked(vacanciesApi.list).mockResolvedValue({
      data: { vacancies: [], meta: {} },
    } as never);
    vi.mocked(vacanciesApi.get).mockResolvedValue({
      data: { vacancy: {} },
    } as never);
    vi.mocked(sessionsApi.getPortfolio).mockResolvedValue({
      data: { portfolio: makePortfolio() },
    } as never);
    vi.mocked(sessionsApi.get).mockResolvedValue({
      data: { session: { candidate_name: "Kandidat Contoh 1" } },
    } as never);
    vi.mocked(portfoliosApi.getFitGap).mockResolvedValue({
      data: { report: makeReport() },
    } as never);
    vi.mocked(portfoliosApi.triggerFitGap).mockResolvedValue({
      data: { status: "generating" },
    } as never);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders a valid backend expected_level as the Required level", () => {
    render(<ComparisonTable comparisons={[makeComparison({ expected_level: 3 })]} />);

    const row = screen.getByRole("row", { name: /Ruby on Rails/ });
    expect(within(row).getAllByRole("cell")[1]).toHaveTextContent("L3");
  });

  it("shows a dash for null and out-of-range expected_level values", () => {
    render(
      <ComparisonTable
        comparisons={[
          makeComparison({ skill_label: "Null level", expected_level: null }),
          makeComparison({ skill_label: "Invalid level", expected_level: 8 }),
        ]}
      />
    );

    for (const label of ["Null level", "Invalid level"]) {
      const row = screen.getByRole("row", { name: new RegExp(label) });
      expect(within(row).getAllByRole("cell")[1]).toHaveTextContent("—");
    }
  });

  it("keeps an unassessed skill visible with no candidate level and the Not assessed result", () => {
    render(
      <ComparisonTable
        comparisons={[
          makeComparison({
            skill_label: "Cloud Security",
            expected_level: 2,
            candidate_level: null,
            result: "not_assessed",
            delta: null,
          }),
        ]}
      />
    );

    const row = screen.getByRole("row", { name: /Cloud Security/ });
    expect(row).toBeInTheDocument();
    expect(within(row).getAllByRole("cell")[2]).toHaveTextContent("—");
    expect(within(row).getAllByRole("cell")[3]).toHaveTextContent("Not assessed");
  });

  it("shows the override indicator when the API marks overridden true", () => {
    render(
      <ComparisonTable
        comparisons={[
          makeComparison({
            expected_level: 4,
            candidate_level: 4,
            result: "match",
            overridden: true,
          }),
        ]}
      />
    );

    const row = screen.getByRole("row", { name: /Ruby on Rails/ });
    expect(within(row).getByTitle(/human override/i)).toBeInTheDocument();
  });

  it("matches the FitGap::Engine comparison payload contract", () => {
    const engineComparison = {
      skill_label: "Ruby on Rails",
      candidate_level: 4,
      expected_level: 3,
      delta: 1,
      result: "exceed",
      overridden: true,
    };

    expect(Object.keys(engineComparison)).toEqual([
      "skill_label",
      "candidate_level",
      "expected_level",
      "delta",
      "result",
      "overridden",
    ]);

    render(
      <ComparisonTable
        comparisons={[engineComparison as unknown as SkillComparison]}
      />
    );

    const row = screen.getByRole("row", { name: /Ruby on Rails/ });
    expect(within(row).getAllByRole("cell")[1]).toHaveTextContent("L3");
    expect(within(row).getByTitle(/human override/i)).toBeInTheDocument();
  });

  async function expectErrorRetryAndNoEmptyState({
    errorMessage,
    emptyState,
    retryCallCount,
  }: {
    errorMessage: RegExp;
    emptyState: string;
    retryCallCount: () => number;
  }) {
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(errorMessage);
    expect(screen.queryByText(emptyState)).not.toBeInTheDocument();

    const retry = screen.getByRole("button", { name: /retry/i });
    expect(retry).toBeInTheDocument();
    fireEvent.click(retry);
    await waitFor(() => expect(retryCallCount()).toBe(2));
  }

  it("shows alert and Retry without the empty state when the assessment list request fails", async () => {
    vi.mocked(assessmentsApi.list).mockRejectedValueOnce(new Error("assessment unavailable"));
    renderWithRouter(<AssessmentListPage />);

    await expectErrorRetryAndNoEmptyState({
      errorMessage: /Failed to load assessments/i,
      emptyState: "No assessments yet.",
      retryCallCount: () => vi.mocked(assessmentsApi.list).mock.calls.length,
    });
  });

  it("shows alert and Retry without the empty state when the vacancy list request fails", async () => {
    vi.mocked(vacanciesApi.list).mockRejectedValueOnce(new Error("vacancies unavailable"));
    renderWithRouter(<VacancyListPage />);

    await expectErrorRetryAndNoEmptyState({
      errorMessage: /Failed to load vacancies/i,
      emptyState: "No vacancies yet.",
      retryCallCount: () => vi.mocked(vacanciesApi.list).mock.calls.length,
    });
  });

  it("shows alert and Retry without an empty state when the portfolio request fails", async () => {
    vi.mocked(sessionsApi.getPortfolio).mockRejectedValueOnce(new Error("portfolio unavailable"));
    render(
      <MemoryRouter initialEntries={["/assessments/11/sessions/31/portfolio"]}>
        <Routes>
          <Route
            path="/assessments/:id/sessions/:sessionId/portfolio"
            element={<PortfolioPage />}
          />
        </Routes>
      </MemoryRouter>
    );

    await expectErrorRetryAndNoEmptyState({
      errorMessage: /Failed to load portfolio/i,
      emptyState: "No portfolio available.",
      retryCallCount: () => vi.mocked(sessionsApi.getPortfolio).mock.calls.length,
    });
  });

  it("shows alert and Retry without an empty state when the fit/gap request fails", async () => {
    vi.mocked(portfoliosApi.getFitGap).mockRejectedValueOnce({
      response: { status: 500 },
    });
    renderFitGapPage();

    await waitFor(() => expect(portfoliosApi.getFitGap).toHaveBeenCalledTimes(1));
    await expectErrorRetryAndNoEmptyState({
      errorMessage: /Failed to load fit\/gap report/i,
      emptyState: "No fit/gap report available.",
      retryCallCount: () => vi.mocked(portfoliosApi.getFitGap).mock.calls.length,
    });
  });

  it("retries portfolio loading from the Fit/Gap page after its initial request fails", async () => {
    vi.mocked(sessionsApi.getPortfolio).mockRejectedValueOnce(new Error("portfolio unavailable"));
    renderFitGapPage();

    expect(await screen.findByRole("alert")).toHaveTextContent(/Failed to load portfolio/i);
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    await waitFor(() => expect(sessionsApi.getPortfolio).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(portfoliosApi.getFitGap).toHaveBeenCalledTimes(1));
  });

  it("shows an assessment detail error instead of an empty candidate state and can retry", async () => {
    vi.mocked(assessmentsApi.get).mockRejectedValueOnce(new Error("assessment unavailable"));
    render(
      <MemoryRouter initialEntries={["/assessments/11/invite"]}>
        <Routes>
          <Route path="/assessments/:id/invite" element={<AssessmentInvitePage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(/Failed to load assessment and candidates/i);
    expect(screen.queryByText("No candidates yet")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    await waitFor(() => expect(assessmentsApi.get).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("No candidates yet")).toBeInTheDocument();
  });

  it("shows empty states only after successful empty list responses", async () => {
    const assessmentList = renderWithRouter(<AssessmentListPage />);
    expect(await screen.findByText("No assessments yet.")).toBeInTheDocument();
    expect(screen.queryByText(/Failed to load/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
    assessmentList.unmount();

    renderWithRouter(<VacancyListPage />);
    expect(await screen.findByText("No vacancies yet.")).toBeInTheDocument();
    expect(screen.queryByText(/Failed to load/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
  });

  it("shows loading UI without prematurely showing an error or empty state", () => {
    vi.mocked(assessmentsApi.list).mockImplementation(() => new Promise(() => {}));

    const { container } = renderWithRouter(<AssessmentListPage />);

    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
    expect(screen.queryByText("No assessments yet.")).not.toBeInTheDocument();
    expect(screen.queryByText(/Failed to load/i)).not.toBeInTheDocument();
  });

  it("keeps a very long skill label available inside the horizontally scrollable table", () => {
    const label = "ExtremelyLongFictionalSkillLabel".repeat(12);
    const { container } = render(
      <ComparisonTable comparisons={[makeComparison({ skill_label: label })]} />
    );

    expect(screen.getByText(label)).toBeInTheDocument();
    expect(container.querySelector(".overflow-x-auto")).toContainElement(
      screen.getByRole("table")
    );
  });

  it("provides responsive wrapping for report controls at a 320px viewport", async () => {
    // jsdom has no layout engine, so this only checks responsive class names.
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 320 });
    renderFitGapPage();

    const heading = await screen.findByRole("heading", { name: "Fit/Gap Report" });
    const header = heading.parentElement?.parentElement?.parentElement;

    expect(header).toHaveClass("flex-col");
    expect(screen.getByRole("table").parentElement).toHaveClass("overflow-x-auto");
    expect(portfoliosApi.getFitGap).toHaveBeenCalled();
  });
});

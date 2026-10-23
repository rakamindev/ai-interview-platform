import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FitGapReportPage from "./FitGapReportPage";
import { useFitGapReport, type FitGapPhase } from "@/hooks/useFitGapReport";
import { vacanciesApi } from "@/services/vacancies";
import { comparison, needsReview, notCovered, portfolio, report } from "@/test/fixtures";
import type { FitGapReport } from "@/types";

vi.mock("@/hooks/useFitGapReport", () => ({ useFitGapReport: vi.fn() }));
vi.mock("@/services/vacancies", () => ({ vacanciesApi: { get: vi.fn() } }));
vi.mock("@/services/portfolios", () => ({ portfoliosApi: { exportPortfolio: vi.fn() } }));

const hook = vi.mocked(useFitGapReport);

function renderPage(state: { phase: FitGapPhase; report?: FitGapReport | null; updating?: boolean }) {
  const actions = { regenerate: vi.fn(), retry: vi.fn() };
  hook.mockReturnValue({
    portfolio: portfolio(),
    report: null,
    updating: false,
    ...state,
    ...actions,
  } as ReturnType<typeof useFitGapReport>);

  render(
    <MemoryRouter initialEntries={["/assessments/1/sessions/3/fitgap/9"]}>
      <Routes>
        <Route path="/assessments/:id/sessions/:sessionId/fitgap/:vacancyId" element={<FitGapReportPage />} />
      </Routes>
    </MemoryRouter>,
  );
  return actions;
}

describe("FitGapReportPage", () => {
  beforeEach(() => {
    vi.mocked(vacanciesApi.get).mockResolvedValue({ data: { vacancy: { role_title: "Backend Engineer" } } } as never);
  });

  it("leads with what needs a decision and counts open questions apart from gaps", async () => {
    renderPage({ phase: "ready", report: report() });

    expect(await screen.findByText(/Backend Engineer/)).toBeInTheDocument();
    const summary = screen.getByRole("region", { name: "Summary" });
    expect(within(summary).getByText("Below expected").nextElementSibling).toHaveTextContent("0");
    expect(within(summary).getByText("Needs your review").nextElementSibling).toHaveTextContent("1");
    expect(screen.getByText(/1 skill needs your review before this report is complete/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /confirm a level/i }))
      .toHaveAttribute("href", "/assessments/1/sessions/3/portfolio#skill-12");
  });

  it("shows both the overall summary and the culture narrative", () => {
    renderPage({ phase: "ready", report: report() });

    expect(screen.getByText(/Solid on data work/)).toBeInTheDocument();
    expect(screen.getByText(/Collaborative and explicit/)).toBeInTheDocument();
  });

  it("does not show the review prompt when every skill is rated with evidence", () => {
    renderPage({ phase: "ready", report: report({ skill_comparisons: [comparison(), notCovered()] }) });

    expect(screen.queryByText(/needs your review before/)).not.toBeInTheDocument();
  });

  it("clamps a very long narrative behind Show more", async () => {
    renderPage({ phase: "ready", report: report({ overall_narrative: "Detail. ".repeat(80), culture_narrative: null }) });

    const toggle = screen.getByRole("button", { name: "Show more" });
    await userEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Show less" })).toBeInTheDocument();
  });

  it("keeps the previous result visible while updating and disables export", () => {
    renderPage({ phase: "generating", report: report(), updating: true });

    expect(screen.getByText(/Updating with the latest ratings/)).toBeInTheDocument();
    expect(screen.getByText("System Design")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /PDF/ })).toBeDisabled();
  });

  it("explains a first-time computation instead of an empty page", () => {
    renderPage({ phase: "generating" });

    expect(screen.getByText(/Comparing the portfolio with this role's requirements/)).toBeInTheDocument();
  });

  it("offers to check again when it takes too long", async () => {
    const { retry } = renderPage({ phase: "slow" });

    await userEvent.click(screen.getByRole("button", { name: /check again/i }));
    expect(retry).toHaveBeenCalled();
  });

  it("offers a retry when the server cannot be reached", async () => {
    const { retry } = renderPage({ phase: "error" });

    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(retry).toHaveBeenCalled();
  });

  it("guides to the vacancy when it has no requirements", () => {
    renderPage({ phase: "ready", report: report({ skill_comparisons: [] }) });

    expect(screen.getByText("This vacancy has no skill requirements yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add requirements" })).toHaveAttribute("href", "/vacancies/9/edit");
  });

  it("points to the portfolio when it is not ready", () => {
    renderPage({ phase: "portfolio_not_ready" });

    expect(screen.getByRole("link", { name: "Go to portfolio" })).toBeInTheDocument();
  });

  it("orders verdict rows as the API sends them (decision first)", () => {
    renderPage({
      phase: "ready",
      report: report({ skill_comparisons: [comparison({ result: "gap", skill_label: "Go", delta: -1 }), needsReview(), comparison()] }),
    });

    const headings = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(headings.slice(0, 3)).toEqual(["Go", "System Design", "SQL"]);
  });
});

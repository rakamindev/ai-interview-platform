import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FitGapReportPage from "@/pages/fitgap/FitGapReportPage";
import { portfoliosApi } from "@/services/portfolios";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import type { FitGapReport } from "@/types";
import { renderWithQueryClient } from "@/test/renderWithQueryClient";
import { portfolioKeys } from "@/lib/queryKeys";

vi.mock("@/services/sessions", () => ({
  sessionsApi: { getPortfolio: vi.fn(), get: vi.fn() },
}));

vi.mock("@/services/vacancies", () => ({
  vacanciesApi: { get: vi.fn() },
}));

vi.mock("@/services/portfolios", () => ({
  portfoliosApi: {
    getFitGap: vi.fn(),
    triggerFitGap: vi.fn(),
    regenerateFitGap: vi.fn(),
    exportPortfolio: vi.fn(),
  },
}));

const portfolio = {
  id: 25,
  session_id: 29,
  generation_status: "complete" as const,
  skills: [],
  overrides: [],
};

const report: FitGapReport = {
  id: 3,
  portfolio_id: 25,
  vacancy_id: 4,
  skill_comparisons: [
    {
      skill_id: "react",
      skill_label: "React",
      expected_level: 4,
      candidate_level: 3,
      ai_level: 2,
      rating_source: "assessor_override",
      result: "gap",
      delta: -1,
      confidence: "high",
    },
  ],
  culture_narrative: "Previous result",
  overall_narrative: "Previous result",
  generated_at: "2026-10-24T10:00:00Z",
  generation_status: "complete",
  generation_error: null,
  freshness: "current",
  has_completed_report: true,
};

const getPortfolioMock = sessionsApi.getPortfolio as ReturnType<typeof vi.fn>;
const getSessionMock = sessionsApi.get as ReturnType<typeof vi.fn>;
const getVacancyMock = vacanciesApi.get as ReturnType<typeof vi.fn>;
const getFitGapMock = portfoliosApi.getFitGap as ReturnType<typeof vi.fn>;
const exportPortfolioMock = portfoliosApi.exportPortfolio as ReturnType<typeof vi.fn>;
function renderPage() {
  return renderWithQueryClient(
    <MemoryRouter initialEntries={["/assessments/17/sessions/29/portfolio/fit-gap/4"]}>
      <Routes>
        <Route
          path="/assessments/:id/sessions/:sessionId/portfolio/fit-gap/:vacancyId"
          element={<FitGapReportPage />}
        />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  getPortfolioMock.mockResolvedValue({ data: { portfolio } });
  getSessionMock.mockResolvedValue({ data: { session: { candidate_name: "Musa" } } });
  getVacancyMock.mockResolvedValue({
    data: {
      vacancy: {
        id: 4,
        role_title: "Senior Frontend Engineer",
        culture_dimensions: "Collaborative",
        competency_expectations: "Frontend delivery",
        skills: [],
      },
    },
  });
  exportPortfolioMock.mockResolvedValue({ data: new Blob(["pdf"]) });
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: vi.fn(() => "blob:fit-gap"),
    revokeObjectURL: vi.fn(),
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
});

describe("FitGapReportPage freshness", () => {
  it("shows vacancy context and a requirement-based fit summary", async () => {
    getFitGapMock.mockResolvedValue({
      data: {
        report: {
          ...report,
          skill_comparisons: [
            report.skill_comparisons[0],
            {
              skill_id: "typescript",
              skill_label: "TypeScript",
              expected_level: 3,
              candidate_level: 3,
              result: "match",
              confidence: "medium",
            },
            {
              skill_id: "testing",
              skill_label: "Testing",
              expected_level: 3,
              candidate_level: null,
              result: "not_assessed",
              confidence: null,
            },
          ],
        },
      },
    });

    renderPage();

    expect(await screen.findByText("Musa · Senior Frontend Engineer")).toBeInTheDocument();
    expect(await screen.findByLabelText("Role fit estimate: 50")).toHaveTextContent("50%");
    expect(screen.getByLabelText("Meets or exceeds: 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Skill gaps: 1")).toHaveTextContent("1 not assessed");
    expect(screen.getByText(/not a hiring decision/i)).toBeInTheDocument();
  });

  it("keeps the previous report visible and blocks export while updating", async () => {
    getFitGapMock.mockResolvedValue({
      data: { report: { ...report, generation_status: "generating", freshness: "updating" } },
    });

    renderPage();

    expect(await screen.findByText("Updating")).toBeInTheDocument();
    expect(screen.getByText("Previous result")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "PDF" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "JSON" })).toBeDisabled();
  });

  it("refreshes immediately when the page regains focus", async () => {
    getFitGapMock.mockResolvedValue({ data: { report } });
    renderPage();
    await screen.findByText("Current");
    getFitGapMock.mockClear();

    window.dispatchEvent(new Event("focus"));

    await waitFor(() => expect(getFitGapMock).toHaveBeenCalledWith(25, 4));
  });

  it("pauses polling while the page is hidden", async () => {
    getFitGapMock.mockResolvedValue({ data: { report } });
    const { client } = renderPage();
    await screen.findByText("Current");

    const query = client.getQueryCache().find({ queryKey: portfolioKeys.fitGap(25, 4) });
    const polling = query?.options as {
      refetchInterval: number;
      refetchIntervalInBackground: boolean;
    };
    expect(polling.refetchInterval).toBe(5_000);
    expect(polling.refetchIntervalInBackground).toBe(false);
  });

  it("requires confirmation before exporting a failed stale report", async () => {
    getFitGapMock.mockResolvedValue({
      data: {
        report: {
          ...report,
          generation_status: "failed",
          freshness: "failed",
          generation_error: "Report regeneration failed. Please try again.",
        },
      },
    });

    renderPage();
    expect(await screen.findByText("Update failed")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "PDF" }));
    expect(await screen.findByText("Export an outdated report?")).toBeInTheDocument();
    expect(exportPortfolioMock).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Export stale report" }));
    await waitFor(() => {
      expect(exportPortfolioMock).toHaveBeenCalledWith(25, "pdf", 4, true);
    });
  });
});

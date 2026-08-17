import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { renderWithProviders } from "@/test/utils";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { Routes, Route } from "react-router-dom";
import FitGapReportPage from "./FitGapReportPage";
import type { FitGapReport, Portfolio } from "@/types";

const { portfoliosApiMock, sessionsApiMock, vacanciesApiMock } = vi.hoisted(() => ({
  portfoliosApiMock: {
    exportPortfolio: vi.fn(),
    getFitGap: vi.fn(),
    triggerFitGap: vi.fn(),
    regenerateFitGap: vi.fn(),
  },
  sessionsApiMock: {
    get: vi.fn(),
    live: vi.fn(),
    endSession: vi.fn(),
    revoke: vi.fn(),
    getCoverage: vi.fn(),
    getTranscript: vi.fn(),
    getPortfolio: vi.fn(),
    regeneratePortfolio: vi.fn(),
    getCandidateInfo: vi.fn(),
    audioComplete: vi.fn(),
  },
  vacanciesApiMock: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/services/portfolios", () => ({ portfoliosApi: portfoliosApiMock }));
vi.mock("@/services/sessions", () => ({ sessionsApi: sessionsApiMock }));
vi.mock("@/services/vacancies", () => ({ vacanciesApi: vacanciesApiMock }));

const reportFixture: FitGapReport = {
  skill_comparisons: [
    { skill_label: "React", required_level: 3, candidate_level: 3, result: "match", delta: 0 },
  ],
  culture_narrative: "Strong culture alignment with async-first teams.",
  overall_narrative: "",
} as FitGapReport;

const portfolioFixture: Portfolio = {
  id: 11,
  session_id: 11,
  generation_status: "complete",
  overrides: [],
  skills: [],
};

function mockLoaded(portfolio = portfolioFixture) {
  sessionsApiMock.getPortfolio.mockResolvedValue({ data: { portfolio } });
  vacanciesApiMock.get.mockResolvedValue({
    data: {
      vacancy: {
        id: 5,
        role_title: "Backend Engineer",
        skills: [{ skill_label: "SQL", expected_level: 4 }],
      },
    },
  });
}

function renderFitGap() {
  renderWithProviders(
    <Routes>
      <Route
        path="/assessments/:id/sessions/:sessionId/fitgap/:vacancyId"
        element={<FitGapReportPage />}
      />
      <Route
        path="/assessments/:id/sessions/:sessionId/portfolio"
        element={<div>PORTFOLIO PAGE</div>}
      />
    </Routes>,
    { route: "/assessments/9/sessions/42/fitgap/5" },
  );
}

describe("FitGapReportPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    portfoliosApiMock.getFitGap.mockResolvedValue({ data: { report: reportFixture } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders loading skeletons while fetching", () => {
    sessionsApiMock.getPortfolio.mockReturnValue(new Promise(() => {}));
    renderFitGap();

    expect(document.querySelectorAll(".animate-pulse")).toHaveLength(2);
  });

  it("renders the report with skill comparison and vacancy context", async () => {
    mockLoaded();
    renderFitGap();

    expect(await screen.findByText("Fit/Gap Report")).toBeInTheDocument();
    expect(screen.getByText("Backend Engineer")).toBeInTheDocument();
    expect(await screen.findByText("Skill Comparison")).toBeInTheDocument();
    expect(screen.getByText("React")).toBeInTheDocument();
    expect(
      screen.getByText("Strong culture alignment with async-first teams."),
    ).toBeInTheDocument();
  });

  it("shows the generating state and triggers a fit/gap run when the report is missing", async () => {
    mockLoaded();
    portfoliosApiMock.getFitGap.mockRejectedValue({ response: { status: 404 } });
    portfoliosApiMock.triggerFitGap.mockResolvedValue({ data: {} });
    renderFitGap();

    expect(await screen.findByText("Generating fit/gap report...")).toBeInTheDocument();
    await waitFor(() => {
      expect(portfoliosApiMock.triggerFitGap).toHaveBeenCalledWith(11, 5);
    });
  });

  it("regenerates the report on demand", async () => {
    mockLoaded();
    portfoliosApiMock.regenerateFitGap.mockResolvedValue({ data: {} });
    renderFitGap();
    await screen.findByText("Skill Comparison");

    fireEvent.click(screen.getByRole("button", { name: /Regenerate/ }));

    await waitFor(() => {
      expect(portfoliosApiMock.regenerateFitGap).toHaveBeenCalledWith(11, 5);
    });
    expect(screen.getByText("Generating fit/gap report...")).toBeInTheDocument();
  });

  it("exports the report as JSON for the vacancy", async () => {
    portfoliosApiMock.exportPortfolio.mockResolvedValue({ data: { ok: true } });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    mockLoaded();
    renderFitGap();
    await screen.findByText("Skill Comparison");

    fireEvent.click(screen.getByRole("button", { name: "JSON" }));

    await waitFor(() => {
      expect(portfoliosApiMock.exportPortfolio).toHaveBeenCalledWith(11, "json", 5);
    });
    clickSpy.mockRestore();
  });

  it("exports the report as PDF for the vacancy", async () => {
    portfoliosApiMock.exportPortfolio.mockResolvedValue({ data: { ok: true } });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    mockLoaded();
    renderFitGap();
    await screen.findByText("Skill Comparison");

    fireEvent.click(screen.getByRole("button", { name: "PDF" }));

    await waitFor(() => {
      expect(portfoliosApiMock.exportPortfolio).toHaveBeenCalledWith(11, "pdf", 5);
    });
    clickSpy.mockRestore();
  });

  it("stays on the empty state when triggering a fit/gap run fails", async () => {
    mockLoaded();
    portfoliosApiMock.getFitGap.mockRejectedValue({ response: { status: 404 } });
    portfoliosApiMock.triggerFitGap.mockRejectedValue(new Error("boom"));
    renderFitGap();

    await waitFor(() => {
      expect(portfoliosApiMock.triggerFitGap).toHaveBeenCalledWith(11, 5);
    });
    expect(screen.queryByText("Generating fit/gap report...")).not.toBeInTheDocument();
    expect(screen.queryByText("Skill Comparison")).not.toBeInTheDocument();
  });

  it("shows discovered skills not in the vacancy requirements", async () => {
    mockLoaded({
      ...portfolioFixture,
      skills: [
        {
          id: 2,
          skill_label: "System Design",
          ai_level: "L2",
          ai_confidence: "medium",
          is_discovered: true,
        } as Portfolio["skills"][number],
      ],
    });
    renderFitGap();

    expect(
      await screen.findByText("Discovered Skills (not in vacancy requirements)"),
    ).toBeInTheDocument();
    expect(screen.getByText("System Design")).toBeInTheDocument();
  });

  it("shows an error state when loading fails", async () => {
    sessionsApiMock.getPortfolio.mockRejectedValue(new Error("boom"));
    renderFitGap();

    expect(await screen.findByText("Failed to load the fit/gap report.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Retry/ }));

    await waitFor(() => {
      expect(sessionsApiMock.getPortfolio).toHaveBeenCalledTimes(2);
    });
  });

  it("renders the vacancy context safely when the vacancy has no skills", async () => {
    sessionsApiMock.getPortfolio.mockResolvedValue({ data: { portfolio: portfolioFixture } });
    vacanciesApiMock.get.mockResolvedValue({
      data: { vacancy: { id: 5, role_title: "Ops Lead", skills: undefined } },
    });
    renderFitGap();

    expect(await screen.findByText("Ops Lead")).toBeInTheDocument();
    // The "· N skills · expected …" annotation is omitted and nothing throws.
    expect(screen.queryByText(/skills · expected/)).not.toBeInTheDocument();
  });
});

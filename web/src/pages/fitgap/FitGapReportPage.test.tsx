import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import FitGapReportPage from "./FitGapReportPage";
import { useFitGapReportPage } from "./useFitGapReportPage";

vi.mock("./useFitGapReportPage", () => ({
  useFitGapReportPage: vi.fn(),
}));

vi.mock("@/components/fitgap/ComparisonTable", () => ({
  default: () => (
    <div data-testid="comparison-table">
      Comparison Table
    </div>
  ),
}));

const mockedUseFitGapReportPage = vi.mocked(useFitGapReportPage);

type ViewModel = ReturnType<typeof useFitGapReportPage>;
type Report = NonNullable<ViewModel["report"]>;
type Portfolio = NonNullable<ViewModel["portfolio"]>;

const createReport = (
  overrides: Partial<Report> = {}
): Report => ({
  id: 1,
  portfolio_id: 1,
  vacancy_id: 1,
  skill_comparisons: [],
  culture_narrative: "Strong culture fit.",
  overall_narrative: "Strong overall fit.",
  generated_at: "2026-08-18T00:00:00Z",
  ...overrides,
});

const createPortfolio = (
  skills: Portfolio["skills"] = []
): Portfolio => ({
  id: 1,
  session_id: 1,
  generation_status: "complete",
  skills,
  overrides: [],
});

const createViewModel = (
  overrides: Partial<ViewModel> = {}
): ViewModel => ({
  id: "assessment-1",
  sessionId: "session-1",
  report: null,
  portfolio: null,
  generating: false,
  loading: false,
  exporting: null,
  regenerating: false,
  handleRegenerate: vi.fn(),
  handleExport: vi.fn(),
  fetchError: null,
  exportError: null,
  refetchData: vi.fn(),
  ...overrides,
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <FitGapReportPage />
    </MemoryRouter>
  );

describe("FitGapReportPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state", () => {
    mockedUseFitGapReportPage.mockReturnValue(
      createViewModel({
        loading: true,
      })
    );

    renderPage();

    expect(
      screen.queryByText("Fit/Gap Report")
    ).not.toBeInTheDocument();
  });

  it("renders fetch error state", () => {
    const refetchData = vi.fn();

    mockedUseFitGapReportPage.mockReturnValue(
      createViewModel({
        fetchError: "Failed to load report.",
        refetchData,
      })
    );

    renderPage();

    expect(
      screen.getByText("Failed to load report.")
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Try Again",
      })
    );

    expect(refetchData).toHaveBeenCalledTimes(1);
  });

  it("renders report header", () => {
    mockedUseFitGapReportPage.mockReturnValue(
      createViewModel({
        report: createReport(),
        portfolio: createPortfolio(),
      })
    );

    renderPage();

    expect(
      screen.getByRole("heading", {
        name: "Fit/Gap Report",
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: /Regenerate/i,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: /PDF/i,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: /JSON/i,
      })
    ).toBeInTheDocument();
  });

  it("calls handleRegenerate", () => {
    const handleRegenerate = vi.fn();

    mockedUseFitGapReportPage.mockReturnValue(
      createViewModel({
        report: createReport(),
        portfolio: createPortfolio(),
        handleRegenerate,
      })
    );

    renderPage();

    fireEvent.click(
      screen.getByRole("button", {
        name: /Regenerate/i,
      })
    );

    expect(handleRegenerate).toHaveBeenCalledTimes(1);
  });

  it("disables regenerate while regenerating", () => {
    mockedUseFitGapReportPage.mockReturnValue(
      createViewModel({
        report: createReport(),
        portfolio: createPortfolio(),
        regenerating: true,
      })
    );

    renderPage();

    expect(
      screen.getByRole("button", {
        name: /Regenerate/i,
      })
    ).toBeDisabled();
  });

  it("disables regenerate while generating", () => {
    mockedUseFitGapReportPage.mockReturnValue(
      createViewModel({
        report: createReport(),
        portfolio: createPortfolio(),
        generating: true,
      })
    );

    renderPage();

    expect(
      screen.getByRole("button", {
        name: /Regenerate/i,
      })
    ).toBeDisabled();
  });

  it("renders generating state", () => {
    mockedUseFitGapReportPage.mockReturnValue(
      createViewModel({
        generating: true,
      })
    );

    renderPage();

    expect(
      screen.getByText("Generating fit/gap report...")
    ).toBeInTheDocument();
  });

  it("renders report content", () => {
    mockedUseFitGapReportPage.mockReturnValue(
      createViewModel({
        report: createReport({
          culture_narrative: "Strong culture fit.",
          overall_narrative: "Strong overall fit.",
        }),
      })
    );

    renderPage();

    expect(
      screen.getByTestId("comparison-table")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Culture & Competency Fit")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Strong culture fit.")
    ).toBeInTheDocument();
  });

  it("falls back to overall narrative", () => {
    mockedUseFitGapReportPage.mockReturnValue(
      createViewModel({
        report: createReport({
          culture_narrative: "",
          overall_narrative: "Strong overall fit.",
        }),
      })
    );

    renderPage();

    expect(
      screen.getByText("Strong overall fit.")
    ).toBeInTheDocument();
  });

  it("calls handleExport with pdf", () => {
    const handleExport = vi.fn();

    mockedUseFitGapReportPage.mockReturnValue(
      createViewModel({
        report: createReport(),
        portfolio: createPortfolio(),
        handleExport,
      })
    );

    renderPage();

    fireEvent.click(
      screen.getByRole("button", {
        name: /PDF/i,
      })
    );

    expect(handleExport).toHaveBeenCalledWith("pdf");
  });

  it("calls handleExport with json", () => {
    const handleExport = vi.fn();

    mockedUseFitGapReportPage.mockReturnValue(
      createViewModel({
        report: createReport(),
        portfolio: createPortfolio(),
        handleExport,
      })
    );

    renderPage();

    fireEvent.click(
      screen.getByRole("button", {
        name: /JSON/i,
      })
    );

    expect(handleExport).toHaveBeenCalledWith("json");
  });

  it("disables export buttons while exporting", () => {
    mockedUseFitGapReportPage.mockReturnValue(
      createViewModel({
        report: createReport(),
        portfolio: createPortfolio(),
        exporting: "pdf",
      })
    );

    renderPage();

    expect(
      screen.getByRole("button", {
        name: /PDF/i,
      })
    ).toBeDisabled();

    expect(
      screen.getByRole("button", {
        name: /JSON/i,
      })
    ).toBeDisabled();
  });

  it("renders export error", () => {
    mockedUseFitGapReportPage.mockReturnValue(
      createViewModel({
        exportError: "Failed to export report.",
      })
    );

    renderPage();

    expect(
      screen.getByText("Failed to export report.")
    ).toBeInTheDocument();
  });

  it("renders discovered skills", () => {
    const skills: Portfolio["skills"] = [
      {
        id: 1,
        skill_label: "TypeScript",
        ai_level: "L4",
        ai_confidence: "high",
        is_discovered: true,
        evidence: ["Used TypeScript extensively."],
        competency_summary: "Strong TypeScript experience.",
      },
    ];

    mockedUseFitGapReportPage.mockReturnValue(
      createViewModel({
        report: createReport(),
        portfolio: createPortfolio(skills),
      })
    );

    renderPage();

    expect(
      screen.getByText("Discovered Skills (not in vacancy requirements)")
    ).toBeInTheDocument();

    expect(screen.getByText("TypeScript")).toBeInTheDocument();

    expect(screen.getByText(/L4/)).toBeInTheDocument();

    expect(screen.getByText(/confirmed/)).toBeInTheDocument();

    expect(
      screen.getByText(
        /Not required for this role, may be additive/
      )
    ).toBeInTheDocument();
  });

  it("renders low confidence discovered skill", () => {
    const skills: Portfolio["skills"] = [
      {
        id: 1,
        skill_label: "GraphQL",
        ai_level: "L3",
        ai_confidence: "low",
        is_discovered: true,
        evidence: ["Used GraphQL in a project."],
        competency_summary: "Some GraphQL experience.",
      },
    ];

    mockedUseFitGapReportPage.mockReturnValue(
      createViewModel({
        report: createReport(),
        portfolio: createPortfolio(skills),
      })
    );

    renderPage();

    expect(
      screen.getByText("Discovered Skills (not in vacancy requirements)")
    ).toBeInTheDocument();

    expect(screen.getByText("GraphQL")).toBeInTheDocument();

    expect(screen.getByText(/L3/)).toBeInTheDocument();

    expect(screen.getByText(/low confidence/)).toBeInTheDocument();
  });

  it("does not render discovered skills section when there are no discovered skills", () => {
    const skills: Portfolio["skills"] = [
      {
        id: 1,
        skill_label: "React",
        ai_level: "L4",
        ai_confidence: "high",
        is_discovered: false,
        evidence: ["Used React extensively."],
        competency_summary: "Strong React experience.",
      },
    ];

    mockedUseFitGapReportPage.mockReturnValue(
      createViewModel({
        report: createReport(),
        portfolio: createPortfolio(skills),
      })
    );

    renderPage();

    expect(
      screen.queryByText(
        "Discovered Skills (not in vacancy requirements)"
      )
    ).not.toBeInTheDocument();
  });
});
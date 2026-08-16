import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import FitGapReportPage from "./FitGapReportPage";
import { sessionsApi } from "@/services/sessions";
import { portfoliosApi } from "@/services/portfolios";

vi.mock("@/hooks/usePolling", () => ({
  usePolling: vi.fn(),
}));

vi.mock("@/services/sessions", () => ({
  sessionsApi: {
    getPortfolio: vi.fn(),
  },
}));

vi.mock("@/services/portfolios", () => ({
  portfoliosApi: {
    getFitGap: vi.fn(),
    regenerateFitGap: vi.fn(),
    exportPortfolio: vi.fn(),
  },
}));

const portfolio = {
  id: 10,
  session_id: 2,
  generation_status: "complete" as const,
  skills: [],
  overrides: [],
};

function report(narrativeStatus: "pending" | "failed") {
  return {
    id: 20,
    portfolio_id: 10,
    vacancy_id: 3,
    skill_comparisons: [
      {
        skill_label: "React",
        skill_id: "react",
        expected_level: 3,
        candidate_level: 2,
        result: "gap" as const,
        delta: -1,
        confidence: "high",
        is_override: false,
        caveat: null,
      },
    ],
    summary: {
      match_count: 0,
      exceed_count: 0,
      gap_count: 1,
      not_assessed_count: 0,
      priority_gaps: ["React"],
    },
    caveats: [],
    additional_skill_signals: [],
    culture_narrative: narrativeStatus === "pending" ? null : null,
    overall_narrative: narrativeStatus === "pending" ? null : null,
    narrative_status: narrativeStatus,
    narrative_error: narrativeStatus === "failed" ? "Narrative generation failed" : null,
    generated_at: "2026-08-15T00:00:00Z",
  };
}

function fullReport() {
  return {
    id: 20,
    portfolio_id: 10,
    vacancy_id: 3,
    skill_comparisons: [
      {
        skill_label: "React",
        skill_id: "react",
        expected_level: 3,
        candidate_level: 2,
        result: "gap" as const,
        delta: -1,
        confidence: "high",
        is_override: false,
        caveat: null,
      },
      {
        skill_label: "Communication",
        skill_id: "communication",
        expected_level: 3,
        candidate_level: null,
        result: "not_assessed" as const,
        delta: null,
        confidence: null,
        is_override: false,
        caveat: "No usable evidence",
      },
      {
        skill_label: "TypeScript",
        skill_id: "typescript",
        expected_level: 3,
        candidate_level: 4,
        result: "exceed" as const,
        delta: 1,
        confidence: "high",
        is_override: false,
        caveat: null,
      },
      {
        skill_label: "Node.js",
        skill_id: "node",
        expected_level: 2,
        candidate_level: 2,
        result: "match" as const,
        delta: 0,
        confidence: "high",
        is_override: false,
        caveat: null,
      },
    ],
    summary: {
      match_count: 1,
      exceed_count: 1,
      gap_count: 1,
      not_assessed_count: 1,
      priority_gaps: ["React"],
    },
    caveats: ["1 required skill has no usable evidence."],
    additional_skill_signals: [
      {
        skill_id: "graphql",
        skill_label: "GraphQL",
        candidate_level: 2,
        confidence: "low",
        is_override: false,
        caveat: null,
      },
    ],
    culture_narrative: null,
    overall_narrative: null,
    narrative_status: "complete" as const,
    narrative_error: null,
    generated_at: "2026-08-15T00:00:00Z",
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/assessments/1/sessions/2/fitgap/3"]}>
      <Routes>
        <Route path="/assessments/:id/sessions/:sessionId/fitgap/:vacancyId" element={<FitGapReportPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("FitGapReportPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(sessionsApi.getPortfolio).mockResolvedValue({ data: { portfolio } } as never);
  });

  it("keeps comparison visible while narrative is pending", async () => {
    vi.mocked(portfoliosApi.getFitGap).mockResolvedValue({ data: { report: report("pending") } } as never);

    renderPage();

    await waitFor(() => expect(screen.getByText("Comparison is ready. AI narrative is still generating.")).toBeInTheDocument());
    expect(screen.getByText("Comparison Summary")).toBeInTheDocument();
    expect(screen.getByText("Narrative is being generated. Comparison remains available.")).toBeInTheDocument();
    expect(screen.getAllByText("React").length).toBeGreaterThan(0);
  });

  it("shows explicit retry state when narrative fails", async () => {
    vi.mocked(portfoliosApi.getFitGap).mockResolvedValue({ data: { report: report("failed") } } as never);

    renderPage();

    await waitFor(() => expect(screen.getByText("Narrative unavailable")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    expect(screen.getByText("Comparison Summary")).toBeInTheDocument();
  });

  it("filters required-skill rows by gap, unassessed, and fit", async () => {
    const reportWithoutPriorityCard = {
      ...fullReport(),
      summary: { ...fullReport().summary, priority_gaps: [] as string[] },
    };
    vi.mocked(portfoliosApi.getFitGap).mockResolvedValue({ data: { report: reportWithoutPriorityCard } } as never);

    renderPage();

    await waitFor(() => expect(screen.getByText("Comparison Summary")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Gaps" }));
    expect(screen.getAllByText("React").length).toBeGreaterThan(0);
    expect(screen.queryByText("TypeScript")).not.toBeInTheDocument();
    expect(screen.queryByText("Communication")).not.toBeInTheDocument();
    expect(screen.queryByText("Node.js")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Unassessed" }));
    expect(screen.getAllByText("Communication").length).toBeGreaterThan(0);
    expect(screen.queryByText("React")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Fit" }));
    expect(screen.getAllByText("TypeScript").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Node.js").length).toBeGreaterThan(0);
    expect(screen.queryByText("Communication")).not.toBeInTheDocument();
  });

  it("shows priority gaps, caveats, and additional skill signals", async () => {
    vi.mocked(portfoliosApi.getFitGap).mockResolvedValue({ data: { report: fullReport() } } as never);

    renderPage();

    await waitFor(() => expect(screen.getByText("Priority gaps")).toBeInTheDocument());
    expect(screen.getByText(/1 required skill has no usable evidence/i)).toBeInTheDocument();
    expect(screen.getByText("Additional Skill Signals")).toBeInTheDocument();
    expect(screen.getByText("GraphQL")).toBeInTheDocument();
    expect(screen.getByText(/not required for this vacancy/i)).toBeInTheDocument();
  });

  it("retries narrative generation when narrative fails", async () => {
    vi.mocked(portfoliosApi.getFitGap).mockResolvedValue({ data: { report: report("failed") } } as never);
    vi.mocked(portfoliosApi.regenerateFitGap).mockResolvedValue({ data: { report: report("pending") } } as never);

    renderPage();

    await waitFor(() => expect(screen.getByText("Narrative unavailable")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    await waitFor(() => expect(portfoliosApi.regenerateFitGap).toHaveBeenCalledWith(10, 3));
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PortfolioPage from "@/pages/portfolio/PortfolioPage";
import FitGapReportPage from "@/pages/fitgap/FitGapReportPage";
import SkillPortfolioCard from "@/components/portfolio/SkillPortfolioCard";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { portfoliosApi } from "@/services/portfolios";
import type { Portfolio, PortfolioSkill, SkillComparison, FitGapReport } from "@/types";
import type { AxiosResponse } from "axios";

vi.mock("@/services/sessions", () => ({
  sessionsApi: {
    getPortfolio: vi.fn(),
    regeneratePortfolio: vi.fn(),
    get: vi.fn(),
  },
}));

vi.mock("@/services/vacancies", () => ({
  vacanciesApi: {
    list: vi.fn(),
  },
}));

vi.mock("@/services/portfolios", () => ({
  portfoliosApi: {
    getOverride: vi.fn(),
    getFitGap: vi.fn(),
    triggerFitGap: vi.fn(),
    regenerateFitGap: vi.fn(),
    exportPortfolio: vi.fn(),
  },
}));

function mockAxiosResponse<T>(data: T): AxiosResponse<T> {
  return {
    data,
    status: 200,
    statusText: "OK",
    headers: {},
    config: {} as AxiosResponse["config"],
  };
}

const sampleSkillA: PortfolioSkill = {
  id: 101,
  skill_id: "SK-ENG-001",
  skill_label: "System Design",
  ai_level: 2,
  ai_confidence: "medium",
  competency_summary: "Handled moderate scale service decomposition.",
  evidence: ["I split the monolith into billing and order services."],
  is_discovered: false,
  probe_count: 3,
  coverage_state: "covered",
};

const sampleSkillB: PortfolioSkill = {
  id: 102,
  skill_id: "SK-ENG-002",
  skill_label: "SQL Optimization",
  ai_level: 3,
  ai_confidence: "high",
  competency_summary: "Detailed query plan analysis.",
  evidence: [],
  is_discovered: false,
  probe_count: 2,
  coverage_state: "partial",
};

const samplePortfolio: Portfolio = {
  id: 55,
  session_id: 10,
  generation_status: "complete",
  generated_at: "2026-10-18T12:00:00Z",
  skills: [sampleSkillA, sampleSkillB],
  overrides: [],
  session_summary: {
    status: "ended",
    end_reason: "manual_candidate",
    duration_seconds: 120,
    configured_skills_count: 4,
    assessed_skills_count: 2,
    covered_skills_count: 1,
    unassessed_skills_count: 2,
  },
  unassessed_skills: [
    {
      skill_id: "SK-ENG-003",
      skill_label: "Incident Management",
      expected_level: 3,
      state: "initiated",
      probe_count: 1,
      reason: "insufficient_evidence",
    },
    {
      skill_id: "SK-ENG-004",
      skill_label: "Cloud Security",
      expected_level: 4,
      state: "not_yet",
      probe_count: 0,
      reason: "not_probed",
    },
  ],
};

describe("Evaluation Workflow — Stage 5B Frontend Verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(vacanciesApi.list).mockResolvedValue(
      mockAxiosResponse({
        vacancies: [
          {
            id: 7,
            role_title: "Senior Backend Engineer",
            culture_dimensions: "High ownership",
            competency_expectations: "Distributed systems",
            skills: [],
          },
        ],
        meta: { current_page: 1, total_pages: 1, total_count: 1, per_page: 20 },
      })
    );
    vi.mocked(sessionsApi.get).mockResolvedValue(
      mockAxiosResponse({
        session: {
          id: 10,
          assessment_id: 1,
          candidate_name: "Rina Pratama",
          invite_token: "tok",
          invite_url: "http://localhost:5173/i/tok",
          status: "ended",
          duration_seconds: 120,
          end_reason: "manual_candidate",
        },
        assessment: { id: 1, name: "Backend Engineering", time_limit_min: 30 },
      })
    );
  });

  describe("PortfolioPage — Session Coverage, 4-Tier Semantics & Async States", () => {
    it("renders SessionCoverageBanner, assessed skills, and UnassessedSkillsSection distinguishing not_probed vs insufficient_evidence", async () => {
      vi.mocked(sessionsApi.getPortfolio).mockResolvedValue(
        mockAxiosResponse({ portfolio: samplePortfolio })
      );

      render(
        <MemoryRouter initialEntries={["/assessments/1/sessions/10/portfolio"]}>
          <Routes>
            <Route path="/assessments/:id/sessions/:sessionId/portfolio" element={<PortfolioPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/2 of 4 configured skills assessed/i)).toBeInTheDocument();
      });

      // SessionCoverageBanner assertions
      expect(screen.getByText("Ended Early by Candidate")).toBeInTheDocument();
      expect(screen.getByText("2m 0s")).toBeInTheDocument();
      const progressbar = screen.getByRole("progressbar", { name: /configured skills assessed/i });
      expect(progressbar).toHaveAttribute("aria-valuenow", "2");
      expect(progressbar).toHaveAttribute("aria-valuemax", "4");

      // Assessed Configured Skills
      expect(screen.getByText("System Design")).toBeInTheDocument();
      expect(screen.getByText("Partially assessed (2 probes)")).toBeInTheDocument();

      // UnassessedSkillsSection assertions
      expect(screen.getByText("Unassessed Skills (2)")).toBeInTheDocument();
      expect(screen.getByText("Incident Management")).toBeInTheDocument();
      expect(screen.getByText("Insufficient Evidence (1 probe)")).toBeInTheDocument();
      expect(screen.getByText("Cloud Security")).toBeInTheDocument();
      expect(screen.getByText("Not Probed (0 probes)")).toBeInTheDocument();
    });

    it("renders failed state with backend error message and triggers regeneratePortfolio on Retry", async () => {
      const user = userEvent.setup();
      vi.mocked(sessionsApi.getPortfolio).mockResolvedValue(
        mockAxiosResponse({
          status: "failed",
          error: "Portfolio generation failed because the AI evaluation service was unavailable.",
        })
      );
      vi.mocked(sessionsApi.regeneratePortfolio).mockResolvedValue(
        mockAxiosResponse({
          message: "Portfolio regeneration started",
          portfolio: { ...samplePortfolio, generation_status: "generating" },
        })
      );

      render(
        <MemoryRouter initialEntries={["/assessments/1/sessions/10/portfolio"]}>
          <Routes>
            <Route path="/assessments/:id/sessions/:sessionId/portfolio" element={<PortfolioPage />} />
          </Routes>
        </MemoryRouter>
      );

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(
        "Portfolio generation failed because the AI evaluation service was unavailable."
      );

      const retryBtn = screen.getByRole("button", { name: /retry generation/i });
      await user.click(retryBtn);

      expect(sessionsApi.regeneratePortfolio).toHaveBeenCalledWith(10);
      expect(await screen.findByText(/generating portfolio/i)).toBeInTheDocument();
    });

    it("renders terminal not-found state on 404 without crashing", async () => {
      vi.mocked(sessionsApi.getPortfolio).mockRejectedValue({
        response: { status: 404 },
      });

      render(
        <MemoryRouter initialEntries={["/assessments/1/sessions/999/portfolio"]}>
          <Routes>
            <Route path="/assessments/:id/sessions/:sessionId/portfolio" element={<PortfolioPage />} />
          </Routes>
        </MemoryRouter>
      );

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(/could not be found in your workspace/i);
    });
  });

  describe("SkillPortfolioCard, OverridePanel & LevelRadio — Accessibility & Validation", () => {
    it("generates unique radio input IDs across multiple cards and enforces >= 5 char rationale validation, error preservation, and override save", async () => {
      const user = userEvent.setup();
      const onOverrideSavedA = vi.fn();
      const onOverrideSavedB = vi.fn();

      render(
        <div>
          <SkillPortfolioCard skill={sampleSkillA} onOverrideSaved={onOverrideSavedA} />
          <SkillPortfolioCard skill={sampleSkillB} onOverrideSaved={onOverrideSavedB} />
        </div>
      );

      const overrideButtons = screen.getAllByRole("button", { name: /override rating/i });
      expect(overrideButtons).toHaveLength(2);

      // Open both override panels to verify LevelRadio ID uniqueness
      await user.click(overrideButtons[0]);
      await user.click(overrideButtons[1]);

      const allRadios = screen.getAllByRole("radio");
      const ids = allRadios.map((r) => r.getAttribute("id")).filter(Boolean);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);

      // Close second panel with Escape key
      await user.keyboard("{Escape}");
      expect(screen.getAllByRole("radiogroup")).toHaveLength(1);

      // Try submitting first panel with short rationale (< 5 chars)
      const saveBtn = screen.getByRole("button", { name: /save override/i });
      const notesInput = screen.getByLabelText(/override rationale/i);
      await user.type(notesInput, "ok");
      await user.click(saveBtn);

      expect(await screen.findByRole("alert")).toHaveTextContent(/at least 5 characters/i);
      expect(portfoliosApi.getOverride).not.toHaveBeenCalled();

      // Simulate API error on valid input with Rails ApiController error format and verify notes are preserved
      vi.mocked(portfoliosApi.getOverride).mockRejectedValueOnce({
        response: { data: { errors: [{ status: 422, message: "Database lock timeout" }] } },
      });

      await user.clear(notesInput);
      await user.type(notesInput, "Candidate demonstrated strong distributed caching patterns.");
      const l4Radio = screen.getByRole("radio", { name: /L4/i });
      await user.click(l4Radio);
      await user.click(saveBtn);

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Database lock timeout (Your changes have been preserved.)"
      );
      expect(notesInput).toHaveValue("Candidate demonstrated strong distributed caching patterns.");

      // Now simulate successful save
      vi.mocked(portfoliosApi.getOverride).mockResolvedValueOnce(
        mockAxiosResponse({
          override: {
            id: 901,
            portfolio_skill_id: 101,
            ai_level: 2,
            override_level: 4,
            assessor_notes: "Candidate demonstrated strong distributed caching patterns.",
            overridden_by: 1,
            overridden_at: "2026-10-18T12:30:00Z",
          },
        })
      );

      await user.click(saveBtn);

      await waitFor(() => {
        expect(onOverrideSavedA).toHaveBeenCalledWith(
          expect.objectContaining({
            override_level: 4,
            assessor_notes: "Candidate demonstrated strong distributed caching patterns.",
          })
        );
      });
    });

    it("renders the Latest Assessor Override block when an override prop is provided", () => {
      render(
        <SkillPortfolioCard
          skill={sampleSkillA}
          override={{
            id: 901,
            portfolio_skill_id: 101,
            ai_level: 2,
            override_level: 4,
            assessor_notes: "Strong production ownership verified in follow-up.",
            overridden_by: 1,
            overridden_at: "2026-10-18T12:30:00Z",
          }}
          onOverrideSaved={vi.fn()}
        />
      );

      expect(screen.getByText(/Latest Assessor Override: AI L2 → Assessor L4/i)).toBeInTheDocument();
      expect(
        screen.getByText("Strong production ownership verified in follow-up.")
      ).toBeInTheDocument();
    });
  });

  describe("FitGapReportPage & ComparisonTable — Status Contract, Narratives & Table Columns", () => {
    it("treats HTTP 404 from getFitGap as terminal not_found and never calls triggerFitGap", async () => {
      vi.mocked(sessionsApi.getPortfolio).mockResolvedValue(
        mockAxiosResponse({ portfolio: samplePortfolio })
      );
      vi.mocked(portfoliosApi.getFitGap).mockRejectedValue({
        response: { status: 404, data: { error: "Resource not found" } },
      });

      render(
        <MemoryRouter initialEntries={["/assessments/1/sessions/10/fitgap/999"]}>
          <Routes>
            <Route
              path="/assessments/:id/sessions/:sessionId/fitgap/:vacancyId"
              element={<FitGapReportPage />}
            />
          </Routes>
        </MemoryRouter>
      );

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(/not found in your workspace/i);
      expect(portfoliosApi.triggerFitGap).not.toHaveBeenCalled();
    });

    it("calls triggerFitGap exactly once when status is not_generated", async () => {
      vi.mocked(sessionsApi.getPortfolio).mockResolvedValue(
        mockAxiosResponse({ portfolio: samplePortfolio })
      );
      vi.mocked(portfoliosApi.getFitGap).mockResolvedValue(
        mockAxiosResponse({ status: "not_generated", report: null })
      );
      vi.mocked(portfoliosApi.triggerFitGap).mockResolvedValue(
        mockAxiosResponse({ status: "generating", message: "Fit/Gap generation started" })
      );

      render(
        <MemoryRouter initialEntries={["/assessments/1/sessions/10/fitgap/7"]}>
          <Routes>
            <Route
              path="/assessments/:id/sessions/:sessionId/fitgap/:vacancyId"
              element={<FitGapReportPage />}
            />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(portfoliosApi.triggerFitGap).toHaveBeenCalledTimes(1);
      });
      expect(portfoliosApi.triggerFitGap).toHaveBeenCalledWith(55, 7);
      expect(screen.getByText(/generating fit\/gap report/i)).toBeInTheDocument();
    });

    it("renders both Overall Hiring Recommendation and Culture & Competency Fit narratives, Required levels, override provenance, and Not assessed count when ready", async () => {
      const comparisons: SkillComparison[] = [
        {
          skill_id: "SK-ENG-001",
          skill_label: "System Design",
          required_level: 3,
          expected_level: 3,
          candidate_level: 4,
          ai_level: 2,
          is_override: true,
          assessor_notes: "Upgraded to L4 based on payment gateway design.",
          confidence: "medium",
          result: "exceed",
          delta: 1,
          assessment_status: "covered",
        },
        {
          skill_id: "SK-ENG-002",
          skill_label: "SQL Optimization",
          required_level: 3,
          expected_level: 3,
          candidate_level: 3,
          ai_level: 3,
          is_override: false,
          assessor_notes: null,
          confidence: "high",
          result: "match",
          delta: 0,
          assessment_status: "partial",
        },
        {
          skill_id: "SK-ENG-005",
          skill_label: "Kubernetes",
          required_level: 4,
          expected_level: 4,
          candidate_level: 2,
          ai_level: 2,
          is_override: false,
          assessor_notes: null,
          confidence: "medium",
          result: "gap",
          delta: -2,
          assessment_status: "covered",
        },
        {
          skill_id: "SK-ENG-003",
          skill_label: "Incident Management",
          required_level: 3,
          expected_level: 3,
          candidate_level: null,
          ai_level: null,
          is_override: false,
          assessor_notes: null,
          confidence: null,
          result: "not_assessed",
          delta: null,
          assessment_status: "insufficient_evidence",
        },
      ];

      const readyReport: FitGapReport = {
        id: 300,
        portfolio_id: 55,
        vacancy_id: 7,
        skill_comparisons: comparisons,
        overall_narrative: "Strong hire recommendation for Senior Backend Engineer.",
        culture_narrative: "Demonstrates high ownership and blameless post-mortem culture.",
        generated_at: "2026-10-18T12:40:00Z",
      };

      vi.mocked(sessionsApi.getPortfolio).mockResolvedValue(
        mockAxiosResponse({ portfolio: samplePortfolio })
      );
      vi.mocked(portfoliosApi.getFitGap).mockResolvedValue(
        mockAxiosResponse({ status: "ready", report: readyReport })
      );

      render(
        <MemoryRouter initialEntries={["/assessments/1/sessions/10/fitgap/7"]}>
          <Routes>
            <Route
              path="/assessments/:id/sessions/:sessionId/fitgap/:vacancyId"
              element={<FitGapReportPage />}
            />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText("Overall Hiring Recommendation")).toBeInTheDocument();
      });

      // Both narratives rendered independently
      expect(
        screen.getByText("Strong hire recommendation for Senior Backend Engineer.")
      ).toBeInTheDocument();
      expect(screen.getByText("Culture & Competency Fit")).toBeInTheDocument();
      expect(
        screen.getByText("Demonstrates high ownership and blameless post-mortem culture.")
      ).toBeInTheDocument();

      // Partial coverage notice rendered when not_assessed skills exist
      expect(
        screen.getByRole("note", { name: /partial interview coverage notice/i })
      ).toHaveTextContent(/1 of 4 required role skills lacked sufficient interview turns/i);

      // ComparisonTable assertions
      expect(screen.getByText("AI L2 → L4")).toBeInTheDocument();
      expect(
        screen.getByText(/Upgraded to L4 based on payment gateway design\./i)
      ).toBeInTheDocument();
      expect(screen.getByText("Partial coverage")).toBeInTheDocument();
      expect(screen.getByText("Insufficient evidence")).toBeInTheDocument();

      // Summary counts include all 4 categories
      expect(screen.getByText(/Match: 1 skill/i)).toBeInTheDocument();
      expect(screen.getByText(/Exceeds: 1 skill/i)).toBeInTheDocument();
      expect(screen.getByText(/Gap: 1 skill/i)).toBeInTheDocument();
      expect(screen.getByText(/Not assessed: 1 skill/i)).toBeInTheDocument();
    });

    it("falls back to expected_level when required_level is absent on legacy reports", () => {
      const legacyComparisons: SkillComparison[] = [
        {
          skill_id: "SK-ENG-010",
          skill_label: "Ruby on Rails",
          expected_level: 4,
          candidate_level: 4,
          confidence: "high",
          result: "match",
          delta: 0,
        },
      ];

      render(<ComparisonTable comparisons={legacyComparisons} />);

      const row = screen.getByText("Ruby on Rails").closest("tr");
      expect(row).not.toBeNull();
      expect(within(row!).getAllByText("L4")).toHaveLength(2);
    });

    it("renders sanitized failure message when FitGap status is failed and calls regenerateFitGap on Retry", async () => {
      const user = userEvent.setup();
      vi.mocked(sessionsApi.getPortfolio).mockResolvedValue(
        mockAxiosResponse({ portfolio: samplePortfolio })
      );
      vi.mocked(portfoliosApi.getFitGap).mockResolvedValue(
        mockAxiosResponse({
          status: "failed",
          error_code: "ai_service_timeout",
          message: "The AI evaluation service timed out while generating this report. Please retry.",
          report: null,
        })
      );
      vi.mocked(portfoliosApi.regenerateFitGap).mockResolvedValue(
        mockAxiosResponse({ status: "generating", message: "Fit/gap report regeneration queued" })
      );

      render(
        <MemoryRouter initialEntries={["/assessments/1/sessions/10/fitgap/7"]}>
          <Routes>
            <Route
              path="/assessments/:id/sessions/:sessionId/fitgap/:vacancyId"
              element={<FitGapReportPage />}
            />
          </Routes>
        </MemoryRouter>
      );

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(
        "The AI evaluation service timed out while generating this report. Please retry."
      );

      const retryBtn = screen.getByRole("button", { name: /retry generation/i });
      await user.click(retryBtn);

      expect(portfoliosApi.regenerateFitGap).toHaveBeenCalledWith(55, 7);
      expect(await screen.findByText(/generating fit\/gap report/i)).toBeInTheDocument();
    });

    it("renders LevelBadge and human override provenance on discovered skills in FitGapReportPage and shows Low AI confidence on unoverridden low-confidence skills", async () => {
      const portfolioWithDiscoveredOverride: Portfolio = {
        ...samplePortfolio,
        skills: [
          ...samplePortfolio.skills,
          {
            ...sampleSkillA,
            id: 103,
            skill_id: "SK-DISC-001",
            skill_label: "GraphQL Federation",
            ai_level: 3,
            is_discovered: true,
          },
        ],
        overrides: [
          ...(samplePortfolio.overrides ?? []),
          {
            id: 902,
            portfolio_skill_id: 103,
            ai_level: 3,
            override_level: 4,
            assessor_notes: "Verified production federation gateway ownership.",
            overridden_by: 1,
            overridden_at: "2026-10-19T10:00:00Z",
          },
        ],
      };

      const lowConfComparison: SkillComparison[] = [
        {
          skill_id: "SK-ENG-002",
          skill_label: "Database Optimization",
          required_level: 3,
          candidate_level: 2,
          ai_level: 2,
          is_override: false,
          confidence: "low",
          assessment_status: "partial",
          result: "gap",
          delta: -1,
        },
      ];

      vi.mocked(sessionsApi.getPortfolio).mockResolvedValue(
        mockAxiosResponse({ portfolio: portfolioWithDiscoveredOverride })
      );
      vi.mocked(portfoliosApi.getFitGap).mockResolvedValue(
        mockAxiosResponse({
          status: "ready",
          report: {
            id: 89,
            portfolio_id: 55,
            vacancy_id: 7,
            overall_fit_score: 70,
            skill_comparisons: lowConfComparison,
            narrative: "Solid candidate with partial database coverage.",
            overall_narrative: "Solid candidate with partial database coverage.",
            generated_at: "2026-10-19T12:00:00Z",
          },
        })
      );

      render(
        <MemoryRouter initialEntries={["/assessments/1/sessions/10/fitgap/7"]}>
          <Routes>
            <Route
              path="/assessments/:id/sessions/:sessionId/fitgap/:vacancyId"
              element={<FitGapReportPage />}
            />
          </Routes>
        </MemoryRouter>
      );

      expect(await screen.findByText("GraphQL Federation")).toBeInTheDocument();
      expect(screen.getByText(/Human override applied \(AI L3 → L4\)/i)).toBeInTheDocument();
      expect(screen.getByText("Low AI confidence")).toBeInTheDocument();
    });
  });
});


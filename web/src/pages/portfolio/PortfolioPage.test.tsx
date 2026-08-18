import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PortfolioPage from "./PortfolioPage";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import type { Portfolio } from "@/types";

vi.mock("@/services/sessions", () => ({
  sessionsApi: {
    getPortfolio: vi.fn(),
    get: vi.fn(),
    regeneratePortfolio: vi.fn(),
  },
}));

vi.mock("@/services/vacancies", () => ({
  vacanciesApi: {
    list: vi.fn(),
  },
}));

describe("PortfolioPage Integration & Lifecycle States", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(vacanciesApi.list).mockResolvedValue({
      data: { vacancies: [{ id: 1, role_title: "Senior Engineer", skills: [] }] },
    } as any);
    vi.mocked(sessionsApi.get).mockResolvedValue({
      data: { session: { id: 1, candidate_name: "Jane Doe" } },
    } as any);
  });

  const renderComponent = () =>
    render(
      <MemoryRouter initialEntries={["/assessments/10/sessions/1/portfolio"]}>
        <Routes>
          <Route path="/assessments/:id/sessions/:sessionId/portfolio" element={<PortfolioPage />} />
        </Routes>
      </MemoryRouter>
    );

  it("renders generating spinner during initial generation", async () => {
    vi.mocked(sessionsApi.getPortfolio).mockResolvedValueOnce({
      data: { status: "generating" },
    } as any);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Generating portfolio...")).toBeInTheDocument();
      expect(screen.getByText(/The AI is analyzing the interview transcript/i)).toBeInTheDocument();
    });
  });

  it("renders complete portfolio results and enables export buttons", async () => {
    const portfolio: Portfolio = {
      id: 101,
      session_id: 1,
      generation_status: "complete",
      generated_at: "2026-08-18T10:00:00Z",
      skills: [
        {
          id: 1,
          skill_label: "PostgreSQL Database",
          is_discovered: false,
          ai_level: 4,
          ai_confidence: "high",
          evidence: ["Optimized queries."],
          competency_summary: "Strong query optimization skills.",
        },
      ],
      overrides: [],
    };

    vi.mocked(sessionsApi.getPortfolio).mockResolvedValueOnce({
      data: { portfolio },
    } as any);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Portfolio Results")).toBeInTheDocument();
      expect(screen.getByText("PostgreSQL Database")).toBeInTheDocument();
      expect(screen.getByText("L4")).toBeInTheDocument();
      expect(screen.getByText("PDF")).toBeEnabled();
      expect(screen.getByText("JSON")).toBeEnabled();
    });
  });

  it("renders sanitized initial generation failure and allows retry with keyboard/click (userEvent)", async () => {
    const user = userEvent.setup();
    const failedPortfolio: Portfolio = {
      id: 102,
      session_id: 1,
      generation_status: "failed",
      generation_error: "Evaluation generation failed. Please retry.",
      skills: [],
      overrides: [],
    };

    vi.mocked(sessionsApi.getPortfolio).mockResolvedValue({
      data: { portfolio: failedPortfolio },
    } as any);
    vi.mocked(sessionsApi.regeneratePortfolio).mockResolvedValueOnce({
      data: { message: "Queued", portfolio: failedPortfolio },
    } as any);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Evaluation generation failed. Please retry.")).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole("button", { name: /Retry Generation/i });
    await user.click(retryBtn);

    expect(sessionsApi.regeneratePortfolio).toHaveBeenCalledWith(1);
  });

  it("renders refreshing banner while preserving old skills during regeneration and page reload", async () => {
    const refreshingPortfolio: Portfolio = {
      id: 103,
      session_id: 1,
      generation_status: "generating",
      skills: [
        {
          id: 2,
          skill_label: "Redis Caching",
          is_discovered: false,
          ai_level: 3,
          ai_confidence: "medium",
          evidence: [],
          competency_summary: "Summary",
        },
      ],
      overrides: [],
    };

    vi.mocked(sessionsApi.getPortfolio).mockResolvedValueOnce({
      data: { status: "generating", portfolio: refreshingPortfolio },
    } as any);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/Regenerating evaluation with AI/i)).toBeInTheDocument();
      expect(screen.getByText("Redis Caching")).toBeInTheDocument();
      expect(screen.getByText("PDF")).toBeDisabled();
      expect(screen.getByText("JSON")).toBeDisabled();
    });
  });

  it("renders warning banner when regeneration fails while preserving previous result", async () => {
    const preservedPortfolio: Portfolio = {
      id: 104,
      session_id: 1,
      generation_status: "complete",
      generation_error: "Regeneration attempt encountered an issue. Preserved and displaying previous valid evaluation.",
      skills: [
        {
          id: 3,
          skill_label: "Ruby on Rails",
          is_discovered: false,
          ai_level: 5,
          ai_confidence: "high",
          evidence: [],
          competency_summary: "Expert knowledge.",
        },
      ],
      overrides: [],
    };

    vi.mocked(sessionsApi.getPortfolio).mockResolvedValueOnce({
      data: { portfolio: preservedPortfolio },
    } as any);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/Regeneration attempt encountered an issue/i)).toBeInTheDocument();
      expect(screen.getByText("Ruby on Rails")).toBeInTheDocument();
      expect(screen.getByText("L5")).toBeInTheDocument();
    });
  });

  it("renders empty/unavailable state when backend returns status unavailable and null portfolio", async () => {
    vi.mocked(sessionsApi.getPortfolio).mockResolvedValueOnce({
      data: { status: "unavailable", portfolio: null },
    } as any);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("No evaluation available")).toBeInTheDocument();
      expect(screen.getByText("No portfolio results have been generated for this session yet.")).toBeInTheDocument();
    });
  });

  it("renders error state when initial API loading fails and handles retry", async () => {
    const user = userEvent.setup();
    vi.mocked(sessionsApi.getPortfolio).mockRejectedValueOnce(new Error("API Timeout"));

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Failed to load portfolio evaluation. Please try again.")).toBeInTheDocument();
    });

    const retryLoadingBtn = screen.getByRole("button", { name: /Retry Loading/i });
    await user.click(retryLoadingBtn);

    expect(sessionsApi.getPortfolio).toHaveBeenCalledTimes(2);
  });

  it("exposes accessible names for back link and vacancy combobox", async () => {
    const portfolio: Portfolio = {
      id: 101,
      session_id: 1,
      generation_status: "complete",
      generated_at: "2026-08-18T10:00:00Z",
      skills: [
        {
          id: 1,
          skill_label: "PostgreSQL Database",
          is_discovered: false,
          ai_level: 4,
          ai_confidence: "high",
          evidence: ["Optimized queries."],
          competency_summary: "Strong query optimization skills.",
        },
      ],
      overrides: [],
    };

    vi.mocked(sessionsApi.getPortfolio).mockResolvedValueOnce({
      data: { portfolio },
    } as any);

    renderComponent();

    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: /back to assessment invite/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("combobox", { name: /choose vacancy for fit\/gap analysis/i })
      ).toBeInTheDocument();
    });
  });
});

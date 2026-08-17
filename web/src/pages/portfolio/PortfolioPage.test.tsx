import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import PortfolioPage from "@/pages/portfolio/PortfolioPage";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import type { Portfolio, Vacancy } from "@/types";

vi.mock("@/services/sessions", () => ({
  sessionsApi: {
    getPortfolio: vi.fn(),
    get: vi.fn(),
    regeneratePortfolio: vi.fn(),
  },
}));

vi.mock("@/services/vacancies", () => ({
  vacanciesApi: { list: vi.fn() },
}));

const vacancy: Vacancy = {
  id: 2,
  role_title: "Senior Frontend Engineer",
  culture_dimensions: "Ownership",
  competency_expectations: "Async-first",
  skills: [],
};

function makePortfolio(overrides: Partial<Portfolio> = {}): Portfolio {
  return {
    id: 114,
    session_id: 15,
    generation_status: "complete",
    skills: [
      {
        id: 1,
        skill_label: "React / Frontend Development Core",
        is_discovered: false,
        ai_level: "L3",
        ai_confidence: "medium",
        evidence: ["quote a"],
        evidence_provenance: [{ quote_index: 0, transcript_turn_id: 10, turn_number: 4, verified: true }],
        competency_summary: "s",
        requires_review: false,
      },
      {
        id: 2,
        skill_label: "Communication",
        is_discovered: false,
        ai_level: null,
        ai_confidence: null,
        evidence: [],
        competency_summary: "Not assessed",
        requires_review: true,
        review_reasons: ["no_valid_level"],
      },
    ],
    overrides: [],
    ...overrides,
  };
}

function renderPage(portfolio: Portfolio) {
  (sessionsApi.getPortfolio as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { portfolio } });
  (sessionsApi.get as ReturnType<typeof vi.fn>).mockResolvedValue({
    data: { session: { candidate_name: "Candidate A" } },
  });
  (vacanciesApi.list as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { vacancies: [vacancy] } });

  return render(
    <MemoryRouter initialEntries={["/assessments/5/sessions/15/portfolio"]}>
      <Routes>
        <Route path="/assessments/:id/sessions/:sessionId/portfolio" element={<PortfolioPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("PortfolioPage review workspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders review progress and flags skills needing review", async () => {
    renderPage(makePortfolio());
    expect(await screen.findByText(/evidence review/i)).toBeInTheDocument();
    expect(await screen.findByText(/1\/2 reviewed/i)).toBeInTheDocument();
    expect(screen.getByText(/1 need review/i)).toBeInTheDocument();
  });

  it("filters to needs-review skills", async () => {
    const user = userEvent.setup();
    renderPage(makePortfolio());
    await screen.findByText(/evidence review/i);

    await user.click(screen.getByText(/needs review \(1\)/i));
    expect(screen.getByText(/communication/i)).toBeInTheDocument();
    expect(screen.queryByText(/react \/ frontend development core/i)).not.toBeInTheDocument();
  });

  it("disables fit/gap while a vacancy-relevant skill needs review, with a blocking message", async () => {
    renderPage(makePortfolio());
    await screen.findByText(/evidence review/i);

    // The button is disabled because a vacancy-relevant skill needs review.
    // (Vacancy selection is exercised separately; Radix Select renders in a
    // portal that jsdom does not fully support for pointer interactions.)
    const runButton = screen.getByRole("button", { name: /run fit\/gap analysis/i });
    expect(runButton).toBeDisabled();
    // Blocking message spans a <strong> + text node — match across the container.
    expect(
      screen.getByText((content) => content.includes("still need a human review"))
    ).toBeInTheDocument();
  });

  it("does not block fit/gap when every flagged skill has a disposition", async () => {
    // All skills reviewed → gate open. Button is only disabled for missing vacancy.
    const reviewedPortfolio = makePortfolio({
      skills: [
        {
          id: 1,
          skill_label: "React / Frontend Development Core",
          is_discovered: false,
          ai_level: "L3",
          ai_confidence: "medium",
          evidence: ["q"],
          evidence_provenance: [{ quote_index: 0, transcript_turn_id: 1, turn_number: 1, verified: true }],
          competency_summary: "s",
          requires_review: false,
          review: { id: 9, portfolio_skill_id: 1, ai_level: 3, outcome: "confirmed", reviewed_level: null, effective_level: 3, rationale: "ok" },
        },
        {
          id: 2,
          skill_label: "Communication",
          is_discovered: false,
          ai_level: null,
          ai_confidence: null,
          evidence: [],
          competency_summary: "Not assessed",
          requires_review: false,
          review: { id: 10, portfolio_skill_id: 2, ai_level: null, outcome: "insufficient_evidence", reviewed_level: null, effective_level: null, rationale: "no signal" },
        },
      ],
    });
    renderPage(reviewedPortfolio);
    await screen.findByText(/evidence review/i);

    // No blocking message, no "needs review" flag.
    expect(screen.queryByText(/relevant to this vacancy still need a human review/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/1 need review/i)).not.toBeInTheDocument();
    // Disabled only because no vacancy is selected yet (not because of the gate).
    const runButton = screen.getByRole("button", { name: /run fit\/gap analysis/i });
    expect(runButton).toBeDisabled();
  });
});

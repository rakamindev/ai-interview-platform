import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import PortfolioPage from "./PortfolioPage";

const mocks = vi.hoisted(() => ({
  getPortfolio: vi.fn(),
  getSession: vi.fn(),
  listVacancies: vi.fn(),
}));

vi.mock("@/services/sessions", () => ({
  sessionsApi: {
    getPortfolio: mocks.getPortfolio,
    get: mocks.getSession,
  },
}));

vi.mock("@/services/vacancies", () => ({
  vacanciesApi: { list: mocks.listVacancies },
}));

describe("PortfolioPage", () => {
  it("links directly to analyzed vacancies with match and gap totals", async () => {
    mocks.getPortfolio.mockResolvedValue({
      data: {
        portfolio: {
          id: 9,
          session_id: 5,
          generation_status: "complete",
          skills: [],
          overrides: [],
          fit_gap_reports: [{
            id: 11,
            portfolio_id: 9,
            vacancy_id: 4,
            vacancy_title: "Senior Backend Engineer",
            skill_comparisons: [
              { skill_label: "Ruby", required_level: 3, candidate_level: 3, result: "match" },
              { skill_label: "SQL", required_level: 3, candidate_level: 2, result: "gap" },
            ],
            culture_narrative: "Aligned",
            overall_narrative: "One gap",
            generated_at: "2026-08-20T00:00:00Z",
          }],
        },
      },
    });
    mocks.listVacancies.mockResolvedValue({ data: { vacancies: [] } });
    mocks.getSession.mockResolvedValue({ data: { session: { candidate_name: "Ayu Pratama" } } });

    render(
      <MemoryRouter initialEntries={["/assessments/1/sessions/5/portfolio"]}>
        <Routes>
          <Route path="/assessments/:id/sessions/:sessionId/portfolio" element={<PortfolioPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("Fit/Gap Analyses History")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Senior Backend Engineer/i });
    expect(link).toHaveAttribute("href", "/assessments/1/sessions/5/fitgap/4");
    expect(link).toHaveTextContent("1 match");
    expect(link).toHaveTextContent("1 gap");
  });
});

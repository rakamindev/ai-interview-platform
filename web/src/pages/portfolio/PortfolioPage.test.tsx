import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

vi.mock("@/services/sessions", () => ({
  sessionsApi: {
    getPortfolio: vi.fn(() => Promise.reject(new Error("boom"))),
    get: vi.fn(() => Promise.reject(new Error("boom"))),
  },
}));
vi.mock("@/services/vacancies", () => ({
  vacanciesApi: { list: vi.fn(() => Promise.reject(new Error("boom"))) },
}));
vi.mock("@/services/portfolios", () => ({ portfoliosApi: {} }));

import PortfolioPage from "@/pages/portfolio/PortfolioPage";

describe("PortfolioPage", () => {
  it("shows an error note when the portfolio fails to load (P4-3)", async () => {
    render(
      <MemoryRouter initialEntries={["/assessments/1/sessions/2/portfolio"]}>
        <Routes>
          <Route path="/assessments/:id/sessions/:sessionId/portfolio" element={<PortfolioPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Failed to load the portfolio/i)).toBeInTheDocument();
  });
});

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import PortfolioPage from "./PortfolioPage";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";

vi.mock("@/services/sessions", () => ({
  sessionsApi: { getPortfolio: vi.fn(), get: vi.fn(), getTranscript: vi.fn(), regeneratePortfolio: vi.fn() },
}));
vi.mock("@/services/vacancies", () => ({ vacanciesApi: { list: vi.fn() } }));
vi.mock("@/services/portfolios", () => ({ portfoliosApi: {} }));

describe("PortfolioPage", () => {
  // Regression: a failed load used to render a blank page with no explanation (silent .catch(() => {})).
  it("shows a load error with retry instead of a blank page", async () => {
    vi.mocked(sessionsApi.getPortfolio).mockRejectedValue(new Error("network"));
    vi.mocked(vacanciesApi.list).mockRejectedValue(new Error("network"));
    vi.mocked(sessionsApi.get).mockRejectedValue(new Error("network"));
    vi.mocked(sessionsApi.getTranscript).mockRejectedValue(new Error("network"));

    render(
      <MemoryRouter initialEntries={["/assessments/1/sessions/2/portfolio"]}>
        <Routes>
          <Route path="/assessments/:id/sessions/:sessionId/portfolio" element={<PortfolioPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load this portfolio");
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });
});

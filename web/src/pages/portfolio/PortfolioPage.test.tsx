import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const { getPortfolio, getSession, listVacancies, regeneratePortfolio } =
  vi.hoisted(() => ({
    getPortfolio: vi.fn(),
    getSession: vi.fn(),
    listVacancies: vi.fn(),
    regeneratePortfolio: vi.fn(),
  }));

vi.mock("@/services/sessions", () => ({
  sessionsApi: {
    getPortfolio,
    get: getSession,
    regeneratePortfolio,
  },
}));

vi.mock("@/services/vacancies", () => ({
  vacanciesApi: { list: listVacancies },
}));

vi.mock("@/services/portfolios", () => ({
  portfoliosApi: {
    exportPortfolio: vi.fn(),
    getOverride: vi.fn(),
    triggerFitGap: vi.fn(),
    getFitGap: vi.fn(),
    regenerateFitGap: vi.fn(),
  },
}));

import PortfolioPage from "./PortfolioPage";

describe("PortfolioPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getPortfolio.mockResolvedValue({
      data: {
        portfolio: {
          id: 10,
          session_id: 20,
          generation_status: "failed",
          generation_error: "AI provider unavailable",
          skills: [],
          overrides: [],
        },
      },
    });

    getSession.mockResolvedValue({
      data: { session: { candidate_name: "Test Candidate" } },
    });

    listVacancies.mockResolvedValue({ data: { vacancies: [] } });
    regeneratePortfolio.mockResolvedValue({ data: {} });
  });

  it("shows the failed state and a Retry button", async () => {
    render(
      <MemoryRouter
        initialEntries={["/assessments/1/sessions/20/portfolio"]}
      >
        <Routes>
          <Route
            path="/assessments/:id/sessions/:sessionId/portfolio"
            element={<PortfolioPage />}
          />
        </Routes>
      </MemoryRouter>
    );

    expect(
      await screen.findByText("Pembuatan portofolio gagal")
    ).toBeInTheDocument();

    expect(screen.getByRole("button", { name: /coba buat ulang/i })).toBeInTheDocument();
  });

  it("requests regeneration when Retry is clicked", async () => {
    render(
      <MemoryRouter
        initialEntries={["/assessments/1/sessions/20/portfolio"]}
      >
        <Routes>
          <Route
            path="/assessments/:id/sessions/:sessionId/portfolio"
            element={<PortfolioPage />}
          />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole("button", { name: /coba buat ulang/i }));

    await waitFor(() => {
      expect(regeneratePortfolio).toHaveBeenCalledWith(20);
    });
  });

  it("shows an error when Retry fails", async () => {
    regeneratePortfolio.mockRejectedValueOnce(new Error("Network unavailable"));

    render(
      <MemoryRouter
        initialEntries={["/assessments/1/sessions/20/portfolio"]}
      >
        <Routes>
          <Route
            path="/assessments/:id/sessions/:sessionId/portfolio"
            element={<PortfolioPage />}
          />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole("button", { name: /coba buat ulang/i }));

    expect(
      await screen.findByText(/Portofolio belum dapat dibuat ulang\. Silakan coba lagi\./i)
    ).toBeInTheDocument();
  });
});

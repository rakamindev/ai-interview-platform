import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { vi, describe, it, expect, beforeEach } from "vitest";
import PortfolioPage from "./PortfolioPage";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";

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

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/assessments/1/sessions/2/portfolio"]}>
      <Routes>
        <Route path="/assessments/:id/sessions/:sessionId/portfolio" element={<PortfolioPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("PortfolioPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (vacanciesApi.list as any).mockResolvedValue({ data: { vacancies: [] } });
  });

  it("shows an error message when loading fails", async () => {
    (sessionsApi.getPortfolio as any).mockRejectedValue(new Error("network error"));
    (sessionsApi.get as any).mockResolvedValue({ data: { session: { candidate_name: "Jane" } } });

    renderPage();

    expect(await screen.findByText(/failed to load portfolio/i)).toBeInTheDocument();
  });

  it("shows an empty state when there are no configured skills", async () => {
    (sessionsApi.getPortfolio as any).mockResolvedValue({
      data: {
        portfolio: { id: 1, session_id: 2, generation_status: "complete", skills: [], overrides: [] },
      },
    });
    (sessionsApi.get as any).mockResolvedValue({ data: { session: { candidate_name: "Jane" } } });

    renderPage();

    expect(await screen.findByText(/no configured skills/i)).toBeInTheDocument();
  });

  it("shows an ended-early badge when the session did not end via full coverage", async () => {
    (sessionsApi.getPortfolio as any).mockResolvedValue({
      data: {
        portfolio: { id: 1, session_id: 2, generation_status: "complete", skills: [], overrides: [] },
      },
    });
    (sessionsApi.get as any).mockResolvedValue({
      data: { session: { candidate_name: "Jane", end_reason: "time_ceiling" } },
    });

    renderPage();

    expect(await screen.findByText(/ended early/i)).toBeInTheDocument();
  });

  it("does not show the ended-early badge when the session covered everything", async () => {
    (sessionsApi.getPortfolio as any).mockResolvedValue({
      data: {
        portfolio: { id: 1, session_id: 2, generation_status: "complete", skills: [], overrides: [] },
      },
    });
    (sessionsApi.get as any).mockResolvedValue({
      data: { session: { candidate_name: "Jane", end_reason: "all_covered" } },
    });

    renderPage();

    await screen.findByText(/no configured skills/i);
    expect(screen.queryByText(/ended early/i)).not.toBeInTheDocument();
  });
});

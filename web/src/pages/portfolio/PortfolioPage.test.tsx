import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PortfolioPage from "./PortfolioPage";

// Mock all services
vi.mock("@/services/sessions", () => ({
  sessionsApi: {
    getPortfolio: vi.fn(),
    get: vi.fn(),
    regeneratePortfolio: vi.fn()
  }
}));
vi.mock("@/services/vacancies", () => ({
  vacanciesApi: {
    list: vi.fn()
  }
}));
vi.mock("@/services/portfolios", () => ({
  portfoliosApi: {
    exportPortfolio: vi.fn()
  }
}));
vi.mock("@/hooks/usePolling", () => ({
  usePolling: vi.fn()
}));

import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { portfoliosApi } from "@/services/portfolios";

const mockSessionsApi = vi.mocked(sessionsApi);
const mockVacanciesApi = vi.mocked(vacanciesApi);
const mockPortfoliosApi = vi.mocked(portfoliosApi);

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/assessments/1/sessions/10/portfolio"]}>
      <Routes>
        <Route path="/assessments/:id/sessions/:sessionId/portfolio" element={<PortfolioPage />} />
        <Route path="/assessments/:id/invite" element={<div>Invite page</div>} />
        <Route
          path="/assessments/:id/sessions/:sessionId/transcript"
          element={<div>Transcript page</div>}
        />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PortfolioPage", () => {
  // AC-6 — API errors surface instead of rendering empty page
  it("shows error state when API calls fail", async () => {
    mockSessionsApi.getPortfolio.mockRejectedValue(new Error("Network error"));
    mockVacanciesApi.list.mockRejectedValue(new Error("Network error"));
    mockSessionsApi.get.mockRejectedValue(new Error("Network error"));

    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText("Failed to load portfolio data. Please try again.")
      ).toBeInTheDocument();
    });
  });

  it("shows generating state while portfolio is generating", async () => {
    mockSessionsApi.getPortfolio.mockResolvedValue({
      data: { data: { portfolio: null, status: "generating" } }
    });
    mockVacanciesApi.list.mockResolvedValue({ data: { vacancies: [] } });
    mockSessionsApi.get.mockResolvedValue({
      data: { session: { candidate_name: "Alice" } }
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Generating portfolio...")).toBeInTheDocument();
    });
  });

  it("shows failed state with retry button", async () => {
    mockSessionsApi.getPortfolio.mockResolvedValue({
      data: {
        data: {
          portfolio: { generation_status: "failed", skills: [], overrides: [], id: 1 },
          status: "done"
        }
      }
    });
    mockVacanciesApi.list.mockResolvedValue({ data: { vacancies: [] } });
    mockSessionsApi.get.mockResolvedValue({
      data: { session: { candidate_name: "Bob" } }
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Portfolio generation failed.")).toBeInTheDocument();
    });
    expect(screen.getByText(/Retry/)).toBeInTheDocument();
  });

  // AC-7.11 — Export wraps errors, not corrupt PDFs
  it("shows error when PDF export fails instead of downloading corrupt blob", async () => {
    mockSessionsApi.getPortfolio.mockResolvedValue({
      data: {
        data: {
          portfolio: {
            id: 5,
            generation_status: "complete",
            skills: [],
            overrides: []
          },
          status: "done"
        }
      }
    });
    mockVacanciesApi.list.mockResolvedValue({ data: { vacancies: [] } });
    mockSessionsApi.get.mockResolvedValue({
      data: { session: { candidate_name: "Carol" } }
    });
    // Export returns JSON error wrapped in Blob
    const errorBlob = new Blob([JSON.stringify({ message: "Export failed: no transcript" })], {
      type: "application/json"
    });
    mockPortfoliosApi.exportPortfolio.mockResolvedValue({
      data: errorBlob,
      headers: { "content-type": "application/json" }
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Portfolio Results")).toBeInTheDocument();
    });

    const pdfButton = screen.getByRole("button", { name: /PDF/ });
    await userEvent.click(pdfButton);

    await waitFor(() => {
      expect(screen.getByText("Export failed: no transcript")).toBeInTheDocument();
    });
  });

  it("shows generic error when export throws", async () => {
    mockSessionsApi.getPortfolio.mockResolvedValue({
      data: {
        data: {
          portfolio: {
            id: 5,
            generation_status: "complete",
            skills: [],
            overrides: []
          },
          status: "done"
        }
      }
    });
    mockVacanciesApi.list.mockResolvedValue({ data: { vacancies: [] } });
    mockSessionsApi.get.mockResolvedValue({
      data: { session: { candidate_name: "Dave" } }
    });
    mockPortfoliosApi.exportPortfolio.mockRejectedValue(new Error("Network error"));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Portfolio Results")).toBeInTheDocument();
    });

    const jsonButton = screen.getByRole("button", { name: /JSON/ });
    await userEvent.click(jsonButton);

    await waitFor(() => {
      expect(screen.getByText("Export failed. Please try again.")).toBeInTheDocument();
    });
  });
});

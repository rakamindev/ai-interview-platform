import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BrowserRouter } from "react-router-dom";
import PortfolioPage from "@/pages/portfolio/PortfolioPage";
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
  vacanciesApi: {
    list: vi.fn(),
  },
}));

describe("PortfolioPage Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (vacanciesApi.list as any).mockResolvedValue({ data: { vacancies: [] } });
    (sessionsApi.get as any).mockResolvedValue({ data: { session: { candidate_name: "Budi Santoso" } } });
  });

  it("renders generating state when portfolio generation is pending or in progress", async () => {
    (sessionsApi.getPortfolio as any).mockResolvedValue({
      data: { status: "generating", portfolio: { generation_status: "generating" } },
    });

    render(
      <BrowserRouter>
        <PortfolioPage />
      </BrowserRouter>
    );

    expect(await screen.findByText(/Generating skill portfolio.../i)).toBeInTheDocument();
  });

  it("renders failed state with retry button when generation fails", async () => {
    (sessionsApi.getPortfolio as any).mockResolvedValue({
      data: {
        portfolio: {
          generation_status: "failed",
          generation_error: "Gemini API rate limit exceeded",
          skills: [],
          overrides: [],
        },
      },
    });

    render(
      <BrowserRouter>
        <PortfolioPage />
      </BrowserRouter>
    );

    expect(await screen.findByText(/Portfolio generation failed/i)).toBeInTheDocument();
    expect(screen.getByText(/Gemini API rate limit exceeded/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Retry Generation/i })).toBeInTheDocument();
  });

  it("renders clean not-found state when portfolio session cannot be found", async () => {
    (sessionsApi.getPortfolio as any).mockRejectedValue({
      response: { status: 404 },
    });

    render(
      <BrowserRouter>
        <PortfolioPage />
      </BrowserRouter>
    );

    expect(await screen.findByText(/Portfolio session not found or has been deleted/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Back to Assessment/i })).toBeInTheDocument();
  });
});

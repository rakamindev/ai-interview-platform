import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PortfolioPage from "@/pages/portfolio/PortfolioPage";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { portfoliosApi } from "@/services/portfolios";
import { usePolling } from "@/hooks/usePolling";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock("@/services/sessions", () => ({
  sessionsApi: {
    get: vi.fn(),
    getPortfolio: vi.fn(),
    regeneratePortfolio: vi.fn(),
  },
}));

vi.mock("@/services/vacancies", () => ({
  vacanciesApi: { list: vi.fn() },
}));

vi.mock("@/services/portfolios", () => ({
  portfoliosApi: { exportPortfolio: vi.fn() },
}));

vi.mock("@/hooks/usePolling", () => ({
  usePolling: vi.fn(),
}));

const samplePortfolio = {
  id: 5,
  session_id: 2,
  generation_status: "complete" as const,
  skills: [
    {
      id: 11,
      skill_label: "React",
      is_discovered: false,
      ai_level: "L3",
      ai_confidence: "high",
      evidence: ["Built a component library"],
      competency_summary: "Solid understanding of component patterns.",
    },
  ],
  overrides: [],
};

function renderPortfolioPage() {
  render(
    <MemoryRouter initialEntries={["/assessments/1/sessions/2/portfolio"]}>
      <Routes>
        <Route path="/assessments/:id/sessions/:sessionId/portfolio" element={<PortfolioPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("PortfolioPage", () => {
  beforeEach(() => {
    navigateMock.mockClear();
    vi.mocked(sessionsApi.get).mockReset();
    vi.mocked(sessionsApi.getPortfolio).mockReset();
    vi.mocked(vacanciesApi.list).mockReset();
    vi.mocked(portfoliosApi.exportPortfolio).mockReset();
    vi.mocked(usePolling).mockReset();

    vi.mocked(sessionsApi.get).mockResolvedValue({
      data: { session: { id: 2, candidate_name: "Jane Doe" } },
    } as never);

    vi.mocked(sessionsApi.getPortfolio).mockResolvedValue({
      data: { portfolio: samplePortfolio },
    } as never);

    vi.mocked(vacanciesApi.list).mockResolvedValue({
      data: {
        vacancies: [{ id: 7, role_title: "Frontend Engineer", skills: [] }],
        meta: { current_page: 1, total_pages: 1, total_count: 1, per_page: 10 },
      },
    } as never);

    globalThis.URL.createObjectURL = vi.fn(() => "blob:mock-url");
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  it("shows a loading state before data resolves", () => {
    vi.mocked(sessionsApi.getPortfolio).mockReturnValue(new Promise(() => {}) as never);
    vi.mocked(vacanciesApi.list).mockReturnValue(new Promise(() => {}) as never);
    vi.mocked(sessionsApi.get).mockReturnValue(new Promise(() => {}) as never);

    renderPortfolioPage();

    expect(screen.queryByText("Portfolio Results")).not.toBeInTheDocument();
  });

  it("renders candidate info, skill cards, and the vacancy selector on success", async () => {
    renderPortfolioPage();

    expect(await screen.findByText("Portfolio Results")).toBeInTheDocument();
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();

    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByText("Built a component library", { exact: false })).toBeInTheDocument();

    expect(screen.getByText("Choose vacancy...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /run fit\/gap analysis/i })).toBeDisabled();
  });

  it("exports the portfolio as PDF when the export button is clicked", async () => {
    vi.mocked(portfoliosApi.exportPortfolio).mockResolvedValueOnce({
      data: new Blob(["pdf-bytes"]),
    } as never);
    const user = userEvent.setup();

    renderPortfolioPage();

    await screen.findByText("Portfolio Results");

    await user.click(screen.getByRole("button", { name: /pdf/i }));

    await waitFor(() =>
      expect(portfoliosApi.exportPortfolio).toHaveBeenCalledWith(5, "pdf", undefined)
    );
  });
});

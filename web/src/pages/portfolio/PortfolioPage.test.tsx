import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import PortfolioPage from "./PortfolioPage";

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

vi.mock("@/hooks/usePolling", () => ({ usePolling: vi.fn() }));

vi.mock("@/components/portfolio/SkillPortfolioCard", () => ({
  default: () => <div data-testid="skill-card" />,
}));

import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { portfoliosApi } from "@/services/portfolios";
import { usePolling } from "@/hooks/usePolling";

const portfolio = {
  id: 7,
  session_id: 11,
  generation_status: "complete",
  skills: [
    {
      id: 1,
      skill_id: 10,
      skill_label: "Python",
      is_discovered: false,
      ai_level: "L3",
      ai_confidence: "high",
      evidence: [],
      competency_summary: "Strong Python experience.",
    },
  ],
  overrides: [],
};

const vacancy = { id: 5, role_title: "Backend Engineer" };

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/assessments/2/sessions/11/portfolio"]}>
      <Routes>
        <Route path="/assessments/:id/sessions/:sessionId/portfolio" element={<PortfolioPage />} />
      </Routes>
    </MemoryRouter>
  );
}

function mockSuccessLoad(overrides: Partial<typeof portfolio> = {}) {
  vi.mocked(sessionsApi.getPortfolio).mockResolvedValue({
    data: { portfolio: { ...portfolio, ...overrides } },
  } as any);
  vi.mocked(vacanciesApi.list).mockResolvedValue({ data: { vacancies: [vacancy] } } as any);
  vi.mocked(sessionsApi.get).mockResolvedValue({
    data: { session: { candidate_name: "Budi Santoso" } },
  } as any);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(usePolling).mockReturnValue(undefined as any);
});

describe("PortfolioPage", () => {
  it("shows an error banner with a working retry when the initial load fails", async () => {
    vi.mocked(sessionsApi.getPortfolio).mockRejectedValue(new Error("boom"));
    vi.mocked(vacanciesApi.list).mockResolvedValue({ data: { vacancies: [vacancy] } } as any);
    vi.mocked(sessionsApi.get).mockResolvedValue({
      data: { session: { candidate_name: "Budi" } },
    } as any);

    renderPage();

    await waitFor(() =>
      expect(screen.getByText("We couldn't load this portfolio. Please try again.")).toBeInTheDocument()
    );

    mockSuccessLoad();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));

    await waitFor(() => expect(screen.getByText("Portfolio Results")).toBeInTheDocument());
    expect(screen.queryByText("We couldn't load this portfolio. Please try again.")).not.toBeInTheDocument();
  });

  it("surfaces an export failure instead of silently clearing the spinner", async () => {
    mockSuccessLoad();
    vi.mocked(portfoliosApi.exportPortfolio).mockRejectedValue(new Error("boom"));

    renderPage();

    await waitFor(() => expect(screen.getByText("Portfolio Results")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /^PDF/ }));

    await waitFor(() =>
      expect(screen.getByText("Could not export the portfolio. Please try again.")).toBeInTheDocument()
    );
  });

  it("shows an error banner when regenerating a failed portfolio fails", async () => {
    mockSuccessLoad({ generation_status: "failed" });
    vi.mocked(sessionsApi.regeneratePortfolio).mockRejectedValue(new Error("boom"));

    renderPage();

    await waitFor(() => expect(screen.getByText("Portfolio generation failed.")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    await waitFor(() =>
      expect(screen.getByText("Could not restart portfolio generation. Please try again.")).toBeInTheDocument()
    );
  });

  it("shows guidance and hides the fit/gap selector when there are no vacancies", async () => {
    mockSuccessLoad();
    vi.mocked(vacanciesApi.list).mockResolvedValue({ data: { vacancies: [] } } as any);

    renderPage();

    await waitFor(() => expect(screen.getByText("Portfolio Results")).toBeInTheDocument());
    expect(screen.getByText(/No vacancies yet/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /run fit\/gap/i })).not.toBeInTheDocument();
  });

  it("shows the generating state when the portfolio is still being generated", async () => {
    vi.mocked(sessionsApi.getPortfolio).mockResolvedValue({ data: { status: "generating" } } as any);
    vi.mocked(vacanciesApi.list).mockResolvedValue({ data: { vacancies: [vacancy] } } as any);
    vi.mocked(sessionsApi.get).mockResolvedValue({
      data: { session: { candidate_name: "Budi" } },
    } as any);

    renderPage();

    await waitFor(() => expect(screen.getByText(/Generating portfolio/)).toBeInTheDocument());
  });
});
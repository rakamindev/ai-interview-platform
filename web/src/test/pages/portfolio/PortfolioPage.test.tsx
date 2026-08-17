import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PortfolioPage from "@/pages/portfolio/PortfolioPage";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import type { Portfolio, PortfolioSkill } from "@/types";

vi.mock("@/services/sessions", () => ({
  sessionsApi: {
    getPortfolio: vi.fn(),
    get: vi.fn(),
  },
}));

vi.mock("@/services/vacancies", () => ({
  vacanciesApi: {
    list: vi.fn(),
  },
}));

vi.mock("@/services/portfolios", () => ({
  portfoliosApi: {
    exportPortfolio: vi.fn(),
    getOverride: vi.fn(),
  },
}));

const getPortfolioMock = vi.mocked(sessionsApi.getPortfolio);
const getSessionMock = vi.mocked(sessionsApi.get);
const listVacanciesMock = vi.mocked(vacanciesApi.list);

function skill(overrides: Partial<PortfolioSkill> = {}): PortfolioSkill {
  return {
    id: 1,
    skill_label: "React",
    is_discovered: false,
    ai_level: 4,
    ai_confidence: "high",
    evidence: [],
    competency_summary: "Strong.",
    ...overrides,
  };
}

function portfolio(overrides: Partial<Portfolio> = {}): Portfolio {
  return {
    id: 1,
    session_id: 9,
    generation_status: "complete",
    verdict: "pass",
    skills: [skill()],
    overrides: [],
    ...overrides,
  };
}

function mockLoaded(p: Portfolio) {
  getPortfolioMock.mockResolvedValue({ data: { portfolio: p } } as any);
  getSessionMock.mockResolvedValue({ data: { session: { candidate_name: "Alice" } } } as any);
  listVacanciesMock.mockResolvedValue({ data: { vacancies: [] } } as any);
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/assessments/1/sessions/9/portfolio"]}>
      <Routes>
        <Route path="/assessments/:id/sessions/:sessionId/portfolio" element={<PortfolioPage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PortfolioPage verdict card", () => {
  it("renders the backend verdict badge, not a client-recomputed one", async () => {
    mockLoaded(portfolio({ verdict: "pass" }));

    renderPage();

    expect(await screen.findByText("Verdict")).toBeInTheDocument();
    expect(screen.getByText("Pass")).toBeInTheDocument();
  });

  it("renders the Consider badge when the backend verdict is consider", async () => {
    mockLoaded(portfolio({ verdict: "consider", skills: [skill({ ai_level: 3 })] }));

    renderPage();

    expect(await screen.findByText("Consider")).toBeInTheDocument();
  });

  it("renders the Failed badge when the backend verdict is failed", async () => {
    mockLoaded(portfolio({ verdict: "failed", skills: [skill({ ai_level: 1 })] }));

    renderPage();

    expect(await screen.findByText("Failed")).toBeInTheDocument();
  });

  it("omits the verdict card entirely when the backend verdict is null, even if skills exist", async () => {
    mockLoaded(portfolio({ verdict: null }));

    renderPage();

    await screen.findByText("Portfolio Results");
    expect(screen.queryByText("Verdict")).not.toBeInTheDocument();
  });

  it("still shows the plain-English summary alongside the backend badge", async () => {
    mockLoaded(
      portfolio({
        verdict: "pass",
        skills: [skill({ id: 1, skill_label: "React", ai_level: 5 })],
      })
    );

    renderPage();

    await screen.findByText("Pass");
    expect(screen.getByText(/Strong across the board/)).toBeInTheDocument();
  });
});

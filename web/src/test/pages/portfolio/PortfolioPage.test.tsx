import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PortfolioPage from "@/pages/portfolio/PortfolioPage";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { candidatesApi } from "@/services/candidates";
import type { Portfolio, PortfolioSkill, Candidate } from "@/types";

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

vi.mock("@/services/candidates", () => ({
  candidatesApi: {
    list: vi.fn(),
  },
}));

const getPortfolioMock = vi.mocked(sessionsApi.getPortfolio);
const getSessionMock = vi.mocked(sessionsApi.get);
const listVacanciesMock = vi.mocked(vacanciesApi.list);
const listCandidatesMock = vi.mocked(candidatesApi.list);

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

function candidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    candidate_id: 2,
    candidate_name: "Bob",
    session_id: 2,
    session_status: "ended",
    interview_status: "completed",
    verdict: "consider",
    ...overrides,
  };
}

function mockLoaded(p: Portfolio) {
  getPortfolioMock.mockResolvedValue({ data: { portfolio: p } } as any);
  getSessionMock.mockResolvedValue({ data: { session: { candidate_name: "Alice" } } } as any);
  listVacanciesMock.mockResolvedValue({ data: { vacancies: [] } } as any);
  listCandidatesMock.mockResolvedValue({
    data: { candidates: [candidate()], meta: { current_page: 1, total_pages: 1, total_count: 1, per_page: 10 } },
  } as any);
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

  it("displays the backend-provided verdict summary verbatim, without recomputing it", async () => {
    mockLoaded(
      portfolio({
        verdict: "pass",
        verdict_summary: "Strong across the board, especially React.",
        skills: [skill({ id: 1, skill_label: "React", ai_level: 5 })],
      })
    );

    renderPage();

    await screen.findByText("Pass");
    expect(screen.getByText("Strong across the board, especially React.")).toBeInTheDocument();
  });
});

describe("PortfolioPage zero-skills empty state", () => {
  it("shows a unified empty state instead of a broken layout when no skills were assessed", async () => {
    mockLoaded(portfolio({ verdict: null, skills: [] }));

    renderPage();

    expect(await screen.findByText("No skills were assessed")).toBeInTheDocument();
    expect(screen.getByText("View transcript").closest("a")).toHaveAttribute(
      "href",
      "/assessments/1/sessions/9/transcript"
    );
  });

  it("does not render the Verdict card, chart grid, or Configured Skills section when there are no skills", async () => {
    mockLoaded(portfolio({ verdict: null, skills: [] }));

    renderPage();

    await screen.findByText("No skills were assessed");
    expect(screen.queryByText("Verdict")).not.toBeInTheDocument();
    expect(screen.queryByText("Skill Levels")).not.toBeInTheDocument();
    expect(screen.queryByText("Skill Profile")).not.toBeInTheDocument();
    expect(screen.queryByText("Configured Skills")).not.toBeInTheDocument();
  });

  it("still renders Fit/Gap below the empty state", async () => {
    mockLoaded(portfolio({ verdict: null, skills: [] }));

    renderPage();

    await screen.findByText("No skills were assessed");
    expect(screen.getByText("Run a Fit/Gap Analysis")).toBeInTheDocument();
  });

  it("renders the normal skills layout, not the empty state, when at least one skill exists", async () => {
    mockLoaded(portfolio({ verdict: null, skills: [skill()] }));

    renderPage();

    await screen.findByText("Configured Skills");
    expect(screen.queryByText("No skills were assessed")).not.toBeInTheDocument();
  });
});

describe("PortfolioPage toolbar responsiveness", () => {
  it("keeps accessible names for Transcript/PDF/JSON/Compare when their text labels are visually hidden on mobile", async () => {
    mockLoaded(portfolio());
    renderPage();
    await screen.findByText("Configured Skills");

    expect(screen.getByRole("link", { name: "Transcript" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download PDF" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download JSON" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Compare" })).toBeInTheDocument();
  });
});

describe("PortfolioPage compare", () => {
  function mockCompareCandidatePortfolio(compareResult: Portfolio | "error") {
    getPortfolioMock.mockImplementation(((sessionId: number) => {
      if (sessionId === 9) return Promise.resolve({ data: { portfolio: portfolio() } });
      if (compareResult === "error") return Promise.reject(new Error("network down"));
      return Promise.resolve({ data: { portfolio: compareResult } });
    }) as any);
  }

  it("opens a picker in a right panel when Compare is clicked", async () => {
    mockLoaded(portfolio());
    renderPage();
    await screen.findByText("Configured Skills");

    fireEvent.click(screen.getByRole("button", { name: /Compare/ }));

    expect(await screen.findByText("Comparing")).toBeInTheDocument();
    expect(await screen.findByText("Bob")).toBeInTheDocument();
  });

  it("loads the selected candidate's portfolio read-only after picking them", async () => {
    mockLoaded(portfolio());
    mockCompareCandidatePortfolio(
      portfolio({ id: 2, session_id: 2, verdict: "failed", skills: [skill({ id: 2, skill_label: "Node.js", ai_level: 1 })] })
    );
    renderPage();
    await screen.findByText("Configured Skills");

    fireEvent.click(screen.getByRole("button", { name: /Compare/ }));
    fireEvent.click(await screen.findByText("Bob"));

    expect((await screen.findAllByText("Node.js")).length).toBeGreaterThan(0);
    expect(screen.getByText("Failed")).toBeInTheDocument();
    // Only the left (own, editable) panel's skill should show the override control.
    expect(screen.getAllByText("Override rating ▼")).toHaveLength(1);
  });

  it("returns to the picker when Change is clicked", async () => {
    mockLoaded(portfolio());
    mockCompareCandidatePortfolio(portfolio({ id: 2, session_id: 2, skills: [skill({ id: 2 })] }));
    renderPage();
    await screen.findByText("Configured Skills");

    fireEvent.click(screen.getByRole("button", { name: /Compare/ }));
    fireEvent.click(await screen.findByText("Bob"));
    await screen.findByText("Change");

    fireEvent.click(screen.getByText("Change"));

    expect(await screen.findByText("Compare with")).toBeInTheDocument();
  });

  it("closes the compare panel entirely when the close button is clicked", async () => {
    mockLoaded(portfolio());
    renderPage();
    await screen.findByText("Configured Skills");

    fireEvent.click(screen.getByRole("button", { name: /Compare/ }));
    await screen.findByText("Comparing");

    fireEvent.click(screen.getByLabelText("Close compare"));

    expect(screen.queryByText("Comparing")).not.toBeInTheDocument();
  });

  it("shows an error state when the compared candidate's portfolio fails to load", async () => {
    mockLoaded(portfolio());
    mockCompareCandidatePortfolio("error");
    renderPage();
    await screen.findByText("Configured Skills");

    fireEvent.click(screen.getByRole("button", { name: /Compare/ }));
    fireEvent.click(await screen.findByText("Bob"));

    expect(await screen.findByText("Couldn't load this candidate's portfolio.")).toBeInTheDocument();
  });

  it("does not show the Compare button while the portfolio is still generating", async () => {
    getPortfolioMock.mockResolvedValue({ data: { status: "generating" } } as any);
    getSessionMock.mockResolvedValue({ data: { session: { candidate_name: "Alice" } } } as any);
    listVacanciesMock.mockResolvedValue({ data: { vacancies: [] } } as any);

    renderPage();

    await screen.findByText("Generating portfolio…");
    expect(screen.queryByRole("button", { name: /Compare/ })).not.toBeInTheDocument();
  });
});

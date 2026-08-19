import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { renderWithProviders } from "@/test/utils";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { Routes, Route } from "react-router-dom";
import PortfolioPage from "./PortfolioPage";
import type { Portfolio } from "@/types";

const { sessionsApiMock, vacanciesApiMock, portfoliosApiMock } = vi.hoisted(() => ({
  sessionsApiMock: {
    get: vi.fn(),
    live: vi.fn(),
    endSession: vi.fn(),
    revoke: vi.fn(),
    getCoverage: vi.fn(),
    getTranscript: vi.fn(),
    getPortfolio: vi.fn(),
    regeneratePortfolio: vi.fn(),
    getCandidateInfo: vi.fn(),
    audioComplete: vi.fn(),
  },
  vacanciesApiMock: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  portfoliosApiMock: { exportPortfolio: vi.fn(), getOverride: vi.fn() },
}));

vi.mock("@/services/sessions", () => ({ sessionsApi: sessionsApiMock }));
vi.mock("@/services/vacancies", () => ({ vacanciesApi: vacanciesApiMock }));
vi.mock("@/services/portfolios", () => ({ portfoliosApi: portfoliosApiMock }));

function portfolioFixture(overrides: Partial<Portfolio> = {}): Portfolio {
  return {
    id: 11,
    generation_status: "complete",
    overrides: [],
    skills: [
      {
        id: 1,
        skill_label: "SQL",
        ai_level: "L4",
        ai_confidence: "high",
        is_discovered: false,
        evidence: ["Wrote optimized queries"],
        competency_summary: "Strong query authoring.",
      } as Portfolio["skills"][number],
      {
        id: 2,
        skill_label: "System Design",
        ai_level: "L2",
        ai_confidence: "medium",
        is_discovered: true,
        evidence: ["Designed a queue-based flow"],
        competency_summary: "Reasonable architecture instincts.",
      } as Portfolio["skills"][number],
    ],
    ...overrides,
  } as Portfolio;
}

function mockLoaded(portfolio = portfolioFixture()) {
  sessionsApiMock.getPortfolio.mockResolvedValue({ data: { portfolio } });
  sessionsApiMock.get.mockResolvedValue({ data: { session: { candidate_name: "Siti" } } });
  sessionsApiMock.getTranscript.mockResolvedValue({ data: { turns: [] } });
  vacanciesApiMock.list.mockResolvedValue({
    data: { vacancies: [{ id: 5, role_title: "Backend Engineer", skills: [] }], meta: {} },
  });
}

function renderPortfolio(route = "/assessments/9/sessions/42/portfolio") {
  renderWithProviders(
    <Routes>
      <Route path="/assessments/:id/sessions/:sessionId/portfolio" element={<PortfolioPage />} />
      <Route
        path="/assessments/:id/sessions/:sessionId/fitgap/:vacancyId"
        element={<div>FITGAP PAGE</div>}
      />
    </Routes>,
    { route },
  );
}

describe("PortfolioPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders loading skeletons while fetching", () => {
    sessionsApiMock.getPortfolio.mockReturnValue(new Promise(() => {}));
    renderPortfolio();

    expect(document.querySelectorAll(".animate-pulse")).toHaveLength(3);
  });

  it("renders the portfolio with configured and discovered skills", async () => {
    mockLoaded();
    renderPortfolio();

    expect(await screen.findByText("Portfolio Results")).toBeInTheDocument();
    expect(screen.getByText("Siti")).toBeInTheDocument();
    expect(screen.getByText("Configured Skills")).toBeInTheDocument();
    expect(screen.getByText("SQL")).toBeInTheDocument();
    expect(screen.getByText("Discovered Skills")).toBeInTheDocument();
    expect(screen.getByText("System Design")).toBeInTheDocument();
  });

  it("shows the generating state when portfolio is not ready", async () => {
    sessionsApiMock.getPortfolio.mockResolvedValue({ data: { status: "generating" } });
    sessionsApiMock.get.mockResolvedValue({ data: { session: { candidate_name: null } } });
    sessionsApiMock.getTranscript.mockResolvedValue({ data: { turns: [] } });
    vacanciesApiMock.list.mockResolvedValue({ data: { vacancies: [] }, meta: {} });
    renderPortfolio();

    expect(await screen.findByText("Generating portfolio...")).toBeInTheDocument();
    expect(
      screen.getByText("The AI is analyzing the interview transcript. This takes about 2 minutes."),
    ).toBeInTheDocument();
  });

  it("shows the failed state and regenerates on retry", async () => {
    mockLoaded(portfolioFixture({ generation_status: "failed" }));
    sessionsApiMock.regeneratePortfolio.mockResolvedValue({ data: {} });
    renderPortfolio();

    expect(await screen.findByText("Portfolio generation failed.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Retry/ }));

    await waitFor(() => {
      expect(sessionsApiMock.regeneratePortfolio).toHaveBeenCalledWith(42);
    });
    expect(screen.getByText("Generating portfolio...")).toBeInTheDocument();
  });

  it("runs fit/gap analysis for the selected vacancy", async () => {
    mockLoaded();
    renderPortfolio();
    await screen.findByText("SQL");

    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(await screen.findByRole("option", { name: /Backend Engineer/ }));
    fireEvent.click(screen.getByRole("button", { name: /Run Fit\/Gap Analysis/ }));

    expect(await screen.findByText("FITGAP PAGE", {}, { timeout: 5000 })).toBeInTheDocument();
  });

  it("exports the portfolio as JSON", async () => {
    portfoliosApiMock.exportPortfolio.mockResolvedValue({ data: { hello: "world" } });
    const createObjectURL = vi.fn(() => "blob:mock");
    URL.createObjectURL = createObjectURL;
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    mockLoaded();
    renderPortfolio();
    await screen.findByText("SQL");

    fireEvent.click(screen.getByRole("button", { name: "JSON" }));

    await waitFor(() => {
      expect(portfoliosApiMock.exportPortfolio).toHaveBeenCalledWith(11, "json", undefined);
    });
    expect(createObjectURL).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it("exports the portfolio as PDF", async () => {
    portfoliosApiMock.exportPortfolio.mockResolvedValue({ data: "%PDF-mock" });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    mockLoaded();
    renderPortfolio();
    await screen.findByText("SQL");

    fireEvent.click(screen.getByRole("button", { name: "PDF" }));

    await waitFor(() => {
      expect(portfoliosApiMock.exportPortfolio).toHaveBeenCalledWith(11, "pdf", undefined);
    });
    clickSpy.mockRestore();
  });

  it("shows an error state when loading fails", async () => {
    sessionsApiMock.getPortfolio.mockRejectedValue(new Error("boom"));
    renderPortfolio();

    expect(await screen.findByText("Failed to load the portfolio.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Retry/ }));

    await waitFor(() => {
      expect(sessionsApiMock.getPortfolio).toHaveBeenCalledTimes(2);
    });
  });

  it("shows generating when the portfolio is pending", async () => {
    mockLoaded(portfolioFixture({ generation_status: "pending" }));
    renderPortfolio();

    expect(await screen.findByText("Generating portfolio...")).toBeInTheDocument();
  });

  it("saves an override from a skill card", async () => {
    portfoliosApiMock.getOverride.mockResolvedValue({
      data: {
        override: {
          portfolio_skill_id: 1,
          override_level: "L5",
          override_confidence: "high",
          assessor_notes: "Raised after probing",
        },
      },
    });
    mockLoaded();
    renderPortfolio();
    await screen.findByText("SQL");

    fireEvent.click(screen.getAllByRole("button", { name: /Override rating/ })[0]);
    fireEvent.click(await screen.findByRole("button", { name: /Save override/ }));

    expect(await screen.findByText("You Overridden ✓")).toBeInTheDocument();
    expect(portfoliosApiMock.getOverride).toHaveBeenCalledWith(1, {
      override_level: 4,
      assessor_notes: "",
    });
  });

  it("scrolls to and highlights the skill card from the ?skill= anchor", async () => {
    const scrollSpy = vi.spyOn(HTMLElement.prototype, "scrollIntoView");
    mockLoaded();
    renderPortfolio("/assessments/9/sessions/42/portfolio?skill=SQL");
    await screen.findByText("SQL");

    const card = document.getElementById("skill-card-SQL");
    expect(card).toHaveClass("ring-2");
    expect(scrollSpy).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 3100));
    });
    expect(card).not.toHaveClass("ring-2");
  });

  it("exports with the selected vacancy id", async () => {
    portfoliosApiMock.exportPortfolio.mockResolvedValue({ data: { hello: "world" } });
    const createObjectURL = vi.fn(() => "blob:mock");
    URL.createObjectURL = createObjectURL;
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    mockLoaded();
    renderPortfolio();
    await screen.findByText("SQL");

    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(await screen.findByRole("option", { name: /Backend Engineer/ }));
    fireEvent.click(screen.getByRole("button", { name: "JSON" }));

    await waitFor(() => {
      expect(portfoliosApiMock.exportPortfolio).toHaveBeenCalledWith(11, "json", 5);
    });
    clickSpy.mockRestore();
  });

  it("renders vacancy options with configured skills", async () => {
    mockLoaded();
    vacanciesApiMock.list.mockResolvedValue({
      data: {
        vacancies: [
          {
            id: 5,
            role_title: "Backend Engineer",
            skills: [
              { skill_label: "SQL", expected_level: 3 },
              { skill_label: "Redis", expected_level: 4 },
            ],
          },
        ],
        meta: {},
      },
    });
    renderPortfolio();
    await screen.findByText("SQL");

    fireEvent.click(screen.getByRole("combobox"));
    const option = await screen.findByRole("option", { name: /Backend Engineer/ });
    expect(option).toHaveTextContent("SQL L3");
    expect(option).toHaveTextContent("Redis L4");
  });
});

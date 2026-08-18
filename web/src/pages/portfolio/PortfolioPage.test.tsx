import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PortfolioPage from "@/pages/portfolio/PortfolioPage";

const { sessionsApi, vacanciesApi, portfoliosApi } = vi.hoisted(() => ({
  sessionsApi: {
    getPortfolio: vi.fn(),
    regeneratePortfolio: vi.fn(),
    get: vi.fn(),
  },
  vacanciesApi: { list: vi.fn() },
  portfoliosApi: { exportPortfolio: vi.fn() },
}));

vi.mock("react-router-dom", () => ({
  useParams: () => ({ id: "1", sessionId: "2" }),
  useNavigate: () => vi.fn(),
  Link: ({ children, to, ...rest }: any) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/services/sessions", () => ({ sessionsApi }));
vi.mock("@/services/vacancies", () => ({ vacanciesApi }));
vi.mock("@/services/portfolios", () => ({ portfoliosApi }));
vi.mock("@/hooks/usePolling", () => ({ usePolling: () => undefined }));

function baseApi() {
  vacanciesApi.list.mockResolvedValue({ data: { vacancies: [] } });
  sessionsApi.get.mockResolvedValue({ data: { session: { candidate_name: "Rizky Ananda" } } });
  portfoliosApi.exportPortfolio.mockResolvedValue({ data: {} });
}

const skill = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  skill_label: "Node.js / Backend Development",
  is_discovered: false,
  ai_level: 4,
  ai_confidence: "high",
  evidence: ["Saya pernah refactor service pembayaran."],
  competency_summary: "Strong service decomposition.",
  ...overrides,
});

const completedPortfolio = {
  id: 9,
  session_id: 2,
  generation_status: "complete",
  skills: [
    skill(),
    skill({ id: 2, skill_label: "System Design", ai_level: 2, ai_confidence: "low", evidence: [] }),
  ],
  overrides: [],
};

describe("PortfolioPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    baseApi();
  });

  it("H9: shows skeletons mirroring the card layout while generating, not a centered spinner", async () => {
    sessionsApi.getPortfolio.mockReturnValue(new Promise(() => {}));
    sessionsApi.getPortfolio.mockImplementationOnce(() =>
      Promise.resolve({ data: { status: "generating" } }),
    );

    render(<PortfolioPage />);

    expect(await screen.findByTestId("portfolio-generating")).toBeInTheDocument();
    // Card-shaped skeletons, not a lone spinner in the middle.
    expect(screen.getAllByTestId("portfolio-generating")[0].querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
    expect(screen.getByText(/takes about 2 minutes/i)).toBeInTheDocument();
  });

  it("H10: explains a failed generation in plain language, keeps data, offers retry without provider errors", async () => {
    sessionsApi.getPortfolio.mockResolvedValue({
      data: {
        portfolio: { ...completedPortfolio, generation_status: "failed" },
        error: "API returned 400",
      },
    });
    sessionsApi.regeneratePortfolio.mockResolvedValue({ data: {} });

    render(<PortfolioPage />);

    expect(await screen.findByTestId("portfolio-failed")).toBeInTheDocument();
    expect(screen.getByText(/couldn't finish analyzing this interview/i)).toBeInTheDocument();
    expect(screen.getByText(/interview and its transcript are unaffected/i)).toBeInTheDocument();

    // Raw provider error must never reach the user.
    expect(screen.queryByText(/API returned 400/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Gemini/i)).not.toBeInTheDocument();

    // Partial data from a previous run stays visible.
    expect(screen.getByText("Node.js / Backend Development")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Try again/i }));
    await waitFor(() => expect(sessionsApi.regeneratePortfolio).toHaveBeenCalledTimes(1));
  });

  it("H11: keeps a completed skill visible when another skill has no evidence (partial data)", async () => {
    sessionsApi.getPortfolio.mockResolvedValue({ data: { portfolio: completedPortfolio } });

    render(<PortfolioPage />);

    expect(await screen.findByText("Node.js / Backend Development")).toBeInTheDocument();
    expect(screen.getByText("System Design")).toBeInTheDocument();
    // The evidence-less skill explains itself instead of breaking the page.
    expect(screen.getByText("No quotes captured for this skill.")).toBeInTheDocument();
  });

  it("H12: empty state explains what is missing and offers a single next action", async () => {
    sessionsApi.getPortfolio.mockResolvedValue({ data: {} });

    render(<PortfolioPage />);

    expect(await screen.findByTestId("portfolio-empty")).toBeInTheDocument();
    expect(screen.getByText("No skill portfolio yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open transcript/i })).toBeInTheDocument();
  });
});

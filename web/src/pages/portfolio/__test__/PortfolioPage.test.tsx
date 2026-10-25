import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import PortfolioPage from "../PortfolioPage";

// Mutable per-test state (vi.hoisted so the vi.mock factories below can read it).
const mocks = vi.hoisted(() => ({
  portfolio: null as unknown,
  refetch: vi.fn(),
  mutateReviewed: vi.fn(),
  mutateRegenerate: vi.fn(),
}));

vi.mock("@/useCases/sessions", () => ({
  useGetPortfolio: () => ({
    data: { portfolio: mocks.portfolio },
    isLoading: false,
    refetch: mocks.refetch,
  }),
  useGetSession: () => ({ data: { session: { candidate_name: "Budi Santoso" } } }),
  useMarkPortfolioReviewed: () => ({ mutate: mocks.mutateReviewed, isPending: false }),
  useRegeneratePortfolio: () => ({ mutate: mocks.mutateRegenerate, isPending: false }),
}));

vi.mock("@/useCases/vacancies", () => ({
  useGetVacancies: () => ({
    data: { vacancies: [{ id: 3, role_title: "Backend Engineer" }] },
  }),
}));

vi.mock("react-router-dom", () => ({
  useParams: () => ({ id: "1", sessionId: "42" }),
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children: React.ReactNode }) => <a href="#link">{children}</a>,
}));

vi.mock("@/services/portfolios", () => ({
  portfoliosApi: { exportPortfolio: vi.fn() },
}));

vi.mock("@/components/portfolio/SkillPortfolioCard", () => ({
  default: () => <div data-testid="skill-card" />,
}));

function makePortfolio(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    generation_status: "complete",
    reviewed_at: null as string | null,
    overrides: [],
    skills: [
      { id: 1, skill_label: "System Design", is_discovered: false },
      { id: 2, skill_label: "Testing", is_discovered: true },
    ],
    ...overrides,
  };
}

describe("PortfolioPage review gate (case 15)", () => {
  beforeEach(() => {
    mocks.mutateReviewed.mockClear();
    mocks.mutateRegenerate.mockClear();
    mocks.refetch.mockClear();
  });

  test("locks export and Fit/Gap while the portfolio is unreviewed", () => {
    mocks.portfolio = makePortfolio({ reviewed_at: null });

    render(<PortfolioPage />);

    expect(screen.getByRole("button", { name: /PDF/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /JSON/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Run Fit\/Gap/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Mark Reviewed/i })).toBeInTheDocument();
  });

  test("unlocks export and removes the gate once reviewed", () => {
    mocks.portfolio = makePortfolio({ reviewed_at: "2026-10-25T00:00:00Z" });

    render(<PortfolioPage />);

    expect(screen.getByRole("button", { name: /PDF/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /JSON/i })).toBeEnabled();
    expect(screen.queryByRole("button", { name: /Mark Reviewed/i })).not.toBeInTheDocument();
    // Fit/Gap still requires a vacancy on top of the review gate.
    expect(screen.getByRole("button", { name: /Run Fit\/Gap/i })).toBeDisabled();
  });

  test("Mark Reviewed calls the mutation for this session", () => {
    mocks.portfolio = makePortfolio({ reviewed_at: null });

    render(<PortfolioPage />);
    fireEvent.click(screen.getByRole("button", { name: /Mark Reviewed/i }));

    expect(mocks.mutateReviewed).toHaveBeenCalledWith(42);
  });

  test("shows the generating state without the gate or export buttons", () => {
    mocks.portfolio = makePortfolio({ generation_status: "generating" });

    render(<PortfolioPage />);

    expect(screen.getByText(/Generating portfolio\.\.\./i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Mark Reviewed/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /PDF/i })).not.toBeInTheDocument();
  });

  test("failed generation shows the retry banner", () => {
    mocks.portfolio = makePortfolio({ generation_status: "failed" });

    render(<PortfolioPage />);

    expect(screen.getByText(/Portfolio generation failed\./i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Retry/i }));
    expect(mocks.mutateRegenerate).toHaveBeenCalledWith(42);
  });
});

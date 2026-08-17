import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PortfolioPage from "@/pages/portfolio/PortfolioPage";

const { sessionsApi, vacanciesApi, portfoliosApi } = vi.hoisted(() => ({
  sessionsApi: { get: vi.fn(), getPortfolio: vi.fn(), setReviewed: vi.fn() },
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

const session = (reviewedAt: string | null) => ({
  data: {
    session: { candidate_name: "Rani Prameswari", reviewed_at: reviewedAt },
    assessment: { id: 1, name: "Senior Frontend" },
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  vacanciesApi.list.mockResolvedValue({ data: { vacancies: [] } });
  sessionsApi.getPortfolio.mockResolvedValue({
    data: { portfolio: { id: 9, generation_status: "complete", skills: [], overrides: [] } },
  });
  sessionsApi.get.mockResolvedValue(session(null));
});

describe("Portfolio review sign-off", () => {
  it("offers a button while the results are still unreviewed", async () => {
    render(<PortfolioPage />);

    expect(await screen.findByTestId("review-toggle")).toHaveTextContent("Mark as reviewed");
    expect(screen.queryByTestId("review-state")).toBeNull();
  });

  it("stops being a button once reviewed", async () => {
    // A control labelled "Reviewed" reads as a status, and clicking a status
    // to silently undo it is a trap. The state becomes text instead.
    sessionsApi.get.mockResolvedValue(session("2026-08-17T10:00:00Z"));

    render(<PortfolioPage />);

    expect(await screen.findByTestId("review-state")).toBeInTheDocument();
    expect(screen.queryByTestId("review-toggle")).toBeNull();
  });

  it("gives undo its own clearly named control", async () => {
    sessionsApi.get.mockResolvedValue(session("2026-08-17T10:00:00Z"));
    sessionsApi.setReviewed.mockResolvedValue({ data: { session: { reviewed_at: null } } });

    render(<PortfolioPage />);

    const undo = await screen.findByTestId("review-undo");
    expect(undo).toHaveTextContent("Undo");

    await userEvent.click(undo);

    expect(sessionsApi.setReviewed).toHaveBeenCalledWith(2, false);
    await waitFor(() => expect(screen.getByTestId("review-toggle")).toBeInTheDocument());
  });

  it("signs off and shows when it happened", async () => {
    sessionsApi.setReviewed.mockResolvedValue({
      data: { session: { reviewed_at: "2026-08-17T10:00:00Z" } },
    });

    render(<PortfolioPage />);

    await userEvent.click(await screen.findByTestId("review-toggle"));

    expect(sessionsApi.setReviewed).toHaveBeenCalledWith(2, true);
    const state = await screen.findByTestId("review-state");
    expect(state).toHaveTextContent(/Reviewed/);
    expect(state.querySelector(".font-mono")).not.toBeNull();
  });

  it("offers nothing to sign off while the report is still being built", async () => {
    sessionsApi.getPortfolio.mockResolvedValue({
      data: { portfolio: { id: 9, generation_status: "failed", skills: [], overrides: [] } },
    });

    render(<PortfolioPage />);

    await waitFor(() => expect(screen.queryByTestId("portfolio-page-skeleton")).toBeNull());
    expect(screen.queryByTestId("review-toggle")).toBeNull();
    expect(screen.queryByTestId("review-state")).toBeNull();
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import PortfolioPage from "@/pages/portfolio/PortfolioPage";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { PORTFOLIO_POLL_INTERVAL_MS, PORTFOLIO_POLL_MAX_ATTEMPTS } from "@/utils/constants";

// Regression coverage for assessment/03_defining_problem_and_gap_to_ideal_condition.md F4:
// a session that never started (no portfolio, never interviewed) must not
// render the same "AI is analyzing... ~2 minutes" message as a session
// whose portfolio worker is genuinely in flight.

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

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/assessments/1/sessions/2/portfolio"]}>
      <Routes>
        <Route path="/assessments/:id/sessions/:sessionId/portfolio" element={<PortfolioPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("PortfolioPage — not_started vs generating (F4)", () => {
  beforeEach(() => {
    vi.mocked(sessionsApi.getPortfolio).mockReset();
    vi.mocked(sessionsApi.get).mockResolvedValue({
      data: { session: { candidate_name: "Test" } },
    } as any);
    vi.mocked(vacanciesApi.list).mockResolvedValue({ data: { vacancies: [] } } as any);
  });

  it("shows a not-started message, not the fake analyzing spinner, when the interview never started", async () => {
    vi.mocked(sessionsApi.getPortfolio).mockResolvedValue({ data: { status: "not_started" } } as any);

    renderPage();

    expect(await screen.findByText(/interview hasn't started yet/i)).toBeInTheDocument();
    expect(screen.queryByText(/generating portfolio/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/this takes about 2 minutes/i)).not.toBeInTheDocument();
  });

  it("still shows the analyzing message when a worker is genuinely generating", async () => {
    vi.mocked(sessionsApi.getPortfolio).mockResolvedValue({ data: { status: "generating" } } as any);

    renderPage();

    expect(await screen.findByText(/generating portfolio/i)).toBeInTheDocument();
    expect(screen.queryByText(/interview hasn't started yet/i)).not.toBeInTheDocument();
  });
});

// Reviewer feedback on F4, two cases the first pass did not cover:
// 1. A session whose interview is still running must say so — it has nothing
//    for the AI to analyze yet, so "AI is analyzing..." is just as misleading.
// 2. An ended session that never gets a portfolio must not poll forever.
describe("PortfolioPage — in-progress sessions and polling limit (F4 follow-up)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(sessionsApi.getPortfolio).mockReset();
    vi.mocked(sessionsApi.get).mockResolvedValue({
      data: { session: { candidate_name: "Test" } },
    } as any);
    vi.mocked(vacanciesApi.list).mockResolvedValue({ data: { vacancies: [] } } as any);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("says the interview is still in progress instead of showing the analyzing spinner, and does not poll", async () => {
    vi.mocked(sessionsApi.getPortfolio).mockResolvedValue({ data: { status: "in_progress" } } as any);

    renderPage();

    expect(await screen.findByText(/interview is still in progress/i)).toBeInTheDocument();
    expect(screen.queryByText(/generating portfolio/i)).not.toBeInTheDocument();

    const callsAfterLoad = vi.mocked(sessionsApi.getPortfolio).mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PORTFOLIO_POLL_INTERVAL_MS * 10);
    });
    expect(vi.mocked(sessionsApi.getPortfolio).mock.calls.length).toBe(callsAfterLoad);
  });

  it("stops polling after the limit and offers a manual re-check instead of spinning forever", async () => {
    vi.mocked(sessionsApi.getPortfolio).mockResolvedValue({ data: { status: "generating" } } as any);

    renderPage();
    expect(await screen.findByText(/generating portfolio/i)).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PORTFOLIO_POLL_INTERVAL_MS * (PORTFOLIO_POLL_MAX_ATTEMPTS + 2));
    });

    expect(screen.getByText(/taking longer than expected/i)).toBeInTheDocument();
    expect(screen.queryByText(/this takes about 2 minutes/i)).not.toBeInTheDocument();

    const callsAtTimeout = vi.mocked(sessionsApi.getPortfolio).mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PORTFOLIO_POLL_INTERVAL_MS * 20);
    });
    expect(vi.mocked(sessionsApi.getPortfolio).mock.calls.length).toBe(callsAtTimeout);
  });

  it("resumes polling when the assessor chooses to check again after a timeout", async () => {
    vi.mocked(sessionsApi.getPortfolio).mockResolvedValue({ data: { status: "generating" } } as any);

    renderPage();
    await screen.findByText(/generating portfolio/i);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PORTFOLIO_POLL_INTERVAL_MS * (PORTFOLIO_POLL_MAX_ATTEMPTS + 2));
    });
    const callsAtTimeout = vi.mocked(sessionsApi.getPortfolio).mock.calls.length;

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /check again/i }));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PORTFOLIO_POLL_INTERVAL_MS * 2);
    });

    expect(vi.mocked(sessionsApi.getPortfolio).mock.calls.length).toBeGreaterThan(callsAtTimeout);
  });

  it("drops the timeout message when the page moves to another session while staying mounted", async () => {
    vi.mocked(sessionsApi.getPortfolio).mockImplementation(
      async (sessionId: number) =>
        ({ data: { status: sessionId === 2 ? "generating" : "in_progress" } }) as any
    );

    render(
      <MemoryRouter initialEntries={["/assessments/1/sessions/2/portfolio"]}>
        <Link to="/assessments/1/sessions/3/portfolio">other session</Link>
        <Routes>
          <Route path="/assessments/:id/sessions/:sessionId/portfolio" element={<PortfolioPage />} />
        </Routes>
      </MemoryRouter>
    );
    await screen.findByText(/generating portfolio/i);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PORTFOLIO_POLL_INTERVAL_MS * (PORTFOLIO_POLL_MAX_ATTEMPTS + 2));
    });
    expect(screen.getByText(/taking longer than expected/i)).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("link", { name: /other session/i }));
    });

    expect(await screen.findByText(/interview is still in progress/i)).toBeInTheDocument();
    expect(screen.queryByText(/taking longer than expected/i)).not.toBeInTheDocument();
  });
});

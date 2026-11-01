import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PortfolioPage from "@/pages/portfolio/PortfolioPage";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { portfoliosApi } from "@/services/portfolios";
import type { Portfolio } from "@/types";

vi.mock("@/services/sessions", () => ({
  sessionsApi: { getPortfolio: vi.fn(), get: vi.fn(), regeneratePortfolio: vi.fn() },
}));
vi.mock("@/services/vacancies", () => ({ vacanciesApi: { list: vi.fn() } }));
vi.mock("@/services/portfolios", () => ({ portfoliosApi: { exportPortfolio: vi.fn() } }));

const portfolio = (overrides: Partial<Portfolio> = {}): Portfolio => ({
  id: 1,
  session_id: 3,
  generation_status: "complete",
  skills: [
    {
      id: 9,
      skill_label: "React",
      is_discovered: false,
      ai_level: 4,
      ai_confidence: "high",
      evidence: ["I profiled the renders"],
      competency_summary: "Solid.",
    },
  ],
  overrides: [],
  ...overrides,
});

function mockPortfolio(p: Portfolio) {
  vi.mocked(sessionsApi.getPortfolio).mockResolvedValue({
    data: { portfolio: p },
  } as Awaited<ReturnType<typeof sessionsApi.getPortfolio>>);
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/assessments/7/sessions/3/portfolio"]}>
      <Routes>
        <Route path="/assessments/:id/sessions/:sessionId/portfolio" element={<PortfolioPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("PortfolioPage", () => {
  beforeEach(() => {
    vi.mocked(sessionsApi.getPortfolio).mockReset();
    vi.mocked(sessionsApi.regeneratePortfolio).mockReset();
    vi.mocked(portfoliosApi.exportPortfolio).mockReset();
    vi.mocked(sessionsApi.get).mockResolvedValue({
      data: { session: { candidate_name: "Budi" } },
    } as Awaited<ReturnType<typeof sessionsApi.get>>);
    vi.mocked(vacanciesApi.list).mockResolvedValue({
      data: {
        vacancies: [],
        meta: { current_page: 1, total_pages: 1, total_count: 0, per_page: 20 },
      },
    } as unknown as Awaited<ReturnType<typeof vacanciesApi.list>>);
  });

  it("shows a retryable error instead of a blank page when the portfolio fails to load", async () => {
    vi.mocked(sessionsApi.getPortfolio).mockRejectedValueOnce(new Error("boom"));
    renderPage();

    expect(await screen.findByText("Failed to load the portfolio.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Retry/ })).toBeInTheDocument();
  });

  it("still shows results when only the vacancy list fails", async () => {
    mockPortfolio(portfolio());
    vi.mocked(vacanciesApi.list).mockReset().mockRejectedValueOnce(new Error("boom"));
    renderPage();

    expect(await screen.findByText("React")).toBeInTheDocument();
    expect(screen.getByText(/Couldn't load vacancies/)).toBeInTheDocument();
  });

  it("points to vacancy creation when there are no vacancies", async () => {
    mockPortfolio(portfolio());
    renderPage();

    expect(await screen.findByRole("link", { name: "create a vacancy" })).toBeInTheDocument();
  });

  it("explains a failed generation retry", async () => {
    mockPortfolio(portfolio({ generation_status: "failed", skills: [] }));
    vi.mocked(sessionsApi.regeneratePortfolio).mockRejectedValueOnce(new Error("boom"));
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: /Retry/ }));

    expect(await screen.findByText("Failed to restart generation.")).toBeInTheDocument();
  });

  it("explains a failed export", async () => {
    mockPortfolio(portfolio());
    vi.mocked(portfoliosApi.exportPortfolio).mockRejectedValueOnce(new Error("boom"));
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: /PDF/ }));

    expect(await screen.findByText("Export failed. Please try again.")).toBeInTheDocument();
  });
});

describe("PortfolioPage generation polling", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("stops polling after 10 minutes and says generation is taking too long", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    vi.mocked(sessionsApi.getPortfolio)
      .mockReset()
      .mockResolvedValue({ data: { status: "generating" } } as Awaited<
        ReturnType<typeof sessionsApi.getPortfolio>
      >);
    vi.mocked(sessionsApi.get).mockResolvedValue({
      data: { session: { candidate_name: "Budi" } },
    } as Awaited<ReturnType<typeof sessionsApi.get>>);
    vi.mocked(vacanciesApi.list).mockResolvedValue({
      data: { vacancies: [] },
    } as unknown as Awaited<ReturnType<typeof vacanciesApi.list>>);
    renderPage();
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(screen.getByText("Generating portfolio...")).toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(10 * 60 * 1000 + 5000));

    expect(screen.getByText(/taking longer than expected/)).toBeInTheDocument();
    const callsAtTimeout = vi.mocked(sessionsApi.getPortfolio).mock.calls.length;
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(sessionsApi.getPortfolio).toHaveBeenCalledTimes(callsAtTimeout);
  });
});

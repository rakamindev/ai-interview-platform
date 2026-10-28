import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PortfolioPage from "./PortfolioPage";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { downloadPortfolioExport } from "@/services/portfolios";
import type { Portfolio, PortfolioSkill } from "@/types";

vi.mock("@/services/sessions", () => ({
  sessionsApi: { getPortfolio: vi.fn(), get: vi.fn(), regeneratePortfolio: vi.fn() },
}));
vi.mock("@/services/vacancies", () => ({ vacanciesApi: { list: vi.fn() } }));
vi.mock("@/services/portfolios", () => ({ downloadPortfolioExport: vi.fn(), portfoliosApi: {} }));

const sessions = vi.mocked(sessionsApi);

const skill = (overrides: Partial<PortfolioSkill>): PortfolioSkill => ({
  id: 1, skill_id: "SK-ENG-001", skill_label: "React", is_discovered: false, ai_level: 3, ai_confidence: "high",
  assessment_status: "assessed", status_reason: null, evidence: [], competency_summary: "Solid.", ...overrides,
});

const portfolio = (overrides: Partial<Portfolio> = {}): Portfolio => ({
  id: 4, session_id: 2, generation_status: "complete", generation_attempts: 1, stale: false,
  generation_error: null, overrides: [],
  skills: [
    skill({ id: 1 }),
    skill({ id: 2, skill_label: "Communication", assessment_status: "not_assessed", ai_level: null,
            ai_confidence: null, status_reason: "Not discussed in the interview.", competency_summary: "" }),
  ],
  ...overrides,
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/assessments/1/sessions/2/portfolio"]}>
      <Routes>
        <Route path="/assessments/:id/sessions/:sessionId/portfolio" element={<PortfolioPage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  sessions.get.mockResolvedValue({ data: { session: { candidate_name: "Dewi Lestari (fake)" } } } as never);
  vi.mocked(vacanciesApi.list).mockResolvedValue({ data: { vacancies: [] } } as never);
});

describe("PortfolioPage", () => {
  it("says how many skills the interview actually assessed (partial state)", async () => {
    sessions.getPortfolio.mockResolvedValue({ status: 200, data: { portfolio: portfolio() } } as never);
    renderPage();

    expect(await screen.findByText("1 of 2 skills assessed · 1 not discussed in the interview")).toBeInTheDocument();
    expect(screen.getByText("Dewi Lestari (fake)")).toBeInTheDocument();
  });

  it("points to a new invitation when no skill was discussed at all", async () => {
    const unrated = portfolio().skills.map((s) => ({ ...s, assessment_status: "not_assessed" as const, ai_level: null, ai_confidence: null }));
    sessions.getPortfolio.mockResolvedValue({ status: 200, data: { portfolio: portfolio({ skills: unrated }) } } as never);
    renderPage();

    expect(await screen.findByText(/No skill was discussed in this interview/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Invite again" })).toHaveAttribute("href", "/assessments/1/invite");
  });

  it("shows progress and the last error while retries run, without offering a second run", async () => {
    sessions.getPortfolio.mockResolvedValue({
      status: 202,
      data: { status: "generating", portfolio: portfolio({ generation_status: "generating", generation_attempts: 2,
                                                          generation_error: "The AI model is overloaded (HTTP 503)." }) },
    } as never);
    renderPage();

    expect(await screen.findByText("Generating the portfolio")).toBeInTheDocument();
    expect(screen.getByText("Attempt 2. Last attempt: The AI model is overloaded (HTTP 503).")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
  });

  it("offers a retry when generation has stalled", async () => {
    sessions.getPortfolio.mockResolvedValue({
      status: 202, data: { status: "generating", portfolio: portfolio({ generation_status: "generating", stale: true }) },
    } as never);
    renderPage();

    expect(await screen.findByText("This is taking much longer than expected.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("shows why generation failed, and no export buttons", async () => {
    sessions.getPortfolio.mockResolvedValue({
      status: 200,
      data: { portfolio: portfolio({ generation_status: "failed", generation_error: "The AI model did not respond in time." }) },
    } as never);
    renderPage();

    expect(await screen.findByText("The AI model did not respond in time.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "PDF" })).not.toBeInTheDocument();
  });

  it("shows an error instead of a blank page when loading fails", async () => {
    sessions.getPortfolio.mockRejectedValue(new Error("Network Error"));
    renderPage();

    expect(await screen.findByText("Could not load the portfolio.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("explains a failed export (AC9.2)", async () => {
    sessions.getPortfolio.mockResolvedValue({ status: 200, data: { portfolio: portfolio() } } as never);
    vi.mocked(downloadPortfolioExport).mockRejectedValueOnce(new Error("Could not export the PDF. Try again."));
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "PDF" }));

    expect(await screen.findByText("Could not export the PDF. Try again.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "PDF" })).toBeEnabled();
  });
});

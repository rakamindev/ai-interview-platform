import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import PortfolioPage from "./PortfolioPage";
import type { Portfolio, PortfolioSkill } from "@/types";

const getPortfolio = vi.fn();
const getSession = vi.fn();
const listVacancies = vi.fn();
const regeneratePortfolio = vi.fn();

vi.mock("@/services/sessions", () => ({
  sessionsApi: {
    getPortfolio: (...a: unknown[]) => getPortfolio(...a),
    get: (...a: unknown[]) => getSession(...a),
    regeneratePortfolio: (...a: unknown[]) => regeneratePortfolio(...a),
  },
}));
vi.mock("@/services/vacancies", () => ({
  vacanciesApi: { list: (...a: unknown[]) => listVacancies(...a) },
}));
vi.mock("@/services/portfolios", () => ({ portfoliosApi: { exportPortfolio: vi.fn() } }));
vi.mock("@/hooks/usePolling", () => ({ usePolling: () => {} }));
vi.mock("@/components/portfolio/SkillPortfolioCard", () => ({
  default: ({ skill }: { skill: PortfolioSkill }) => <div>{skill.skill_label}</div>,
}));

const skill = (label: string): PortfolioSkill => ({
  id: 1,
  skill_label: label,
  is_discovered: false,
  assessed: true,
  ai_level: "2",
  ai_confidence: "high",
  evidence: [],
  competency_summary: "Summary.",
});

const portfolio = (o: Partial<Portfolio> = {}): Portfolio =>
  ({
    id: 3,
    session_id: 3,
    generation_status: "complete",
    generation_error: null,
    skills: [],
    overrides: [],
    ...o,
  }) as Portfolio;

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/assessments/1/sessions/3/portfolio"]}>
      <Routes>
        <Route path="/assessments/:id/sessions/:sessionId/portfolio" element={<PortfolioPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  listVacancies.mockResolvedValue({ data: { vacancies: [] } });
  getSession.mockResolvedValue({ data: { session: { candidate_name: "Yanto" } } });
  regeneratePortfolio.mockResolvedValue({ data: {} });
});

describe("PortfolioPage", () => {
  it("shows a skeleton while loading", () => {
    getPortfolio.mockReturnValue(new Promise(() => {}));

    const { container } = renderPage();

    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  // Swallowed by an empty catch, a network error and a session with no results
  // looked identical: a blank page.
  describe("when the request fails", () => {
    beforeEach(() => {
      getPortfolio.mockRejectedValue({ message: "Network Error" });
    });

    it("says the load failed instead of rendering nothing", async () => {
      renderPage();

      expect(await screen.findByText(/could not load this portfolio/i)).toBeInTheDocument();
    });

    it("surfaces the reason", async () => {
      renderPage();

      expect(await screen.findByText(/network error/i)).toBeInTheDocument();
    });

    it("offers a way to retry", async () => {
      renderPage();

      expect(await screen.findByRole("button", { name: /try again/i })).toBeInTheDocument();
    });
  });

  describe("when the session produced no skills", () => {
    beforeEach(() => {
      getPortfolio.mockResolvedValue({ data: { portfolio: portfolio() } });
    });

    it("explains the emptiness rather than showing a bare page", async () => {
      renderPage();

      expect(await screen.findByText(/no results for this session/i)).toBeInTheDocument();
    });

    it("points at the transcript, which does exist", async () => {
      renderPage();

      expect(await screen.findByRole("link", { name: /read the transcript/i })).toBeInTheDocument();
    });
  });

  // A duplicate job failing after a successful one flips the status to failed.
  // The results are still there, and were being thrown away.
  describe("when generation failed but results exist", () => {
    beforeEach(() => {
      getPortfolio.mockResolvedValue({
        data: {
          portfolio: portfolio({
            generation_status: "failed",
            generation_error: "Failed after 3 retries: API returned 503",
            skills: [skill("React / Frontend Development Core")],
          }),
        },
      });
    });

    it("still renders the skills", async () => {
      renderPage();

      expect(
        await screen.findByText("React / Frontend Development Core"),
      ).toBeInTheDocument();
    });

    // "API returned 503" is not actionable for an assessor, and it is already in
    // the logs for whoever it is actionable for.
    it("explains the failure in words the reader can act on", async () => {
      renderPage();

      expect(
        await screen.findByText(/could not finish analysing this interview/i),
      ).toBeInTheDocument();
    });

    it("does not put the raw upstream error in front of the assessor", async () => {
      renderPage();

      await screen.findByText(/could not finish analysing this interview/i);
      expect(screen.queryByText(/API returned 503/)).not.toBeInTheDocument();
    });

    it("warns that retrying replaces what is shown", async () => {
      renderPage();

      expect(await screen.findByText(/retrying replaces them/i)).toBeInTheDocument();
    });

    // The handler awaited with no catch. When the API refused, the promise
    // rejected, nothing on screen moved, and the assessor clicked again —
    // 20-odd times in the run that surfaced this.
    it("says something when the retry itself is refused", async () => {
      regeneratePortfolio.mockRejectedValue({
        response: { status: 422, data: { errors: [{ message: "…status is 'failed'" }] } },
      });
      renderPage();

      fireEvent.click(await screen.findByRole("button", { name: /retry/i }));

      expect(await screen.findByText(/could not start a new run/i)).toBeInTheDocument();
    });

    it("re-reads the status, since the run may have restarted on its own", async () => {
      regeneratePortfolio.mockRejectedValue({ response: { status: 422 } });
      renderPage();

      await screen.findByRole("button", { name: /retry/i });
      const before = getPortfolio.mock.calls.length;
      fireEvent.click(screen.getByRole("button", { name: /retry/i }));

      await waitFor(() =>
        expect(getPortfolio.mock.calls.length).toBeGreaterThan(before),
      );
    });
  });

  it("renders skills on a clean run", async () => {
    getPortfolio.mockResolvedValue({
      data: { portfolio: portfolio({ skills: [skill("Communication")] }) },
    });

    renderPage();

    await waitFor(() => expect(screen.getByText("Communication")).toBeInTheDocument());
    expect(screen.queryByText(/no results for this session/i)).not.toBeInTheDocument();
  });
});

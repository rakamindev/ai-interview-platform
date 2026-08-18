import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import { renderWithRoute } from "@/test/testUtils";
import PortfolioPage from "./PortfolioPage";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import type { Portfolio, Session, Vacancy } from "@/types";

vi.mock("@/services/sessions", () => ({
  sessionsApi: {
    get: vi.fn(),
    getPortfolio: vi.fn(),
    regeneratePortfolio: vi.fn(),
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
  },
}));

function makePortfolio(overrides: Partial<Portfolio> = {}): Portfolio {
  return {
    id: 1,
    session_id: 2,
    generation_status: "complete",
    skills: [],
    overrides: [],
    ...overrides,
  };
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 2,
    assessment_id: 1,
    invite_token: "tok",
    invite_url: "http://localhost:5173/interview/tok",
    status: "ended",
    ...overrides,
  };
}

function makeVacancy(overrides: Partial<Vacancy> = {}): Vacancy {
  return { id: 3, role_title: "Flutter Engineer", culture_dimensions: "", competency_expectations: "", skills: [], ...overrides };
}

function mockApis({
  portfolio,
  session,
  vacancies = [],
}: {
  portfolio: Portfolio;
  session: Session;
  vacancies?: Vacancy[];
}) {
  vi.mocked(sessionsApi.getPortfolio).mockResolvedValue({ data: { portfolio } } as any);
  vi.mocked(sessionsApi.get).mockResolvedValue({
    data: { session: { ...session, assessment: { id: 1, name: "QA Engineer Screening", time_limit_min: 45 } } },
  } as any);
  vi.mocked(vacanciesApi.list).mockResolvedValue({ data: { vacancies, meta: {} as any } } as any);
}

async function renderPortfolioPage(initialEntry: string) {
  return renderWithRoute(<PortfolioPage />, {
    path: "/assessments/:id/sessions/:sessionId/portfolio",
    initialEntries: [initialEntry],
  });
}

describe("PortfolioPage", () => {
  beforeEach(() => {
    vi.mocked(sessionsApi.getPortfolio).mockReset();
    vi.mocked(sessionsApi.get).mockReset();
    vi.mocked(vacanciesApi.list).mockReset();
  });

  // AI generation failure transparency — the failed-state block previously showed
  // only a generic "Portfolio generation failed." message, discarding the
  // portfolio.generation_error field the API already sent (see EXPLORATION_LOG.md
  // §4.1 slice-C).
  describe("AI generation failure transparency", () => {
    it("surfaces the backend's generation_error alongside the generic failure message", async () => {
      mockApis({
        portfolio: makePortfolio({ generation_status: "failed", generation_error: "Gemini API timed out after 3 retries" }),
        session: makeSession(),
      });

      await renderPortfolioPage("/assessments/1/sessions/2/portfolio");

      expect(await screen.findByText("Portfolio generation failed.")).toBeInTheDocument();
      expect(screen.getByText("Gemini API timed out after 3 retries")).toBeInTheDocument();
    });

    it("shows only the generic failure message when no generation_error is present", async () => {
      mockApis({
        portfolio: makePortfolio({ generation_status: "failed", generation_error: undefined }),
        session: makeSession(),
      });

      await renderPortfolioPage("/assessments/1/sessions/2/portfolio");

      const genericMessage = await screen.findByText("Portfolio generation failed.");
      const failedBlock = genericMessage.closest("div");
      expect(within(failedBlock as HTMLElement).getAllByText(/./, { selector: "p" })).toHaveLength(1);
    });
  });

  // Session lifecycle visibility — started_at/ended_at/duration_seconds were
  // computed by the backend but never rendered in the Portfolio header.
  describe("session lifecycle visibility", () => {
    it("shows the completion time and duration in the header once the session has ended", async () => {
      mockApis({
        portfolio: makePortfolio(),
        session: makeSession({ status: "ended", ended_at: "2026-08-18T03:54:00Z", duration_seconds: 347 }),
      });

      await renderPortfolioPage("/assessments/1/sessions/2/portfolio");

      expect(await screen.findByText(/Completed/)).toHaveTextContent(/Completed.*5m 47s/);
    });

    it("shows no completion line while the session is still active", async () => {
      mockApis({
        portfolio: makePortfolio({ generation_status: "generating" }),
        session: makeSession({ status: "active", started_at: "2026-08-18T03:00:00Z" }),
      });

      await renderPortfolioPage("/assessments/1/sessions/2/portfolio");

      expect(await screen.findByText("Generating portfolio...")).toBeInTheDocument();
      expect(screen.queryByText(/Completed/)).not.toBeInTheDocument();
    });
  });

  // Vacancy-context persistence (STEP 09) — selectedVacancy is now derived from the
  // URL (?vacancy=) instead of local state, so it survives unmount/remount when
  // navigating to Fit/Gap and back.
  describe("vacancy-context persistence", () => {
    it("hydrates the selected vacancy from a valid ?vacancy= URL param", async () => {
      mockApis({
        portfolio: makePortfolio(),
        session: makeSession(),
        vacancies: [makeVacancy({ id: 3 }), makeVacancy({ id: 4, role_title: "QA Engineer" })],
      });

      await renderPortfolioPage("/assessments/1/sessions/2/portfolio?vacancy=3");

      const runButton = await screen.findByRole("button", { name: /Run Fit\/Gap Analysis/ });
      expect(runButton).toBeEnabled();
      expect(screen.getByTestId("location-display")).toHaveTextContent("vacancy=3");
    });

    it("clears an invalid ?vacancy= URL param once the real vacancy list has loaded", async () => {
      mockApis({
        portfolio: makePortfolio(),
        session: makeSession(),
        vacancies: [makeVacancy({ id: 3 })],
      });

      await renderPortfolioPage("/assessments/1/sessions/2/portfolio?vacancy=999999");

      const runButton = await screen.findByRole("button", { name: /Run Fit\/Gap Analysis/ });
      expect(runButton).toBeDisabled();
      expect(screen.getByTestId("location-display")).not.toHaveTextContent("vacancy=");
    });

    it("preserves unrelated search params when scrubbing an invalid vacancy id", async () => {
      mockApis({
        portfolio: makePortfolio(),
        session: makeSession(),
        vacancies: [makeVacancy({ id: 3 })],
      });

      await renderPortfolioPage("/assessments/1/sessions/2/portfolio?vacancy=999999&foo=bar");

      await screen.findByRole("button", { name: /Run Fit\/Gap Analysis/ });
      const location = screen.getByTestId("location-display");
      expect(location).toHaveTextContent("foo=bar");
      expect(location).not.toHaveTextContent("vacancy=");
    });
  });
});

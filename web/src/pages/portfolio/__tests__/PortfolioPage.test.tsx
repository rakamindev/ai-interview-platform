import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PortfolioPage from "@/pages/portfolio/PortfolioPage";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { renderWithQueryClient } from "@/test/renderWithQueryClient";

vi.mock("@/services/sessions", () => ({
  sessionsApi: {
    getPortfolio: vi.fn(),
    get: vi.fn(),
    regeneratePortfolio: vi.fn(),
  },
}));

vi.mock("@/services/vacancies", () => ({
  vacanciesApi: { list: vi.fn() },
}));

vi.mock("@/services/portfolios", () => ({
  portfoliosApi: { exportPortfolio: vi.fn() },
}));

const getPortfolioMock = sessionsApi.getPortfolio as ReturnType<typeof vi.fn>;
const getSessionMock = sessionsApi.get as ReturnType<typeof vi.fn>;
const regeneratePortfolioMock = sessionsApi.regeneratePortfolio as ReturnType<typeof vi.fn>;
const listVacanciesMock = vacanciesApi.list as ReturnType<typeof vi.fn>;

const failedPortfolio = {
  id: 19,
  session_id: 23,
  generation_status: "failed" as const,
  generation_error: "Generation failed",
  skills: [],
  overrides: [],
};

const completePortfolio = {
  id: 20,
  session_id: 23,
  generation_status: "complete" as const,
  skills: [
    {
      id: 101,
      skill_label: "System Design",
      is_discovered: false,
      ai_level: "L3",
      ai_confidence: "high",
      evidence: [],
      evidence_status: "verified" as const,
      competency_summary: "Builds reliable distributed systems.",
    },
    {
      id: 102,
      skill_label: "Stakeholder Management",
      is_discovered: true,
      ai_level: "L2",
      ai_confidence: "medium",
      evidence: [],
      evidence_status: "insufficient" as const,
      competency_summary: "Communicates trade-offs clearly.",
    },
  ],
  overrides: [],
};

const vacancy = {
  id: 7,
  role_title: "Senior Platform Engineer",
  culture_dimensions: "Collaborative",
  competency_expectations: "System design",
  skills: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
  getSessionMock.mockResolvedValue({ data: { session: { candidate_name: "Budi Santoso" } } });
  regeneratePortfolioMock.mockResolvedValue({ data: { message: "queued", portfolio: failedPortfolio } });
  listVacanciesMock.mockResolvedValue({
    data: {
      vacancies: [],
      meta: { current_page: 1, total_pages: 0, total_count: 0, per_page: 100 },
    },
  });
});

function renderPage() {
  return renderWithQueryClient(
    <MemoryRouter initialEntries={["/assessments/10/sessions/23/portfolio"]}>
      <Routes>
        <Route path="/assessments/:id/sessions/:sessionId/portfolio" element={<PortfolioPage />} />
        <Route path="/assessments/:id/edit" element={<p>Edit assessment page</p>} />
        <Route path="/assessments/:id/invite" element={<p>Assessment page</p>} />
        <Route
          path="/assessments/:id/sessions/:sessionId/fitgap/:vacancyId"
          element={<p>Fit gap destination</p>}
        />
      </Routes>
    </MemoryRouter>
  );
}

describe("PortfolioPage — generation failure recovery", () => {
  it("directs an invalid empty assessment to configuration instead of offering a futile retry", async () => {
    getPortfolioMock.mockResolvedValue({
      data: { portfolio: { ...failedPortfolio, failure_reason: "missing_assessment_skills" } },
    });

    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("This assessment has no skills to evaluate");
    expect(screen.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /edit assessment/i }));
    expect(await screen.findByText("Edit assessment page")).toBeInTheDocument();
  });

  it("keeps retry available for recoverable generation failures", async () => {
    getPortfolioMock.mockResolvedValue({
      data: { portfolio: { ...failedPortfolio, failure_reason: "generation_failed" } },
    });

    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: /retry/i }));

    await waitFor(() => {
      expect(regeneratePortfolioMock).toHaveBeenCalledWith(23);
    });
    expect(screen.getByText("Generating portfolio…")).toBeInTheDocument();
  });
});

describe("PortfolioPage — focused result polish", () => {
  it("renders load failure as the exclusive primary state and recovers on retry", async () => {
    getPortfolioMock
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce({ data: { portfolio: completePortfolio } });

    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load this portfolio");
    expect(screen.queryByRole("heading", { name: /portfolio results/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /transcript/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /retry/i }));

    expect(await screen.findByRole("heading", { name: /portfolio results/i })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(getPortfolioMock).toHaveBeenCalledTimes(2);
  });

  it("shows result context, accessible actions, and the grouped comparison flow", async () => {
    getPortfolioMock.mockResolvedValue({ data: { portfolio: completePortfolio } });
    listVacanciesMock.mockResolvedValue({
      data: {
        vacancies: [vacancy],
        meta: { current_page: 1, total_pages: 1, total_count: 1, per_page: 100 },
      },
    });

    renderPage();

    expect(await screen.findByText("Budi Santoso")).toBeInTheDocument();
    expect(screen.getByLabelText("Portfolio skill summary")).toBeInTheDocument();
    expect(screen.getByLabelText("Level estimate: 50%")).toHaveTextContent("Average L2.5 of L5");
    expect(screen.getByLabelText("Confidence estimate: 100%")).toHaveTextContent(
      "2 of 2 medium or high"
    );
    expect(screen.getByLabelText("Skills assessed: 2")).toHaveTextContent(
      "1 configured · 1 discovered"
    );
    expect(screen.getByText(/this is not a hiring score/i)).toBeInTheDocument();
    expect(screen.queryByText("Verified evidence coverage")).not.toBeInTheDocument();
    expect(screen.queryByText("Status")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to assessment/i })).toHaveClass("h-10", "w-10");
    expect(screen.getByRole("link", { name: /transcript/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^pdf$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^json$/i })).toBeInTheDocument();
    expect(screen.getByText("System Design")).toBeInTheDocument();
    expect(screen.getByText("Stakeholder Management")).toBeInTheDocument();
    expect(screen.getByText("Compare Against a Vacancy")).toBeInTheDocument();
    expect(screen.getByText(/compare this candidate portfolio/i)).toBeInTheDocument();
    expect(listVacanciesMock).toHaveBeenCalledWith({ page: 1, perPage: 100 });

    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Senior Platform Engineer" }));
    await user.click(screen.getByRole("button", { name: /run fit\/gap analysis/i }));

    expect(await screen.findByText("Fit gap destination")).toBeInTheDocument();
  });

  it("disables comparison clearly when no vacancies exist", async () => {
    getPortfolioMock.mockResolvedValue({ data: { portfolio: completePortfolio } });
    renderPage();

    expect(await screen.findByText("Compare Against a Vacancy")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeDisabled();
    expect(screen.getByText("No vacancies available")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /run fit\/gap analysis/i })).toBeDisabled();
  });

  it("discloses when the bounded vacancy list is incomplete", async () => {
    getPortfolioMock.mockResolvedValue({ data: { portfolio: completePortfolio } });
    listVacanciesMock.mockResolvedValue({
      data: {
        vacancies: [vacancy],
        meta: { current_page: 1, total_pages: 2, total_count: 125, per_page: 100 },
      },
    });
    renderPage();

    expect(await screen.findByRole("note")).toHaveTextContent(
      "Showing the first 1 of 125 vacancies. Vacancy search is not available yet."
    );
  });

  it("keeps configured and discovered counts accurate for a partial portfolio", async () => {
    getPortfolioMock.mockResolvedValue({
      data: {
        portfolio: {
          ...completePortfolio,
          generation_status: "partial",
          generation_error: "One skill could not be generated",
        },
      },
    });
    renderPage();

    expect(await screen.findByLabelText("Skills assessed: 2")).toHaveTextContent(
      "1 configured · 1 discovered"
    );
    expect(screen.getByText("Portfolio partially generated")).toBeInTheDocument();
    expect(screen.queryByText("Compare Against a Vacancy")).not.toBeInTheDocument();
  });
});

import { render, screen, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import PortfolioPage, { unreachedSkills } from "../PortfolioPage";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { assessmentsApi } from "@/services/assessments";
import type { AssessmentSkill, Portfolio, PortfolioSkill } from "@/types";

vi.mock("@/services/sessions", () => ({
  sessionsApi: { getPortfolio: vi.fn(), get: vi.fn(), regeneratePortfolio: vi.fn() },
}));
vi.mock("@/services/vacancies", () => ({ vacanciesApi: { list: vi.fn() } }));
vi.mock("@/services/assessments", () => ({ assessmentsApi: { get: vi.fn() } }));
vi.mock("@/services/portfolios", () => ({ portfoliosApi: { exportPortfolio: vi.fn(), getOverride: vi.fn() } }));

const configured = (skill_label: string, skill_id?: number): AssessmentSkill => ({
  skill_label,
  skill_id,
  is_custom: skill_id == null,
  expected_level: 3,
  display_order: 0,
});

const rated = (id: number, skill_label: string, skill_id?: number, is_discovered = false): PortfolioSkill => ({
  id,
  skill_id,
  skill_label,
  is_discovered,
  ai_level: "L3",
  ai_confidence: "high",
  evidence: ["I profiled it first."],
  competency_summary: "Solid.",
} as PortfolioSkill);

const portfolio: Portfolio = {
  id: 7,
  session_id: 3,
  generation_status: "complete",
  skills: [rated(1, "Ruby on Rails", 11), rated(2, "Kafka", undefined, true)],
  overrides: [],
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/assessments/1/sessions/3/portfolio"]}>
      <Routes>
        <Route path="/assessments/:id/sessions/:sessionId/portfolio" element={<PortfolioPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("unreachedSkills", () => {
  it("returns configured skills with no rating, matching by id or by label", () => {
    const result = unreachedSkills(
      [configured("Ruby on Rails", 11), configured("PostgreSQL", 12), configured("  System design "), configured("Kubernetes")],
      [rated(1, "Ruby on Rails", 11), rated(2, "Postgres (renamed)", 12), rated(3, "system design")],
    );
    expect(result.map((s) => s.skill_label)).toEqual(["Kubernetes"]);
  });
});

describe("PortfolioPage", () => {
  beforeEach(() => {
    vi.mocked(sessionsApi.getPortfolio).mockResolvedValue({ data: { portfolio } } as any);
    vi.mocked(sessionsApi.get).mockResolvedValue({ data: { session: { candidate_name: "Demo Candidate" } } } as any);
    vi.mocked(vacanciesApi.list).mockResolvedValue({ data: { vacancies: [{ id: 4, role_title: "Backend Engineer" }] } } as any);
    vi.mocked(assessmentsApi.get).mockResolvedValue({
      data: { assessment: { skills: [configured("Ruby on Rails", 11), configured("Kubernetes", 13)] } },
    } as any);
  });

  afterEach(() => vi.clearAllMocks());

  it("lists configured skills the interview never reached, separately from rated ones", async () => {
    renderPage();

    const section = await screen.findByRole("region", { name: "Not reached in the interview" });
    expect(section).toHaveTextContent("Kubernetes");
    expect(section).not.toHaveTextContent("Ruby on Rails");
    expect(screen.getByRole("region", { name: "Also came up in the interview" })).toHaveTextContent("Kafka");
  });

  it("still renders the ratings when the assessment skill list cannot be loaded", async () => {
    vi.mocked(assessmentsApi.get).mockRejectedValue(new Error("500"));

    renderPage();

    expect(await screen.findByText("Ruby on Rails")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Not reached in the interview" })).not.toBeInTheDocument();
  });

  it("shows a retryable error instead of an empty page when loading fails", async () => {
    vi.mocked(sessionsApi.getPortfolio).mockRejectedValueOnce(new Error("Network Error"));

    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load this candidate's portfolio");
    act(() => screen.getByRole("button", { name: "Try again" }).click());
    expect(await screen.findByText("Ruby on Rails")).toBeInTheDocument();
  });

  it("explains a failed generation and reports a retry that could not be queued", async () => {
    vi.mocked(sessionsApi.getPortfolio).mockResolvedValue({ data: { portfolio: { ...portfolio, generation_status: "failed" } } } as any);
    vi.mocked(sessionsApi.regeneratePortfolio).mockRejectedValue(new Error("500"));

    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("The portfolio could not be generated.");
    act(() => screen.getByRole("button", { name: "Generate again" }).click());
    expect(await screen.findByText(/retry could not be queued/)).toBeInTheDocument();
  });

  it("points to vacancy creation when there is nothing to compare against", async () => {
    vi.mocked(vacanciesApi.list).mockResolvedValue({ data: { vacancies: [] } } as any);

    renderPage();

    expect(await screen.findByRole("link", { name: "Create a vacancy" })).toHaveAttribute("href", "/vacancies/new");
  });
});

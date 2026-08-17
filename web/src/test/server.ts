import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import type { Assessment, FitGapReport, Portfolio, PortfolioSkill, Session, Vacancy } from "@/types";

const API = "*/api/v1";

export function buildSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 5,
    assessment_id: 1,
    candidate_name: "Dewi Lestari",
    invite_token: "tok",
    invite_url: "http://localhost:3000/invite/tok",
    status: "ended",
    ...overrides,
  };
}

export function buildSkill(overrides: Partial<PortfolioSkill> = {}): PortfolioSkill {
  return {
    id: 10,
    skill_label: "React",
    is_discovered: false,
    ai_level: "L3",
    ai_confidence: "high",
    evidence: ["The candidate described building a complex state machine."],
    competency_summary: "Comfortable with hooks and component architecture.",
    ...overrides,
  };
}

export function buildPortfolio(overrides: Partial<Portfolio> = {}): Portfolio {
  return {
    id: 1,
    session_id: 5,
    generation_status: "complete",
    generated_at: "2026-08-17T10:00:00Z",
    skills: [buildSkill()],
    overrides: [],
    ...overrides,
  };
}

export function buildVacancy(overrides: Partial<Vacancy> = {}): Vacancy {
  return {
    id: 7,
    role_title: "Frontend Engineer",
    culture_dimensions: "collaboration",
    competency_expectations: "React at L3",
    skills: [{ id: 1, skill_label: "React", expected_level: 3 }],
    ...overrides,
  };
}

export function buildReport(overrides: Partial<FitGapReport> = {}): FitGapReport {
  return {
    id: 1,
    portfolio_id: 1,
    vacancy_id: 7,
    skill_comparisons: [
      { skill_label: "React", required_level: 3, candidate_level: 3, result: "match", delta: 0 },
    ],
    culture_narrative: "Strong cultural alignment.",
    overall_narrative: "Good overall fit.",
    generated_at: "2026-08-17T11:00:00Z",
    ...overrides,
  };
}

export const handlers = [
  http.get(`${API}/sessions/:id`, () =>
    HttpResponse.json({
      data: {
        session: buildSession(),
        assessment: { id: 1, name: "Frontend Engineer Assessment", time_limit_min: 30 },
      },
    })
  ),

  http.get(`${API}/sessions/:id/portfolio`, () =>
    HttpResponse.json({ data: { portfolio: buildPortfolio() } })
  ),

  http.get(`${API}/sessions/:id/transcript`, () =>
    HttpResponse.json({ data: { turns: [], total: 0 } })
  ),

  http.get(`${API}/vacancies`, () =>
    HttpResponse.json({ data: { vacancies: [buildVacancy()] } })
  ),

  http.get(`${API}/portfolios/:pid/fitgap/:vid`, () =>
    HttpResponse.json({ data: { report: buildReport() } })
  ),

  http.post(`${API}/portfolios/:pid/fitgap`, () =>
    HttpResponse.json({ data: { status: "generating", message: "queued" } }, { status: 202 })
  ),

  http.post(`${API}/sessions/:id/portfolio/regenerate`, () =>
    HttpResponse.json({ data: { message: "queued", portfolio: buildPortfolio({ generation_status: "pending" }) } })
  ),
];

export const server = setupServer(...handlers);
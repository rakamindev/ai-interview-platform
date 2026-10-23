import type { FitGapReport, Portfolio, SkillComparison } from "@/types";

// Synthetic data only.
export function comparison(overrides: Partial<SkillComparison> = {}): SkillComparison {
  return {
    skill_label: "SQL",
    skill_id: null,
    expected_level: 3,
    candidate_level: 3,
    ai_level: 3,
    confidence: "high",
    overridden: false,
    portfolio_skill_id: 11,
    result: "match",
    provisional_result: null,
    delta: 0,
    ...overrides,
  };
}

export const needsReview = (overrides: Partial<SkillComparison> = {}) =>
  comparison({
    skill_label: "System Design",
    expected_level: 4,
    candidate_level: null,
    ai_level: 2,
    confidence: "low",
    portfolio_skill_id: 12,
    result: "insufficient_evidence",
    provisional_result: "gap",
    delta: null,
    ...overrides,
  });

export const notCovered = (overrides: Partial<SkillComparison> = {}) =>
  comparison({
    skill_label: "Kubernetes",
    candidate_level: null,
    ai_level: null,
    confidence: null,
    portfolio_skill_id: null,
    result: "not_assessed",
    delta: null,
    ...overrides,
  });

export function report(overrides: Partial<FitGapReport> = {}): FitGapReport {
  return {
    id: 1,
    portfolio_id: 5,
    vacancy_id: 9,
    skill_comparisons: [needsReview(), notCovered(), comparison()],
    culture_narrative: "Collaborative and explicit about trade-offs.",
    overall_narrative: "Solid on data work; system design is still an open question.",
    comparator_version: 2,
    generated_at: "2026-10-23T07:00:00Z",
    ...overrides,
  };
}

export function portfolio(overrides: Partial<Portfolio> = {}): Portfolio {
  return {
    id: 5,
    session_id: 3,
    generation_status: "complete",
    skills: [],
    overrides: [],
    ...overrides,
  };
}

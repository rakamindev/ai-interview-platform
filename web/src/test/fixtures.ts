import type { AssessorOverride, FitGapReport, Portfolio, PortfolioSkill, SkillComparison } from "@/types";

// Fictional data only.
export function skill(overrides: Partial<PortfolioSkill> = {}): PortfolioSkill {
  return {
    id: 1,
    skill_id: "SK-ENG-001",
    skill_label: "React",
    is_discovered: false,
    assessed: true,
    ai_level: 3,
    ai_confidence: "high",
    effective_level: 3,
    override: null,
    evidence: ["I model loading and error states before the happy path."],
    competency_summary: "Handles UI state deliberately.",
    ...overrides,
  };
}

export function notAssessedSkill(overrides: Partial<PortfolioSkill> = {}): PortfolioSkill {
  return skill({
    id: 2,
    skill_id: "SK-ENG-008",
    skill_label: "Cloud Infrastructure",
    assessed: false,
    ai_level: null,
    ai_confidence: null,
    effective_level: null,
    evidence: [],
    competency_summary: "Not covered: the candidate did not discuss cloud work.",
    ...overrides,
  });
}

export function override(overrides: Partial<AssessorOverride> = {}): AssessorOverride {
  return {
    id: 9,
    portfolio_skill_id: 2,
    ai_level: null,
    override_level: 2,
    assessor_notes: "Follow-up call: owns the staging environment.",
    ...overrides,
  };
}

export function portfolio(skills: PortfolioSkill[], overrides: Partial<Portfolio> = {}): Portfolio {
  return {
    id: 7,
    session_id: 3,
    generation_status: "complete",
    generated_at: "2026-10-20T10:00:00Z",
    generation_error: null,
    skills,
    overrides: [],
    ...overrides,
  };
}

export function comparison(overrides: Partial<SkillComparison> = {}): SkillComparison {
  return {
    skill_label: "React",
    skill_id: "SK-ENG-001",
    expected_level: 3,
    candidate_level: 3,
    ai_level: 3,
    is_override: false,
    result: "match",
    delta: 0,
    confidence: "high",
    ...overrides,
  };
}

export function report(overrides: Partial<FitGapReport> = {}): FitGapReport {
  return {
    id: 1,
    portfolio_id: 7,
    vacancy_id: 2,
    skill_comparisons: [comparison()],
    recommendation_status: "sufficient",
    evidence_gaps: [],
    culture_narrative: "Comfortable with written, async collaboration.",
    overall_narrative: "Recommend proceeding to the technical round.",
    generated_at: "2026-10-20T10:00:00Z",
    ...overrides,
  };
}

import type { PortfolioSkill, SkillComparison } from "@/types";

// Fictional data only.
export function ratedSkill(overrides: Partial<PortfolioSkill> = {}): PortfolioSkill {
  return {
    id: 1,
    skill_id: "sk-react",
    skill_label: "React / Frontend Development",
    is_discovered: false,
    rating_status: "rated",
    ai_level: 3,
    ai_confidence: "high",
    probe_count: 4,
    coverage_state: "covered",
    evidence: [{ quote: "I split the context into read and write providers", turn_number: 4 }],
    competency_summary: "Reasons clearly about state trade-offs.",
    ...overrides,
  };
}

export function notAssessedSkill(overrides: Partial<PortfolioSkill> = {}): PortfolioSkill {
  return ratedSkill({
    id: 2,
    skill_label: "System Design",
    rating_status: "not_assessed",
    ai_level: null,
    ai_confidence: null,
    probe_count: 0,
    coverage_state: "not_yet",
    evidence: [],
    competency_summary: "The interview did not reach this skill.",
    ...overrides,
  });
}

export function comparison(overrides: Partial<SkillComparison> = {}): SkillComparison {
  return {
    skill_label: "React",
    expected_level: 3,
    candidate_level: 3,
    ai_level: 3,
    result: "match",
    delta: 0,
    confidence: "high",
    rating_status: "rated",
    overridden: false,
    low_confidence: false,
    ...overrides,
  };
}

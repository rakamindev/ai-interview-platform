import type { PortfolioSkill, SkillComparison } from "@/types";

export function buildSkill(overrides: Partial<PortfolioSkill> = {}): PortfolioSkill {
  return {
    id: 1,
    skill_id: null,
    skill_label: "System Design",
    is_discovered: false,
    assessment_status: "assessed",
    ai_level: 3,
    ai_confidence: "high",
    evidence: ["I start from the data contracts."],
    competency_summary: "Reasons from contracts first.",
    ...overrides,
  };
}

export function buildUnratedSkill(overrides: Partial<PortfolioSkill> = {}): PortfolioSkill {
  return buildSkill({
    id: 2,
    skill_label: "Testing",
    assessment_status: "not_assessed",
    ai_level: null,
    ai_confidence: null,
    evidence: [],
    competency_summary: null,
    ...overrides,
  });
}

export function buildComparison(overrides: Partial<SkillComparison> = {}): SkillComparison {
  return {
    skill_label: "System Design",
    expected_level: 3,
    candidate_level: 3,
    result: "match",
    delta: 0,
    is_override: false,
    not_assessed_reason: null,
    ...overrides,
  };
}

import type { AssessorOverride, PortfolioSkill, SkillComparison } from "@/types";

export function skill(overrides: Partial<PortfolioSkill> = {}): PortfolioSkill {
  return {
    id: 1,
    skill_id: "sk-eng-001",
    skill_label: "React / Frontend Development",
    is_discovered: false,
    assessment_status: "assessed",
    status_reason: null,
    ai_level: 3,
    ai_confidence: "high",
    coverage_state: "covered",
    probe_count: 4,
    evidence: ["We moved hot data into a ref"],
    evidence_refs: [{ quote: "We moved hot data into a ref", turn_number: 4 }],
    unverified_evidence_count: 0,
    competency_summary: "Reasons clearly about state trade-offs.",
    ...overrides,
  };
}

export function notAssessed(overrides: Partial<PortfolioSkill> = {}): PortfolioSkill {
  return skill({
    id: 2,
    skill_label: "System Design",
    assessment_status: "not_assessed",
    status_reason: "never_reached",
    ai_level: null,
    ai_confidence: null,
    coverage_state: "not_yet",
    probe_count: 0,
    evidence: [],
    evidence_refs: [],
    competency_summary: "The interview ended before this skill was discussed.",
    ...overrides,
  });
}

export function override(overrides: Partial<AssessorOverride> = {}): AssessorOverride {
  return {
    id: 9,
    portfolio_skill_id: 2,
    ai_level: null,
    override_level: 3,
    assessor_notes: "Covered in a follow-up call",
    ...overrides,
  };
}

export function comparison(overrides: Partial<SkillComparison> = {}): SkillComparison {
  return {
    skill_label: "React",
    required_level: 3,
    expected_level: 3,
    candidate_level: 3,
    result: "match",
    delta: 0,
    is_override: false,
    confidence: "high",
    needs_review: false,
    not_assessed_reason: null,
    ...overrides,
  };
}

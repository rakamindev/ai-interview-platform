import { describe, it, expect } from "vitest";
import {
  assessmentStatusOf,
  coveragePercent,
  isReady,
} from "@/utils/evaluation";
import type { EvaluationSkillSummary, EvaluationSummary } from "@/types";

describe("evaluation utils", () => {
  it("derives assessment status from the summary skill", () => {
    const skill: EvaluationSkillSummary = {
      id: 1,
      skill_label: "React",
      is_discovered: false,
      assessment_status: "partial",
      evidence: ["quote"],
      counter_evidence: [],
    };
    expect(assessmentStatusOf(skill)).toBe("partial");
  });

  it("falls back to evidence presence when status is missing", () => {
    const withEvidence = { ...baseSkill(), assessment_status: undefined } as unknown as EvaluationSkillSummary;
    const noEvidence = {
      ...baseSkill(),
      assessment_status: undefined,
      evidence: [],
    } as unknown as EvaluationSkillSummary;

    expect(assessmentStatusOf(withEvidence)).toBe("assessed");
    expect(assessmentStatusOf(noEvidence)).toBe("not_assessed");
  });

  it("computes coverage percent from the summary", () => {
    const summary: EvaluationSummary = {
      overall_status: "needs_review",
      coverage: { assessed: 3, total: 4, percent: 75 },
      needs_review: true,
      review_reasons: [],
      skills: [],
    };
    expect(coveragePercent(summary)).toBe(75);
    expect(coveragePercent(null)).toBe(0);
  });

  it("recognizes readiness", () => {
    expect(isReady({ ...summaryFor("ready_for_review") })).toBe(true);
    expect(isReady({ ...summaryFor("needs_review") })).toBe(false);
    expect(isReady(null)).toBe(false);
  });

  function summaryFor(status: "ready_for_review" | "needs_review"): EvaluationSummary {
    return {
      overall_status: status,
      coverage: { assessed: 4, total: 4, percent: 100 },
      needs_review: status === "needs_review",
      review_reasons: [],
      skills: [],
    };
  }

  function baseSkill() {
    return {
      id: 1,
      skill_label: "React",
      is_discovered: false,
      assessment_status: "assessed" as const,
      ai_level: 3,
      ai_confidence: "high",
      evidence: ["quote"],
      counter_evidence: [],
    };
  }
});
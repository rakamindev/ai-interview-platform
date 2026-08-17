import { describe, expect, it } from "vitest";
import { requiredLevel, summarizeComparisons } from "./fitGap";
import type { SkillComparison } from "@/types";

const row = (overrides: Partial<SkillComparison> = {}): SkillComparison => ({
  skill_label: "System Design",
  required_level: 3,
  candidate_level: 3,
  result: "match",
  confidence: "high",
  evidence_count: 2,
  ...overrides,
});

describe("fit/gap decision safety", () => {
  it("supports legacy reports that used expected_level", () => {
    const legacy = row({ required_level: undefined as unknown as number, expected_level: 4 });

    expect(requiredLevel(legacy)).toBe(4);
  });

  it("keeps missing evidence separate from a skill gap", () => {
    const summary = summarizeComparisons([
      row(),
      row({ skill_label: "Communication", result: "gap", candidate_level: 2 }),
      row({
        skill_label: "Security",
        result: "not_assessed",
        candidate_level: undefined,
        confidence: null,
        evidence_count: 0,
      }),
    ]);

    expect(summary.gap).toBe(1);
    expect(summary.not_assessed).toBe(1);
    expect(summary.decision_status).toBe("review_required");
  });

  it("requires review when any rating has low confidence", () => {
    const summary = summarizeComparisons([
      row({ confidence: "low" }),
      row({ skill_label: "Communication", is_override: true }),
    ]);

    expect(summary.low_confidence).toBe(1);
    expect(summary.human_overrides).toBe(1);
    expect(summary.decision_status).toBe("review_required");
  });

  it("marks complete evidence as ready for structured review", () => {
    const summary = summarizeComparisons([
      row(),
      row({ skill_label: "Communication", result: "exceed", candidate_level: 4, delta: 1 }),
    ]);

    expect(summary.decision_status).toBe("evidence_ready");
    expect(summary.total_skills).toBe(2);
  });
});

import { describe, expect, it } from "vitest";

import type { SkillComparison } from "../types/fit-gap.types";
import { parsePositiveInteger, requiredLevel, summarizeComparisons } from "./fit-gap";

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
    const legacy = row({ required_level: undefined, expected_level: 4 });

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

describe("fit/gap route parameters", () => {
  it("accepts positive integer identifiers", () => {
    expect(parsePositiveInteger("42")).toBe(42);
  });

  it.each([undefined, "", "0", "-1", "1.5", "abc"])(
    "rejects invalid identifier %s",
    (value) => {
      expect(parsePositiveInteger(value)).toBeNull();
    },
  );
});

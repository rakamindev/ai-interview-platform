import { describe, it, expect } from "vitest";
import {
  normalizeSkillComparison,
  normalizeSkillComparisons,
  countByResult,
} from "./fitGapDisplay";

describe("normalizeSkillComparison", () => {
  it("prefers required_level over expected_level", () => {
    const normalized = normalizeSkillComparison({
      skill_label: "React",
      result: "match",
      required_level: 4,
      expected_level: 3,
      candidate_level: 4,
    });
    expect(normalized.required_level).toBe(4);
  });

  it("maps expected_level to required_level for the FE contract", () => {
    const normalized = normalizeSkillComparison({
      skill_label: "React",
      result: "gap",
      expected_level: 3,
      candidate_level: 2,
      delta: -1,
    });

    expect(normalized.required_level).toBe(3);
    expect(normalized.candidate_level).toBe(2);
    expect(normalized.result).toBe("gap");
  });

  it("maps overridden to is_override", () => {
    const normalized = normalizeSkillComparison({
      skill_label: "React",
      result: "match",
      expected_level: 3,
      candidate_level: 3,
      overridden: true,
    });

    expect(normalized.is_override).toBe(true);
  });

  it("preserves not_assessed without a candidate level", () => {
    const normalized = normalizeSkillComparison({
      skill_label: "System Design",
      result: "not_assessed",
      expected_level: 2,
      candidate_level: null,
    });

    expect(normalized.result).toBe("not_assessed");
    expect(normalized.candidate_level).toBeUndefined();
    expect(normalized.required_level).toBe(2);
  });
});

describe("normalizeSkillComparisons", () => {
  it("treats missing comparison lists as empty", () => {
    expect(normalizeSkillComparisons(undefined)).toEqual([]);
    expect(normalizeSkillComparisons(null)).toEqual([]);
  });
});

describe("countByResult", () => {
  it("counts not_assessed rows for decision summaries", () => {
    const rows = normalizeSkillComparisons([
      { skill_label: "A", result: "match", expected_level: 3, candidate_level: 3 },
      { skill_label: "B", result: "not_assessed", expected_level: 2 },
      { skill_label: "C", result: "not_assessed", expected_level: 4 },
      { skill_label: "D", result: "gap", expected_level: 4, candidate_level: 2, delta: -2 },
    ]);

    expect(countByResult(rows, "not_assessed")).toBe(2);
    expect(countByResult(rows, "match")).toBe(1);
    expect(countByResult(rows, "gap")).toBe(1);
    expect(countByResult(rows, "exceed")).toBe(0);
  });
});

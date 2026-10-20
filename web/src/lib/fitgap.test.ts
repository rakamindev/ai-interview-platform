import { describe, expect, it } from "vitest";
import { coveragePercent, formatDelta, normalizeComparison, sortComparisons, summarize } from "@/lib/fitgap";
import type { SkillComparison } from "@/types";

const row = (over: Partial<SkillComparison>): SkillComparison => ({
  skill_label: "React",
  required_level: 3,
  candidate_level: 3,
  result: "match",
  ...over,
});

describe("formatDelta", () => {
  it("signs positives and uses a real minus for negatives", () => {
    expect(formatDelta(2)).toBe("+2");
    expect(formatDelta(-1)).toBe("−1");
  });
  it("never renders undefined, NaN or -0", () => {
    expect(formatDelta(undefined)).toBe("0");
    expect(formatDelta(null)).toBe("0");
    expect(formatDelta(NaN)).toBe("0");
    expect(formatDelta(-0)).toBe("0");
  });
});

describe("coveragePercent", () => {
  it("is null when nothing is required", () => {
    expect(coveragePercent({ assessed: 0, total: 0 })).toBeNull();
  });
  it("rounds and clamps", () => {
    expect(coveragePercent({ assessed: 1, total: 3 })).toBe(33);
    expect(coveragePercent({ assessed: 5, total: 3 })).toBe(100);
  });
});

describe("sortComparisons", () => {
  it("puts gaps, then unknowns, then matches, then exceeds, keeping vacancy order inside a group", () => {
    const sorted = sortComparisons([
      row({ skill_label: "A", result: "exceed" }),
      row({ skill_label: "B", result: "gap" }),
      row({ skill_label: "C", result: "match" }),
      row({ skill_label: "D", result: "not_assessed" }),
      row({ skill_label: "E", result: "gap" }),
    ]);
    expect(sorted.map((c) => c.skill_label)).toEqual(["B", "E", "D", "C", "A"]);
  });
  it("does not mutate its input", () => {
    const input = [row({ result: "exceed" }), row({ result: "gap" })];
    sortComparisons(input);
    expect(input[0].result).toBe("exceed");
  });
});

describe("normalizeComparison (API/UI seam)", () => {
  it("reads legacy expected_level when required_level is missing", () => {
    const legacy = { skill_label: "SQL", expected_level: 4, result: "gap" } as unknown as SkillComparison;
    expect(normalizeComparison(legacy).required_level).toBe(4);
  });
  it("prefers required_level", () => {
    expect(normalizeComparison(row({ required_level: 2 })).required_level).toBe(2);
  });
});

describe("summarize", () => {
  it("counts every result and coverage", () => {
    const s = summarize([
      row({ result: "match" }),
      row({ result: "gap", low_evidence: true }),
      row({ result: "not_assessed", candidate_level: null }),
      row({ result: "exceed", is_override: true }),
    ]);
    expect(s).toMatchObject({
      total: 4, assessed: 3, match: 1, gap: 1, exceed: 1, not_assessed: 1,
      low_evidence: 1, overridden: 1, coverage_pct: 75,
    });
  });
  it("handles an empty vacancy", () => {
    expect(summarize([])).toMatchObject({ total: 0, assessed: 0, coverage_pct: null });
  });
});

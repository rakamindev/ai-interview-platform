import { describe, expect, it } from "vitest";
import type { SkillComparison } from "@/types";
import { levelLabel, summarizeComparisons } from "./comparisonSummary";

const row = (overrides: Partial<SkillComparison>): SkillComparison => ({
  skill_label: "Communication",
  expected_level: 3,
  candidate_level: 3,
  result: "match",
  delta: 0,
  ...overrides,
});

describe("summarizeComparisons", () => {
  it("counts every result, including skills that were not assessed", () => {
    const summary = summarizeComparisons([
      row({ result: "match" }),
      row({ result: "exceed", candidate_level: 5, delta: 2 }),
      row({ result: "gap", candidate_level: 1, delta: -2 }),
      row({ result: "not_assessed", candidate_level: null, delta: null }),
      row({ result: "not_assessed", candidate_level: null, delta: null }),
    ]);

    expect(summary.total).toBe(5);
    expect(summary.counts).toEqual({ match: 1, exceed: 1, gap: 1, not_assessed: 2 });
  });

  it("never counts an unknown result as a match", () => {
    const summary = summarizeComparisons([row({ result: "pending" as SkillComparison["result"] })]);

    expect(summary.counts.match).toBe(0);
    expect(summary.counts.not_assessed).toBe(1);
  });

  it("reports an override only when one is present", () => {
    expect(summarizeComparisons([row({})]).hasOverride).toBe(false);
    expect(summarizeComparisons([row({}), row({ is_override: true })]).hasOverride).toBe(true);
  });

  it("handles an empty list", () => {
    expect(summarizeComparisons([])).toEqual({
      total: 0,
      counts: { match: 0, exceed: 0, gap: 0, not_assessed: 0 },
      hasOverride: false,
    });
  });
});

describe("levelLabel", () => {
  it("labels levels 1 to 5 and returns null for missing or out-of-range levels", () => {
    expect(levelLabel(3)).toBe("L3");
    expect(levelLabel(null)).toBeNull();
    expect(levelLabel(undefined)).toBeNull();
    expect(levelLabel(0)).toBeNull();
    expect(levelLabel(7)).toBeNull();
  });
});

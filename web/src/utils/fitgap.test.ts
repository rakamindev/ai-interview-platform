import { describe, it, expect } from "vitest";
import { summarizeCoverage, requiredLevelOf } from "./fitgap";
import type { SkillComparison } from "../types";

const row = (result: SkillComparison["result"]) =>
  ({ skill_label: "X", result } as SkillComparison);

describe("summarizeCoverage", () => {
  it("reports 1 of 4 when three skills are not assessed", () => {
    const list = [row("match"), row("not_assessed"), row("not_assessed"), row("not_assessed")];
    expect(summarizeCoverage(list)).toEqual({
      assessed: 1, total: 4, not_assessed: 3, complete: false,
    });
  });

  it("is complete when every skill was assessed", () => {
    expect(summarizeCoverage([row("match"), row("gap")]).complete).toBe(true);
  });

  it("does not crash on empty, null or undefined input", () => {
    const empty = { assessed: 0, total: 0, not_assessed: 0, complete: true };
    expect(summarizeCoverage([])).toEqual(empty);
    expect(summarizeCoverage(null)).toEqual(empty);
    expect(summarizeCoverage(undefined)).toEqual(empty);
  });
});

describe("requiredLevelOf", () => {
  it("reads expected_level, the field the API actually sends", () => {
    expect(requiredLevelOf({ expected_level: 4 })).toBe(4);
  });

  it("falls back to required_level for older payloads", () => {
    expect(requiredLevelOf({ required_level: 3 })).toBe(3);
  });

  it("returns undefined when neither field exists", () => {
    expect(requiredLevelOf({})).toBeUndefined();
  });
});

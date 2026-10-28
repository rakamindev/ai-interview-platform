import type { FitGapCoverage, SkillComparison } from "../types";

// How many of the vacancy's required skills were actually assessed.
export function summarizeCoverage(
  comparisons: SkillComparison[] | null | undefined
): FitGapCoverage {
  const list = comparisons ?? [];
  const not_assessed = list.filter((c) => c.result === "not_assessed").length;
  return {
    assessed: list.length - not_assessed,
    total: list.length,
    not_assessed,
    complete: not_assessed === 0,
  };
}

// The API sends `expected_level`; older code read `required_level`.
export function requiredLevelOf(
  c: Pick<SkillComparison, "required_level" | "expected_level">
): number | undefined {
  return c.expected_level ?? c.required_level;
}

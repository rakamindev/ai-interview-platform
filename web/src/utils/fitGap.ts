import type { SkillComparison, SkillComparisonResult } from "@/types";

export function getComparisonResult(comparison: SkillComparison): SkillComparisonResult {
  return comparison.result ?? comparison.fit_result ?? "not_assessed";
}

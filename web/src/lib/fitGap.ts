import type { FitGapReviewSummary, SkillComparison } from "@/types";

export function requiredLevel(comparison: SkillComparison): number | undefined {
  return comparison.required_level ?? comparison.expected_level;
}

export function summarizeComparisons(
  comparisons: SkillComparison[],
): FitGapReviewSummary {
  const count = (result: SkillComparison["result"]) =>
    comparisons.filter((comparison) => comparison.result === result).length;

  const summary = {
    total_skills: comparisons.length,
    match: count("match"),
    gap: count("gap"),
    exceed: count("exceed"),
    not_assessed: count("not_assessed"),
    low_confidence: comparisons.filter(
      (comparison) => comparison.confidence === "low",
    ).length,
    human_overrides: comparisons.filter(
      (comparison) => comparison.is_override === true,
    ).length,
  };

  return {
    ...summary,
    decision_status:
      summary.not_assessed > 0 || summary.low_confidence > 0
        ? "review_required"
        : "evidence_ready",
  };
}

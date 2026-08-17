import type {
  FitGapReviewSummary,
  SkillComparison,
} from "../types/fit-gap.types";

export function parsePositiveInteger(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null;

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function requiredLevel(comparison: SkillComparison): number | undefined {
  return comparison.required_level ?? comparison.expected_level;
}

export function summarizeComparisons(
  comparisons: SkillComparison[],
): FitGapReviewSummary {
  const count = (result: SkillComparison["result"]) =>
    comparisons.filter((comparison) => comparison.result === result).length;

  const notAssessed = count("not_assessed");
  const lowConfidence = comparisons.filter(
    (comparison) => comparison.confidence === "low",
  ).length;

  return {
    total_skills: comparisons.length,
    match: count("match"),
    gap: count("gap"),
    exceed: count("exceed"),
    not_assessed: notAssessed,
    low_confidence: lowConfidence,
    human_overrides: comparisons.filter((comparison) => comparison.is_override).length,
    decision_status:
      notAssessed > 0 || lowConfidence > 0 ? "review_required" : "evidence_ready",
  };
}

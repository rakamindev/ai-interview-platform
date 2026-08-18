export type FitGapComparisonResult = "match" | "gap" | "exceed" | "not_assessed";

export interface FitGapComparisonLike {
  result: FitGapComparisonResult;
  candidate_level?: number | null;
}

export interface FitGapSummary {
  total: number;
  assessed: number;
  matches: number;
  gaps: number;
  exceeds: number;
  notAssessed: number;
  positiveRate: number | null;
}

export function summarizeComparisons(comparisons: FitGapComparisonLike[]): FitGapSummary {
  const matches = comparisons.filter((comparison) => comparison.result === "match").length;
  const gaps = comparisons.filter((comparison) => comparison.result === "gap").length;
  const exceeds = comparisons.filter((comparison) => comparison.result === "exceed").length;
  const notAssessed = comparisons.filter((comparison) => comparison.result === "not_assessed").length;
  const assessed = matches + gaps + exceeds;

  return {
    total: comparisons.length,
    assessed,
    matches,
    gaps,
    exceeds,
    notAssessed,
    positiveRate: assessed === 0 ? null : Math.round(((matches + exceeds) / assessed) * 100),
  };
}

import type { FitGapSummary, SkillComparison, SkillComparisonResult } from "@/types";

/** Display order: what needs a human first. */
const RESULT_ORDER: Record<SkillComparisonResult, number> = {
  gap: 0,
  not_assessed: 1,
  match: 2,
  exceed: 3,
};

/** "+2", "-1", "0" – a real minus sign, never "-0" or "undefined". */
export function formatDelta(delta: number | null | undefined): string {
  if (delta == null || Number.isNaN(delta) || delta === 0) return "0";
  return delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`;
}

/** Whole-number percentage clamped to 0..100; null when there is nothing to measure. */
export function coveragePercent(summary: Pick<FitGapSummary, "assessed" | "total">): number | null {
  if (!summary.total) return null;
  return Math.min(100, Math.max(0, Math.round((summary.assessed / summary.total) * 100)));
}

/** Gaps first, then unknowns, then matches; stable inside a group so the vacancy order is kept. */
export function sortComparisons(comparisons: SkillComparison[]): SkillComparison[] {
  return comparisons
    .map((c, index) => ({ c, index }))
    .sort((a, b) => RESULT_ORDER[a.c.result] - RESULT_ORDER[b.c.result] || a.index - b.index)
    .map(({ c }) => c);
}

/**
 * Old reports (written before the API returned `required_level`) carry `expected_level`.
 * Accept both so a stale cache or an older deployment never renders "undefined".
 */
export function normalizeComparison(raw: SkillComparison & { expected_level?: number }): SkillComparison {
  return { ...raw, required_level: raw.required_level ?? raw.expected_level ?? 0 };
}

/** Rebuilds the summary from rows, for reports that predate the server-side summary. */
export function summarize(comparisons: SkillComparison[]): FitGapSummary {
  const count = (r: SkillComparisonResult) => comparisons.filter((c) => c.result === r).length;
  const total = comparisons.length;
  const notAssessed = count("not_assessed");
  const assessed = total - notAssessed;
  return {
    total,
    assessed,
    match: count("match"),
    exceed: count("exceed"),
    gap: count("gap"),
    not_assessed: notAssessed,
    low_evidence: comparisons.filter((c) => c.low_evidence).length,
    overridden: comparisons.filter((c) => c.is_override).length,
    coverage_pct: total ? coveragePercent({ assessed, total }) : null,
  };
}

import { LEVEL_LABELS } from "@/utils/constants";
import type { SkillComparison, SkillComparisonResult } from "@/types";

export interface ComparisonSummary {
  total: number;
  counts: Record<SkillComparisonResult, number>;
  hasOverride: boolean;
}

export function summarizeComparisons(comparisons: SkillComparison[]): ComparisonSummary {
  const counts: Record<SkillComparisonResult, number> = { match: 0, exceed: 0, gap: 0, not_assessed: 0 };
  for (const c of comparisons) {
    // an unknown result is safer shown as not assessed than counted as a match
    counts[c.result in counts ? c.result : "not_assessed"] += 1;
  }
  return { total: comparisons.length, counts, hasOverride: comparisons.some((c) => c.is_override === true) };
}

export function levelLabel(level: number | null | undefined): string | null {
  return level != null ? LEVEL_LABELS[level] ?? null : null;
}

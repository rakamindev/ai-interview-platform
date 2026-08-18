/**
 * Normalize fit-gap skill comparison payloads from the API so the UI can
 * rely on a stable frontend contract (required_level / is_override).
 */
import type { SkillComparison, SkillComparisonResult } from "@/types";

export type ApiSkillComparison = {
  skill_label: string;
  result: SkillComparisonResult;
  candidate_level?: number | null;
  expected_level?: number;
  required_level?: number;
  delta?: number | null;
  overridden?: boolean;
  is_override?: boolean;
  confidence?: string | null;
};

export function normalizeSkillComparison(raw: ApiSkillComparison): SkillComparison {
  const required =
    raw.required_level ?? raw.expected_level ?? 0;
  const isOverride = Boolean(raw.is_override ?? raw.overridden);

  return {
    skill_label: raw.skill_label,
    required_level: required,
    candidate_level: raw.candidate_level ?? undefined,
    result: raw.result,
    delta: raw.delta ?? undefined,
    is_override: isOverride,
  };
}

export function normalizeSkillComparisons(
  comparisons: ApiSkillComparison[] | undefined | null
): SkillComparison[] {
  return (comparisons ?? []).map(normalizeSkillComparison);
}

export function countByResult(
  comparisons: SkillComparison[],
  result: SkillComparisonResult
): number {
  return comparisons.filter((c) => c.result === result).length;
}

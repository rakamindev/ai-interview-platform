const NORMAL_END_REASONS = new Set(["manual_candidate", "manual_assessor", "all_covered", "time_ceiling"]);

export function isNormalInterviewEnd(reason?: string | null) {
  return !!reason && NORMAL_END_REASONS.has(reason);
}

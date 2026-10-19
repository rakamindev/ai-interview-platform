export type FitResult = "match" | "gap" | "exceed" | "not_assessed";
export type Verdict = "advance" | "hold" | "decline";

export interface ComparisonInput {
  skill_label?: string | null;
  required_level?: number | null;
  expected_level?: number | null;
  candidate_level?: number | null;
  result?: string | null;
  confidence?: string | null;
  delta?: number | null;
  is_override?: boolean;
}

export interface HiringDecision {
  verdict: Verdict;
  rationale: string;
  counts: Record<FitResult, number>;
  blockingSkills: string[];
  lowConfidenceSkills: string[];
}

export function fromServerDecision(raw: {
  verdict: Verdict;
  rationale: string;
  counts?: Partial<Record<FitResult, number>>;
  blocking_skills?: string[];
  low_confidence_skills?: string[];
}): HiringDecision {
  return {
    verdict: raw.verdict,
    rationale: raw.rationale,
    counts: {
      match: raw.counts?.match ?? 0,
      gap: raw.counts?.gap ?? 0,
      exceed: raw.counts?.exceed ?? 0,
      not_assessed: raw.counts?.not_assessed ?? 0,
    },
    blockingSkills: raw.blocking_skills ?? [],
    lowConfidenceSkills: raw.low_confidence_skills ?? [],
  };
}

export function requiredLevel(row: ComparisonInput): number | null {
  const value = row.required_level ?? row.expected_level;
  return typeof value === "number" && value >= 1 && value <= 5 ? value : null;
}

export function confidenceOf(row: ComparisonInput): string {
  return (row.confidence ?? "").trim().toLowerCase();
}

function labelOf(row: ComparisonInput, index: number): string {
  const label = row.skill_label?.trim();
  return label ? label : `Skill ${index + 1}`;
}

export function decide(comparisons: ComparisonInput[]): HiringDecision {
  const rows = comparisons.map((row, index) => ({
    label: labelOf(row, index),
    result: (row.result ?? "not_assessed") as FitResult,
    confidence: confidenceOf(row),
  }));

  const counts: Record<FitResult, number> = {
    match: rows.filter((row) => row.result === "match").length,
    gap: rows.filter((row) => row.result === "gap").length,
    exceed: rows.filter((row) => row.result === "exceed").length,
    not_assessed: rows.filter((row) => row.result === "not_assessed").length,
  };

  const unknown = rows.filter((row) => row.result === "not_assessed");
  const lowConfidence = rows.filter((row) => row.result !== "not_assessed" && row.confidence === "low");
  const gaps = rows.filter((row) => row.result === "gap" && row.confidence !== "low");

  let verdict: Verdict = "advance";
  let rationale = "Every required skill was assessed at or above the role bar with usable confidence.";
  let blocking = [] as typeof rows;

  if (rows.length === 0) {
    verdict = "hold";
    rationale = "No role requirements are defined, so there is nothing to decide against.";
  } else if (unknown.length > 0) {
    verdict = "hold";
    rationale = "One or more required skills have no usable rating. Do not advance or decline until those skills are assessed.";
    blocking = unknown;
  } else if (lowConfidence.length > 0) {
    verdict = "hold";
    rationale = "One or more ratings rest on low confidence. Collect more evidence before a hiring decision.";
    blocking = lowConfidence;
  } else if (gaps.length > 0) {
    verdict = "decline";
    rationale = "Every required skill was assessed, and at least one confident gap remains against the role bar.";
    blocking = gaps;
  }

  return {
    verdict,
    rationale,
    counts,
    blockingSkills: blocking.map((row) => row.label),
    lowConfidenceSkills: lowConfidence.map((row) => row.label),
  };
}

export function clampText(value: string, limit: number): { text: string; truncated: boolean } {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) return { text: normalized, truncated: false };
  return { text: `${normalized.slice(0, limit).trimEnd()}…`, truncated: true };
}

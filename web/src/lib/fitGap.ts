import type { SkillComparison, SkillComparisonResult } from "@/types";

export interface FitGapSummary {
  total: number;
  meets: number;      // match + exceed
  below: number;      // gap
  review: number;     // insufficient_evidence
  notCovered: number; // not_assessed
  /** Skills with a verdict the report stands behind. */
  rated: number;
  /** Skills that are open questions, not weaknesses. */
  open: number;
}

export function summarize(comparisons: SkillComparison[]): FitGapSummary {
  const count = (...results: SkillComparisonResult[]) =>
    comparisons.filter((c) => results.includes(c.result)).length;

  const meets = count("match", "exceed");
  const below = count("gap");
  const review = count("insufficient_evidence");
  const notCovered = count("not_assessed");

  return {
    total: comparisons.length,
    meets,
    below,
    review,
    notCovered,
    rated: meets + below,
    open: review + notCovered,
  };
}

export function summarySentence(s: FitGapSummary): string {
  const rated = `${s.rated} of ${s.total} required ${s.total === 1 ? "skill" : "skills"} rated with enough evidence.`;
  if (s.open === 0) return rated;
  const verb = s.open === 1 ? "is an open question" : "are open questions";
  return `${rated} ${s.open} ${verb}, not evidence of weakness.`;
}

export type Tone = "negative" | "attention" | "neutral" | "positive";

export interface ResultMeta {
  label: string;
  tone: Tone;
}

export function resultMeta(c: SkillComparison): ResultMeta {
  switch (c.result) {
    case "gap":
      return { label: `Below by ${Math.abs(c.delta ?? 0)}`, tone: "negative" };
    case "insufficient_evidence":
      return { label: "Needs review", tone: "attention" };
    case "not_assessed":
      return { label: "Not covered", tone: "neutral" };
    case "match":
      return { label: "Meets", tone: "positive" };
    case "exceed":
      return { label: `Exceeds by ${c.delta ?? 0}`, tone: "positive" };
  }
}

const DIRECTION: Record<string, string> = {
  gap: "below",
  match: "at",
  exceed: "above",
};

/** Plain-language explanation shown under the row, or null when the verdict speaks for itself. */
export function resultExplanation(c: SkillComparison): string | null {
  if (c.result === "insufficient_evidence") {
    const direction = c.provisional_result ? ` (${DIRECTION[c.provisional_result]} the expected L${c.expected_level})` : "";
    return `Only briefly explored. The AI suggested L${c.ai_level}${direction}, but there is not enough evidence to rely on it. Confirm a level before treating it as a gap or a strength.`;
  }
  if (c.result === "not_assessed") {
    return "The interview did not cover this skill. This is an open question, not evidence of weakness.";
  }
  return null;
}

/** Where the verdict's level came from. */
export function levelSource(c: SkillComparison): string | null {
  if (c.overridden) return "Assessor-confirmed";
  if (c.result === "insufficient_evidence" || c.result === "not_assessed") return null;
  return c.confidence ? `AI · ${c.confidence} confidence` : "AI";
}

// Display rules for portfolio and fit/gap data. Kept free of React so the
// rules the assessor relies on are unit-tested on their own.
import type {
  AssessorOverride,
  Confidence,
  NotAssessedReason,
  PortfolioSkill,
  SkillComparison,
} from "@/types";

/** "L3" → 3, 3 → 3, anything else → null. Never invents a level. */
export function toLevel(value: number | string | null | undefined): number | null {
  if (typeof value === "number") return Number.isInteger(value) && value >= 1 && value <= 5 ? value : null;
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^[Ll]?([1-5])$/);
  return match ? Number(match[1]) : null;
}

export function isAssessed(skill: PortfolioSkill): boolean {
  return (skill.assessment_status ?? "assessed") === "assessed" && toLevel(skill.ai_level) !== null;
}

/** The level the assessor sees: their override if any, else the AI's, else null. */
export function effectiveLevel(skill: PortfolioSkill, override?: AssessorOverride): number | null {
  return override?.override_level ?? toLevel(skill.ai_level);
}

/**
 * A skill needs a person to look at it when nobody has rated it, or the AI's
 * rating rests on thin or unverifiable evidence. A human override settles it.
 */
export function needsReview(skill: PortfolioSkill, override?: AssessorOverride): boolean {
  if (override) return false;
  if (!isAssessed(skill)) return true;
  return skill.ai_confidence === "low" || skill.evidence.length === 0;
}

export interface PortfolioSummary {
  total: number;
  assessed: number;
  notAssessed: number;
  needsReview: number;
  overridden: number;
}

export function summarizePortfolio(
  skills: PortfolioSkill[],
  overrides: Record<number, AssessorOverride>
): PortfolioSummary {
  const configured = skills.filter((s) => !s.is_discovered);
  return {
    total: configured.length,
    assessed: configured.filter((s) => effectiveLevel(s, overrides[s.id]) !== null).length,
    notAssessed: configured.filter((s) => effectiveLevel(s, overrides[s.id]) === null).length,
    needsReview: configured.filter((s) => needsReview(s, overrides[s.id])).length,
    overridden: configured.filter((s) => overrides[s.id]).length,
  };
}

export const NOT_ASSESSED_COPY: Record<NotAssessedReason, { title: string; body: string }> = {
  never_reached: {
    title: "Not reached in the interview",
    body: "The interview ended before this skill came up, so there is no evidence either way. This is not a low score — plan a follow-up to assess it.",
  },
  model_omitted: {
    title: "Discussed, but not rated",
    body: "The candidate talked about this skill, but the AI did not return a rating. Read the transcript and add your own rating.",
  },
  invalid_level: {
    title: "AI rating was unusable",
    body: "The AI returned something that is not an L1–L5 level, so it was discarded. Read the transcript and add your own rating.",
  },
  not_in_interview: {
    title: "Not part of this interview",
    body: "This vacancy skill was not configured in the assessment, so the candidate was never asked about it.",
  },
};

export function notAssessedCopy(reason?: NotAssessedReason | null) {
  return NOT_ASSESSED_COPY[reason ?? "never_reached"] ?? NOT_ASSESSED_COPY.never_reached;
}

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
};

/** Why the confidence is what it is, in the assessor's terms. */
export function confidenceReason(skill: PortfolioSkill): string {
  const probes = skill.probe_count;
  const parts: string[] = [];
  if (probes != null) parts.push(`${probes} follow-up ${probes === 1 ? "question" : "questions"}`);
  if (skill.coverage_state) parts.push(`coverage: ${skill.coverage_state.replace("_", " ")}`);
  if (skill.evidence.length === 0) parts.push("no quote matched the transcript");
  return parts.length ? parts.join(" · ") : "Based on interview coverage";
}

/** Fit/gap rows from before `required_level` existed only have `expected_level`. */
export function requiredLevel(comparison: SkillComparison): number | null {
  return toLevel(comparison.required_level ?? comparison.expected_level ?? null);
}

export function comparisonNeedsReview(comparison: SkillComparison): boolean {
  if (comparison.needs_review != null) return comparison.needs_review;
  return comparison.result === "not_assessed" || (!comparison.is_override && comparison.confidence === "low");
}

export function summarizeComparisons(comparisons: SkillComparison[]) {
  const count = (r: SkillComparison["result"]) => comparisons.filter((c) => c.result === r).length;
  return {
    match: count("match"),
    exceed: count("exceed"),
    gap: count("gap"),
    notAssessed: count("not_assessed"),
    needsReview: comparisons.filter(comparisonNeedsReview).length,
  };
}

import type { EvaluationSkillSummary, EvaluationSummary } from "@/types";

export type AssessmentStatus = "assessed" | "partial" | "not_assessed";

export const ASSESSMENT_STATUS_LABEL: Record<AssessmentStatus, string> = {
  assessed: "Assessed",
  partial: "Partial",
  not_assessed: "Not assessed",
};

export const ASSESSMENT_STATUS_BADGE: Record<AssessmentStatus, string> = {
  assessed: "border-transparent bg-teal-600 text-white",
  partial: "border-transparent bg-amber-500 text-white",
  not_assessed: "border-transparent bg-neutral-400 text-white",
};

export function assessmentStatusOf(skill: EvaluationSkillSummary): AssessmentStatus {
  return skill.assessment_status ?? (skill.evidence?.length ? "assessed" : "not_assessed");
}

export function coveragePercent(summary?: EvaluationSummary | null): number {
  return summary?.coverage?.percent ?? 0;
}

export function isReady(summary?: EvaluationSummary | null): boolean {
  return summary?.overall_status === "ready_for_review";
}
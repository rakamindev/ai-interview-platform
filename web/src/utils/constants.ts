import type { SkillComparisonResult } from "@/types";

export const TIME_LIMIT_OPTIONS = [10, 30, 45, 60, 90] as const;

/** True only for an integer level 1–5. Anything else means "no level", never a default L1. */
export function isLevel(level: number | null | undefined): level is number {
  return typeof level === "number" && Number.isInteger(level) && level >= 1 && level <= 5;
}

export function levelLabel(level: number | null | undefined): string {
  return isLevel(level) ? `L${level}` : "Not assessed";
}

export const LEVEL_LABELS: Record<number, string> = {
  1: "L1",
  2: "L2",
  3: "L3",
  4: "L4",
  5: "L5",
};

export const LEVEL_DESCRIPTIONS: Record<number, string> = {
  1: "Foundational",
  2: "Functional",
  3: "Proficient",
  4: "Advanced",
  5: "Expert",
};

// Level badges: one teal ramp, light to dark. Grey is reserved for "not assessed",
// so L1 must never look neutral.
export const LEVEL_BADGE_CLASSES: Record<number, string> = {
  1: "bg-teal-50 text-teal-800 ring-1 ring-inset ring-teal-200",
  2: "bg-teal-100 text-teal-800",
  3: "bg-teal-200 text-teal-900",
  4: "bg-teal-600 text-white",
  5: "bg-teal-800 text-white",
};

// Coverage state display
export const COVERAGE_STATE_LABELS: Record<string, string> = {
  not_yet: "not yet",
  initiated: "initiated",
  partial: "partial",
  covered: "covered",
};

export const COVERAGE_STATE_WIDTH: Record<string, number> = {
  not_yet: 0,
  initiated: 25,
  partial: 60,
  covered: 100,
};

export const COVERAGE_STATE_COLOR: Record<string, string> = {
  not_yet: "bg-neutral-200",
  initiated: "bg-blue-300",
  partial: "bg-teal-400",
  covered: "bg-teal-600",
};

// Fit/Gap result display
export const FIT_GAP_RESULT_LABELS: Record<SkillComparisonResult, string> = {
  match: "Meets",
  exceed: "Exceeds",
  gap: "Below",
  not_assessed: "No evidence",
};

export const FIT_GAP_RESULT_CLASSES: Record<SkillComparisonResult, string> = {
  match: "text-evidence",
  exceed: "text-evidence",
  gap: "text-shortfall",
  not_assessed: "text-muted-foreground",
};

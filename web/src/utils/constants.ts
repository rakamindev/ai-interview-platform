export const TIME_LIMIT_OPTIONS = [10, 30, 45, 60, 90] as const;

/** Parse "L3" → 3, passthrough number, fallback to 1 */
export function parseLevel(level: string | number): number {
  if (typeof level === "number") return level;
  const n = parseInt(level.replace(/\D/g, ""), 10);
  return isNaN(n) ? 1 : n;
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

// L-badge colors (Tailwind classes)
export const LEVEL_BADGE_CLASSES: Record<number, string> = {
  1: "bg-neutral-200 text-neutral-700",
  2: "bg-blue-100 text-blue-700",
  3: "bg-teal-100 text-teal-700",
  4: "bg-purple-100 text-purple-700",
  5: "bg-yellow-100 text-yellow-700",
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
export const FIT_GAP_RESULT_LABELS: Record<string, string> = {
  match: "Match",
  gap: "Gap",
  exceed: "Exceeds",
  not_assessed: "Not assessed",
  additional: "Additional",
};

// not_assessed is deliberately neutral rather than amber. A gap is a finding
// about a candidate; an unassessed skill is the absence of one. Styling them
// alike invites an assessor to read "we never asked" as "they cannot do it".
export const FIT_GAP_RESULT_CLASSES: Record<string, string> = {
  match: "text-green-700 bg-green-50 ring-green-600/20",
  gap: "text-amber-700 bg-amber-50 ring-amber-600/20",
  exceed: "text-green-700 bg-green-50 ring-green-600/20",
  not_assessed: "text-neutral-600 bg-neutral-100 ring-neutral-500/20",
  additional: "text-sky-700 bg-sky-50 ring-sky-600/20",
};

export const ASSESSMENT_STATE_LABELS: Record<string, string> = {
  assessed: "Assessed",
  insufficient_evidence: "Insufficient evidence",
  not_probed: "Never discussed",
};

export const ASSESSMENT_STATE_EXPLANATIONS: Record<string, string> = {
  assessed: "Rated from evidence in the interview.",
  insufficient_evidence:
    "Discussed, but the exchange did not support a rating anyone could defend.",
  not_probed:
    "This skill was never raised during the interview, so there is no evidence to rate.",
};

export const CONFIDENCE_CLASSES: Record<string, string> = {
  high: "text-green-700 bg-green-50",
  medium: "text-amber-700 bg-amber-50",
  low: "text-red-700 bg-red-50",
};

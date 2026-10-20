export const TIME_LIMIT_OPTIONS = [10, 30, 45, 60, 90] as const;

/**
 * Reads a level from the API: 3, "3" and "L3" give 3. Anything that isn't a whole level from 1 to 5
 * gives null, which means "not assessed". Never guess a level: an unreadable value used to become L1
 * (Step 3, P0-1), and a missing one crashed the portfolio page (P2-11).
 */
export function parseLevel(level: unknown): number | null {
  if (typeof level === "number") return Number.isInteger(level) && level >= 1 && level <= 5 ? level : null;
  if (typeof level !== "string") return null;
  const match = /^\s*L?([1-5])\s*$/i.exec(level);
  return match ? Number(match[1]) : null;
}

// Plain-language reasons a skill has no level (AC-22, AC-25). Wording matches the API's PDF export.
export const NOT_ASSESSED_REASON_LABELS: Record<string, string> = {
  not_reached: "Not reached before the interview ended",
  insufficient_evidence: "Not enough evidence to rate",
  omitted_by_model: "Missing from the AI's output",
  not_in_assessment: "Not part of this interview",
};

// How a session ended, for the portfolio summary. "all_covered" is left out on purpose: anyone with
// the invite link can send it (Step 3, P1-10), so it's never repeated as a fact.
export const END_REASON_LABELS: Record<string, string> = {
  manual_candidate: "ended by the candidate",
  manual_assessor: "ended by the assessor",
  time_ceiling: "time limit reached",
  error: "ended by a connection error",
};

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
};

export const FIT_GAP_RESULT_CLASSES: Record<string, string> = {
  match: "text-green-700 bg-green-50",
  gap: "text-amber-700 bg-amber-50",
  exceed: "text-green-700 bg-green-50",
  not_assessed: "text-neutral-500 bg-neutral-50",
};

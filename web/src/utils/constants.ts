export const TIME_LIMIT_OPTIONS = [10, 30, 45, 60, 90] as const;

/**
 * Parse 3 or "L3" → 3. Anything outside L1–L5 returns null: a missing or malformed rating
 * must be shown as unrated, never converted into a low level.
 */
export function parseLevel(level: string | number | null | undefined): number | null {
  const n =
    typeof level === "number" ? level : parseInt(String(level ?? "").replace(/\D/g, ""), 10);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
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

// L-badge colors (Tailwind classes), an increasing ramp built from the brand palette
export const LEVEL_BADGE_CLASSES: Record<number, string> = {
  1: "bg-rakamin-gray/15 text-rakamin-charcoal",
  2: "bg-rakamin-light-cyan text-rakamin-dark-teal",
  3: "bg-rakamin-teal/20 text-rakamin-dark-teal",
  4: "bg-rakamin-dark-teal text-rakamin-white",
  5: "bg-rakamin-yellow text-rakamin-charcoal",
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
  not_yet: "bg-rakamin-gray/30",
  initiated: "bg-rakamin-teal/40",
  partial: "bg-rakamin-teal",
  covered: "bg-rakamin-dark-teal",
};

// Fit/Gap result display
export const FIT_GAP_RESULT_LABELS: Record<string, string> = {
  match: "Match",
  gap: "Gap",
  exceed: "Exceeds",
  not_assessed: "Not assessed",
};

export const FIT_GAP_RESULT_CLASSES: Record<string, string> = {
  match: "text-green-800 bg-green-50",
  gap: "text-rakamin-charcoal bg-rakamin-yellow/30",
  exceed: "text-rakamin-dark-teal bg-rakamin-light-cyan",
  not_assessed: "text-rakamin-charcoal bg-rakamin-gray/15",
};

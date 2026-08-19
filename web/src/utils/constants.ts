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

// L-badge colors: neutral → teal ramp (matches brand hue) → brand secondary at the top tier.
// Each pair is pre-verified for light/dark contrast (Tailwind's own teal-950/teal-300 combo).
export const LEVEL_BADGE_CLASSES: Record<number, string> = {
  1: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
  2: "bg-teal-100 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300",
  3: "bg-primary/15 text-primary dark:bg-primary/25 dark:text-teal-300",
  4: "bg-teal-700 text-white dark:bg-teal-600 dark:text-white",
  5: "bg-secondary text-secondary-foreground",
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

// Progress fill colors — same teal ramp as LEVEL_BADGE_CLASSES for a coherent progression.
export const COVERAGE_STATE_COLOR: Record<string, string> = {
  not_yet: "bg-neutral-300 dark:bg-neutral-700",
  initiated: "bg-teal-300 dark:bg-teal-700",
  partial: "bg-teal-400 dark:bg-teal-500",
  covered: "bg-teal-600 dark:bg-teal-400",
};

// Fit/Gap result display
export const FIT_GAP_RESULT_LABELS: Record<string, string> = {
  match: "Match",
  gap: "Gap",
  exceed: "Exceeds",
  not_assessed: "Not assessed",
};

// Semantic status colors (universal green/amber, not brand-derived) — pass/fail/warning
// needs to read instantly, so intentionally kept outside the teal ramp above.
export const FIT_GAP_RESULT_CLASSES: Record<string, string> = {
  match: "text-green-700 bg-green-50 dark:bg-green-950/40 dark:text-green-400",
  gap: "text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400",
  exceed: "text-green-700 bg-green-50 dark:bg-green-950/40 dark:text-green-400",
  not_assessed: "text-neutral-500 bg-neutral-50 dark:bg-neutral-800/60 dark:text-neutral-400",
};
